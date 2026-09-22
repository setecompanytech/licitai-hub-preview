// ═══════════════════════════════════════════════════════════════════════════
// Certidões — o que se confere na fonte, e só isso (22/09/2026, tarde)
//
// Antes, esta função "verificava" CNDT e CRF por busca na web com IA ("não
// foram encontrados indícios…"), pedia à IA uma lista genérica de certidões
// estaduais e municipais sem saber onde a empresa está, e resumia tudo em
// prosa. Nada disso é documento probatório. O dono: "quem atua dentro da
// administração pública busca por veracidade".
//
// Agora a função devolve dois fatos, cada um da sua fonte:
//  · o CADASTRO do CNPJ na base pública da Receita (razão social, situação,
//    UF e município — o domicílio fiscal que decide quais são os órgãos
//    estadual e municipal, em vez de uma seleção solta);
//  · as SANÇÕES nos quatro cadastros do Portal da Transparência (CEIS, CNEP,
//    CEPIM, leniência), pela API oficial, com o filtro conferido
//    (`_shared/portal-transparencia.ts`).
// As certidões de regularidade (CND federal, CRF, CNDT, estadual, municipal,
// falência, junta) NÃO se emitem aqui: cada uma sai no seu órgão emissor, e o
// catálogo do front (`data/certidoes-catalogo.ts`) diz onde. Sem OpenAI, sem
// Firecrawl.
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";
import { URL_CADASTRO_CHAVE, verificarIdoneidade } from "../_shared/portal-transparencia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Cadastro {
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  situacaoCodigo: number | null;
  motivoSituacao: string;
  dataAbertura: string;
  uf: string;
  municipio: string;
  cnaePrincipal: string;
  naturezaJuridica: string;
  porte: string;
  fonte: "brasilapi";
}

const s = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** O cadastro do CNPJ na base pública da Receita, redistribuída pela BrasilAPI. */
async function cadastroDoCnpj(cnpj: string): Promise<{ cadastro: Cadastro | null; erro?: string }> {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (r.status === 404) return { cadastro: null, erro: "CNPJ não encontrado na base pública da Receita Federal." };
  if (!r.ok) return { cadastro: null, erro: `Base pública da Receita indisponível (HTTP ${r.status}).` };
  const d = await r.json();
  return {
    cadastro: {
      razaoSocial: s(d.razao_social),
      nomeFantasia: s(d.nome_fantasia),
      situacao: s(d.descricao_situacao_cadastral),
      situacaoCodigo: Number(d.situacao_cadastral) || null,
      motivoSituacao: s(d.descricao_motivo_situacao_cadastral),
      dataAbertura: s(d.data_inicio_atividade),
      uf: s(d.uf).toUpperCase(),
      municipio: s(d.municipio),
      cnaePrincipal: s(d.cnae_fiscal_descricao),
      naturezaJuridica: s(d.natureza_juridica),
      porte: s(d.porte),
      fonte: "brasilapi",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    await requireAuth(req, { functionName: "certidoes-negativas", maxRequests: 10, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cnpj = String(body.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) return json({ error: "CNPJ é obrigatório (14 dígitos)." }, 400);

    const chave = Deno.env.get("PORTAL_TRANSPARENCIA_API_KEY");

    const [cad, idon] = await Promise.all([
      cadastroDoCnpj(cnpj).catch((e: unknown) => ({ cadastro: null, erro: e instanceof Error ? e.message : String(e) })),
      chave
        ? verificarIdoneidade(cnpj, chave)
          .then((idoneidade) => ({ idoneidade, erro: undefined as string | undefined }))
          .catch((e: unknown) => ({ idoneidade: null, erro: e instanceof Error ? e.message : String(e) }))
        : Promise.resolve({ idoneidade: null, erro: `Chave da API do Portal da Transparência não configurada (${URL_CADASTRO_CHAVE}).` }),
    ]);

    return json({
      cnpj,
      cadastro: cad.cadastro,
      ...(cad.erro ? { cadastroErro: cad.erro } : {}),
      idoneidade: idon.idoneidade,
      ...(idon.erro ? { idoneidadeErro: idon.erro } : {}),
      consultadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[certidoes-negativas]", e);
    return json({ error: e instanceof Error ? e.message : "Erro ao consultar" }, 500);
  }
});
