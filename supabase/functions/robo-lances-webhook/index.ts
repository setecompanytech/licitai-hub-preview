import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { credencialEmClaro } from "../_shared/credenciais-cifra.ts";
import { portalDoAgente } from "../_shared/robo-portais.ts";
import { instalarCertificadoNoAgente } from "../_shared/certificado-agente.ts";

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

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /robo-lances-webhook/{action}
    const action = pathParts[pathParts.length - 1] || "";

    const body = req.method !== "GET" ? await req.json() : {};

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
      if (!url_base) {
        return jsonResponse({ error: "url_base é obrigatório" }, 400);
      }

      const { data, error } = await supabase
        .from("agente_externo_config")
        .upsert(
          {
            user_id: user.id,
            nome: nome || "Agente Principal",
            url_base,
            api_key_hash: api_key || null,
            status: "verificando",
            max_sessoes_paralelas: max_sessoes_paralelas || 3,
          },
          { onConflict: "user_id,nome" }
        )
        .select()
        .single();

      if (error) throw error;

      // Try to ping the agent
      try {
        const pingResp = await fetch(`${url_base}/health`, {
          method: "GET",
          headers: { "X-Agent-Key": api_key || "" },
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
      const itensDaSessao = itens.map((i: Record<string, unknown>, idx: number) => ({
        sessao_id: sessao.id,
        user_id: user.id,
        empresa_id: body.empresa_id ?? null,
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
            "X-Agent-Key": agente.api_key_hash || "",
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
        .select("*, agente_externo_config!inner(api_key_hash, user_id)")
        .eq("id", sessao_id)
        .single();

      if (!sessao) {
        return jsonResponse({ error: "Sessão não encontrada" }, 404);
      }

      // Validate agent key
      const expectedKey = (sessao as any).agente_externo_config?.api_key_hash;
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
    if (action === "parar-sessao") {
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

      const tentativas: Array<Record<string, unknown>> = [];
      let parou = false;
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        try {
          const resp = await fetch(`${base}/sessao/encerrar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": agente.api_key_hash || "",
            },
            body: JSON.stringify({ sessao_id }),
            signal: AbortSignal.timeout(15000),
          });
          const corpo = await resp.json().catch(() => ({}));
          if (resp.ok) { parou = true; break; }
          tentativas.push({ agente: agente.nome, status: resp.status, motivo: corpo?.error ?? null });
        } catch (e) {
          tentativas.push({ agente: agente.nome, motivo: e instanceof Error ? e.message : "sem resposta" });
        }
      }

      // O banco reflete a parada mesmo que o agente já tivesse encerrado por
      // conta própria: a lista de sessões é o que a pessoa lê depois, e ela não
      // pode continuar dizendo "em operação" para algo que acabou.
      await supabase
        .from("sessoes_lance_real")
        .update({
          status: "encerrado",
          erro: "Interrompida manualmente pelo operador",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessao_id);

      return jsonResponse({ parou, sessao_id, tentativas });
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
              "X-Agent-Key": agente.api_key_hash || "",
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

      // 1. Encerrar todas as sessões ativas do usuário no DB
      const { data: sessoesAtivas } = await supabase
        .from("sessoes_lance_real")
        .select("id, agente_id")
        .eq("user_id", user.id)
        .in("status", ["ativo", "enviando"]);

      if (sessoesAtivas && sessoesAtivas.length > 0) {
        await supabase
          .from("sessoes_lance_real")
          .update({
            status: "encerrado",
            erro: `Parada emergencial: ${motivo || "Acionada pelo operador"}`,
          })
          .eq("user_id", user.id)
          .in("status", ["ativo", "enviando"]);
      }

      // 2. Notify all active agents
      const { data: agentes } = await supabase
        .from("agente_externo_config")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ativo");

      const agentResults: { agente: string; ok: boolean }[] = [];
      for (const agente of agentes || []) {
        try {
          const resp = await fetch(`${agente.url_base}/kill-switch`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": agente.api_key_hash || "",
            },
            body: JSON.stringify({ motivo }),
            signal: AbortSignal.timeout(5000),
          });
          agentResults.push({
            agente: agente.nome,
            ok: resp.ok,
            http: resp.status,
            detalhe: resp.ok ? null : (resp.status === 404
              ? "o agente não implementa a rota /kill-switch"
              : `HTTP ${resp.status}`),
          });
        } catch (e) {
          agentResults.push({
            agente: agente.nome,
            ok: false,
            http: 0,
            detalhe: e instanceof Error ? e.message : "sem resposta do agente",
          });
        }
      }

      // 3. Audit log
      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "kill-switch",
        payload: { motivo, sessoes_encerradas: sessoesAtivas?.length || 0, agentResults },
      });

      // Falha silenciosa é proibida — ainda mais num freio de emergência. As
      // sessões SEMPRE são encerradas no sistema (paramos de mandar comandos),
      // mas se nenhum agente confirmou, quem está no portal precisa saber.
      const confirmaram = agentResults.filter((r) => r.ok).length;
      return jsonResponse({
        success: true,
        sessoes_encerradas: sessoesAtivas?.length || 0,
        agentes_total: agentResults.length,
        agentes_confirmaram: confirmaram,
        agente_parou: agentResults.length > 0 && confirmaram === agentResults.length,
        agentes_notificados: agentResults,
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
              "X-Agent-Key": agente.api_key_hash || "",
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
            headers: { "Content-Type": "application/json", "X-Agent-Key": agente.api_key_hash || "" },
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
          .select("*")
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
