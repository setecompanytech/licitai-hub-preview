import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { credencialEmClaro } from "../_shared/credenciais-cifra.ts";
import { portalDoAgente } from "../_shared/robo-portais.ts";
import { instalarCertificadoNoAgente } from "../_shared/certificado-agente.ts";
import {
  resolverAcao,
  erroDeColunaAusente,
  ehAgenteGerenciado,
  chaveParaOAgente,
} from "../_shared/robo-acao.ts";

/**
 * O que da configuração do agente pode sair desta função para o navegador.
 *
 * Tudo, MENOS `api_key_hash` — que, apesar do nome, é a chave em claro usada em
 * `X-Agent-Key` e conferida no `callback`. Devolvê-la ao navegador era entregar
 * a quem abrisse o DevTools o poder de forjar callbacks de sessão.
 */
const COLUNAS_PUBLICAS_DO_AGENTE =
  "id, user_id, nome, url_base, status, ultimo_heartbeat, versao_agente, capacidades, " +
  "max_sessoes_paralelas, sessoes_ativas, ram_mb, created_at, updated_at";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  // A chave do agente gerenciado mora SÓ aqui, como segredo da edge function.
  // Ver `configurar-agente` e `chaveParaOAgente` (_shared/robo-acao.ts).
  const chaveGerenciada = Deno.env.get("AGENTE_API_KEY") || null;

  try {
    const url = new URL(req.url);

    // Corpo vazio ou malformado não pode virar 500 antes de se saber a ação.
    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};

    // Path: /robo-lances-webhook/{action}. O `action` do corpo só vale quando a
    // URL termina no nome da função — a forma que três telas usavam e que
    // respondia 404 "Ação desconhecida" (ver _shared/robo-acao.ts).
    const action = resolverAcao(url.pathname, body);

    // ─── ACTIONS FROM THE FRONTEND (authenticated user) ───

    if (action === "configurar-agente") {
      // Save/update external agent config
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }

      const { url_base, nome, api_key, max_sessoes_paralelas } = body;
      if (!url_base || typeof url_base !== "string") {
        return jsonResponse({ error: "url_base é obrigatório" }, 400);
      }
      const urlBase = url_base.trim().replace(/\/+$/, "");
      try {
        new URL(urlBase);
      } catch {
        return jsonResponse({ error: `"${urlBase}" não é um endereço válido para o agente.` }, 400);
      }

      // ── A CHAVE DO AGENTE GERENCIADO NÃO PASSA PELO NAVEGADOR ─────────────
      //
      // Até 14/09/2026 a tela mandava a chave do Agente Cloud no corpo desta
      // chamada — escrita como constante em AgenteExternoConfig.tsx, ou seja,
      // dentro do JavaScript público. É a mesma chave que o `callback` confere:
      // qualquer pessoa com o bundle podia forjar eventos de sessão.
      //
      // Agora, para o agente gerenciado, a chave é o segredo `AGENTE_API_KEY`
      // desta função, e o que vier em `api_key` é ignorado. Sem o segredo, a
      // resposta é 503 — inventar uma chave aqui gravaria um agente que nunca
      // conversaria com a VPS, e a tela mostraria "configurado" para um robô
      // mudo.
      //
      // Agente próprio (outro endereço) segue com a chave que o dono cadastra:
      // é a chave DELE, para o servidor DELE.
      let chave: string | null;
      if (ehAgenteGerenciado(urlBase)) {
        if (!chaveGerenciada) {
          return jsonResponse(
            {
              error: "O Agente Cloud ainda não pode ser ativado: a chave do serviço não está " +
                     "configurada no servidor (segredo AGENTE_API_KEY da edge function). " +
                     "Nada foi gravado. Avise o suporte da plataforma.",
            },
            503
          );
        }
        chave = chaveGerenciada;
      } else {
        chave = typeof api_key === "string" && api_key ? api_key : null;
      }

      const { data, error } = await supabase
        .from("agente_externo_config")
        .upsert(
          {
            user_id: user.id,
            nome: nome || "Agente Principal",
            url_base: urlBase,
            api_key_hash: chave,
            status: "verificando",
            max_sessoes_paralelas: max_sessoes_paralelas || 3,
          },
          { onConflict: "user_id,nome" }
        )
        // Colunas explícitas: a resposta volta ao navegador e não leva a chave.
        .select(COLUNAS_PUBLICAS_DO_AGENTE)
        .single();

      if (error) throw error;

      // Try to ping the agent
      try {
        const pingResp = await fetch(`${urlBase}/health`, {
          method: "GET",
          headers: { "X-Agent-Key": chave || "" },
          signal: AbortSignal.timeout(5000),
        });
        const agentStatus = pingResp.ok ? "ativo" : "erro";
        const pingData = pingResp.ok ? await pingResp.json().catch(() => ({})) : {};

        await supabase
          .from("agente_externo_config")
          .update({
            status: agentStatus,
            ultimo_heartbeat: new Date().toISOString(),
            versao_agente: pingData.version || null,
            capacidades: pingData.capabilities || [],
            sessoes_ativas: pingData.capacidade?.sessoes_ativas || pingData.sessoes_ativas || 0,
            ram_mb: pingData.capacidade?.ram_total_mb || null,
          })
          .eq("id", data.id);

        data.status = agentStatus;
      } catch {
        await supabase
          .from("agente_externo_config")
          .update({ status: "offline" })
          .eq("id", data.id);
        data.status = "offline";
      }

      return jsonResponse({ success: true, agente: data });
    }

    if (action === "enviar-sessao") {
      // Send a bid session to the external agent
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }

      // Get agent config
      //
      // NAO usar `.single()` aqui. O `configurar-agente` faz upsert com
      // `onConflict: "user_id,nome"`, e o nome carrega o plano ("Agente Cloud —
      // Enterprise", "— Profissional"). Trocar de plano cria uma linha NOVA em
      // vez de atualizar a existente, entao o mesmo usuario pode ter duas
      // configuracoes ativas — e `.single()` falha com mais de uma linha,
      // devolvendo `data: null`.
      //
      // O efeito era cruel: o Checklist de Ativacao usa `.find()`, achava a
      // primeira e mostrava "Agente Externo Configurado" em VERDE, enquanto o
      // envio da sessao respondia "Nenhum agente ativo configurado". A tela
      // dizia uma coisa e o botao fazia outra.
      //
      // Pega o mais recentemente atualizado, que e o criterio que a pessoa
      // espera: o agente que ela configurou por ultimo.
      const { data: agentesAtivos, error: erroAgente } = await supabase
        .from("agente_externo_config")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .order("updated_at", { ascending: false });

      if (erroAgente) {
        return jsonResponse(
          { error: `Não foi possível ler a configuração do agente: ${erroAgente.message}` },
          500
        );
      }

      const agente = agentesAtivos?.[0];

      if (!agente) {
        return jsonResponse(
          { error: "Nenhum agente ativo configurado. Configure um agente externo primeiro." },
          400
        );
      }

      // O PORTAL DA TELA NAO E O PORTAL DO AGENTE.
      //
      // O id que a interface usa (`compras-gov`) e o nome do modulo no agente
      // (`comprasgov`) sao vocabularios diferentes, e ninguem traduzia. O envio
      // seguia inteiro — validava, gravava a sessao com status "enviando", fazia
      // o POST — e so o agente reclamava, com `Portal "compras-gov" nao
      // suportado`. Sobrava linha no banco para um trabalho que nunca comecou.
      //
      // Recusar aqui, antes de qualquer escrita, custa uma consulta a um objeto
      // em memoria.
      const portalAgente = portalDoAgente(body.portal_id);
      if (!portalAgente) {
        return jsonResponse(
          {
            error: `"${body.portal_nome || body.portal_id}" não é um portal que o robô ` +
                   `conhece. Escolha a disputa novamente pelo seletor de portais.`,
          },
          400
        );
      }

      // A CREDENCIAL VEM ANTES DA SESSAO.
      //
      // O codigo anterior mandava `credenciais_portal: body.credenciais_portal_id`
      // — o IDENTIFICADOR da credencial — para um agente que espera um objeto
      // com login e senha (`this.credenciais.login` nos modulos de portal).
      // Ninguem buscava nem decifrava no meio do caminho, entao o robo recebia
      // `undefined` nos dois campos e tentaria entrar no portal sem senha.
      //
      // A busca acontece aqui em cima, e nao depois do insert, para nao deixar
      // linha orfa com status "enviando" quando a credencial nao existe.
      let credenciais;
      try {
        credenciais = await credencialEmClaro(supabase, user.id, body.portal_id);
      } catch (e: any) {
        return jsonResponse(
          { error: `Não foi possível ler a credencial do portal: ${e.message}` },
          500
        );
      }

      if (!credenciais) {
        return jsonResponse(
          {
            error: `Nenhuma credencial ativa cadastrada para "${body.portal_nome || body.portal_id}". ` +
                   `Cadastre em Robô de Lances → Portais antes de enviar a sessão.`,
          },
          400
        );
      }

      // O ROBO NAO ENTRA CEGO.
      //
      // Ate 09/09/2026 o que atravessava era `edital` (string) e tres valores
      // da disputa inteira. Num pregao com 40 itens o agente achava o processo
      // e nao sabia em qual item estava — e seguia assim mesmo, sem que nada
      // na tela denunciasse.
      //
      // A recusa fica ANTES do insert: sessao gravada com status "enviando"
      // para um trabalho que nunca deveria comecar e o mesmo tipo de linha
      // orfa que a busca de credencial ja evita mais acima.
      const itens = Array.isArray(body.itens) ? body.itens : [];
      if (itens.length === 0) {
        return jsonResponse(
          {
            error: `A disputa "${body.edital}" foi enviada sem nenhum item. ` +
                   `O robô precisa saber o que disputar dentro do processo — ` +
                   `abra a disputa, importe os itens do processo e envie de novo.`,
          },
          400
        );
      }

      // Create session record
      const sessaoData = {
        user_id: user.id,
        lance_config_id: body.lance_config_id,
        licitacao_id: body.licitacao_id ?? null,
        tipo_disputa: body.tipo_disputa ?? null,
        portal_id: body.portal_id,
        portal_nome: body.portal_nome,
        edital: body.edital,
        valor_referencia: body.valor_referencia,
        valor_inicial: body.valor_inicial,
        valor_minimo: body.valor_minimo,
        decremento_min: body.decremento_min,
        decremento_percentual: body.decremento_percentual,
        intervalo_segundos: body.intervalo_segundos || 30,
        max_lances: body.max_lances || 20,
        modo: "real",
        status: "enviando",
        agente_id: agente.id,
      };

      const { data: sessao, error: sessErr } = await supabase
        .from("sessoes_lance_real")
        .insert(sessaoData)
        .select()
        .single();

      if (sessErr) throw sessErr;

      // OS ITENS DA SESSAO, COM OS TRES VALORES SEPARADOS.
      //
      // `preco_venda`, `custo_unitario` e `valor_estimado_orgao` sao colunas
      // diferentes de proposito. Colapsados num campo so — que era o estado
      // anterior — o teto do orgao, o nosso preco e um custo interno viram
      // todos "R$ alguma coisa", e depois de gravado nao da para saber qual
      // deles estava ancorando a disputa.
      //
      // `?? null` em vez de `|| 0` em todos: nulo aqui significa "nao sabido",
      // e zero seria uma afirmacao falsa sobre dinheiro — do tipo que ninguem
      // confere justamente porque parece preenchida.
      // Vínculo estável com o item do processo (`licitacao_itens.id`), quando a
      // disputa o trouxe. Id que não existe mais — a re-extração do edital apaga
      // e recria os itens — vira nulo em vez de derrubar a sessão por FK; o
      // casamento cai para lote + número, que é o que havia antes.
      const idDoItem = (i: Record<string, unknown>) => {
        const v = i.licitacao_item_id ?? i.licitacaoItemId;
        return typeof v === "string" && v.length > 0 ? v : null;
      };
      const idsInformados = [...new Set(itens.map(idDoItem).filter(Boolean))] as string[];
      const idsValidos = new Set<string>();
      if (idsInformados.length) {
        const { data: existentes } = await supabase.from("licitacao_itens").select("id").in("id", idsInformados);
        (existentes || []).forEach((r: { id: string }) => idsValidos.add(r.id));
      }

      const itensDaSessao = itens.map((i: Record<string, unknown>, idx: number) => ({
        sessao_id: sessao.id,
        user_id: user.id,
        empresa_id: body.empresa_id ?? null,
        licitacao_item_id: idsValidos.has(idDoItem(i) ?? '') ? idDoItem(i) : null,
        numero: Number(i.numero) || idx + 1,
        lote: i.lote ?? null,
        descricao: String(i.descricao || ''),
        marca: i.marca ?? null,
        modelo: i.modelo ?? null,
        quantidade: Number(i.quantidade) || 1,
        unidade: i.unidade || 'UN',
        preco_venda: i.preco_venda ?? null,
        custo_unitario: i.custo_unitario ?? null,
        valor_estimado_orgao: i.valor_estimado_orgao ?? null,
        valor_minimo: i.valor_minimo ?? null,
        origem: i.origem ?? null,
        situacao: 'aguardando',
      }));

      const { error: itensErr } = await supabase
        .from("sessao_lance_itens")
        .insert(itensDaSessao);

      // Falha silenciosa e proibida (principio 3): sem os itens gravados, a
      // sessao seguiria e ninguem saberia por que o robo nao sabe o que
      // disputar. Recusar aqui deixa a sessao marcada com a causa.
      if (itensErr) {
        await supabase
          .from("sessoes_lance_real")
          .update({ status: "erro", erro: `Itens da disputa nao gravados: ${itensErr.message}` })
          .eq("id", sessao.id);

        return jsonResponse(
          {
            error: `A sessão foi criada mas os itens da disputa não foram gravados ` +
                   `(${itensErr.message}). O robô não foi acionado.`,
          },
          500
        );
      }

      // Log the outgoing webhook
      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "enviar-sessao",
        payload: { sessao_id: sessao.id, ...sessaoData },
      });

      // Forward to external agent
      try {
        const agentResp = await fetch(`${agente.url_base}/sessao/iniciar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
            "X-Callback-URL": `${supabaseUrl}/functions/v1/robo-lances-webhook/callback`,
          },
          body: JSON.stringify({
            sessao_id: sessao.id,
            ...sessaoData,
            // DEPOIS do spread de proposito: `sessaoData.portal_id` guarda o id
            // da tela, que e o que fica no banco e casa com a credencial. O
            // agente precisa do nome do modulo dele. Sao campos com o mesmo nome
            // e significados diferentes — inverter as duas linhas quebra o envio
            // em Compras.gov e em nenhum outro portal, que e o tipo de defeito
            // que so aparece em producao.
            portal_id: portalAgente,
            // login e senha em claro — e o que o modulo do portal consome
            credenciais_portal: credenciais,
            // UASG (Compras.gov): desambigua o numero da compra, que se repete
            // entre orgaos. Fora do sessaoData de proposito — nao e coluna da
            // sessao, e assim o envio nao depende de migration.
            uasg: body.uasg ?? null,
            // O ALVO DENTRO DO PROCESSO.
            //
            // `sessaoData` ja leva `tipo_disputa`; os itens vao aqui porque
            // nao sao coluna da sessao — moram em `sessao_lance_itens`. Sem
            // eles o agente sabe entrar no processo e nao sabe o que disputar
            // la dentro.
            itens: itensDaSessao.map((i) => ({
              numero: i.numero,
              lote: i.lote,
              descricao: i.descricao,
              marca: i.marca,
              modelo: i.modelo,
              quantidade: i.quantidade,
              unidade: i.unidade,
              preco_venda: i.preco_venda,
              custo_unitario: i.custo_unitario,
              valor_estimado_orgao: i.valor_estimado_orgao,
              valor_minimo: i.valor_minimo,
            })),
          }),
          // 10s era MENOS que o trabalho pedido. O agente so responde depois
          // de abrir o Chrome, fazer login e navegar ate a disputa — nos logs
          // de 08/09 isso levou 12s so para FALHAR o login. A edge function
          // abortava antes, devolvia "Agente inacessivel" e o usuario via erro
          // enquanto o robo entrava no portal com sucesso: o pior tipo de
          // mentira, a que desmente algo que deu certo.
          //
          // 60s cobre o caminho inteiro com folga. O conserto de fundo e o
          // agente responder na hora e seguir a sessao em segundo plano —
          // anotado em docs/agente-cloud-pendencias.md.
          signal: AbortSignal.timeout(60000),
        });

        const agentData = await agentResp.json().catch(() => ({}));

        if (agentResp.ok) {
          await supabase
            .from("sessoes_lance_real")
            .update({ status: "ativo" })
            .eq("id", sessao.id);
          sessao.status = "ativo";
        } else {
          await supabase
            .from("sessoes_lance_real")
            .update({ status: "erro", erro: agentData.error || "Erro no agente" })
            .eq("id", sessao.id);
          sessao.status = "erro";
          sessao.erro = agentData.error;
        }

        return jsonResponse({ success: true, sessao });
      } catch (e: any) {
        await supabase
          .from("sessoes_lance_real")
          .update({ status: "erro", erro: e.message })
          .eq("id", sessao.id);

        return jsonResponse({ success: false, error: `Agente inacessível: ${e.message}` }, 502);
      }
    }

    // ─── CALLBACKS FROM THE EXTERNAL AGENT ───

    if (action === "callback") {
      // The agent sends updates here
      const agentKey = req.headers.get("x-agent-key");
      const { sessao_id, tipo, payload } = body;

      if (!sessao_id || !tipo) {
        return jsonResponse({ error: "sessao_id e tipo são obrigatórios" }, 400);
      }

      // Verify session exists
      const { data: sessao } = await supabase
        .from("sessoes_lance_real")
        .select("*, agente_externo_config!inner(api_key_hash, user_id, url_base)")
        .eq("id", sessao_id)
        .single();

      if (!sessao) {
        return jsonResponse({ error: "Sessão não encontrada" }, 404);
      }

      // Validate agent key
      //
      // Agente gerenciado: vale o segredo AGENTE_API_KEY, não a linha — a
      // chave antiga gravada no banco estava no bundle público.
      const expectedKey = chaveParaOAgente((sessao as any).agente_externo_config, chaveGerenciada);
      if (!expectedKey || agentKey !== expectedKey) {
        return jsonResponse({ error: "Chave do agente inválida" }, 403);
      }

      const userId = (sessao as any).agente_externo_config?.user_id || sessao.user_id;

      // Log incoming webhook
      await supabase.from("webhook_log").insert({
        user_id: userId,
        direcao: "entrada",
        tipo,
        payload: body,
      });

      // Process callback types
      switch (tipo) {
        case "lance-enviado": {
          // Agent successfully sent a bid
          const { rodada, valor, tipo_lance } = payload;
          await supabase.from("lances_historico").insert({
            user_id: userId,
            sessao_id,
            rodada,
            valor,
            tipo: tipo_lance || "meu",
            origem: "real",
            metadata: payload.metadata || {},
          });
          await supabase
            .from("sessoes_lance_real")
            .update({
              valor_atual: valor,
              rodada_atual: rodada,
              status: "ativo",
            })
            .eq("id", sessao_id);
          break;
        }

        case "lance-concorrente": {
          // Competitor bid detected
          const { rodada, valor } = payload;
          await supabase.from("lances_historico").insert({
            user_id: userId,
            sessao_id,
            rodada,
            valor,
            tipo: "concorrente",
            origem: "real",
            metadata: payload.metadata || {},
          });
          await supabase
            .from("sessoes_lance_real")
            .update({ valor_atual: valor, rodada_atual: rodada })
            .eq("id", sessao_id);
          break;
        }

        case "sessao-encerrada": {
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "encerrado",
              resultado: payload.resultado || "finalizado",
              valor_atual: payload.valor_final,
            })
            .eq("id", sessao_id);

          // ── O PROCESSO FICA SABENDO, SEM NINGUÉM CLICAR ──────────────────
          //
          // Até aqui a sessão terminava e o processo no Kanban não registrava
          // nada. O único caminho era alguém abrir o Robô de Lances e apertar
          // um botão (`registrarResultadoDisputa`, RoboLances.tsx) — e quem
          // acabou de acompanhar um pregão raramente volta para fazer isso.
          //
          // O QUE ESTE BLOCO NÃO FAZ, E POR QUÊ: não marca "Vencida" nem
          // "Perdida". O agente manda `resultado: 'finalizado'` ou
          // 'parada_emergencial' — ele não tem como saber quem venceu, e
          // `valor_final` é o valor configurado, não um desfecho (com a trava
          // ligada nenhum lance chega a ser enviado). Escrever um resultado a
          // partir disso seria inventar dado.
          //
          // Além disso, derrota exige motivo registrado em `comercial_perdas`:
          // um trigger recusa a mudança de status sem ele. Tentar aqui daria
          // erro de banco num callback que ninguém está olhando.
          //
          // Então o que se grava é o que se sabe: a sessão acabou, com quantas
          // rodadas e de que jeito. Quem decide o resultado é gente.
          if (sessao.licitacao_id) {
            const emergencia = payload.resultado === "parada_emergencial";
            const rodadas = payload.total_rodadas ?? 0;

            await supabase.from("licitacao_mensagens").insert({
              licitacao_id: sessao.licitacao_id,
              user_id: userId,
              tipo: "sistema",
              conteudo: emergencia
                ? `🛑 **Sessão do robô interrompida** em ${sessao.edital} ` +
                  `(${sessao.portal_nome}) após ${rodadas} rodada(s). ` +
                  `A parada foi acionada por uma pessoa. O resultado da disputa ainda precisa ser registrado.`
                : `🏁 **Sessão do robô encerrada** em ${sessao.edital} ` +
                  `(${sessao.portal_nome}) após ${rodadas} rodada(s). ` +
                  `O robô acompanha e não envia lance — o resultado da disputa ainda precisa ser registrado.`,
            });

            // O aviso vai para quem disparou. `notificacoes` é a mesma tabela
            // que o resto do produto usa (quatro escritores), então o sino do
            // cabeçalho já a mostra sem tela nova.
            await supabase.from("notificacoes").insert({
              user_id: userId,
              tipo: emergencia ? "alerta" : "info",
              titulo: emergencia
                ? `🛑 Robô interrompido — ${sessao.edital}`
                : `🏁 Robô encerrou — ${sessao.edital}`,
              mensagem:
                `A sessão em ${sessao.portal_nome} terminou após ${rodadas} rodada(s). ` +
                `Abra o processo para registrar como a disputa terminou.`,
              link: `/processo/${sessao.licitacao_id}`,
            });
          }
          break;
        }

        // ─── O PREGOEIRO FALOU ───────────────────────────────────────────
        //
        // A maior falta apontada pelo cliente: "após a fase de lances vem o
        // acompanhamento, ele dispara um alerta toda vez que a empresa é
        // convocada".
        //
        // POR QUE `licitacao_mensagens` E NAO `agent_chat_monitor`:
        // a segunda tem chave estrangeira para `agent_licitacoes`, que e a
        // tabela do modulo de prospeccao — outro universo. A sessao do robo
        // carrega `licitacao_id` de `licitacoes`, entao o banco recusaria a
        // linha. E `licitacao_mensagens` ja e lida pelo `LicitacaoChat`, que
        // ja tem realtime e ja toca som quando o tipo e "alerta".
        //
        // Ou seja: o alerta que faltava nao precisava de tela nova nem de
        // cron. Precisava de alguem escrevendo na tabela certa.
        case "mensagem-pregoeiro": {
          const mensagens = Array.isArray(payload.mensagens) ? payload.mensagens : [];
          if (!sessao.licitacao_id || mensagens.length === 0) break;

          // O que faz o som tocar. "Convocada", "diligencia", "documento" e
          // "prazo" sao chamados que exigem acao de gente; o resto e conversa
          // da sala e entra sem alarme — alerta em tudo deixa de ser alerta.
          const PEDE_ACAO = /convocad|convoca[çc][ãa]o|dilig[êe]ncia|habilita[çc][ãa]o|documento|prazo|apresent|envie|anexe|recurso|negocia/i;

          for (const m of mensagens) {
            const texto = String(m.texto || "").slice(0, 2000);
            if (!texto) continue;
            const urgente = PEDE_ACAO.test(texto);
            const autor = String(m.autor || "Pregoeiro").slice(0, 80);

            await supabase.from("licitacao_mensagens").insert({
              licitacao_id: sessao.licitacao_id,
              user_id: userId,
              // "alerta" e o tipo que o LicitacaoChat sonoriza. Usado so
              // quando o texto pede acao — ver PEDE_ACAO acima.
              tipo: urgente ? "alerta" : "sistema",
              conteudo: `💬 **${autor}** (${sessao.portal_nome}): ${texto}`,
              // O dado cru fica aqui: o conteudo e para ler, o metadata e para
              // consultar depois sem reprocessar texto.
              metadata: {
                origem: "portal",
                portal: sessao.portal_id,
                edital: sessao.edital,
                sessao_id,
                mensagem_id: m.id ?? null,
                remetente: autor,
                requer_acao: urgente,
              },
            });

            if (urgente) {
              await supabase.from("notificacoes").insert({
                user_id: userId,
                tipo: "urgente",
                titulo: `⚠️ O pregoeiro chamou — ${sessao.edital}`,
                mensagem: texto.slice(0, 200),
                link: `/processo/${sessao.licitacao_id}`,
              });
            }
          }
          break;
        }

        case "erro": {
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "erro",
              erro: payload.mensagem || "Erro desconhecido",
            })
            .eq("id", sessao_id);
          break;
        }

        // O robo avisa CADA rodada em que decidiu nao dar lance, com o motivo.
        // O Praefectus respondia 400 "tipo desconhecido" e o agente registrava
        // "Callback falhou" — 12 avisos descartados em 6 minutos, na sessao de
        // 08/09 as 23:13. Nada quebrava, e era justamente a informacao que
        // provaria que o robo estava vivo e trabalhando.
        //
        // O corpo ja estava sendo gravado em `webhook_log` (o insert acontece
        // antes deste switch), entao o historico nao se perdeu — o que faltava
        // era a sessao refletir a rodada, que e o que a tela le.
        // ─── A CONFERENCIA DOS ITENS CONTRA O PORTAL ─────────────────────
        //
        // A tela monta os itens do NOSSO lado (Precificacao, Proposta,
        // extracao do edital) e nada disso conversa com o portal. Um numero
        // errado so apareceria durante o pregao, quando nao ha mais o que
        // fazer.
        //
        // So grava quando ha o que dizer: conferencia que bate nao vira
        // mensagem. Mural cheio de "esta tudo certo" e mural que ninguem le,
        // e ai o aviso que importa passa junto.
        case "itens-conferidos": {
          if (!sessao.licitacao_id) break;
          const { leu, ok, resumo, faltando, divergencias, total_no_portal, com_valor_referencia } = payload;
          if (leu && ok) break;

          const linhas: string[] = [];
          if (!leu) {
            linhas.push(
              `Não foi possível ler a lista de itens do portal para conferir o que enviamos. ` +
              `Isso não impede a sessão — apenas não houve conferência.`
            );
          } else {
            if (Array.isArray(faltando) && faltando.length) {
              linhas.push(
                `**${faltando.length} item(ns) que enviamos não existem neste processo** ` +
                `(nº ${faltando.slice(0, 10).join(', ')}). O robô não teria o que acompanhar neles.`
              );
            }
            if (Array.isArray(divergencias) && divergencias.length) {
              linhas.push(
                `**${divergencias.length} item(ns) com valor de referência diferente** do publicado: ` +
                divergencias.slice(0, 5).map((d: { numero: number; nosso: number; portal: number }) =>
                  `nº ${d.numero} (nosso R$ ${d.nosso} × portal R$ ${d.portal})`).join('; ')
              );
            }
            // O contexto que evita a leitura errada de "nenhuma divergencia":
            // edital sem estimado publicado nao foi conferido, foi ignorado.
            if (total_no_portal && com_valor_referencia === 0) {
              linhas.push(
                `Observação: o portal listou ${total_no_portal} item(ns) e nenhum com valor de ` +
                `referência publicado — a conferência de valores não teve o que comparar.`
              );
            }
          }

          if (!linhas.length) break;

          await supabase.from("licitacao_mensagens").insert({
            licitacao_id: sessao.licitacao_id,
            user_id: userId,
            // "alerta" para item inexistente, que e defeito de cadastro e
            // custa a disputa; "sistema" para o resto, que e contexto.
            tipo: Array.isArray(faltando) && faltando.length ? "alerta" : "sistema",
            conteudo:
              `🔎 **Conferência dos itens em ${sessao.edital}** (${sessao.portal_nome})\n\n` +
              linhas.map((l) => `• ${l}`).join('\n'),
            metadata: {
              origem: "conferencia-itens",
              sessao_id,
              edital: sessao.edital,
              resumo: resumo ?? null,
              total_no_portal: total_no_portal ?? null,
            },
          });

          if (Array.isArray(faltando) && faltando.length) {
            await supabase.from("notificacoes").insert({
              user_id: userId,
              tipo: "urgente",
              titulo: `🔎 Itens não conferem — ${sessao.edital}`,
              mensagem: `${faltando.length} item(ns) enviados ao robô não existem neste processo do portal.`,
              link: `/processo/${sessao.licitacao_id}`,
            });
          }
          break;
        }

        case "rodada-sem-lance": {
          const { rodada } = payload;
          await supabase
            .from("sessoes_lance_real")
            .update({
              rodada_atual: rodada ?? null,
              // Toca o updated_at: e ele que diz "esta sessao deu sinal agora".
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessao_id);
          break;
        }

        case "heartbeat": {
          if (sessao.agente_id) {
            await supabase
              .from("agente_externo_config")
              .update({ ultimo_heartbeat: new Date().toISOString() })
              .eq("id", sessao.agente_id);
          }
          break;
        }

        default:
          return jsonResponse({ error: `Tipo de callback desconhecido: ${tipo}` }, 400);
      }

      return jsonResponse({ success: true, received: tipo });
    }

    // ─── KILL SWITCH ───

    // Parar UMA sessão, sem derrubar as outras.
    //
    // O kill-switch existia, e mata tudo. Faltava o freio preciso: em
    // 09/09/2026 uma sessão travada teve que ser encerrada por `curl` na VPS,
    // porque nenhuma tela oferecia isso. Freio que só existe no terminal não é
    // freio para quem opera.
    //
    // ── EM DOIS TEMPOS, E SÓ O SEGUNDO É "PARADO" (14/09/2026) ──────────────
    //
    // A versão anterior gravava `status: 'encerrado'` mesmo quando NENHUM
    // agente confirmava — e aceitava o `sessao_id` de qualquer usuário logado.
    // A lista passava a dizer "Encerrada" para um robô que talvez seguisse no
    // portal. Agora:
    //
    //   1. autoriza: quem iniciou a sessão, ou admin/operador da empresa dela;
    //   2. grava a LÁPIDE (`parada_solicitada_em/_por`) ANTES de chamar o
    //      agente — princípio 3: se a função cair no meio, o pedido fica;
    //   3. `encerrado` + `parada_confirmada_em` só com resposta 2xx de um agente;
    //   4. sem confirmação, o status fica como está e a sessão ganha a nota das
    //      tentativas — a tela diz "aguardando confirmação", nunca "parado".
    //
    // Parar o robô não cancela lance que o portal já aceitou.
    //
    // Sem a migration 20260914000002 as colunas da parada não existem: a função
    // grava só status/erro, como antes, e avisa em `observacoes`. O freio nunca
    // espera a contabilidade.
    if (action === "parar-sessao") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) return jsonResponse({ error: "Token inválido" }, 401);

      const { sessao_id } = body;
      if (!sessao_id) return jsonResponse({ error: "sessao_id é obrigatório" }, 400);

      // `select("*")` de propósito: com ou sem a migration nova a leitura não
      // falha por coluna ausente — `empresa_id` só vem `undefined`.
      const { data: sessao, error: erroSessao } = await supabase
        .from("sessoes_lance_real")
        .select("*")
        .eq("id", sessao_id)
        .maybeSingle();
      if (erroSessao) {
        return jsonResponse({ error: `Não foi possível ler a sessão: ${erroSessao.message}` }, 500);
      }
      if (!sessao) return jsonResponse({ error: "Sessão não encontrada" }, 404);

      // Processo é da empresa (princípio 2): o colega que opera o processo
      // precisa conseguir frear o robô que outra pessoa disparou. Sessão sem
      // `empresa_id` só aceita quem a iniciou — nunca mais aberto que antes.
      let autorizado = sessao.user_id === user.id;
      if (!autorizado && sessao.empresa_id) {
        const { data: membro, error: erroMembro } = await supabase
          .from("empresa_membros")
          .select("papel")
          .eq("empresa_id", sessao.empresa_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (erroMembro) {
          return jsonResponse(
            { error: `Não foi possível conferir seu papel na empresa: ${erroMembro.message}` },
            500
          );
        }
        autorizado = membro?.papel === "admin" || membro?.papel === "operador";
      }
      if (!autorizado) {
        return jsonResponse(
          {
            error: "Você não pode parar esta sessão: ela foi iniciada por outra pessoa " +
                   "e você não é administrador nem operador da empresa dela.",
          },
          403
        );
      }

      const observacoes: string[] = [];
      let colunasDaParada = true;

      // 1. A LÁPIDE, antes de qualquer chamada ao agente.
      const solicitadaEm = new Date().toISOString();
      const { error: erroLapide } = await supabase
        .from("sessoes_lance_real")
        .update({ parada_solicitada_em: solicitadaEm, parada_solicitada_por: user.id })
        .eq("id", sessao_id);
      if (erroLapide && erroDeColunaAusente(erroLapide)) {
        colunasDaParada = false;
        observacoes.push(
          "O banco ainda não tem as colunas da parada em dois tempos (migration " +
          "20260914000002 não aplicada): o pedido não ficou registrado na sessão."
        );
      } else if (erroLapide) {
        observacoes.push(`O pedido de parada não foi registrado na sessão: ${erroLapide.message}`);
      }

      // 2. Os agentes — os do DONO da sessão, não os de quem clicou: o colega
      // que freia o robô não tem agente próprio. O agente em que a sessão foi
      // aberta vai primeiro, porque é onde ela vive.
      const filtroAgentes = sessao.agente_id
        ? `user_id.eq.${sessao.user_id},id.eq.${sessao.agente_id}`
        : `user_id.eq.${sessao.user_id}`;
      const { data: agentesLidos, error: erroAgentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .or(filtroAgentes);
      const agentes = [...(agentesLidos || [])].sort(
        (a, b) => Number(b.id === sessao.agente_id) - Number(a.id === sessao.agente_id)
      );

      const tentativas: Array<Record<string, unknown>> = [];
      if (erroAgentes) {
        tentativas.push({ agente: null, motivo: `Não foi possível ler os agentes: ${erroAgentes.message}` });
      } else if (!agentes.length) {
        tentativas.push({ agente: null, motivo: "Nenhum agente configurado para esta sessão" });
      }

      let confirmadaEm: string | null = null;
      for (const agente of agentes) {
        const base = String(agente.url_base || "").replace(/\/$/, "");
        try {
          const resp = await fetch(`${base}/sessao/encerrar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
            },
            body: JSON.stringify({ sessao_id }),
            signal: AbortSignal.timeout(15000),
          });
          const corpo = await resp.json().catch(() => ({}));
          if (resp.ok) {
            confirmadaEm = new Date().toISOString();
            tentativas.push({ agente: agente.nome, status: resp.status, confirmou: true });
            break;
          }
          tentativas.push({ agente: agente.nome, status: resp.status, motivo: corpo?.error ?? null });
        } catch (e) {
          tentativas.push({ agente: agente.nome, motivo: e instanceof Error ? e.message : "sem resposta" });
        }
      }

      // 3. O desfecho no banco — "encerrado" SÓ com a confirmação.
      if (confirmadaEm) {
        const campos: Record<string, unknown> = {
          status: "encerrado",
          erro: "Interrompida manualmente pelo operador",
          updated_at: confirmadaEm,
        };
        if (colunasDaParada) campos.parada_confirmada_em = confirmadaEm;

        let { error: erroFinal } = await supabase
          .from("sessoes_lance_real")
          .update(campos)
          .eq("id", sessao_id);
        if (erroFinal && erroDeColunaAusente(erroFinal) && "parada_confirmada_em" in campos) {
          delete campos.parada_confirmada_em;
          ({ error: erroFinal } = await supabase
            .from("sessoes_lance_real")
            .update(campos)
            .eq("id", sessao_id));
        }
        if (erroFinal) {
          observacoes.push(
            `O agente confirmou a parada, mas a sessão não foi atualizada no banco: ${erroFinal.message}`
          );
        }
      } else {
        const resumo = tentativas
          .map((t) => [t.agente, t.motivo ?? t.status].filter(Boolean).join(": "))
          .filter(Boolean)
          .join(" · ");
        // Sem `updated_at`: na lista ele é o "último sinal" do robô, e um
        // pedido nosso não é sinal dele.
        const { error: erroNota } = await supabase
          .from("sessoes_lance_real")
          .update({
            erro: `Parada solicitada sem confirmação do agente${resumo ? ` (${resumo})` : ""}. ` +
                  `O robô pode continuar operando no portal.`,
          })
          .eq("id", sessao_id);
        if (erroNota) {
          observacoes.push(`A nota das tentativas não foi gravada na sessão: ${erroNota.message}`);
        }
      }

      // Trilha no mesmo lugar em que o kill-switch registra a dele.
      const { error: erroLog } = await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "parar-sessao",
        payload: {
          sessao_id,
          dono_da_sessao: sessao.user_id,
          solicitada_em: solicitadaEm,
          confirmada_em: confirmadaEm,
          tentativas,
        },
      });
      if (erroLog) observacoes.push(`O registro de auditoria da parada falhou: ${erroLog.message}`);

      return jsonResponse({
        // `parou` fica por compatibilidade com telas antigas; significa o mesmo
        // que `agente_confirmou`.
        parou: confirmadaEm !== null,
        agente_confirmou: confirmadaEm !== null,
        parada_solicitada_em: solicitadaEm,
        parada_confirmada_em: confirmadaEm,
        sessao_id,
        tentativas,
        ...(observacoes.length ? { observacoes } : {}),
      });
    }

    // ─── focar-sessao ───
    //
    // Traz para a frente, na tela virtual do servidor, a janela DAQUELE pregao.
    //
    // O agente aguenta 8 sessoes simultaneas e todas desenham na MESMA tela
    // (:99). Sem isto, com dois pregoes no mesmo horario — que o cliente
    // descreveu como rotina — o VNC mostra as janelas empilhadas e nao existe
    // acao possivel para "quero ver o outro".
    //
    // Diferente de parar-sessao, aqui NAO se escreve no banco: focar e uma
    // acao de visualizacao, nao muda o estado de nada. Se falhar, a sessao
    // continua rodando exatamente como estava.
    if (action === "focar-sessao") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { sessao_id } = body;
      if (!sessao_id) return jsonResponse({ error: "sessao_id é obrigatório" }, 400);

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .eq("user_id", user.id);

      if (!agentes?.length) return jsonResponse({ error: "Nenhum agente configurado" }, 400);

      let ultimoMotivo: string | null = null;
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        try {
          const resp = await fetch(`${base}/sessao/focar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
            },
            body: JSON.stringify({ sessao_id }),
            signal: AbortSignal.timeout(15000),
          });
          const corpo = await resp.json().catch(() => ({}));
          if (resp.ok) return jsonResponse({ focou: true, sessao_id, edital: corpo?.edital ?? null });
          ultimoMotivo = corpo?.error ?? `o agente respondeu ${resp.status}`;
        } catch (e) {
          // 404 aqui costuma ser agente ANTIGO, sem a rota. Dizer isso poupa
          // procurar defeito onde só falta atualizar o agente da VPS.
          ultimoMotivo = e instanceof Error ? e.message : "sem resposta";
        }
      }

      return jsonResponse(
        {
          focou: false,
          sessao_id,
          error: ultimoMotivo || "Nenhum agente conseguiu trazer a janela para frente",
        },
        502
      );
    }

    if (action === "kill-switch") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { motivo } = body;
      const motivoTexto = motivo || "Acionada pelo operador";
      const observacoes: string[] = [];

      // ── EM DOIS TEMPOS, COMO parar-sessao (14/09/2026) ────────────────────
      //
      // A versão anterior gravava `encerrado` em todas as sessões ANTES de
      // chamar qualquer agente, e respondia "N sessões encerradas" mesmo sem
      // confirmação. Freio de emergência é justamente onde isso não pode
      // acontecer. E só alcançava as sessões de quem clicou: o colega que opera
      // o processo da empresa não conseguia frear o robô disparado por outro.
      //
      //   1. alvo: sessões ativas iniciadas por quem aciona E as das empresas
      //      em que é admin/operador;
      //   2. lápide + marca de emergência ANTES de chamar os agentes;
      //   3. `encerrado` + `parada_confirmada_em` só na sessão cujo agente
      //      respondeu 2xx; as demais ficam "aguardando confirmação".

      const { data: papeis } = await supabase
        .from("empresa_membros")
        .select("empresa_id, papel")
        .eq("user_id", user.id);
      const empresasQueOpera = (papeis || [])
        .filter((m: { papel: string }) => m.papel === "admin" || m.papel === "operador")
        .map((m: { empresa_id: string }) => m.empresa_id);

      const lerSessoes = (comEmpresa: boolean) => {
        const q = supabase.from("sessoes_lance_real").select("*").in("status", ["ativo", "enviando"]);
        return comEmpresa && empresasQueOpera.length
          ? q.or(`user_id.eq.${user.id},empresa_id.in.(${empresasQueOpera.join(",")})`)
          : q.eq("user_id", user.id);
      };
      let { data: sessoesLidas, error: erroSessoes } = await lerSessoes(true);
      if (erroSessoes && erroDeColunaAusente(erroSessoes)) {
        observacoes.push(
          "Migration 20260914000002 não aplicada: o freio alcançou só as sessões iniciadas por você."
        );
        ({ data: sessoesLidas, error: erroSessoes } = await lerSessoes(false));
      }
      if (erroSessoes) {
        return jsonResponse({ error: `Não foi possível ler as sessões ativas: ${erroSessoes.message}` }, 500);
      }
      const sessoesAtivas = sessoesLidas || [];
      const idsSessao = sessoesAtivas.map((s: { id: string }) => s.id);

      // 2. Lápide e marca de emergência, antes dos agentes.
      const solicitadaEm = new Date().toISOString();
      if (idsSessao.length) {
        const marcas: Record<string, unknown> = {
          parada_emergencial: true,
          parada_emergencial_em: solicitadaEm,
          parada_emergencial_por: user.email ?? user.id,
          parada_solicitada_em: solicitadaEm,
          parada_solicitada_por: user.id,
        };
        let { error: erroMarca } = await supabase.from("sessoes_lance_real").update(marcas).in("id", idsSessao);
        if (erroMarca && erroDeColunaAusente(erroMarca)) {
          delete marcas.parada_solicitada_em;
          delete marcas.parada_solicitada_por;
          ({ error: erroMarca } = await supabase.from("sessoes_lance_real").update(marcas).in("id", idsSessao));
        }
        if (erroMarca) {
          observacoes.push(`A marca de parada emergencial não foi gravada nas sessões: ${erroMarca.message}`);
        }
      }

      // Agentes: os das sessões alvo (onde elas vivem) e os ativos de quem aciona.
      const idsAgente = [
        ...new Set(sessoesAtivas.map((s: { agente_id?: string | null }) => s.agente_id).filter(Boolean)),
      ] as string[];
      const { data: agentesLidos } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash, status, user_id")
        .or(idsAgente.length ? `user_id.eq.${user.id},id.in.(${idsAgente.join(",")})` : `user_id.eq.${user.id}`);
      const agentes = (agentesLidos || []).filter(
        (a: { id: string; status: string }) => a.status === "ativo" || idsAgente.includes(a.id)
      );

      const agentResults: Array<{ id: string; agente: string; ok: boolean; http: number; detalhe: string | null }> = [];
      for (const agente of agentes) {
        try {
          const resp = await fetch(`${agente.url_base}/kill-switch`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
            },
            body: JSON.stringify({ motivo }),
            signal: AbortSignal.timeout(5000),
          });
          agentResults.push({
            id: agente.id,
            agente: agente.nome,
            ok: resp.ok,
            http: resp.status,
            detalhe: resp.ok ? null : (resp.status === 404
              ? "o agente não implementa a rota /kill-switch"
              : `HTTP ${resp.status}`),
          });
        } catch (e) {
          agentResults.push({
            id: agente.id,
            agente: agente.nome,
            ok: false,
            http: 0,
            detalhe: e instanceof Error ? e.message : "sem resposta do agente",
          });
        }
      }

      // 3. O desfecho — "encerrado" só na sessão cujo agente confirmou.
      //
      // A rota /kill-switch do agente para tudo o que roda NELE. Sessão com
      // `agente_id` depende da resposta daquele agente; sessão sem vínculo só
      // conta como confirmada se TODOS os agentes avisados confirmaram — sem
      // saber onde ela vive, "algum confirmou" não prova nada sobre ela.
      const okPorAgente = new Map(agentResults.map((r) => [r.id, r.ok]));
      const todosConfirmaram = agentResults.length > 0 && agentResults.every((r) => r.ok);
      const idsConfirmados = sessoesAtivas
        .filter((s: { agente_id?: string | null }) =>
          s.agente_id ? okPorAgente.get(s.agente_id) === true : todosConfirmaram)
        .map((s: { id: string }) => s.id);
      const idsAguardando = idsSessao.filter((id: string) => !idsConfirmados.includes(id));

      if (idsConfirmados.length) {
        const campos: Record<string, unknown> = {
          status: "encerrado",
          erro: `Parada emergencial: ${motivoTexto}`,
          parada_confirmada_em: new Date().toISOString(),
        };
        let { error: erroFinal } = await supabase.from("sessoes_lance_real").update(campos).in("id", idsConfirmados);
        if (erroFinal && erroDeColunaAusente(erroFinal)) {
          delete campos.parada_confirmada_em;
          ({ error: erroFinal } = await supabase.from("sessoes_lance_real").update(campos).in("id", idsConfirmados));
        }
        if (erroFinal) {
          observacoes.push(`O agente confirmou, mas as sessões não foram atualizadas no banco: ${erroFinal.message}`);
        }
      }
      if (idsAguardando.length) {
        // Sem `updated_at`: ele é o "último sinal" do robô, e um pedido nosso não é sinal dele.
        const { error: erroNota } = await supabase
          .from("sessoes_lance_real")
          .update({
            erro: `Parada emergencial solicitada sem confirmação do agente (${motivoTexto}). ` +
                  "O robô pode continuar operando no portal.",
          })
          .in("id", idsAguardando);
        if (erroNota) observacoes.push(`A nota de parada pendente não foi gravada: ${erroNota.message}`);
      }

      // 4. Trilha
      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "kill-switch",
        payload: {
          motivo: motivoTexto,
          parada_solicitada_em: solicitadaEm,
          sessoes_alvo: idsSessao,
          sessoes_confirmadas: idsConfirmados,
          agentResults,
          observacoes,
        },
      });

      const confirmaram = agentResults.filter((r) => r.ok).length;
      return jsonResponse({
        success: true,
        parada_solicitada_em: solicitadaEm,
        sessoes_alvo: idsSessao.length,
        sessoes_confirmadas: idsConfirmados.length,
        sessoes_aguardando: idsAguardando.length,
        // Contrato anterior — o bundle já publicado lê este campo. Agora conta
        // só as sessões CONFIRMADAS, que é o que a palavra "encerradas" promete.
        sessoes_encerradas: idsConfirmados.length,
        agentes_total: agentResults.length,
        agentes_confirmaram: confirmaram,
        agente_parou: agentResults.length > 0 && confirmaram === agentResults.length,
        agentes_notificados: agentResults,
        observacoes,
      });
    }

    // ─── STATUS ───

    // ─── instalar-certificado ───
    // Repete a entrega do certificado ao agente. O upload ja tenta sozinho; esta
    // acao existe para quando o agente estava fora do ar naquele momento — sem
    // ela, a unica saida seria gerar um novo link e reenviar o arquivo inteiro.
    if (action === "instalar-certificado") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const resultado = await instalarCertificadoNoAgente(supabase, user.id);
      return jsonResponse(
        {
          instalado: resultado.instalado,
          motivo: resultado.motivo,
          certificado: resultado.certificado ?? null,
        },
        resultado.instalado ? 200 : 400
      );
    }

    // Healthcheck AO VIVO. Antes, o único ping acontecia ao configurar o
    // agente: versão, RAM e "ativo" ficavam congelados no banco desde então —
    // a tela dizia "Agente Online" lendo uma linha de meses atrás. Aqui
    // perguntamos ao agente e atualizamos o registro. Também substitui o
    // heartbeat que o agente nunca empurrou: puxamos o sinal de vida.
    // A pessoa responde o que a tela pediu, e QUEM DIGITA é o robô.
    //
    // Medido em 09/09/2026: um código do gov.br levava ~50s para ir do celular
    // até o campo — WhatsApp, leitura, troca de aba, teclado do VNC — e o código
    // vale ~60s. Três tentativas queimaram e a conta do cliente foi bloqueada
    // por excesso de erro (ERL0018900). Por aqui o mesmo número chega em ~2s.
    if (action === "responder-humano") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { sessao_id, valor } = body;
      if (!sessao_id || valor === undefined || valor === null || String(valor).trim() === "") {
        return jsonResponse({ error: "sessao_id e valor são obrigatórios" }, 400);
      }

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .eq("user_id", user.id);

      if (!agentes?.length) {
        return jsonResponse({ error: "Nenhum agente configurado" }, 400);
      }

      // Sem adivinhar em qual agente a sessão vive: pergunta a cada um, e o
      // que não a tiver responde 409, que não é erro.
      const tentativas: Array<Record<string, unknown>> = [];
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        try {
          const resp = await fetch(`${base}/sessao/responder`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
            },
            body: JSON.stringify({ sessao_id, valor: String(valor).trim() }),
            signal: AbortSignal.timeout(10000),
          });
          const corpo = await resp.json().catch(() => ({}));
          if (resp.ok && corpo?.aceito) {
            // O valor NUNCA volta na resposta nem entra em log: é código de
            // acesso de conta de terceiro.
            return jsonResponse({ aceito: true, agente: agente.nome, tipo: corpo.tipo ?? null });
          }
          tentativas.push({ agente: agente.nome, status: resp.status, motivo: corpo?.error ?? null });
        } catch (e) {
          tentativas.push({ agente: agente.nome, motivo: e instanceof Error ? e.message : "sem resposta" });
        }
      }

      return jsonResponse({
        aceito: false,
        error: "Nenhum agente tinha pedido em aberto para esta sessão — " +
          "a tela pode ter seguido sozinha, ou a sessão já terminou.",
        tentativas,
      }, 409);
    }

    if (action === "healthcheck") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, capacidades")
        .eq("user_id", user.id);

      if (!agentes?.length) {
        return jsonResponse({ configurado: false, online: false, agentes: [] });
      }

      const resultados = [];
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        let online = false;
        let saude: Record<string, unknown> | null = null;
        let erro: string | null = null;
        const capacidadesAtuais = (agente as { capacidades?: Record<string, unknown> }).capacidades;
        const t0 = Date.now();
        try {
          const resp = await fetch(`${base}/health`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            saude = await resp.json().catch(() => ({}));
            online = true;
          } else {
            erro = `HTTP ${resp.status}`;
          }
        } catch (e) {
          erro = e instanceof Error ? e.message : "sem resposta";
        }

        // O registro passa a refletir a realidade — inclusive quando é ruim.
        await supabase
          .from("agente_externo_config")
          .update({
            status: online ? "ativo" : "erro",
            ultimo_heartbeat: online ? new Date().toISOString() : undefined,
            versao_agente: (saude?.version as string) ?? undefined,
            ram_mb: ((saude?.capacidade as Record<string, number>)?.ram_total_mb) ?? undefined,
            sessoes_ativas: (saude?.sessoes_ativas as number) ?? undefined,
            // Mescla: o snapshot de saúde não pode apagar o resultado do
            // teste do freio de emergência guardado no mesmo campo.
            capacidades: saude
              ? ({ ...(capacidadesAtuais || {}), saude } as never)
              : undefined,
          })
          .eq("id", agente.id);

        resultados.push({
          id: agente.id,
          nome: agente.nome,
          url_base: agente.url_base,
          online,
          erro,
          latencia_ms: Date.now() - t0,
          versao: saude?.version ?? null,
          capacidade: saude?.capacidade ?? null,
          sessoes_ativas: saude?.sessoes_ativas ?? null,
          certificado: saude?.certificado ?? null,
          portais_suportados: saude?.portais_suportados ?? null,
          // O que o robô está esperando de uma pessoa AGORA. Vem da tela real
          // em que ele parou, não de configuração por portal: se o cliente
          // desligar a verificação em duas etapas, esta lista vem vazia e
          // nenhum campo aparece na interface.
          aguardando_humano: saude?.aguardando_humano ?? null,
          // Freio de emergência: só o teste explícito prova que existe
          kill_switch: (capacidadesAtuais as { kill_switch?: unknown })?.kill_switch ?? null,
        });
      }

      return jsonResponse({
        configurado: true,
        online: resultados.some((r) => r.online),
        agentes: resultados,
      });
    }

    // Teste do freio de emergência. Sondar a rota por HEAD/OPTIONS não
    // distingue "ausente" de "protegida" neste agente, e um POST às cegas
    // durante uma disputa abortaria lances reais. Então o teste é DELIBERADO
    // e só roda sem sessões ativas — como se testa um alarme de incêndio.
    if (action === "testar-kill-switch") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const { data: ativas } = await supabase
        .from("sessoes_lance_real")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["ativo", "enviando"]);
      if (ativas?.length) {
        return jsonResponse({
          error: `Há ${ativas.length} sessão(ões) de lance em andamento. O teste do freio abortaria disputas reais — execute com o robô parado.`,
        }, 409);
      }

      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash, capacidades")
        .eq("user_id", user.id);
      if (!agentes?.length) return jsonResponse({ error: "Nenhum agente configurado." }, 400);

      const resultados = [];
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        let ok = false, http = 0, detalhe: string | null = null;
        try {
          const resp = await fetch(`${base}/kill-switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada) },
            body: JSON.stringify({ motivo: "Teste de verificação do freio de emergência (sem sessões ativas)", teste: true }),
            signal: AbortSignal.timeout(8000),
          });
          ok = resp.ok;
          http = resp.status;
          if (!ok) {
            detalhe = resp.status === 404
              ? "o agente não implementa a rota POST /kill-switch"
              : `HTTP ${resp.status}`;
          }
        } catch (e) {
          detalhe = e instanceof Error ? e.message : "sem resposta do agente";
        }

        const registro = { ok, http, detalhe, testado_em: new Date().toISOString() };
        const capacidades = (agente as { capacidades?: Record<string, unknown> }).capacidades || {};
        await supabase
          .from("agente_externo_config")
          .update({ capacidades: { ...capacidades, kill_switch: registro } as never })
          .eq("id", agente.id);

        resultados.push({ agente: agente.nome, ...registro });
      }

      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "teste-kill-switch",
        payload: { resultados },
      });

      return jsonResponse({
        verificado: resultados.every((r) => r.ok),
        resultados,
      });
    }

    if (action === "status") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Não autorizado" }, 401);
      }
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!user) return jsonResponse({ error: "Token inválido" }, 401);

      const [agenteResp, sessoesResp] = await Promise.all([
        supabase
          .from("agente_externo_config")
          // Esta resposta vai ao navegador: nunca `*`, que levaria a chave.
          .select(COLUNAS_PUBLICAS_DO_AGENTE)
          .eq("user_id", user.id),
        supabase
          .from("sessoes_lance_real")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      return jsonResponse({
        agentes: agenteResp.data || [],
        sessoes: sessoesResp.data || [],
      });
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 404);
  } catch (e: any) {
    console.error("robo-lances-webhook error:", e);
    return jsonResponse({ error: e.message || "Erro interno" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
