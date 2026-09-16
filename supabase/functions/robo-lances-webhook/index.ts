import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { credencialEmClaro } from "../_shared/credenciais-cifra.ts";
import { portalDoAgente, idDeArmazenamento } from "../_shared/robo-portais.ts";
import { autorizadoComoCron } from "../_shared/cron-auth.ts";
import { anteriorDoItem, eventosDoEstado, mesclarEstadoDoItem, motivoParaPessoas, situacaoDoItem, type EstadoDaSala, type EstadoGravado, type EventoDaSala } from "../_shared/robo-estado-da-sala.ts";
import {
  horaEmBrasilia,
  pendenciasDaDisputa,
  perfilDoComprasGov,
  qualLembrete,
  sessaoDoPerfil,
  sessoesVencidasParaAvisar,
  textoDaSessaoVencida,
  textoDoLembrete,
  MINUTOS_DA_VESPERA,
  MINUTOS_DO_DESPACHO,
  type SessaoGovBr,
} from "../_shared/robo-prontidao.ts";
import { instalarCertificadoNoAgente } from "../_shared/certificado-agente.ts";
import {
  resolverAcao,
  erroDeColunaAusente,
  ehAgenteGerenciado,
  chaveParaOAgente,
  chaveEsperadaNoCallback,
} from "../_shared/robo-acao.ts";
// O que é da empresa e o que é da operação Praefectus — ver o cabeçalho do arquivo.
import {
  FRASES_AO_CLIENTE,
  corpoDeErro,
  textoDoErro,
  ehEstouroDeTempo,
  motivoDeNegocio,
  ehAdminDaPlataforma,
  estadoDoLigado,
  agentesParaUsuario,
  comAgenteGerenciado,
  agenteCompartilhado,
  rotearSessoes,
  idsDeSessaoNaSaude,
  reduzirSaudeParaCliente,
  tentativasParaCliente,
  motivoDoCertificadoParaCliente,
  certificadoParaCliente,
  contarSessoesVivasNaSaude,
  saudeParaGuardar,
  ehUuid,
  type EstadoDoLigado,
} from "../_shared/robo-plataforma.ts";

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
  // O agente da PLATAFORMA, para quem não tem linha própria em
  // `agente_externo_config` (ver `agentesParaUsuario`,
  // _shared/robo-plataforma.ts). Segredo e não coluna pelo mesmo motivo da
  // chave: trocar a VPS é trocar o segredo, sem caçar linhas no banco.
  const ambiente = { AGENTE_URL_BASE: Deno.env.get("AGENTE_URL_BASE") || null };
  // Fora do `try` para o `catch` saber a quem responde (ver o fim da função).
  let acaoAtual = "";

  try {
    const url = new URL(req.url);

    // Corpo vazio ou malformado não pode virar 500 antes de se saber a ação.
    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};

    // Path: /robo-lances-webhook/{action}. O `action` do corpo só vale quando a
    // URL termina no nome da função — a forma que três telas usavam e que
    // respondia 404 "Ação desconhecida" (ver _shared/robo-acao.ts).
    const action = resolverAcao(url.pathname, body);
    acaoAtual = action;

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

      // ── EXCLUSIVO DA OPERAÇÃO PRAEFECTUS (14/09/2026) ─────────────────────
      //
      // Endereço, chave e slots do agente não são decisão do cliente. Até aqui
      // todo administrador de empresa cadastrava a própria linha pela tela do
      // robô; agora quem não tem linha usa o agente da plataforma
      // (`AGENTE_URL_BASE`), e esta ação fica com o administrador da
      // plataforma (`user_roles.role = 'admin'`).
      if (!(await ehAdminDaPlataforma(supabase, user.id))) {
        return jsonResponse({ error: FRASES_AO_CLIENTE.exclusivoDaPlataforma }, 403);
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
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      // ── O ROBÔ DA EMPRESA ESTÁ LIGADO? ANTES DE QUALQUER ESCRITA ──────────
      //
      // Desligar o robô é a decisão da empresa de NÃO operar
      // (`robo_empresa_config`, migration 20260914000004). A recusa vem antes
      // de ler agente, credencial ou itens: sessão gravada com status
      // "enviando" para uma empresa que desligou o robô seria a mesma linha
      // órfã que as recusas abaixo já evitam.
      //
      // A empresa vem do corpo; sem ela, do processo — senão omitir
      // `empresa_id` bastaria para contornar o desligamento. E só vale empresa
      // de que a pessoa é membro: a de outra serviria para o mesmo contorno.
      //
      // Sem linha ou sem a tabela = ligado (princípio 7). Falha de leitura de
      // outro tipo NÃO é ligado: recusa com 503, porque atropelar um
      // "desligado" é pior do que pedir para tentar de novo.
      let empresaDaSessao: string | null = ehUuid(body.empresa_id) ? body.empresa_id : null;
      if (!empresaDaSessao && ehUuid(body.licitacao_id)) {
        const { data: processo } = await supabase
          .from("licitacoes")
          .select("empresa_id")
          .eq("id", body.licitacao_id)
          .maybeSingle();
        empresaDaSessao = processo?.empresa_id ?? null;
      }
      if (empresaDaSessao && !ehAdmin) {
        const { data: membro } = await supabase
          .from("empresa_membros")
          .select("empresa_id")
          .eq("empresa_id", empresaDaSessao)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!membro) return jsonResponse({ error: FRASES_AO_CLIENTE.foraDaEmpresa }, 403);
      }
      if (empresaDaSessao) {
        const ligado = await lerLigadoDaEmpresa(supabase, empresaDaSessao);
        if (ligado.estado === "desligado") {
          return jsonResponse({ error: FRASES_AO_CLIENTE.roboDesligado }, 409);
        }
        if (ligado.estado === "indeterminado") {
          await registrarNoLog(
            supabase, user.id, "enviar-sessao-recusada",
            { etapa: "ler-ligado", empresa_id: empresaDaSessao },
            { erro: ligado.detalhe }
          );
          return jsonResponse(
            corpoDeErro(FRASES_AO_CLIENTE.ligadoIncerto, { ehAdmin, detalhe: ligado.detalhe }),
            503
          );
        }
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
        await registrarNoLog(supabase, user.id, "enviar-sessao-recusada", { etapa: "ler-agente" }, {
          erro: erroAgente.message,
        });
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.falhaInterna, { ehAdmin, detalhe: erroAgente.message }),
          500
        );
      }

      // Sem linha própria ativa, o agente da PLATAFORMA (`AGENTE_URL_BASE`).
      // Ele não tem linha: `agente.id` é nulo e a sessão é gravada com
      // `agente_id` nulo — que é como o callback e o freio a reconhecem.
      const agente = agentesParaUsuario(agentesAtivos, ambiente)[0];

      if (!agente) {
        const detalhe = "Nenhuma linha ativa em agente_externo_config para o usuário e segredo " +
                        "AGENTE_URL_BASE ausente ou inválido.";
        await registrarNoLog(supabase, user.id, "enviar-sessao-recusada", { etapa: "sem-agente" }, { erro: detalhe });
        return jsonResponse(corpoDeErro(FRASES_AO_CLIENTE.semRobo, { ehAdmin, detalhe }), 400);
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
        await registrarNoLog(
          supabase, user.id, "enviar-sessao-recusada",
          { etapa: "ler-credencial", portal_id: body.portal_id },
          { erro: textoDoErro(e) }
        );
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.credencialIlegivel, { ehAdmin, detalhe: textoDoErro(e) }),
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
        // Vazio ou zero = sem teto: o robô disputa até o piso de cada item. O
        // `|| 20` de antes transformava essa escolha num teto que ninguém pôs.
        max_lances: Number(body.max_lances) > 0 ? Number(body.max_lances) : null,
        modo: "real",
        status: "enviando",
        // Nulo no agente gerenciado, que não tem linha.
        agente_id: agente.id,
      };

      // `empresa_id` fora do `sessaoData` de propósito: o `sessaoData` também
      // viaja para o agente e para o log. Na sessão, ele decide quem da
      // empresa a vê (migration 20260914000002) — e é por ele que a saúde
      // reduzida mostra ao colega a sessão que outra pessoa disparou. Sem a
      // coluna, grava como antes.
      let { data: sessao, error: sessErr } = await supabase
        .from("sessoes_lance_real")
        .insert({ ...sessaoData, empresa_id: empresaDaSessao })
        .select()
        .single();
      if (sessErr && erroDeColunaAusente(sessErr)) {
        ({ data: sessao, error: sessErr } = await supabase
          .from("sessoes_lance_real")
          .insert(sessaoData)
          .select()
          .single());
      }

      if (sessErr || !sessao) {
        const detalhe = sessErr?.message ?? "insert da sessão sem retorno";
        await registrarNoLog(supabase, user.id, "enviar-sessao-recusada", { etapa: "gravar-sessao" }, { erro: detalhe });
        return jsonResponse(corpoDeErro(FRASES_AO_CLIENTE.falhaInterna, { ehAdmin, detalhe }), 500);
      }

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

        await registrarNoLog(supabase, user.id, "enviar-sessao-recusada", { sessao_id: sessao.id, etapa: "gravar-itens" }, {
          erro: itensErr.message,
        });
        return jsonResponse(
          corpoDeErro(
            "Os itens da disputa não puderam ser gravados, e o robô não foi acionado. " +
              "Tente novamente; se persistir, fale com o suporte.",
            { ehAdmin, detalhe: itensErr.message }
          ),
          500
        );
      }

      // O CNPJ da empresa é como o robô se acha na classificação pública do
      // item e responde "somos o líder". Falha de leitura não barra o envio:
      // sem CNPJ o robô só não afirma liderança, e decidirLance trata isso
      // como motivo para não dar lance.
      let cnpjEmpresa: string | null = null;
      if (empresaDaSessao) {
        const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", empresaDaSessao).maybeSingle();
        cnpjEmpresa = emp?.cnpj ?? null;
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
            cnpj_empresa: cnpjEmpresa,
            // O ALVO DENTRO DO PROCESSO.
            //
            // `sessaoData` ja leva `tipo_disputa`; os itens vao aqui porque
            // nao sao coluna da sessao — moram em `sessao_lance_itens`. Sem
            // eles o agente sabe entrar no processo e nao sabe o que disputar
            // la dentro.
            itens: itensDaSessao.map((i, idx) => ({
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
              // Não é coluna de `sessao_lance_itens`: vai só ao agente, lida do
              // item como veio da tela. Vazio = melhor preço.
              estrategia: (itens[idx] as Record<string, unknown>)?.estrategia ?? null,
              margem_desempate: (itens[idx] as Record<string, unknown>)?.margem_desempate ?? null,
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
          return jsonResponse({ success: true, sessao });
        }

        // ── RECUSA DO AGENTE NÃO É 200 (14/09/2026) ─────────────────────────
        //
        // A resposta anterior era `200 { success: true, sessao: { status:
        // "erro" } }` — e a tela, que decide pelo `error`, dizia "Sessão
        // aceita pelo robô" para uma sessão recusada. Agora é 502 com a frase
        // de negócio. O erro cru fica na sessão (diagnóstico da plataforma) e
        // no `webhook_log`; o administrador da plataforma o recebe em
        // `detalhe_tecnico`.
        const erroCru = agentData?.error || `O agente respondeu HTTP ${agentResp.status}`;
        await supabase
          .from("sessoes_lance_real")
          .update({ status: "erro", erro: erroCru })
          .eq("id", sessao.id);
        await registrarNoLog(
          supabase, user.id, "enviar-sessao-falha",
          { sessao_id: sessao.id, etapa: "agente-recusou" },
          { erro: erroCru, status_code: agentResp.status, resposta: agentData }
        );
        const frase = motivoDeNegocio(agentData?.error, FRASES_AO_CLIENTE.sessaoNaoIniciada);
        return jsonResponse(
          corpoDeErro(frase, {
            ehAdmin,
            detalhe: erroCru,
            extra: { success: false, sessao: { ...sessao, status: "erro", erro: ehAdmin ? erroCru : frase } },
          }),
          502
        );
      } catch (e) {
        const erroCru = textoDoErro(e);
        await supabase
          .from("sessoes_lance_real")
          .update({ status: "erro", erro: erroCru })
          .eq("id", sessao.id);
        await registrarNoLog(
          supabase, user.id, "enviar-sessao-falha",
          { sessao_id: sessao.id, etapa: "agente-sem-resposta" },
          { erro: erroCru }
        );
        // Estouro de tempo não é "fora do ar": o agente pode estar entrando no
        // portal agora (ver o comentário do timeout acima), e a frase diz isso.
        return jsonResponse(
          corpoDeErro(
            ehEstouroDeTempo(e) ? FRASES_AO_CLIENTE.semRespostaATempo : FRASES_AO_CLIENTE.roboForaDoAr,
            { ehAdmin, detalhe: erroCru, extra: { success: false } }
          ),
          502
        );
      }
    }

    // ─── O AGENDADOR: O ROBÔ ENTRA SOZINHO NO HORÁRIO ─────────────────────
    //
    // Chamado por pg_cron a cada minuto (migration 20260916000002). Faz o que
    // o "Enviar ao robô" faz, sem ninguém clicando: acha as disputas que
    // começam agora, confere se o robô da empresa está ligado, monta a sessão
    // e chama o agente.
    //
    // Não tem usuário logado: a autorização é o CRON_SECRET, e cada disputa é
    // despachada em nome de QUEM A CADASTROU (`user_id` da linha) — é dele o
    // agente, a credencial do portal e o certificado.
    if (action === "disparar-agendadas") {
      if (!autorizadoComoCron(req)) return jsonResponse({ error: "Unauthorized" }, 401);

      const agora = Date.now();
      // Adianta o login: entrar 15 minutos antes dá margem para o captcha do
      // gov.br pedir um clique humano e ainda assim a sessão estar de pé
      // quando o pregão abrir.
      const ate = new Date(agora + 15 * 60_000).toISOString();
      // Atrasada demais não vira sessão: uma disputa de ontem que ninguém
      // despachou não deve abrir Chrome hoje.
      const desde = new Date(agora - 30 * 60_000).toISOString();

      const { data: pendentes, error: erroLeitura } = await supabase
        .from("robo_lances_disputas")
        .select("*")
        .is("enviada_em", null)
        .not("inicio_sessao", "is", null)
        .gte("inicio_sessao", desde)
        .lte("inicio_sessao", ate)
        .order("inicio_sessao", { ascending: true })
        .limit(20);

      if (erroLeitura) {
        // Coluna ausente = migration 20260916000001 ainda não aplicada. É
        // estado de instalação, não defeito: responde dizendo o que falta.
        const faltaMigration = erroDeColunaAusente(erroLeitura);
        return jsonResponse(
          {
            ok: false,
            erro: faltaMigration
              ? "Agendamento indisponível: a migration 20260916000001 (inicio_sessao/enviada_em) ainda não foi aplicada."
              : erroLeitura.message,
          },
          faltaMigration ? 409 : 500,
        );
      }

      const relatorio: Array<Record<string, unknown>> = [];

      for (const d of (pendentes || []) as Array<Record<string, any>>) {
        const donoId = d.user_id as string;
        const avisar = async (titulo: string, mensagem: string) => {
          await supabase.from("notificacoes").insert({
            user_id: donoId,
            tipo: "urgente",
            titulo,
            mensagem,
            link: `/robo-lances/disputa/${d.id}`,
          });
        };

        // O robô da empresa desligado é decisão de quem assina, e vale também
        // para o agendamento. Aqui NÃO marca `enviada_em`: se religarem antes
        // da sessão, o próximo minuto despacha.
        if (d.empresa_id) {
          const ligado = await lerLigadoDaEmpresa(supabase, d.empresa_id);
          if (ligado.estado === "desligado") {
            relatorio.push({ disputa: d.id, resultado: "robo-desligado" });
            continue;
          }
        }

        // SESSÃO VIVA DESTA DISPUTA? (16/09/2026) Uma disputa remarcada volta
        // à agenda (gatilho da migration 20260916000004), e uma enviada pelo
        // botão não marca `enviada_em`. Nos dois casos o robô pode já estar na
        // sala — e duas sessões com o mesmo CPF e o mesmo certificado derrubam
        // uma à outra. "Viva" = deu sinal nos últimos 15 minutos: a espera do
        // captcha dura até 10, e sessão que morreu sem avisar não pode travar
        // a agenda para sempre.
        const { data: vivas } = await supabase
          .from("sessoes_lance_real")
          .select("id")
          .eq("lance_config_id", d.id)
          .in("status", ["enviando", "ativo", "pausado"])
          .gte("updated_at", new Date(agora - 15 * 60_000).toISOString())
          .limit(1);
        if (vivas && vivas.length) {
          relatorio.push({ disputa: d.id, resultado: "sessao-ja-ativa", sessao: vivas[0].id });
          continue;
        }

        // RESERVA ANTES DE TRABALHAR. Duas execuções do job podem se cruzar
        // (a anterior ainda esperando o agente), e duas sessões no mesmo
        // portal, com o mesmo CPF e o mesmo certificado, derrubam uma à
        // outra. O update condicional é a reserva: quem não pegar a linha,
        // desiste.
        const { data: reservada } = await supabase
          .from("robo_lances_disputas")
          .update({ enviada_em: new Date().toISOString() })
          .eq("id", d.id)
          .is("enviada_em", null)
          .select("id");
        if (!reservada || reservada.length === 0) {
          relatorio.push({ disputa: d.id, resultado: "ja-despachada" });
          continue;
        }

        // A disputa grava o NOME do portal ("Compras.gov.br"); o agente e a
        // credencial falam por id ("compras-gov"). Quem traduz no envio manual
        // é o navegador; aqui não há navegador nenhum, e mandar o nome cru foi
        // o que fez o primeiro despacho agendado morrer como "portal
        // desconhecido" (16/09/2026).
        const portalId = idDeArmazenamento(d.portal);
        const portalAgente = portalDoAgente(portalId);
        if (!portalAgente) {
          await avisar(
            `🤖 Robô não entrou — ${d.edital}`,
            `O portal "${d.portal || "(não informado)"}" não é um que o robô conhece. Reabra a disputa e escolha o portal de novo.`,
          );
          relatorio.push({ disputa: d.id, resultado: "portal-desconhecido" });
          continue;
        }

        const itensCadastrados = Array.isArray(d.itens) ? d.itens : [];
        if (itensCadastrados.length === 0) {
          await avisar(
            `🤖 Robô não entrou — ${d.edital}`,
            "A disputa não tem item cadastrado, e o robô precisa saber o que acompanhar dentro do processo.",
          );
          relatorio.push({ disputa: d.id, resultado: "sem-itens" });
          continue;
        }

        const { data: agentesAtivos } = await supabase
          .from("agente_externo_config")
          .select("*")
          .eq("user_id", donoId)
          .eq("status", "ativo")
          .order("updated_at", { ascending: false });
        const agente = agentesParaUsuario(agentesAtivos, ambiente)[0];
        if (!agente) {
          await avisar(`🤖 Robô não entrou — ${d.edital}`, "Nenhum robô ativo configurado para quem cadastrou esta disputa.");
          relatorio.push({ disputa: d.id, resultado: "sem-agente" });
          continue;
        }

        let credenciais;
        try {
          credenciais = await credencialEmClaro(supabase, donoId, portalId as string);
        } catch (e) {
          await avisar(`🤖 Robô não entrou — ${d.edital}`, `A credencial do portal não pôde ser lida: ${textoDoErro(e)}`);
          relatorio.push({ disputa: d.id, resultado: "credencial-ilegivel" });
          continue;
        }
        if (!credenciais) {
          await avisar(
            `🤖 Robô não entrou — ${d.edital}`,
            "Nenhuma credencial ativa cadastrada para este portal. Cadastre em Robô de Lances → Portais.",
          );
          relatorio.push({ disputa: d.id, resultado: "sem-credencial" });
          continue;
        }

        let cnpjDaEmpresa: string | null = null;
        if (d.empresa_id) {
          const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", d.empresa_id).maybeSingle();
          cnpjDaEmpresa = emp?.cnpj ?? null;
        }

        // Os itens são gravados no vocabulário da tela (camelCase) e viajam no
        // do servidor (snake_case) — a mesma tradução que o envio manual faz
        // antes de chamar esta função.
        const itensParaSessao = itensCadastrados.map((i: Record<string, any>, idx: number) => ({
          numero: Number(i.numero) || idx + 1,
          lote: i.lote ?? null,
          descricao: String(i.descricao || ""),
          marca: i.marca ?? null,
          modelo: i.modelo ?? null,
          quantidade: Number(i.quantidade) || 1,
          unidade: i.unidade || "UN",
          preco_venda: Number(i.valorReferencia) > 0 ? Number(i.valorReferencia) : null,
          custo_unitario: i.custoUnitario ?? null,
          valor_estimado_orgao: i.valorEstimadoOrgao ?? null,
          valor_minimo: i.valorMinimo ?? null,
          origem: i.origem ?? null,
        }));

        const sessaoData = {
          user_id: donoId,
          lance_config_id: d.id,
          licitacao_id: d.licitacao_id ?? null,
          tipo_disputa: d.tipo_disputa ?? null,
          // `portal_id` é o id de armazenamento, que casa com a credencial e
          // fica na sessão; o nome continua sendo o que a pessoa lê.
          portal_id: portalId,
          portal_nome: d.portal,
          edital: d.edital,
          valor_referencia: d.valor_referencia,
          valor_inicial: d.valor_inicial,
          valor_minimo: d.valor_minimo,
          decremento_min: d.decremento_min,
          decremento_percentual: d.decremento_percentual,
          intervalo_segundos: d.intervalo_segundos || 30,
          max_lances: Number(d.max_lances) > 0 ? Number(d.max_lances) : null,
          modo: "real",
          status: "enviando",
          agente_id: agente.id,
        };

        let { data: sessao, error: sessErr } = await supabase
          .from("sessoes_lance_real")
          .insert({ ...sessaoData, empresa_id: d.empresa_id ?? null })
          .select()
          .single();
        if (sessErr && erroDeColunaAusente(sessErr)) {
          ({ data: sessao, error: sessErr } = await supabase
            .from("sessoes_lance_real")
            .insert(sessaoData)
            .select()
            .single());
        }
        if (sessErr || !sessao) {
          await avisar(`🤖 Robô não entrou — ${d.edital}`, "A sessão não pôde ser registrada e o robô não foi acionado.");
          await registrarNoLog(supabase, donoId, "enviar-sessao-recusada", { disputa_id: d.id, etapa: "gravar-sessao", origem: "agendador" }, { erro: sessErr?.message ?? "insert sem retorno" });
          relatorio.push({ disputa: d.id, resultado: "sessao-nao-gravada" });
          continue;
        }

        const { error: itensErr } = await supabase.from("sessao_lance_itens").insert(
          itensParaSessao.map((i) => ({
            ...i,
            sessao_id: sessao.id,
            user_id: donoId,
            empresa_id: d.empresa_id ?? null,
            situacao: "aguardando",
          })),
        );
        // O robô recebe os itens pelo corpo do envio e segue sem esta cópia;
        // o que não pode é a falha passar calada (princípio 3).
        if (itensErr) {
          await registrarNoLog(supabase, donoId, "itens-da-sessao-nao-gravados", { sessao_id: sessao.id, origem: "agendador" }, { erro: itensErr.message });
        }

        try {
          const resp = await fetch(`${agente.url_base}/sessao/iniciar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
              "X-Callback-URL": `${supabaseUrl}/functions/v1/robo-lances-webhook/callback`,
            },
            body: JSON.stringify({
              sessao_id: sessao.id,
              ...sessaoData,
              portal_id: portalAgente,
              credenciais_portal: credenciais,
              uasg: d.uasg ?? null,
              cnpj_empresa: cnpjDaEmpresa,
              // Estratégia e margem não são colunas de `sessao_lance_itens`: entram só aqui.
              itens: itensParaSessao.map((i, idx) => ({
                ...i,
                estrategia: itensCadastrados[idx]?.estrategia ?? null,
                margem_desempate: itensCadastrados[idx]?.margemDesempate ?? null,
              })),
            }),
            signal: AbortSignal.timeout(60000),
          });
          const corpo = await resp.json().catch(() => ({}));
          // 5xx e 429 são do lado do robô (reiniciando, sem vaga, sobrecarga):
          // vale tentar de novo. 4xx é configuração, e repetir não resolve.
          const passageira = resp.status >= 500 || resp.status === 429;
          if (resp.ok) {
            await supabase.from("sessoes_lance_real").update({ status: "ativo" }).eq("id", sessao.id);
            // Sem notificação de sucesso aqui: quem avisa que o robô chegou é
            // o próprio agente, pelo callback `sessao-ativa`, e dois avisos
            // para o mesmo fato treinam a pessoa a ignorar os dois.
            relatorio.push({ disputa: d.id, resultado: "despachada", sessao: sessao.id });
          } else if (passageira) {
            const erroCru = corpo?.error || `O agente respondeu HTTP ${resp.status}`;
            await supabase.from("sessoes_lance_real").update({ status: "erro", erro: erroCru }).eq("id", sessao.id);
            await registrarNoLog(supabase, donoId, "enviar-sessao-falha", { disputa_id: d.id, sessao_id: sessao.id, etapa: "agente-falha-passageira", origem: "agendador" }, { erro: erroCru });
            const r = await tentarDeNovoOuDesistir(supabase, d, avisar, motivoDeNegocio(corpo?.error, FRASES_AO_CLIENTE.sessaoNaoIniciada));
            relatorio.push({ disputa: d.id, resultado: r });
          } else {
            const erroCru = corpo?.error || `O agente respondeu HTTP ${resp.status}`;
            await supabase.from("sessoes_lance_real").update({ status: "erro", erro: erroCru }).eq("id", sessao.id);
            await avisar(`🤖 Robô não entrou — ${d.edital}`, motivoDeNegocio(corpo?.error, FRASES_AO_CLIENTE.sessaoNaoIniciada));
            await registrarNoLog(supabase, donoId, "enviar-sessao-falha", { disputa_id: d.id, sessao_id: sessao.id, etapa: "agente-recusou", origem: "agendador" }, { erro: erroCru });
            relatorio.push({ disputa: d.id, resultado: "agente-recusou" });
          }
        } catch (e) {
          // Sem resposta, tempo estourado, robô fora do ar: passageira por
          // natureza — a VPS reiniciando por um minuto não pode custar o pregão.
          const erroCru = textoDoErro(e);
          await supabase.from("sessoes_lance_real").update({ status: "erro", erro: erroCru }).eq("id", sessao.id);
          await registrarNoLog(supabase, donoId, "enviar-sessao-falha", { disputa_id: d.id, sessao_id: sessao.id, etapa: "agente-sem-resposta", origem: "agendador" }, { erro: erroCru });
          const r = await tentarDeNovoOuDesistir(
            supabase,
            d,
            avisar,
            ehEstouroDeTempo(e) ? FRASES_AO_CLIENTE.semRespostaATempo : FRASES_AO_CLIENTE.roboForaDoAr,
          );
          relatorio.push({ disputa: d.id, resultado: r });
        }
      }

      // LEMBRETE DE PRONTIDÃO (Fase 8, 16/09/2026): véspera e 1 hora antes,
      // com a checagem do que faria o robô não entrar. Depois do despacho, e
      // blindado: lembrete que falha não pode custar a entrada de ninguém.
      let lembretes: Array<Record<string, unknown>> = [];
      try {
        lembretes = await enviarLembretesDeProntidao(supabase, ambiente, agora);
      } catch (e) {
        lembretes = [{ erro: textoDoErro(e) }];
        console.error("robo-lances-webhook: lembretes de prontidão falharam:", textoDoErro(e));
      }

      // SESSÃO DO GOV.BR VENCIDA (Fase 8, 16/09/2026): o vigia vê, a equipe
      // fica sabendo na hora — e não no minuto do pregão. A cada 5 minutos
      // basta: o vigia confere de 20 em 20.
      let vigia: Array<Record<string, unknown>> = [];
      if (new Date(agora).getUTCMinutes() % 5 === 0) {
        try {
          vigia = await avisarSessoesVencidas(supabase, ambiente, agora);
        } catch (e) {
          vigia = [{ erro: textoDoErro(e) }];
          console.error("robo-lances-webhook: aviso de sessão vencida falhou:", textoDoErro(e));
        }
      }

      return jsonResponse({ ok: true, janela: { desde, ate }, encontradas: (pendentes || []).length, relatorio, lembretes, vigia });
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
        // Junção SEM `!inner`: sessão do agente gerenciado não tem linha de
        // agente (`agente_id` nulo), e o `!inner` a descartaria — o callback
        // responderia 404 a um robô que está trabalhando.
        .select("*, agente_externo_config(api_key_hash, user_id, url_base)")
        .eq("id", sessao_id)
        .single();

      if (!sessao) {
        return jsonResponse({ error: "Sessão não encontrada" }, 404);
      }

      // Validate agent key
      //
      // Agente gerenciado: vale o segredo AGENTE_API_KEY, não a linha — a
      // chave antiga gravada no banco estava no bundle público. Sessão sem
      // linha de agente é a do gerenciado (ver `chaveEsperadaNoCallback`).
      const expectedKey = chaveEsperadaNoCallback((sessao as any).agente_externo_config, chaveGerenciada);
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
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "lance-enviado",
            mensagem: `Lance enviado: R$ ${formatarReais(valor)}`,
            item: null,
            dados: { valor, rodada, motivo: payload.motivo ?? null },
          }]);
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
          // `valor_atual` é o NOSSO valor. Até 16/09/2026 este callback
          // gravava ali o lance do concorrente, e a tela mostrava o preço dele
          // como se fosse o nosso.
          await supabase
            .from("sessoes_lance_real")
            .update({ rodada_atual: rodada })
            .eq("id", sessao_id);
          break;
        }

        // ─── O LANCE QUE O PORTAL RECUSOU ────────────────────────────────
        //
        // O agente envia `lance-recusado` desde que passou a conferir se o
        // portal aceitou o envio, e este switch não conhecia o tipo: a
        // resposta era 400 "Tipo de callback desconhecido" e o aviso morria
        // no log do agente — o mesmo defeito que `rodada-sem-lance` teve em
        // 08/09. E é o evento em que alguém MAIS precisa agir: intervalo
        // mínimo do edital, lance que não cobre o próprio anterior, sessão
        // derrubada pelo portal.
        case "lance-recusado": {
          const { rodada, valor, resultado } = payload;
          // `valor_atual` NÃO avança: o portal não aceitou este número, e
          // gravá-lo como nosso faria a rodada seguinte partir de uma
          // premissa falsa — foi por isso que o agente passou a conferir o
          // resultado antes de dar o lance por enviado.
          await supabase.from("lances_historico").insert({
            user_id: userId,
            sessao_id,
            rodada: rodada ?? 0,
            valor,
            tipo: "recusado",
            origem: "real",
            metadata: { ...(payload.metadata || {}), resultado: resultado ?? null },
          });
          await supabase
            .from("sessoes_lance_real")
            .update({
              rodada_atual: rodada ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessao_id);
          await supabase.from("notificacoes").insert({
            user_id: userId,
            tipo: "urgente",
            titulo: `⛔ Lance recusado — ${sessao.edital}`,
            mensagem:
              `O portal não aceitou o lance de R$ ${formatarReais(valor)}` +
              `${resultado ? ` (${String(resultado).slice(0, 120)})` : ""}. ` +
              `Confira o intervalo mínimo do edital e a disputa.`,
            link: linkDaDisputa(sessao),
          });
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "lance-recusado",
            mensagem: `O portal recusou o lance de R$ ${formatarReais(valor)}`,
            item: null,
            dados: { valor, rodada: rodada ?? null, resultado: resultado ?? null },
          }]);
          break;
        }

        // ─── O ROBÔ CHEGOU NA SALA ───────────────────────────────────────
        //
        // O robô entra sozinho no horário da sessão (D7): quem cadastrou a
        // disputa precisa saber que ele chegou, sem abrir tela remota
        // nenhuma. Sem este aviso, "entrou" e "não entrou" têm a mesma cara
        // do lado de cá — foi o que aconteceu em 14/09 às 20:07, quando o
        // login parou no captcha e ninguém soube a tempo.
        case "sessao-ativa": {
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "ativo",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessao_id);
          await supabase.from("notificacoes").insert({
            user_id: userId,
            tipo: "info",
            titulo: `🤖 Robô na sala — ${sessao.edital}`,
            mensagem:
              `O robô entrou na disputa em ${sessao.portal_nome} e está acompanhando` +
              `${payload.itens ? ` ${payload.itens} item(ns)` : ""}.`,
            link: linkDaDisputa(sessao),
          });
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "entrou",
            mensagem: `Robô entrou na compra ${sessao.edital}` +
              `${payload.modo_disputa ? ` · modo ${payload.modo_disputa}` : ""}` +
              `${Number.isFinite(Number(payload.intervalo_minimo)) && payload.intervalo_minimo !== null ? ` · intervalo mínimo R$ ${formatarReais(payload.intervalo_minimo)}` : ""}`,
            item: null,
            dados: { itens: payload.itens ?? null, modo: payload.modo_disputa ?? null },
          }]);
          break;
        }

        // ─── O ESTADO DA SALA (D13, 16/09/2026) ──────────────────────────
        //
        // O robô manda o que viu na sala a cada mudança, ou a cada 30 s. É o
        // que a página da disputa mostra: o quadro de status (estado_sala),
        // as colunas "Seu último lance", "Melhor lance" e "Situação"
        // (sessao_lance_itens) e a linha do tempo (robo_eventos_sessao) — para
        // acompanhar sem a tela remota. Substitui o `rodada-sem-lance`.
        case "estado-da-sala": {
          const novo = (payload || {}) as EstadoDaSala & { total_itens?: number };
          // Com vários itens, a comparação é com o último estado DO MESMO item
          // (Fase 7) — senão a troca de item viraria "mudou de posição".
          const gravadoAntes = ((sessao as any).estado_sala ?? null) as EstadoGravado | null;
          const anterior = anteriorDoItem(gravadoAntes, novo.item);
          const estadoDoItem: EstadoDaSala = {
            ...novo,
            decisao: { ...(novo.decisao || {}), motivo_legivel: motivoParaPessoas(novo) },
          };
          const agoraIso = new Date().toISOString();
          const atualizacao: Record<string, unknown> = {
            estado_sala: mesclarEstadoDoItem(gravadoAntes, estadoDoItem),
            estado_sala_em: agoraIso,
            updated_at: agoraIso,
            rodada_atual: novo.rodada ?? null,
          };
          // O nosso valor publicado no portal é o valor atual da sessão — com
          // um item só; com vários, cada item tem o seu na coluna do item.
          if (Number.isFinite(novo.nosso_lance as number) && !(Number(novo.total_itens) > 1)) atualizacao.valor_atual = novo.nosso_lance;

          const { error: erroSessao } = await supabase.from("sessoes_lance_real").update(atualizacao).eq("id", sessao_id);
          if (erroSessao && erroDeColunaAusente(erroSessao)) {
            // Migration 20260916000005 ainda não aplicada: ao menos o sinal de
            // vida, como fazia o rodada-sem-lance.
            await supabase.from("sessoes_lance_real").update({ updated_at: agoraIso, rodada_atual: novo.rodada ?? null }).eq("id", sessao_id);
          }

          if (Number.isFinite(novo.item as number)) {
            await supabase
              .from("sessao_lance_itens")
              .update({
                melhor_lance: Number.isFinite(novo.melhor_lance as number) ? novo.melhor_lance : null,
                seu_ultimo_lance: Number.isFinite(novo.nosso_lance as number) ? novo.nosso_lance : null,
                sou_lider: typeof novo.sou_lider === "boolean" ? novo.sou_lider : null,
                situacao: situacaoDoItem(novo.fase),
              })
              .eq("sessao_id", sessao_id)
              .eq("numero", novo.item);
          }

          if (!erroSessao) {
            await registrarEventos(supabase, sessao, userId, eventosDoEstado(anterior, estadoDoItem, formatarReais));
          }
          break;
        }

        // ── O ROBÔ PAROU ESPERANDO UMA PESSOA (16/09/2026) ─────────────────
        //
        // Captcha do gov.br, código de verificação. O pedido só existia no
        // /health do agente, e em 14/09 às 20:07 o gov.br pediu o clique, a
        // tela remota estava na área admin, ninguém viu e a espera expirou.
        //
        // Quem pode atender é o administrador da PLATAFORMA — a tela remota é
        // só dele desde 14/09 —, então o aviso urgente vai para os admins, com
        // o caminho direto da tela e até que horas o robô espera. Quem enviou a
        // disputa recebe um aviso simples, sem a tela remota: fica sabendo por
        // que o robô ainda não entrou, e que a Praefectus já foi chamada.
        case "pedido-humano": {
          const tipoPedido = String(payload?.tipo || "");
          const oQue = tipoPedido === "captcha"
            ? "o clique no captcha do gov.br"
            : tipoPedido === "codigo"
              ? "um código de verificação"
              : "uma ação de uma pessoa";
          const expira = payload?.expira_em ? new Date(String(payload.expira_em)) : null;
          const ate = expira && !Number.isNaN(expira.getTime())
            ? expira.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
            : null;
          const urlDoAgente = String((sessao as any).agente_externo_config?.url_base || ambiente.AGENTE_URL_BASE || "")
            .trim()
            .replace(/\/+$/, "");
          const telaRemota = urlDoAgente
            ? `${urlDoAgente}/vnc/vnc.html?path=/vnc/&autoconnect=true&resize=scale&reconnect=true`
            : null;

          const { data: admins, error: adminsErr } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          if (adminsErr) {
            await registrarNoLog(supabase, userId, "pedido-humano-sem-destinatario", { sessao_id }, { erro: adminsErr.message });
          }
          const idsAdmin = [...new Set((admins || []).map((a: { user_id: string }) => a.user_id))];

          if (idsAdmin.length) {
            await supabase.from("notificacoes").insert(
              idsAdmin.map((adminId) => ({
                user_id: adminId,
                tipo: "urgente",
                titulo: `🧑 Robô esperando uma pessoa — ${sessao.edital}`,
                mensagem:
                  `O robô parou em ${sessao.portal_nome} esperando ${oQue}` +
                  `${ate ? `, até as ${ate}` : ""}. ` +
                  (telaRemota ? `Tela remota: ${telaRemota}` : "Abra a tela remota na área admin do Robô de Lances."),
                link: "/admin/robo-lances",
              })),
            );
            // Canal fora do sistema (Fase 8): o captcha espera minutos, e quem
            // resolve pode não estar com o Praefectus aberto. Em segundo plano:
            // o robô espera esta resposta só 10 s e reenvia o callback — e-mail
            // lento aqui duplicaria o aviso.
            emSegundoPlano(avisarPorEmail(
              supabase,
              idsAdmin as string[],
              {
                titulo: `🧑 Robô esperando uma pessoa — ${sessao.edital}`,
                mensagem: `O robô parou em ${sessao.portal_nome} esperando ${oQue}${ate ? `, até as ${ate}` : ""}. Abra a tela remota na área admin do Robô de Lances.`,
                link: "/admin/robo-lances",
              },
              `pedido-humano:${sessao_id}:${String(payload?.expira_em || tipoPedido)}`,
            ));
          }

          if (!idsAdmin.includes(userId)) {
            await supabase.from("notificacoes").insert({
              user_id: userId,
              tipo: "info",
              titulo: `⏳ Robô aguardando verificação — ${sessao.edital}`,
              mensagem:
                `O ${sessao.portal_nome} pediu ${oQue} antes de o robô entrar. ` +
                `A equipe Praefectus já foi avisada; o robô segue sozinho depois disso.`,
              link: linkDaDisputa(sessao),
            });
          }
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "verificacao",
            mensagem: `Aguardando ${oQue} antes de entrar${ate ? ` (até as ${ate})` : ""} — a equipe Praefectus foi avisada`,
            item: null,
            dados: { tipo: tipoPedido },
          }]);
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
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "encerrou",
            mensagem: payload.resultado === "parada_emergencial"
              ? "Sessão interrompida pela parada emergencial"
              : `Sessão encerrada${typeof payload.motivo === "string" && payload.motivo ? ` — ${payload.motivo}` : ""}` +
                `${typeof payload.lances_enviados === "number" ? ` · ${payload.lances_enviados} lance(s) enviado(s)` : ""}`,
            item: null,
            dados: { resultado: payload.resultado ?? null, motivo: payload.motivo ?? null },
          }]);

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
            // O agente diz por que saiu (teto, piso, item encerrado, limite de
            // horas, pedido pelo painel) e quantos lances o portal aceitou.
            // Agente anterior a 16/09 não manda os dois — aí a frase não os cita.
            const motivoDoFim = typeof payload.motivo === "string" && payload.motivo ? ` Motivo: ${payload.motivo}.` : "";
            const lancesDoRobo = typeof payload.lances_enviados === "number"
              ? ` ${payload.lances_enviados} lance(s) enviado(s) pelo robô.`
              : "";

            await supabase.from("licitacao_mensagens").insert({
              licitacao_id: sessao.licitacao_id,
              user_id: userId,
              tipo: "sistema",
              conteudo: emergencia
                ? `🛑 **Sessão do robô interrompida** em ${sessao.edital} ` +
                  `(${sessao.portal_nome}) após ${rodadas} rodada(s). ` +
                  `A parada foi acionada por uma pessoa. O resultado da disputa ainda precisa ser registrado.`
                : `🏁 **Sessão do robô encerrada** em ${sessao.edital} ` +
                  `(${sessao.portal_nome}) após ${rodadas} rodada(s).${lancesDoRobo}${motivoDoFim} ` +
                  `O resultado da disputa ainda precisa ser registrado.`,
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
                `A sessão em ${sessao.portal_nome} terminou após ${rodadas} rodada(s).${lancesDoRobo}${motivoDoFim} ` +
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
          const mensagemDoErro = payload.mensagem || "Erro desconhecido";
          await supabase
            .from("sessoes_lance_real")
            .update({
              status: "erro",
              erro: mensagemDoErro,
            })
            .eq("id", sessao_id);
          // O robô que não conseguiu operar é o caso mais caro de ficar
          // calado: a disputa acontece do mesmo jeito, só que sem ninguém
          // sabendo que ela está sem robô. A sessão já registrava o erro na
          // própria linha, e ninguém olha a linha durante um pregão.
          await supabase.from("notificacoes").insert({
            user_id: userId,
            tipo: "urgente",
            titulo: `⚠️ Robô parou — ${sessao.edital}`,
            mensagem:
              `${String(mensagemDoErro).slice(0, 200)} ` +
              `A disputa em ${sessao.portal_nome} segue sem o robô até alguém agir.`,
            link: linkDaDisputa(sessao),
          });
          await registrarEventos(supabase, sessao, userId, [{
            tipo: "erro",
            mensagem: "O robô parou com erro — a disputa segue sem o robô até alguém agir",
            item: null,
            dados: {},
          }]);
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
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const { sessao_id } = body;
      if (!sessao_id) return jsonResponse({ error: "sessao_id é obrigatório" }, 400);
      if (!ehUuid(sessao_id)) return jsonResponse({ error: FRASES_AO_CLIENTE.sessaoNaoEncontrada }, 404);

      // `select("*")` de propósito: com ou sem a migration nova a leitura não
      // falha por coluna ausente — `empresa_id` só vem `undefined`.
      const { data: sessao, error: erroSessao } = await supabase
        .from("sessoes_lance_real")
        .select("*")
        .eq("id", sessao_id)
        .maybeSingle();
      if (erroSessao) {
        await registrarNoLog(supabase, user.id, "parar-sessao-falha", { sessao_id, etapa: "ler-sessao" }, {
          erro: erroSessao.message,
        });
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.falhaInterna, { ehAdmin, detalhe: erroSessao.message }),
          500
        );
      }
      if (!sessao) return jsonResponse({ error: FRASES_AO_CLIENTE.sessaoNaoEncontrada }, 404);

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
          await registrarNoLog(supabase, user.id, "parar-sessao-falha", { sessao_id, etapa: "ler-papel" }, {
            erro: erroMembro.message,
          });
          return jsonResponse(
            corpoDeErro(FRASES_AO_CLIENTE.falhaInterna, { ehAdmin, detalhe: erroMembro.message }),
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

      // O cliente lê a frase; o detalhe (migration, mensagem do banco) vai para
      // o log e, para o administrador da plataforma, em `detalhe_tecnico`.
      const observacoes: string[] = [];
      const detalhesTecnicos: string[] = [];
      const anotar = (frase: string, detalhe?: string) => {
        observacoes.push(frase);
        if (detalhe) detalhesTecnicos.push(detalhe);
      };
      let colunasDaParada = true;

      // 1. A LÁPIDE, antes de qualquer chamada ao agente.
      const solicitadaEm = new Date().toISOString();
      const { error: erroLapide } = await supabase
        .from("sessoes_lance_real")
        .update({ parada_solicitada_em: solicitadaEm, parada_solicitada_por: user.id })
        .eq("id", sessao_id);
      if (erroLapide && erroDeColunaAusente(erroLapide)) {
        colunasDaParada = false;
        anotar(
          "O pedido de parada não ficou registrado na sessão.",
          "O banco ainda não tem as colunas da parada em dois tempos (migration 20260914000002 não aplicada)."
        );
      } else if (erroLapide) {
        anotar("O pedido de parada não ficou registrado na sessão.", erroLapide.message);
      }

      // 2. Os agentes — os do DONO da sessão, não os de quem clicou: o colega
      // que freia o robô não tem agente próprio. O agente em que a sessão foi
      // aberta vai primeiro, porque é onde ela vive.
      //
      // Depois deles, o agente da PLATAFORMA (`AGENTE_URL_BASE`): é onde vivem
      // as sessões de quem não tem agente próprio, gravadas com `agente_id`
      // nulo — e por isso ele passa à frente quando a sessão não tem vínculo.
      const filtroAgentes = sessao.agente_id
        ? `user_id.eq.${sessao.user_id},id.eq.${sessao.agente_id}`
        : `user_id.eq.${sessao.user_id}`;
      const { data: agentesLidos, error: erroAgentes } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .or(filtroAgentes);
      const doDono = [...(agentesLidos || [])].sort(
        (a, b) => Number(b.id === sessao.agente_id) - Number(a.id === sessao.agente_id)
      );
      const agentes = comAgenteGerenciado(doDono, ambiente, { primeiro: !sessao.agente_id });

      const tentativas: Array<Record<string, unknown>> = [];
      if (erroAgentes) {
        tentativas.push({ agente: null, motivo: `Não foi possível ler os agentes: ${erroAgentes.message}` });
      }
      if (!agentes.length) {
        tentativas.push({ agente: null, motivo: "Nenhum agente configurado para esta sessão e segredo AGENTE_URL_BASE ausente" });
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
          tentativas.push({ agente: agente.nome, motivo: textoDoErro(e) });
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
          anotar(
            "O robô confirmou a parada, mas a lista de sessões ainda não reflete isso.",
            `Sessão não atualizada no banco após a confirmação: ${erroFinal.message}`
          );
        }
      } else {
        const resumo = tentativas
          .map((t) => [t.agente, t.motivo ?? t.status].filter(Boolean).join(": "))
          .filter(Boolean)
          .join(" · ");
        // Sem `updated_at`: na lista ele é o "último sinal" do robô, e um
        // pedido nosso não é sinal dele.
        //
        // A nota com o resumo cru fica na SESSÃO, que é o registro de
        // diagnóstico que a plataforma lê; a resposta ao cliente sai sem ele.
        const { error: erroNota } = await supabase
          .from("sessoes_lance_real")
          .update({
            erro: `Parada solicitada sem confirmação do agente${resumo ? ` (${resumo})` : ""}. ` +
                  `O robô pode continuar operando no portal.`,
          })
          .eq("id", sessao_id);
        if (erroNota) {
          anotar(
            "A falta de confirmação não ficou anotada na sessão.",
            `A nota das tentativas não foi gravada na sessão: ${erroNota.message}`
          );
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
          detalhes_tecnicos: detalhesTecnicos,
        },
      });
      if (erroLog) {
        anotar("O registro de auditoria da parada falhou.", `webhook_log: ${erroLog.message}`);
      }

      return jsonResponse({
        // `parou` fica por compatibilidade com telas antigas; significa o mesmo
        // que `agente_confirmou`.
        parou: confirmadaEm !== null,
        agente_confirmou: confirmadaEm !== null,
        parada_solicitada_em: solicitadaEm,
        parada_confirmada_em: confirmadaEm,
        sessao_id,
        // Cliente: sem nome de agente nem erro cru (ver `tentativasParaCliente`).
        tentativas: ehAdmin ? tentativas : tentativasParaCliente(tentativas),
        ...(observacoes.length ? { observacoes } : {}),
        ...(ehAdmin && detalhesTecnicos.length ? { detalhe_tecnico: detalhesTecnicos } : {}),
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
    //
    // Só sessão que a pessoa pode ver (dela ou das empresas dela): no agente
    // compartilhado, o id de outra empresa traria para a frente a janela dela.
    if (action === "focar-sessao") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const { sessao_id } = body;
      if (!sessao_id) return jsonResponse({ error: "sessao_id é obrigatório" }, 400);

      if (!ehAdmin && !(await sessoesVisiveis(supabase, user.id, [sessao_id])).has(sessao_id)) {
        return jsonResponse({ focou: false, sessao_id, error: FRASES_AO_CLIENTE.sessaoNaoEncontrada }, 404);
      }

      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .eq("user_id", user.id);
      const agentes = agentesParaUsuario(proprios, ambiente);

      if (!agentes.length) {
        const detalhe = "Nenhum agente próprio e segredo AGENTE_URL_BASE ausente ou inválido.";
        await registrarNoLog(supabase, user.id, "focar-sessao-falha", { sessao_id, etapa: "sem-agente" }, { erro: detalhe });
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.semRobo, { ehAdmin, detalhe, extra: { focou: false, sessao_id } }),
          400
        );
      }

      const tentativas: Array<Record<string, unknown>> = [];
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
          // 404 aqui costuma ser agente ANTIGO, sem a rota. O detalhe fica no
          // log e no `detalhe_tecnico`: poupa procurar defeito onde só falta
          // atualizar o agente da VPS.
          tentativas.push({ agente: agente.nome, status: resp.status, motivo: corpo?.error ?? null });
        } catch (e) {
          tentativas.push({ agente: agente.nome, motivo: textoDoErro(e) });
        }
      }

      await registrarNoLog(supabase, user.id, "focar-sessao-falha", { sessao_id, tentativas });
      return jsonResponse(
        corpoDeErro(FRASES_AO_CLIENTE.focoNaoAconteceu, {
          ehAdmin,
          detalhe: tentativas,
          extra: { focou: false, sessao_id },
        }),
        502
      );
    }

    if (action === "kill-switch") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const { motivo } = body;
      const motivoTexto = motivo || "Acionada pelo operador";
      const observacoes: string[] = [];
      const detalhesTecnicos: string[] = [];
      const anotar = (frase: string, detalhe?: string) => {
        observacoes.push(frase);
        if (detalhe) detalhesTecnicos.push(detalhe);
      };

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
        anotar(
          "O freio alcançou só as sessões iniciadas por você.",
          "Migration 20260914000002 não aplicada: sem `empresa_id` nas sessões."
        );
        ({ data: sessoesLidas, error: erroSessoes } = await lerSessoes(false));
      }
      if (erroSessoes) {
        await registrarNoLog(supabase, user.id, "kill-switch-falha", { etapa: "ler-sessoes" }, { erro: erroSessoes.message });
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.falhaInterna, { ehAdmin, detalhe: erroSessoes.message }),
          500
        );
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
          anotar("A marca de parada emergencial não foi gravada nas sessões.", erroMarca.message);
        }
      }

      // Agentes: os das sessões alvo (onde elas vivem), os ativos de quem
      // aciona e — para sessão sem vínculo, ou para quem não tem agente
      // próprio — o da plataforma.
      const idsAgente = [
        ...new Set(sessoesAtivas.map((s: { agente_id?: string | null }) => s.agente_id).filter(Boolean)),
      ] as string[];
      const { data: agentesLidos } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash, status, user_id")
        .or(idsAgente.length ? `user_id.eq.${user.id},id.in.(${idsAgente.join(",")})` : `user_id.eq.${user.id}`);
      const linhas = (agentesLidos || []).filter(
        (a: { id: string; status: string }) => a.status === "ativo" || idsAgente.includes(a.id)
      );
      const precisaDoGerenciado = !linhas.length || sessoesAtivas.some(
        (s: { agente_id?: string | null }) => !s.agente_id || !linhas.some((a: { id: string }) => a.id === s.agente_id)
      );
      const agentes = precisaDoGerenciado
        ? comAgenteGerenciado(linhas, ambiente, { deduplicar: false })
        : agentesParaUsuario(linhas, null);

      const { porAgente, semAgente } = rotearSessoes(
        sessoesAtivas.map((s: { id: string; agente_id?: string | null }) => ({ id: s.id, agente_id: s.agente_id ?? null })),
        agentes
      );

      const confirmadas = new Set<string>();
      const agentResults: Array<{
        id: string | null; agente: string; ok: boolean; http: number; detalhe: string | null;
        modo: "kill-switch" | "por-sessao";
      }> = [];
      for (const [i, agente] of agentes.entries()) {
        const base = String(agente.url_base || "").replace(/\/+$/, "");
        const headers = {
          "Content-Type": "application/json",
          "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada),
        };
        const daqui = porAgente.get(i) || [];

        // ── AGENTE COMPARTILHADO: SESSÃO POR SESSÃO ─────────────────────────
        //
        // A rota /kill-switch do agente encerra TUDO o que roda nele. No
        // agente da plataforma isso são as disputas de todas as empresas: o
        // freio de uma virava o apagão das outras. Ali o freio pede
        // `/sessao/encerrar` para cada sessão alvo — e agente compartilhado
        // sem sessão alvo nem é chamado.
        if (agenteCompartilhado(agente, ambiente.AGENTE_URL_BASE)) {
          if (!daqui.length) continue;
          const respostas = await Promise.all(daqui.map(async (sid) => {
            try {
              const resp = await fetch(`${base}/sessao/encerrar`, {
                method: "POST",
                headers,
                body: JSON.stringify({ sessao_id: sid, motivo }),
                signal: AbortSignal.timeout(8000),
              });
              await resp.body?.cancel().catch(() => {});
              return { sid, ok: resp.ok, http: resp.status, detalhe: resp.ok ? null : `HTTP ${resp.status}` };
            } catch (e) {
              return { sid, ok: false, http: 0, detalhe: textoDoErro(e) };
            }
          }));
          respostas.filter((r) => r.ok).forEach((r) => confirmadas.add(r.sid));
          const falhas = respostas.filter((r) => !r.ok);
          agentResults.push({
            id: agente.id,
            agente: agente.nome,
            ok: falhas.length === 0,
            http: falhas[0]?.http ?? 200,
            detalhe: falhas.length
              ? `${falhas.length} de ${respostas.length} sessão(ões) sem confirmação: ` +
                falhas.map((f) => `${f.sid}: ${f.detalhe}`).join("; ")
              : null,
            modo: "por-sessao",
          });
          continue;
        }

        // Agente próprio (servidor de uma empresa só): a rota /kill-switch,
        // que para tudo o que roda NELE — como antes.
        try {
          const resp = await fetch(`${base}/kill-switch`, {
            method: "POST",
            headers,
            body: JSON.stringify({ motivo }),
            signal: AbortSignal.timeout(5000),
          });
          await resp.body?.cancel().catch(() => {});
          agentResults.push({
            id: agente.id,
            agente: agente.nome,
            ok: resp.ok,
            http: resp.status,
            detalhe: resp.ok ? null : (resp.status === 404
              ? "o agente não implementa a rota /kill-switch"
              : `HTTP ${resp.status}`),
            modo: "kill-switch",
          });
          if (resp.ok) daqui.forEach((sid) => confirmadas.add(sid));
        } catch (e) {
          agentResults.push({
            id: agente.id,
            agente: agente.nome,
            ok: false,
            http: 0,
            detalhe: textoDoErro(e) || "sem resposta do agente",
            modo: "kill-switch",
          });
        }
      }

      // 3. O desfecho — "encerrado" só na sessão cujo agente confirmou.
      //
      // Sessão sem agente conhecido (sem vínculo e sem agente da plataforma
      // configurado) só conta como confirmada se TODOS os /kill-switch
      // avisados confirmaram — sem saber onde ela vive, "algum confirmou" não
      // prova nada sobre ela, e o encerramento sessão a sessão de um agente
      // compartilhado não a alcança.
      const globais = agentResults.filter((r) => r.modo === "kill-switch");
      if (globais.length > 0 && globais.every((r) => r.ok)) {
        semAgente.forEach((id) => confirmadas.add(id));
      }
      const idsConfirmados = idsSessao.filter((id: string) => confirmadas.has(id));
      const idsAguardando = idsSessao.filter((id: string) => !confirmadas.has(id));

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
          anotar(
            "O robô confirmou a parada, mas a lista de sessões ainda não reflete isso.",
            `Sessões não atualizadas no banco após a confirmação: ${erroFinal.message}`
          );
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
        if (erroNota) {
          anotar("A falta de confirmação não ficou anotada nas sessões.", `Nota de parada pendente: ${erroNota.message}`);
        }
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
          detalhes_tecnicos: detalhesTecnicos,
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
        // Cliente: sem id, nome, HTTP nem erro cru — `KillSwitchButton` lê
        // só `ok` e `detalhe`.
        agentes_notificados: ehAdmin
          ? agentResults
          : agentResults.map((r) => ({ ok: r.ok, detalhe: r.ok ? null : FRASES_AO_CLIENTE.freioSemConfirmacao })),
        observacoes,
        ...(ehAdmin && detalhesTecnicos.length ? { detalhe_tecnico: detalhesTecnicos } : {}),
      });
    }

    // ─── STATUS ───

    // ─── instalar-certificado ───
    // Repete a entrega do certificado ao agente. O upload ja tenta sozinho; esta
    // acao existe para quando o agente estava fora do ar naquele momento — sem
    // ela, a unica saida seria gerar um novo link e reenviar o arquivo inteiro.
    if (action === "instalar-certificado") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      // Com agente próprio ativo, o helper escolhe sozinho — como antes. Sem
      // ele, o agente da PLATAFORMA vai como terceiro argumento.
      //
      // ⚠️ `_shared/certificado-agente.ts` ainda lê o agente só por `user_id`
      // e ignora esse argumento. Enquanto não aceitar, o resultado volta com
      // "Nenhum agente ativo configurado…" — detectado abaixo e registrado no
      // `webhook_log`, para não passar por falha do cliente.
      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .limit(1);
      const gerenciado = (proprios || []).length ? null : agentesParaUsuario([], ambiente)[0] ?? null;
      if (!(proprios || []).length && !gerenciado) {
        const detalhe = "Nenhum agente próprio ativo e segredo AGENTE_URL_BASE ausente ou inválido.";
        await registrarNoLog(supabase, user.id, "instalar-certificado-falha", { etapa: "sem-agente" }, { erro: detalhe });
        return jsonResponse(
          {
            instalado: false,
            motivo: FRASES_AO_CLIENTE.semRobo,
            certificado: null,
            ...(ehAdmin ? { detalhe_tecnico: detalhe } : {}),
          },
          400
        );
      }

      const instalar = instalarCertificadoNoAgente as unknown as (
        ...args: unknown[]
      ) => Promise<{ instalado: boolean; motivo: string | null; certificado?: Record<string, unknown> | null }>;
      const resultado = await instalar(
        supabase,
        user.id,
        gerenciado ? { ...gerenciado, api_key_hash: chaveGerenciada } : undefined
      );

      if (!resultado.instalado) {
        const helperIgnorouOGerenciado = !!gerenciado &&
          /^Nenhum agente ativo configurado/.test(resultado.motivo || "");
        await registrarNoLog(
          supabase,
          user.id,
          "instalar-certificado-falha",
          {
            etapa: helperIgnorouOGerenciado ? "helper-sem-agente-gerenciado" : "instalacao",
            agente_gerenciado: !!gerenciado,
            certificado: resultado.certificado ?? null,
          },
          {
            erro: helperIgnorouOGerenciado
              ? "certificado-agente.ts ainda não aceita o agente gerenciado (3º argumento): " + resultado.motivo
              : resultado.motivo,
          }
        );
      }

      let certificado: unknown = resultado.certificado ?? null;
      if (!ehAdmin && certificado) {
        const empresas = await empresasDoUsuario(supabase, user.id);
        certificado = certificadoParaCliente(certificado, await cnpjsDasEmpresas(supabase, empresas));
      }
      return jsonResponse(
        {
          instalado: resultado.instalado,
          motivo: ehAdmin ? resultado.motivo : motivoDoCertificadoParaCliente(resultado.motivo),
          certificado,
        },
        resultado.instalado ? 200 : 400
      );
    }

    // A pessoa responde o que a tela pediu, e QUEM DIGITA é o robô.
    //
    // Medido em 09/09/2026: um código do gov.br levava ~50s para ir do celular
    // até o campo — WhatsApp, leitura, troca de aba, teclado do VNC — e o código
    // vale ~60s. Três tentativas queimaram e a conta do cliente foi bloqueada
    // por excesso de erro (ERL0018900). Por aqui o mesmo número chega em ~2s.
    //
    // Só para sessão que a pessoa pode ver: no agente compartilhado, digitar
    // no pedido de outra empresa seria operar a conta dela no portal.
    if (action === "responder-humano") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const { sessao_id, valor } = body;
      if (!sessao_id || valor === undefined || valor === null || String(valor).trim() === "") {
        return jsonResponse({ error: "sessao_id e valor são obrigatórios" }, 400);
      }

      if (!ehAdmin && !(await sessoesVisiveis(supabase, user.id, [sessao_id])).has(sessao_id)) {
        return jsonResponse({ aceito: false, error: FRASES_AO_CLIENTE.sessaoNaoEncontrada }, 404);
      }

      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash")
        .eq("user_id", user.id);
      const agentes = agentesParaUsuario(proprios, ambiente);

      if (!agentes.length) {
        const detalhe = "Nenhum agente próprio e segredo AGENTE_URL_BASE ausente ou inválido.";
        await registrarNoLog(supabase, user.id, "responder-humano-falha", { sessao_id, etapa: "sem-agente" }, { erro: detalhe });
        return jsonResponse(corpoDeErro(FRASES_AO_CLIENTE.semRobo, { ehAdmin, detalhe }), 400);
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
            return jsonResponse({
              aceito: true,
              tipo: corpo.tipo ?? null,
              ...(ehAdmin ? { agente: agente.nome } : {}),
            });
          }
          tentativas.push({ agente: agente.nome, status: resp.status, motivo: corpo?.error ?? null });
        } catch (e) {
          tentativas.push({ agente: agente.nome, motivo: textoDoErro(e) });
        }
      }

      // O log leva as tentativas — nunca o valor.
      await registrarNoLog(supabase, user.id, "responder-humano-falha", { sessao_id, tentativas });
      return jsonResponse(
        {
          aceito: false,
          error: FRASES_AO_CLIENTE.semPedidoEmAberto,
          ...(ehAdmin ? { tentativas } : {}),
        },
        409
      );
    }

    // Healthcheck AO VIVO. Antes, o único ping acontecia ao configurar o
    // agente: versão, RAM e "ativo" ficavam congelados no banco desde então —
    // a tela dizia "Agente Online" lendo uma linha de meses atrás. Aqui
    // perguntamos ao agente e atualizamos o registro. Também substitui o
    // heartbeat que o agente nunca empurrou: puxamos o sinal de vida.
    //
    // ── DUAS VISÕES (14/09/2026) ────────────────────────────────────────────
    //
    // Administrador da plataforma: a saúde completa, como sempre foi — agora
    // também com `sessoes` e `desfechos_humano`, que `usePedidosDoRobo` já lia
    // e esta ação nunca devolvia (a lista de sessões vivas vinha sempre vazia).
    //
    // Cliente: `reduzirSaudeParaCliente` (_shared/robo-plataforma.ts), onde o
    // contrato está escrito campo a campo. Sem endereço, nome do host, versão,
    // RAM, slots nem erro cru — e só as sessões e os pedidos de código que ele
    // pode ver. O `/health` do agente compartilhado traz os de TODAS as
    // empresas.
    if (action === "healthcheck") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, capacidades")
        .eq("user_id", user.id);
      const agentes = agentesParaUsuario(proprios, ambiente);

      if (!agentes.length) {
        return jsonResponse({ configurado: false, online: false, agentes: [] });
      }

      // O freio do agente gerenciado não tem linha própria onde morar: vale o
      // último teste gravado nas linhas que apontam para o mesmo host.
      const freioGerenciado = agentes.some((a) => a.gerenciado)
        ? await freioDoAgenteGerenciado(supabase, ambiente.AGENTE_URL_BASE)
        : null;

      const resultados = await Promise.all(agentes.map(async (agente) => {
        const { online, saude, erro, latencia_ms } = await sondarAgente(agente.url_base);
        const capacidadesAtuais = agente.capacidades as Record<string, unknown> | undefined;

        // O registro passa a refletir a realidade — inclusive quando é ruim.
        // O agente gerenciado não tem linha: nada a atualizar.
        if (agente.id) {
          await supabase
            .from("agente_externo_config")
            .update({
              status: online ? "ativo" : "erro",
              ultimo_heartbeat: online ? new Date().toISOString() : undefined,
              versao_agente: (saude?.version as string) ?? undefined,
              ram_mb: ((saude?.capacidade as Record<string, number>)?.ram_total_mb) ?? undefined,
              sessoes_ativas: (saude?.sessoes_ativas as number) ?? undefined,
              // Mescla: o snapshot de saúde não pode apagar o resultado do
              // teste do freio de emergência guardado no mesmo campo. E vai
              // SEM sessões, pedidos e certificado — ver `saudeParaGuardar`.
              capacidades: saude
                ? ({ ...(capacidadesAtuais || {}), saude: saudeParaGuardar(saude) } as never)
                : undefined,
            })
            .eq("id", agente.id);
        }

        return {
          id: agente.id,
          nome: agente.nome,
          url_base: agente.url_base,
          gerenciado: agente.gerenciado,
          online,
          erro,
          latencia_ms,
          versao: saude?.version ?? null,
          capacidade: saude?.capacidade ?? null,
          sessoes_ativas: saude?.sessoes_ativas ?? null,
          sessoes: saude?.sessoes ?? null,
          certificado: saude?.certificado ?? null,
          portais_suportados: saude?.portais_suportados ?? null,
          // O que o robô está esperando de uma pessoa AGORA. Vem da tela real
          // em que ele parou, não de configuração por portal: se o cliente
          // desligar a verificação em duas etapas, esta lista vem vazia e
          // nenhum campo aparece na interface.
          aguardando_humano: saude?.aguardando_humano ?? null,
          desfechos_humano: saude?.desfechos_humano ?? null,
          // Freio de emergência: só o teste explícito prova que existe
          kill_switch: agente.gerenciado
            ? freioGerenciado
            : (capacidadesAtuais as { kill_switch?: unknown })?.kill_switch ?? null,
        };
      }));

      const completa = {
        configurado: true,
        online: resultados.some((r) => r.online),
        agentes: resultados,
      };
      if (ehAdmin) return jsonResponse(completa);

      const empresas = await empresasDoUsuario(supabase, user.id);
      const visiveis = await sessoesVisiveis(supabase, user.id, idsDeSessaoNaSaude(completa), empresas);
      const cnpjs = resultados.some((r) => r.certificado && typeof r.certificado === "object")
        ? await cnpjsDasEmpresas(supabase, empresas)
        : [];
      return jsonResponse(reduzirSaudeParaCliente(completa, visiveis, { cnpjsVisiveis: cnpjs }));
    }

    // Teste do freio de emergência. Sondar a rota por HEAD/OPTIONS não
    // distingue "ausente" de "protegida" neste agente, e um POST às cegas
    // durante uma disputa abortaria lances reais. Então o teste é DELIBERADO
    // e só roda sem sessões ativas — como se testa um alarme de incêndio.
    //
    // Exclusivo da operação Praefectus (14/09/2026). No agente compartilhado
    // "sem sessões ativas" quer dizer sem as de NINGUÉM: o teste pergunta ao
    // próprio agente antes, e não roda se ele estiver ocupado ou mudo.
    if (action === "testar-kill-switch") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      if (!(await ehAdminDaPlataforma(supabase, user.id))) {
        return jsonResponse({ error: FRASES_AO_CLIENTE.exclusivoDaPlataforma }, 403);
      }

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

      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base, api_key_hash, capacidades")
        .eq("user_id", user.id);
      const agentes = comAgenteGerenciado(proprios, ambiente);
      if (!agentes.length) {
        return jsonResponse({ error: "Nenhum agente configurado e segredo AGENTE_URL_BASE ausente." }, 400);
      }

      const resultados: Array<Record<string, unknown>> = [];
      let freioDoGerenciado: Record<string, unknown> | null = null;
      for (const agente of agentes) {
        const base = agente.url_base.replace(/\/$/, "");
        const compartilhado = agenteCompartilhado(agente, ambiente.AGENTE_URL_BASE);

        if (compartilhado) {
          const sondagem = await sondarAgente(base);
          const vivas = contarSessoesVivasNaSaude(sondagem.saude);
          if (!sondagem.online || vivas > 0) {
            // Pulado não é reprovado: nada é gravado, e o último teste vale.
            resultados.push({
              agente: agente.nome,
              ok: false,
              http: 0,
              pulado: true,
              detalhe: !sondagem.online
                ? `o agente não respondeu ao /health (${sondagem.erro}) — sem confirmar que está vazio, o teste não roda`
                : `há ${vivas} sessão(ões) em andamento neste agente, de qualquer empresa — o teste não roda`,
              testado_em: null,
            });
            continue;
          }
        }

        let ok = false, http = 0, detalhe: string | null = null;
        try {
          const resp = await fetch(`${base}/kill-switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Agent-Key": chaveParaOAgente(agente, chaveGerenciada) },
            body: JSON.stringify({ motivo: "Teste de verificação do freio de emergência (sem sessões ativas)", teste: true }),
            signal: AbortSignal.timeout(8000),
          });
          await resp.body?.cancel().catch(() => {});
          ok = resp.ok;
          http = resp.status;
          if (!ok) {
            detalhe = resp.status === 404
              ? "o agente não implementa a rota POST /kill-switch"
              : `HTTP ${resp.status}`;
          }
        } catch (e) {
          detalhe = textoDoErro(e) || "sem resposta do agente";
        }

        const registro = { ok, http, detalhe, testado_em: new Date().toISOString() };
        if (agente.id) {
          const capacidades = (agente.capacidades as Record<string, unknown>) || {};
          await supabase
            .from("agente_externo_config")
            .update({ capacidades: { ...capacidades, kill_switch: registro } as never })
            .eq("id", agente.id);
        }
        // O freio é do HOST, não da linha: toda linha que aponta para o agente
        // compartilhado — de qualquer empresa — passa a refletir este teste,
        // e o `healthcheck` do agente gerenciado o lê de lá.
        if (compartilhado) {
          await propagarFreio(supabase, agente.url_base, registro);
          if (agente.gerenciado) freioDoGerenciado = registro;
        }

        resultados.push({ agente: agente.nome, ...registro });
      }

      await supabase.from("webhook_log").insert({
        user_id: user.id,
        direcao: "saida",
        tipo: "teste-kill-switch",
        payload: {
          resultados,
          // Reserva de leitura para `freioDoAgenteGerenciado` quando nenhuma
          // linha aponta para o host da plataforma.
          ...(freioDoGerenciado ? { kill_switch_gerenciado: freioDoGerenciado } : {}),
        },
      });

      const executados = resultados.filter((r) => !r.pulado);
      return jsonResponse({
        verificado: executados.length > 0 && executados.every((r) => r.ok),
        resultados,
      });
    }

    // Exclusivo da plataforma na parte do agente: o cliente recebe as próprias
    // sessões e `agentes: []` (o formato fica, o conteúdo sai).
    if (action === "status") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const sessoesResp = await supabase
        .from("sessoes_lance_real")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!ehAdmin) {
        return jsonResponse({ agentes: [], sessoes: sessoesResp.data || [] });
      }

      const agenteResp = await supabase
        .from("agente_externo_config")
        // Esta resposta vai ao navegador: nunca `*`, que levaria a chave.
        .select(COLUNAS_PUBLICAS_DO_AGENTE)
        .eq("user_id", user.id);
      const gerenciado = agentesParaUsuario([], ambiente)[0] ?? null;

      return jsonResponse({
        agentes: agenteResp.data || [],
        sessoes: sessoesResp.data || [],
        // O que o servidor sabe do agente da plataforma — sem a chave, só se ela existe.
        agente_gerenciado: {
          configurado: !!gerenciado,
          url_base: gerenciado?.url_base ?? null,
          chave_configurada: !!chaveGerenciada,
        },
      });
    }

    // ─── situacao-do-robo ───
    //
    // A pergunta que o CLIENTE faz, em palavras dele: "o robô da minha empresa
    // pode trabalhar agora?". Sem host, versão, RAM, slots nem erro técnico —
    // isso é da operação Praefectus.
    //
    //   disponivel          algum agente que atende o usuário respondeu ao
    //                       /health (2xx em até 8s)
    //   motivo              frase de negócio quando algo impede; null quando não
    //   ligado              `robo_empresa_config.ligado`; sem linha ou sem a
    //                       tabela (migration 20260914000004) = true
    //   portais_suportados  os portais que o agente no ar opera, ou null
    //   verificado_em       ISO
    //
    // Só para membro da empresa (403 para os demais). O administrador da
    // plataforma consulta qualquer empresa e recebe `detalhe_tecnico`.
    if (action === "situacao-do-robo") {
      const { user, resposta: naoAutenticado } = await usuarioDaRequisicao(supabase, req);
      if (!user) return naoAutenticado!;
      const ehAdmin = await ehAdminDaPlataforma(supabase, user.id);

      const empresaId = typeof body.empresa_id === "string" ? body.empresa_id.trim() : "";
      if (!empresaId) return jsonResponse({ error: "empresa_id é obrigatório" }, 400);

      if (!ehAdmin) {
        if (!ehUuid(empresaId)) return jsonResponse({ error: FRASES_AO_CLIENTE.foraDaEmpresa }, 403);
        const { data: membro, error: erroMembro } = await supabase
          .from("empresa_membros")
          .select("empresa_id")
          .eq("empresa_id", empresaId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (erroMembro) {
          await registrarNoLog(supabase, user.id, "situacao-do-robo-falha", { empresa_id: empresaId, etapa: "ler-membro" }, {
            erro: erroMembro.message,
          });
          return jsonResponse({ error: FRASES_AO_CLIENTE.situacaoIlegivel }, 503);
        }
        if (!membro) return jsonResponse({ error: FRASES_AO_CLIENTE.foraDaEmpresa }, 403);
      }

      const ligadoLido = await lerLigadoDaEmpresa(supabase, empresaId);
      if (ligadoLido.estado === "indeterminado") {
        await registrarNoLog(supabase, user.id, "situacao-do-robo-falha", { empresa_id: empresaId, etapa: "ler-ligado" }, {
          erro: ligadoLido.detalhe,
        });
        return jsonResponse(
          corpoDeErro(FRASES_AO_CLIENTE.situacaoIlegivel, { ehAdmin, detalhe: ligadoLido.detalhe }),
          503
        );
      }
      const ligado = ligadoLido.estado !== "desligado";

      const { data: proprios } = await supabase
        .from("agente_externo_config")
        .select("id, nome, url_base")
        .eq("user_id", user.id);
      const agentes = agentesParaUsuario(proprios, ambiente);
      const sondagens = await Promise.all(agentes.map((a) => sondarAgente(a.url_base)));
      const noAr = sondagens.find((s) => s.online) ?? null;
      const disponivel = noAr !== null;

      const motivo = !agentes.length
        ? FRASES_AO_CLIENTE.semRobo
        : !ligado
        ? FRASES_AO_CLIENTE.situacaoDesligado
        : !disponivel
        ? FRASES_AO_CLIENTE.situacaoForaDoAr
        : null;

      const portais = noAr && Array.isArray(noAr.saude?.portais_suportados)
        ? (noAr.saude!.portais_suportados as unknown[]).filter((p): p is string => typeof p === "string")
        : null;

      // Rastro da indisponibilidade (princípio 3) — é o que a operação
      // procura quando um cliente liga dizendo que o robô sumiu.
      const detalhe = !agentes.length
        ? "Nenhum agente próprio e segredo AGENTE_URL_BASE ausente ou inválido."
        : !disponivel
        ? sondagens.map((s, i) => `${agentes[i].nome}: ${s.erro}`).join(" · ")
        : null;
      if (detalhe) {
        await registrarNoLog(supabase, user.id, "situacao-do-robo-indisponivel", { empresa_id: empresaId }, { erro: detalhe });
      }

      return jsonResponse({
        disponivel,
        motivo,
        ligado,
        portais_suportados: portais,
        verificado_em: new Date().toISOString(),
        ...(ehAdmin && detalhe ? { detalhe_tecnico: detalhe } : {}),
      });
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 404);
  } catch (e: any) {
    console.error("robo-lances-webhook error:", e);
    // O callback é do agente, que registra a resposta no log dele — lá o
    // texto cru ajuda a achar o defeito. As telas recebem a frase de negócio;
    // o detalhe fica no log da edge function (a linha acima).
    return jsonResponse(
      { error: acaoAtual === "callback" ? (e?.message || "Erro interno") : FRASES_AO_CLIENTE.falhaInterna },
      500
    );
  }
});

/**
 * Reais numa frase de aviso: "R$ 1.234,56".
 *
 * Escrito à mão em vez de `Intl` porque o valor chega do agente como número
 * ou string, e um `NaN` formatado viraria "R$ NaN" no sino do usuário.
 */
/**
 * Grava eventos na linha do tempo da sessão (`robo_eventos_sessao`, D13).
 *
 * Nunca derruba o callback: a linha do tempo é informação adicional, e a
 * tabela pode ainda não existir (migration 20260916000005 não aplicada).
 */
async function registrarEventos(
  supabase: any,
  sessao: Record<string, any>,
  userId: string,
  eventos: EventoDaSala[],
): Promise<void> {
  if (!eventos.length) return;
  const { error } = await supabase.from("robo_eventos_sessao").insert(
    eventos.map((e) => ({
      sessao_id: sessao.id,
      user_id: userId,
      empresa_id: sessao.empresa_id ?? null,
      tipo: e.tipo,
      item: e.item,
      mensagem: e.mensagem,
      dados: e.dados,
    })),
  );
  if (error) console.error("[robo-lances-webhook] linha do tempo não gravada:", error.message);
}

function formatarReais(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  const [inteiro, centavos] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`;
}

/**
 * Para onde o aviso leva quem clicar.
 *
 * A página da disputa é onde há o que fazer; o processo é o segundo melhor
 * destino; a lista é o último recurso. O que não pode acontecer é um aviso
 * urgente com link quebrado — sessão sem disputa vinculada é estado
 * legítimo, não motivo para não avisar.
 */
function linkDaDisputa(
  sessao: { lance_config_id?: string | null; licitacao_id?: string | null } | null | undefined,
): string {
  if (sessao?.lance_config_id) return `/robo-lances/disputa/${sessao.lance_config_id}`;
  if (sessao?.licitacao_id) return `/processo/${sessao.licitacao_id}`;
  return "/robo-lances";
}

/**
 * FALHA PASSAGEIRA NO DESPACHO AGENDADO (16/09/2026): tenta de novo no minuto
 * seguinte, até `MAX_TENTATIVAS_ENVIO`.
 *
 * Antes, o robô sem resposta naquele minuto (VPS reiniciando, tempo estourado)
 * custava o pregão: `enviada_em` ficava marcado e o agendador nunca mais olhava
 * a disputa. Agora a conta sobe em `tentativas_envio` (migration
 * 20260916000004) e a marca é limpa para o próximo minuto pegar de novo.
 *
 * Avisa na PRIMEIRA falha ("tentando de novo") e quando desiste — as do meio só
 * vão ao log: um aviso por minuto treinaria a pessoa a ignorar o que importa.
 * Sem a coluna (migration não aplicada), segue o comportamento antigo: avisa e
 * não tenta de novo.
 */
const MAX_TENTATIVAS_ENVIO = 5;

async function tentarDeNovoOuDesistir(
  supabase: any,
  d: Record<string, any>,
  avisar: (titulo: string, mensagem: string) => Promise<void>,
  motivo: string,
): Promise<string> {
  const temColuna = Object.prototype.hasOwnProperty.call(d, "tentativas_envio");
  const tentativas = (Number(d.tentativas_envio) || 0) + 1;

  if (!temColuna) {
    await avisar(`🤖 Robô não entrou — ${d.edital}`, motivo);
    return "falha-sem-nova-tentativa";
  }

  const vaiTentar = tentativas < MAX_TENTATIVAS_ENVIO;
  const { error } = await supabase
    .from("robo_lances_disputas")
    .update(vaiTentar ? { tentativas_envio: tentativas, enviada_em: null } : { tentativas_envio: tentativas })
    .eq("id", d.id);

  if (error) {
    await avisar(`🤖 Robô não entrou — ${d.edital}`, motivo);
    return "falha-sem-nova-tentativa";
  }
  if (vaiTentar) {
    if (tentativas === 1) {
      await avisar(
        `🔁 Robô não entrou, tentando de novo — ${d.edital}`,
        `${motivo} O agendador tenta de novo a cada minuto, até ${MAX_TENTATIVAS_ENVIO} vezes.`,
      );
    }
    return `nova-tentativa-${tentativas}`;
  }
  await avisar(
    `🤖 Robô não entrou — ${d.edital}`,
    `${motivo} Foram ${MAX_TENTATIVAS_ENVIO} tentativas, uma por minuto, e o agendador desistiu. Envie ao robô pela página da disputa.`,
  );
  return "desistiu";
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Apoio: leituras e sondagens que várias ações repetem ───────────────────
//
// Aqui, e não em `_shared/robo-plataforma.ts`, porque falam com o banco e com
// a rede. As DECISÕES sobre o que elas devolvem ficam lá, onde há teste.

/** Quem chama. Sem usuário, `resposta` já é o 401 a devolver. */
async function usuarioDaRequisicao(
  supabase: any,
  req: Request,
): Promise<{ user: { id: string; email?: string | null } | null; resposta: Response | null }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { user: null, resposta: jsonResponse({ error: "Não autorizado" }, 401) };
  const { data, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !data?.user) return { user: null, resposta: jsonResponse({ error: "Token inválido" }, 401) };
  return { user: data.user, resposta: null };
}

/**
 * Trilha de uma ação no `webhook_log` — é para onde vai o detalhe técnico que
 * não pode ir para o cliente. Falha do log não derruba a ação: avisa no
 * console da função, que é o rastro que sobra.
 */
async function registrarNoLog(
  supabase: any,
  userId: string,
  tipo: string,
  payload: Record<string, unknown>,
  extra: { erro?: unknown; status_code?: number; resposta?: unknown } = {},
): Promise<void> {
  const linha: Record<string, unknown> = { user_id: userId, direcao: "saida", tipo, payload };
  if (extra.erro !== undefined && extra.erro !== null) {
    linha.erro = typeof extra.erro === "string" ? extra.erro : JSON.stringify(extra.erro);
  }
  if (extra.status_code !== undefined) linha.status_code = extra.status_code;
  if (extra.resposta !== undefined) linha.resposta = extra.resposta;
  try {
    const { error } = await supabase.from("webhook_log").insert(linha);
    if (error) console.error(`robo-lances-webhook: webhook_log (${tipo}) não gravado:`, error.message);
  } catch (e) {
    console.error(`robo-lances-webhook: webhook_log (${tipo}) não gravado:`, textoDoErro(e));
  }
}

/**
 * Lembretes de prontidão das disputas agendadas (Fase 8, 16/09/2026).
 *
 * Roda no mesmo minuto do agendador. Para cada disputa ainda não enviada que
 * começa nas próximas 24 horas: decide se cabe o lembrete da véspera ou o de
 * 1 hora antes (`qualLembrete`), RESERVA a marca na disputa antes de avisar
 * (duas execuções que se cruzam não mandam dois lembretes), confere o que
 * faria o robô não entrar e avisa quem cadastrou e quem opera a empresa.
 *
 * A sessão do gov.br vem do vigia do robô (`/health` → `vigia_sessao`), pelo
 * perfil da credencial. Sessão vencida ou robô sem resposta também avisam os
 * administradores da Praefectus, que são quem resolve.
 */
async function enviarLembretesDeProntidao(
  supabase: any,
  ambiente: { AGENTE_URL_BASE: string | null },
  agoraMs: number,
): Promise<Array<Record<string, unknown>>> {
  const agora = new Date(agoraMs);
  const { data: candidatas, error } = await supabase
    .from("robo_lances_disputas")
    .select("*")
    .is("enviada_em", null)
    .gt("inicio_sessao", new Date(agoraMs + MINUTOS_DO_DESPACHO * 60_000).toISOString())
    .lte("inicio_sessao", new Date(agoraMs + MINUTOS_DA_VESPERA * 60_000).toISOString())
    .or("lembrete_vespera_em.is.null,lembrete_1h_em.is.null")
    .order("inicio_sessao", { ascending: true })
    .limit(50);
  if (error) {
    // Coluna ausente = migration 20260916000006 não aplicada: sem lembrete, sem ruído.
    return [{ lembretes: erroDeColunaAusente(error) ? "indisponivel-falta-migration-20260916000006" : error.message }];
  }

  const saudes = new Map<string, Record<string, any> | null>();
  const saudeDoAgente = async (url: string) => {
    if (!saudes.has(url)) {
      try {
        const r = await fetch(`${url.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(8000) });
        saudes.set(url, r.ok ? await r.json() : null);
      } catch {
        saudes.set(url, null);
      }
    }
    return saudes.get(url) ?? null;
  };

  const feitos: Array<Record<string, unknown>> = [];
  for (const d of (candidatas || []) as Array<Record<string, any>>) {
    const inicio = new Date(d.inicio_sessao);
    const qual = qualLembrete(inicio, agora, { vespera: d.lembrete_vespera_em, umaHora: d.lembrete_1h_em });
    if (!qual) continue;

    const coluna = qual === "vespera" ? "lembrete_vespera_em" : "lembrete_1h_em";
    const { data: reservada } = await supabase
      .from("robo_lances_disputas")
      .update({ [coluna]: agora.toISOString() })
      .eq("id", d.id)
      .is(coluna, null)
      .is("enviada_em", null)
      .select("id");
    if (!reservada || reservada.length === 0) continue;

    const donoId = d.user_id as string;
    const portalId = idDeArmazenamento(d.portal);
    const portalAgente = portalDoAgente(portalId);
    const ehComprasGov = portalAgente === "comprasgov";

    const roboDaEmpresa = d.empresa_id ? (await lerLigadoDaEmpresa(supabase, d.empresa_id)).estado : "indeterminado";

    const { data: agentesAtivos } = await supabase
      .from("agente_externo_config")
      .select("*")
      .eq("user_id", donoId)
      .eq("status", "ativo")
      .order("updated_at", { ascending: false });
    const agente = agentesParaUsuario(agentesAtivos, ambiente)[0];

    // Só a existência e o login: a senha não precisa sair do cofre para isto.
    let login: string | null = null;
    if (portalId) {
      const { data: cred } = await supabase
        .from("credenciais_portais")
        .select("login, senha_hash, status")
        .eq("user_id", donoId)
        .eq("portal_id", portalId)
        .maybeSingle();
      if (cred && (!cred.status || cred.status === "ativo") && cred.login && cred.senha_hash) login = String(cred.login);
    }

    let sessaoGovBr: SessaoGovBr = "nao-se-aplica";
    let sessaoConferidaAs: string | null = null;
    let lanceLiberado: boolean | null = null;
    const saude = agente?.url_base ? await saudeDoAgente(String(agente.url_base)) : null;
    if (saude && Array.isArray(saude.portais_com_lance_liberado) && portalAgente) {
      lanceLiberado = saude.portais_com_lance_liberado.includes(portalAgente);
    }
    if (ehComprasGov && agente && login) {
      if (!saude) {
        sessaoGovBr = "robo-sem-resposta";
      } else {
        const lido = sessaoDoPerfil(saude.vigia_sessao, await perfilDoComprasGov(login));
        sessaoGovBr = lido.estado;
        sessaoConferidaAs = lido.em ? horaEmBrasilia(lido.em) : null;
      }
    }

    const itens = Array.isArray(d.itens) ? d.itens : [];
    const pendencias = pendenciasDaDisputa({
      itens,
      valorMinimoGeral: d.valor_minimo,
      roboDaEmpresa,
      temAgente: !!agente,
      temCredencial: !!login,
      portalConhecido: !!portalAgente,
      precisaUasg: ehComprasGov,
      uasg: d.uasg,
      sessaoGovBr,
      sessaoConferidaAs,
      lanceLiberado,
    });
    const texto = textoDoLembrete({ qual, edital: d.edital, portalNome: d.portal, inicioSessao: inicio, agora, pendencias, sessaoGovBr, sessaoConferidaAs });
    const link = `/robo-lances/disputa/${d.id}`;

    // Processo é da empresa (princípio 2): quem opera a empresa também é lembrado.
    const destinatarios = new Set<string>([donoId]);
    if (d.empresa_id) {
      const { data: membros } = await supabase
        .from("empresa_membros")
        .select("user_id, papel")
        .eq("empresa_id", d.empresa_id)
        .in("papel", ["admin", "operador"]);
      for (const m of membros || []) if (m.user_id) destinatarios.add(m.user_id);
    }
    const { error: erroAviso } = await supabase.from("notificacoes").insert(
      [...destinatarios].map((uid) => ({ user_id: uid, tipo: texto.tipo, titulo: texto.titulo, mensagem: texto.mensagem, link })),
    );

    const chaveDoEmail = `lembrete:${d.id}:${qual}:${d.inicio_sessao}`;
    const email = await avisarPorEmail(supabase, [...destinatarios], { titulo: texto.titulo, mensagem: texto.mensagem, link }, chaveDoEmail);

    const chamaEquipe = pendencias.some((p) => p.chave === "gov-br-vencida" || p.chave === "robo-sem-resposta");
    if (chamaEquipe) {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const idsAdmin = [...new Set((admins || []).map((a: { user_id: string }) => a.user_id))].filter((id) => !destinatarios.has(id as string));
      if (idsAdmin.length) {
        await supabase.from("notificacoes").insert(
          idsAdmin.map((uid) => ({
            user_id: uid,
            tipo: "alerta",
            titulo: `🔐 Robô vai precisar da equipe — ${d.edital}`,
            mensagem: `${texto.mensagem}`,
            link: "/admin/robo-lances",
          })),
        );
        await avisarPorEmail(
          supabase,
          idsAdmin as string[],
          { titulo: `🔐 Robô vai precisar da equipe — ${d.edital}`, mensagem: texto.mensagem, link: "/admin/robo-lances" },
          `${chaveDoEmail}:equipe`,
        );
      }
    }

    await registrarNoLog(supabase, donoId, "lembrete-prontidao", { disputa_id: d.id, qual, pendencias: pendencias.map((p) => p.chave) }, erroAviso ? { erro: erroAviso.message } : {});
    feitos.push({ disputa: d.id, qual, pendencias: pendencias.map((p) => p.chave), avisados: destinatarios.size, emails: email, chamou_equipe: chamaEquipe });
  }
  return feitos;
}

/**
 * Avisa os administradores da Praefectus quando o vigia do robô acha a sessão
 * do gov.br vencida (Fase 8, 16/09/2026).
 *
 * Lê o `/health` de cada robô ativo, separa as conferências vencidas que ainda
 * não viraram aviso (`sessoesVencidasParaAvisar`; a marca é a linha
 * `vigia-sessao-vencida` no `webhook_log`), descobre de quem é a conta pelo
 * perfil da credencial e diz qual é a próxima disputa dela — é o horário em que
 * alguém vai precisar clicar no captcha.
 */
async function avisarSessoesVencidas(
  supabase: any,
  ambiente: { AGENTE_URL_BASE: string | null },
  agoraMs: number,
): Promise<Array<Record<string, unknown>>> {
  const agora = new Date(agoraMs);
  const { data: agentes } = await supabase.from("agente_externo_config").select("url_base").eq("status", "ativo");
  const urls = new Set<string>(
    [...(agentes || []).map((a: { url_base?: string | null }) => a.url_base), ambiente.AGENTE_URL_BASE]
      .filter((u): u is string => typeof u === "string" && u.trim() !== "")
      .map((u) => u.trim().replace(/\/+$/, "")),
  );

  const { data: avisadas } = await supabase
    .from("webhook_log")
    .select("payload")
    .eq("tipo", "vigia-sessao-vencida")
    .gte("created_at", new Date(agoraMs - 7 * 86_400_000).toISOString());
  const jaAvisadas = new Set<string>(
    (avisadas || []).map((l: { payload?: { chave?: string } }) => l.payload?.chave).filter(Boolean) as string[],
  );

  let donosPorPerfil: Map<string, string> | null = null;
  const donoDoPerfil = async (perfil: string) => {
    if (!donosPorPerfil) {
      donosPorPerfil = new Map();
      const { data: creds } = await supabase
        .from("credenciais_portais")
        .select("user_id, login, status")
        .eq("portal_id", "compras-gov");
      for (const c of creds || []) {
        if (!c.login || (c.status && c.status !== "ativo")) continue;
        donosPorPerfil.set(await perfilDoComprasGov(String(c.login)), c.user_id);
      }
    }
    return donosPorPerfil.get(perfil) ?? null;
  };

  const feitos: Array<Record<string, unknown>> = [];
  for (const url of urls) {
    let saude: Record<string, any> | null = null;
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8000) });
      saude = r.ok ? await r.json() : null;
    } catch {
      saude = null;
    }
    if (!saude) continue;

    for (const vencida of sessoesVencidasParaAvisar(saude.vigia_sessao, jaAvisadas)) {
      const dono = await donoDoPerfil(vencida.perfil);
      let proxima: { edital: string; inicioSessao: Date } | null = null;
      if (dono) {
        const { data: disputas } = await supabase
          .from("robo_lances_disputas")
          .select("edital, inicio_sessao")
          .eq("user_id", dono)
          .is("enviada_em", null)
          .gt("inicio_sessao", agora.toISOString())
          .lte("inicio_sessao", new Date(agoraMs + 7 * 86_400_000).toISOString())
          .order("inicio_sessao", { ascending: true })
          .limit(1);
        if (disputas && disputas[0]) proxima = { edital: disputas[0].edital, inicioSessao: new Date(disputas[0].inicio_sessao) };
      }
      const texto = textoDaSessaoVencida({ conferidaEm: new Date(vencida.em), agora, proxima });

      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const idsAdmin = [...new Set((admins || []).map((a: { user_id: string }) => a.user_id))] as string[];
      // Sem administrador cadastrado, o aviso não pode sumir: vai ao dono da conta.
      const destinatarios = idsAdmin.length ? idsAdmin : dono ? [dono] : [];
      if (destinatarios.length) {
        await supabase.from("notificacoes").insert(
          destinatarios.map((uid) => ({ user_id: uid, tipo: "alerta", titulo: texto.titulo, mensagem: texto.mensagem, link: "/admin/robo-lances" })),
        );
        await avisarPorEmail(supabase, destinatarios, { titulo: texto.titulo, mensagem: texto.mensagem, link: "/admin/robo-lances" }, `vigia:${vencida.chave}`);
      }
      const quemRegistra = dono ?? destinatarios[0] ?? null;
      if (quemRegistra) {
        await registrarNoLog(supabase, quemRegistra, "vigia-sessao-vencida", { chave: vencida.chave, perfil: vencida.perfil, conferida_em: vencida.em, avisados: destinatarios.length });
      } else {
        console.error("robo-lances-webhook: sessão do gov.br vencida sem ninguém para avisar:", vencida.chave);
      }
      jaAvisadas.add(vencida.chave);
      feitos.push({ chave: vencida.chave, avisados: destinatarios.length, proxima: proxima?.edital ?? null });
    }
  }
  return feitos;
}

/** Trabalho que continua depois da resposta (`EdgeRuntime.waitUntil`); sem ele, espera. */
function emSegundoPlano(tarefa: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(tarefa.catch(() => {}));
  else void tarefa.catch(() => {});
}

/**
 * O aviso do robô também por e-mail (Fase 8, 16/09/2026) — canal fora do
 * sistema, para quem não está com o Praefectus aberto.
 *
 * Usa a fila de e-mail que o sistema já tem (`send-transactional-email`, modelo
 * `notificacao-sistema`, com lista de supressão e descadastro). O e-mail vem da
 * conta de cada destinatário. `chave` + usuário é a idempotência: o mesmo aviso
 * não sai duas vezes para a mesma pessoa. Falha de e-mail nunca derruba o
 * aviso do sininho, que já foi gravado antes — só entra na contagem.
 *
 * WhatsApp fica de fora de propósito: `whatsapp-envio` hoje só SIMULA o envio
 * (não há provedor contratado).
 */
async function avisarPorEmail(
  supabase: any,
  destinatarios: ReadonlyArray<string>,
  aviso: { titulo: string; mensagem: string; link: string },
  chave: string,
): Promise<{ enviados: number; falhas: number }> {
  const url = Deno.env.get("SUPABASE_URL");
  const chaveDeServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resultado = { enviados: 0, falhas: 0 };
  if (!url || !chaveDeServico) return { enviados: 0, falhas: destinatarios.length };

  for (const uid of new Set(destinatarios)) {
    try {
      const { data } = await supabase.auth.admin.getUserById(uid);
      const email = data?.user?.email;
      if (!email) {
        resultado.falhas++;
        continue;
      }
      const r = await fetch(`${url}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveDeServico}`, apikey: chaveDeServico },
        body: JSON.stringify({
          templateName: "notificacao-sistema",
          recipientEmail: email,
          idempotencyKey: `robo:${chave}:${uid}`,
          templateData: {
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            ctaText: "Abrir no Praefectus",
            ctaUrl: `https://praefectus.com.br${aviso.link}`,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) resultado.enviados++;
      else {
        resultado.falhas++;
        console.error(`robo-lances-webhook: e-mail do aviso (${chave}) recusado: HTTP ${r.status}`);
      }
    } catch (e) {
      resultado.falhas++;
      console.error(`robo-lances-webhook: e-mail do aviso (${chave}) falhou:`, textoDoErro(e));
    }
  }
  return resultado;
}

/** `robo_empresa_config` → ligado / desligado / indeterminado (ver `estadoDoLigado`). */
async function lerLigadoDaEmpresa(supabase: any, empresaId: string): Promise<EstadoDoLigado> {
  try {
    const leitura = await supabase
      .from("robo_empresa_config")
      .select("ligado")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    return estadoDoLigado(leitura);
  } catch (e) {
    return estadoDoLigado({ error: e });
  }
}

/** Empresas de que o usuário é membro, com qualquer papel. Falha → nenhuma. */
async function empresasDoUsuario(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("empresa_membros").select("empresa_id").eq("user_id", userId);
  if (error) {
    console.error("robo-lances-webhook: empresa_membros ilegível:", error.message);
    return [];
  }
  return [...new Set((data || []).map((m: { empresa_id: string }) => m.empresa_id).filter(Boolean))] as string[];
}

/** CNPJs das empresas — para reconhecer o certificado DELAS no agente compartilhado. */
async function cnpjsDasEmpresas(supabase: any, empresas: string[]): Promise<string[]> {
  if (!empresas.length) return [];
  const { data, error } = await supabase.from("empresas").select("cnpj").in("id", empresas);
  if (error) {
    console.error("robo-lances-webhook: empresas ilegíveis:", error.message);
    return [];
  }
  return (data || []).map((e: { cnpj?: string | null }) => e.cnpj).filter(Boolean) as string[];
}

/**
 * Destes ids, quais sessões o usuário pode ver: as que ele iniciou e as das
 * empresas de que é membro — o mesmo critério das policies de
 * `sessoes_lance_real`.
 *
 * Sem a coluna `empresa_id` (migration 20260914000002), só as dele. Falha de
 * leitura → nenhuma: na dúvida, o cliente não vê a sessão alheia.
 */
async function sessoesVisiveis(
  supabase: any,
  userId: string,
  ids: unknown[],
  empresas?: string[],
): Promise<Set<string>> {
  const validos = [...new Set(ids.filter(ehUuid))];
  if (!validos.length) return new Set();
  const minhasEmpresas = empresas ?? await empresasDoUsuario(supabase, userId);
  const base = () => supabase.from("sessoes_lance_real").select("id").in("id", validos);

  let { data, error } = minhasEmpresas.length
    ? await base().or(`user_id.eq.${userId},empresa_id.in.(${minhasEmpresas.join(",")})`)
    : await base().eq("user_id", userId);
  if (error && erroDeColunaAusente(error) && minhasEmpresas.length) {
    ({ data, error } = await base().eq("user_id", userId));
  }
  if (error) {
    console.error("robo-lances-webhook: sessões visíveis ilegíveis:", error.message);
    return new Set();
  }
  return new Set((data || []).map((s: { id: string }) => s.id));
}

/** Pergunta ao agente se está vivo (`GET /health`, 8s). Nunca lança. */
async function sondarAgente(urlBase: string): Promise<{
  online: boolean;
  saude: Record<string, unknown> | null;
  erro: string | null;
  latencia_ms: number;
}> {
  const base = String(urlBase || "").replace(/\/+$/, "");
  const t0 = Date.now();
  try {
    const resp = await fetch(`${base}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const saude = await resp.json().catch(() => ({}));
      return {
        online: true,
        saude: saude && typeof saude === "object" ? saude : {},
        erro: null,
        latencia_ms: Date.now() - t0,
      };
    }
    await resp.body?.cancel().catch(() => {});
    return { online: false, saude: null, erro: `HTTP ${resp.status}`, latencia_ms: Date.now() - t0 };
  } catch (e) {
    return { online: false, saude: null, erro: textoDoErro(e) || "sem resposta", latencia_ms: Date.now() - t0 };
  }
}

/** As linhas de `agente_externo_config` — de qualquer empresa — que apontam para este host. */
async function linhasDoHost(
  supabase: any,
  urlBase: string,
): Promise<Array<{ id: string; url_base: string; capacidades: Record<string, unknown> | null }>> {
  let host: string;
  try {
    host = new URL(urlBase).hostname;
  } catch {
    return [];
  }
  const { data, error } = await supabase
    .from("agente_externo_config")
    .select("id, url_base, capacidades")
    .ilike("url_base", `%${host}%`);
  if (error) {
    console.error("robo-lances-webhook: linhas do host ilegíveis:", error.message);
    return [];
  }
  // O `ilike` só estreita; quem decide é a comparação de hostname.
  return (data || []).filter((l: { url_base: string }) => ehAgenteGerenciado(l.url_base, urlBase));
}

/**
 * O último teste do freio do agente gerenciado.
 *
 * Ele não tem linha própria: vale o teste mais recente gravado nas linhas que
 * apontam para o mesmo host (`testar-kill-switch` propaga para todas). Sem
 * nenhuma linha, a reserva é o `webhook_log` do próprio teste.
 */
async function freioDoAgenteGerenciado(
  supabase: any,
  urlBase: string | null,
): Promise<Record<string, unknown> | null> {
  if (!urlBase) return null;
  let freio: Record<string, unknown> | null = null;
  for (const linha of await linhasDoHost(supabase, urlBase)) {
    const ks = linha.capacidades?.kill_switch as Record<string, unknown> | undefined;
    if (!ks || typeof ks !== "object") continue;
    if (!freio || String(ks.testado_em || "") > String(freio.testado_em || "")) freio = ks;
  }
  if (freio) return freio;

  const { data } = await supabase
    .from("webhook_log")
    .select("payload")
    .eq("tipo", "teste-kill-switch")
    .order("created_at", { ascending: false })
    .limit(20);
  for (const r of data || []) {
    const ks = (r as { payload?: { kill_switch_gerenciado?: unknown } }).payload?.kill_switch_gerenciado;
    if (ks && typeof ks === "object") return ks as Record<string, unknown>;
  }
  return null;
}

/** Grava o resultado do teste do freio em todas as linhas que apontam para o host. */
async function propagarFreio(supabase: any, urlBase: string, registro: Record<string, unknown>): Promise<void> {
  for (const linha of await linhasDoHost(supabase, urlBase)) {
    const { error } = await supabase
      .from("agente_externo_config")
      .update({ capacidades: { ...(linha.capacidades || {}), kill_switch: registro } })
      .eq("id", linha.id);
    if (error) console.error("robo-lances-webhook: freio não propagado para", linha.id, error.message);
  }
}
