// @ts-nocheck
// Edge Function: pncp-arquivos-edital
// Serve o edital dentro da aplicação, sem mandar o usuário para o portal:
//   action="listar" → lista os arquivos da contratação (API de Consulta do PNCP)
//   action="abrir"  → baixa UM arquivo e grava no bucket privado `processo-arquivos`,
//                     devolvendo o path para o front gerar signed URL e exibir no iframe.
//
// Por que materializar no storage em vez de apontar o iframe direto para o PNCP:
//   - o PNCP responde com Content-Disposition: attachment em parte dos arquivos
//     (o navegador baixaria em vez de renderizar);
//   - o portal fica instável com frequência (502/503/504) — depois do primeiro
//     acesso o arquivo continua abrindo mesmo com o PNCP fora do ar.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BUCKET = "processo-arquivos";

/**
 * Fetch com um retry educado no 429. O PNCP limita por IP de saída — e as
 * sincronizações em lote saem dos MESMOS IPs desta função, então um usuário
 * abrindo o edital logo após um sync levava o 429 alheio e via "Indisponível".
 */
async function fetchPncp(url: string, init: RequestInit): Promise<Response> {
  const resp = await fetch(url, init);
  if (resp.status !== 429) return resp;
  const retryAfter = Math.min(Number(resp.headers.get("Retry-After")) || 2, 5);
  await new Promise((r) => setTimeout(r, retryAfter * 1000));
  return fetch(url, init);
}
const UA = "Mozilla/5.0 (compatible; LicitAI/1.0)";
const MAX_BYTES = 45 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extrai cnpj/ano/sequencial da URL do PNCP (formato /editais/CNPJ/ANO/SEQ). */
function parsePncpUrl(url: string | null | undefined) {
  const m = (url || "").match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
  if (!m) return null;
  return { cnpj: m[1], ano: m[2], seq: m[3] };
}

/** Extrai cnpj/ano/sequencial do numeroControlePNCP (`CNPJ-1-SEQUENCIAL/ANO`). */
function parseNumeroControle(numero: string | null | undefined) {
  const m = (numero || "").match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
  if (!m) return null;
  return { cnpj: m[1], ano: m[3], seq: String(Number(m[2])) };
}

/** Monta cnpj/ano/sequencial a partir das colunas soltas do cache. */
function parseColunasCache(row: any) {
  const cnpj = (row?.cnpj_orgao || "").replace(/\D/g, "");
  const ano = String(row?.ano_compra || "");
  const seq = String(row?.sequencial_compra || "");
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !seq) return null;
  return { cnpj, ano, seq: String(Number(seq)) };
}

/**
 * Localiza a contratação no `pncp_editais_cache` quando a URL do processo é de
 * outro portal. Casa primeiro pelo link exato (mais confiável) e, se não achar,
 * pelo número da compra restringido pelo órgão.
 */
async function resolvePeloCache(
  admin: any,
  urlEdital: string | null,
  numero: string | null,
  orgao: string | null,
) {
  const colunas =
    "cnpj_orgao, ano_compra, sequencial_compra, numero_controle_pncp, url_pncp, orgao, link_sistema_origem, link_comprasnet";

  const extrair = (row: any) =>
    parseColunasCache(row) ??
    parseNumeroControle(row?.numero_controle_pncp) ??
    parsePncpUrl(row?.url_pncp);

  // 1) Mesmo link de origem — uma consulta por coluna, porque `.or()` quebra
  //    quando a URL tem vírgula ou parêntese.
  if (urlEdital) {
    for (const coluna of ["link_sistema_origem", "link_comprasnet", "url_pncp"]) {
      const { data } = await admin
        .from("pncp_editais_cache")
        .select(colunas)
        .eq(coluna, urlEdital)
        .limit(5);

      for (const row of data ?? []) {
        const achado = extrair(row);
        if (achado) return achado;
      }
    }
  }

  // 2) Número da compra + órgão. O número guardado na licitação costuma vir
  //    com prefixo do portal ("PR32"), então tentamos o valor exato e depois
  //    só os dígitos. O órgão é obrigatório aqui — sem ele o risco é servir o
  //    edital de outra contratação com o mesmo número.
  // Curingas do LIKE precisam sair do texto vindo do banco
  const orgaoLike = (orgao || "").replace(/[%_,]/g, " ").trim();
  if (numero && orgaoLike.length >= 6) {
    const digitos = numero.replace(/\D/g, "");
    const numerosPossiveis = digitos && digitos !== numero ? [numero, digitos] : [numero];

    for (const n of numerosPossiveis) {
      const { data } = await admin
        .from("pncp_editais_cache")
        .select(colunas)
        .ilike("orgao", `%${orgaoLike}%`)
        .ilike("numero_compra", `%${n}%`)
        .limit(20);

      for (const row of data ?? []) {
        const achado = extrair(row);
        if (achado) return achado;
      }
    }
  }

  return null;
}

function sanitize(nome: string) {
  return (nome || "arquivo")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function extensaoDe(nome: string, contentType: string) {
  const porNome = (nome.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  if (porNome) return porNome.toLowerCase();
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("zip")) return "zip";
  if (contentType.includes("word")) return "docx";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "xlsx";
  return "bin";
}

/**
 * Lista os arquivos da contratação.
 *
 * O endpoint é o `/api/pncp/v1/` — a API de Consulta (`/api/consulta/v1/`)
 * responde 404 para `/arquivos`, ela não expõe esse recurso. A de Consulta fica
 * como fallback só para o caso de a principal sair do ar.
 *
 * A listagem NÃO traz nome de arquivo nem extensão: só `titulo` e
 * `tipoDocumentoNome`. A extensão real aparece apenas no Content-Disposition do
 * download, então aqui ela fica vazia quando não dá para deduzir.
 */
async function listarArquivos(cnpj: string, ano: string, seq: string) {
  const endpoints = [
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`,
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}` +
      `/arquivos?pagina=1&tamanhoPagina=100`,
  ];

  let ultimoErro = "";
  for (const url of endpoints) {
    let resp: Response;
    try {
      resp = await fetchPncp(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
      continue;
    }

    if (!resp.ok) {
      ultimoErro = `PNCP respondeu ${resp.status} ao listar arquivos`;
      continue;
    }

    const payload = await resp.json();
    const arr: any[] = Array.isArray(payload) ? payload : (payload?.data ?? []);

    return arr
      .filter((a: any) => a?.statusAtivo !== false)
      .map((a: any, idx: number) => {
        const sequencial = a.sequencialDocumento ?? a.sequencialArquivo ?? idx + 1;
        const nome = a.nomeArquivo || a.titulo || `documento-${sequencial}`;
        return {
          sequencial,
          nome,
          titulo: a.titulo || nome,
          tipo: a.tipoDocumentoNome || a.tipoDocumentoDescricao || "Arquivo",
          data_publicacao: a.dataPublicacaoPncp || a.dataPublicacao || null,
          // A API às vezes traz a URL pronta, às vezes só o sequencial — o download
          // aceita as duas formas (ver baixarArquivo).
          url: a.url || a.uri || null,
          // "" = desconhecida; quem sabe é o download
          extensao: (nome.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase() ?? "",
        };
      });
  }

  throw new Error(ultimoErro || "Não foi possível listar os arquivos no PNCP");
}

/** Baixa o arquivo tentando a URL da listagem e, se falhar, o endpoint por sequencial. */
async function baixarArquivo(
  cnpj: string,
  ano: string,
  seq: string,
  arquivo: { sequencial: number; url: string | null; nome: string },
) {
  const candidatas = [
    arquivo.url,
    `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${arquivo.sequencial}`,
    `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${arquivo.sequencial}`,
  ].filter(Boolean) as string[];

  let ultimoErro = "";

  for (const url of candidatas) {
    try {
      const resp = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "*/*" },
        signal: AbortSignal.timeout(45_000),
      });

      if (!resp.ok) {
        ultimoErro = `HTTP ${resp.status} em ${url}`;
        continue;
      }

      const tamanho = Number(resp.headers.get("content-length") || 0);
      if (tamanho > MAX_BYTES) {
        throw new Error(
          `Arquivo com ${(tamanho / 1024 / 1024).toFixed(1)} MB excede o limite de 45 MB para visualização.`,
        );
      }

      const buffer = new Uint8Array(await resp.arrayBuffer());
      if (buffer.byteLength === 0) {
        ultimoErro = `resposta vazia em ${url}`;
        continue;
      }
      if (buffer.byteLength > MAX_BYTES) {
        throw new Error("Arquivo maior que 45 MB — use o download direto.");
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream";

      // Nome real vindo do Content-Disposition, quando houver
      const disposition = resp.headers.get("content-disposition") || "";
      const nomeHeader = (disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i) || [])[1];

      return {
        buffer,
        contentType,
        nome: decodeURIComponent(nomeHeader || arquivo.nome),
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("excede o limite")) throw e;
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(ultimoErro || "Não foi possível baixar o arquivo no PNCP");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // getUser (e não getClaims): é o método disponível na versão do supabase-js
    // que roda no runtime das Edge Functions deste projeto.
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const licitacaoId: string | undefined = body?.licitacao_id;
    const action: string = body?.action || "listar";
    if (!licitacaoId) return json({ error: "licitacao_id required" }, 400);

    // Acesso: consulta com o JWT do usuário — o RLS por empresa (Onda 4)
    // decide. A checagem antiga `user_id !== userId` devolvia 404 para
    // qualquer colega abrindo processo da empresa.
    const { data: lic } = await userClient
      .from("licitacoes")
      .select("id, user_id, url_edital, numero, orgao")
      .eq("id", licitacaoId)
      .maybeSingle();

    if (!lic) {
      return json({ error: "Licitação não encontrada" }, 404);
    }

    // A URL salva no processo costuma ser do portal de origem (ComprasNet, etc.),
    // e não do PNCP. Quando não dá para extrair cnpj/ano/sequencial dela,
    // procuramos a mesma contratação no cache do PNCP.
    const pncp = parsePncpUrl(lic.url_edital) ??
      await resolvePeloCache(admin, lic.url_edital, lic.numero, lic.orgao);

    if (!pncp) {
      return json({
        success: false,
        sem_fonte_pncp: true,
        error: "Não foi possível identificar esta contratação no PNCP.",
        url_edital: lic.url_edital,
      });
    }

    const { cnpj, ano, seq } = pncp;

    if (action === "listar") {
      const arquivos = await listarArquivos(cnpj, ano, seq);
      return json({
        success: true,
        origem: { cnpj, ano, sequencial: seq },
        total: arquivos.length,
        arquivos,
      });
    }

    if (action === "abrir") {
      const sequencial = Number(body?.sequencial);
      if (!sequencial) return json({ error: "sequencial required" }, 400);

      const arquivos = await listarArquivos(cnpj, ano, seq);
      const alvo = arquivos.find((a) => Number(a.sequencial) === sequencial);
      if (!alvo) return json({ error: "Arquivo não encontrado na contratação" }, 404);

      // Pasta por contratação (não por registro): o mesmo edital aberto pelo
      // workspace e pelos compromissos reaproveita o arquivo já baixado.
      // O 1º segmento precisa ser o user id — é o que as policies do bucket exigem.
      const pasta = `${userId}/pncp/${cnpj}-${ano}-${seq}`;
      const baseNome = sanitize(alvo.nome);

      // Se já foi materializado antes, devolve direto (sem bater no PNCP de novo)
      const { data: existentes } = await admin.storage.from(BUCKET).list(pasta, { limit: 100 });
      const jaExiste = (existentes ?? []).find((f) => f.name.startsWith(`${sequencial}-`));
      if (jaExiste) {
        return json({
          success: true,
          cached: true,
          path: `${pasta}/${jaExiste.name}`,
          nome: alvo.nome,
          content_type: jaExiste.metadata?.mimetype || null,
        });
      }

      const baixado = await baixarArquivo(cnpj, ano, seq, alvo);
      const ext = extensaoDe(baixado.nome, baixado.contentType);
      const nomeFinal = baseNome.endsWith(`.${ext}`) ? baseNome : `${baseNome}.${ext}`;
      const path = `${pasta}/${sequencial}-${nomeFinal}`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, baixado.buffer, {
        contentType: ext === "pdf" ? "application/pdf" : baixado.contentType,
        upsert: true,
      });
      if (upErr) return json({ error: `Falha ao salvar: ${upErr.message}` }, 500);

      return json({
        success: true,
        cached: false,
        path,
        nome: baixado.nome,
        content_type: baixado.contentType,
        tamanho: baixado.buffer.byteLength,
      });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[pncp-arquivos-edital]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
