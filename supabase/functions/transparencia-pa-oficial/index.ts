// Transparência do Pará pela API OFICIAL de dados abertos (08/09/2026).
//
// Substitui o scraper de IA aposentado: aqui nada é estimado — os números vêm
// de https://api-dados-abertos.sistemas.pa.gov.br (sem autenticação, JSON).
//
// Dois modos:
//  - 'despesas': /despesas-publicas?ano — execução POR ÓRGÃO (orçado,
//    empenhado, liquidado, pago). Alimenta a aba Transparência num clique.
//  - 'empenhos': varredura de /notas-empenho filtrando por CREDOR no nosso
//    lado (o parâmetro `orgao` da API devolve [] para qualquer valor —
//    testado em 08/09 com sigla, nome e código). Página de 2.000 registros,
//    corte por invocação e continuação explícita: melhor devolver "varri até
//    a página N, continue" do que estourar o tempo e falhar mudo.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api-dados-abertos.sistemas.pa.gov.br/dados-abertos';

type NotaEmpenho = {
  numero: string; dt_despesa: string; orgao: string; credor: string;
  id_ne: string; valor_empenhado: number; valor_pago: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const modo = body.modo || 'despesas';
    const ano = Number(body.ano) || new Date().getFullYear();

    if (modo === 'despesas') {
      const r = await fetch(`${BASE}/despesas-publicas?ano=${ano}&mesInicio=1&mesFim=12&qtdRegistros=500`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(35_000),
      });
      if (!r.ok) {
        return new Response(JSON.stringify({ error: `API do Pará respondeu ${r.status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const linhas = await r.json() as Array<{
        orgao: string; sigla_orgao: string; vlr_orc_atualizado: number;
        vlr_empenhado: number; vlr_liquidado: number; vlr_pago: number;
      }>;
      const data = (linhas || [])
        .filter((l) => l.orgao && l.orgao !== '---' && (l.vlr_empenhado > 0 || l.vlr_pago > 0))
        .map((l) => ({
          orgao: l.sigla_orgao && l.sigla_orgao !== l.orgao ? `${l.sigla_orgao} — ${l.orgao}` : l.orgao,
          valor: l.vlr_empenhado,
          quantidade: 1,
          liquidado: l.vlr_liquidado,
          pago: l.vlr_pago,
        }));
      return new Response(JSON.stringify({
        success: true, data, ano,
        fonte: 'Portal da Transparência do Pará — API oficial de dados abertos',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (modo === 'empenhos') {
      // A varredura paginada de 08/09 durou meio dia: o backend do PRÓPRIO
      // portal expõe busca textual server-side (nome, CNPJ, nº de empenho) e
      // os TOTAIS da busca — os mesmos números que a tela do portal mostra
      // (conferido ao centavo: ETHOS 2026 = 8 notas, R$ 6.054.144,00).
      // É serviço interno do portal, não a API documentada: se mudar sem
      // aviso, o erro sai com o status na cara — nunca em silêncio.
      const BUSCA = 'https://api-notas-empenho.sistemas.pa.gov.br/notas-empenho';
      const texto = String(body.credor || '').trim();
      if (texto.length < 4) {
        return new Response(JSON.stringify({ error: 'Informe nome, CNPJ ou nº de empenho com pelo menos 4 caracteres.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const pagina = Math.max(Number(body.pagina) || 1, 1);
      const qtd = Math.min(Number(body.qtdRegistros) || 50, 200);
      const q = `ano=${ano}&textoBusca=${encodeURIComponent(texto)}`;

      const [rLista, rTotais] = await Promise.all([
        fetch(`${BUSCA}?${q}&pagina=${pagina}&qtdRegistros=${qtd}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25_000) }),
        fetch(`${BUSCA}/totais-busca-avancada?${q}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25_000) }),
      ]);
      if (!rLista.ok) {
        return new Response(JSON.stringify({ error: `Busca do portal respondeu ${rLista.status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const lista = await rLista.json() as { data?: Array<NotaEmpenho & { credor_cpf_cnpj?: string }> };
      const totaisRaw = rTotais.ok ? await rTotais.json().catch(() => null) as
        { data?: Array<{ valor_empenhado: number; valor_pago: number; qtd_notas: number; total_reg: number }> } | null : null;
      const t = totaisRaw?.data?.[0] ?? null;

      return new Response(JSON.stringify({
        success: true,
        achados: lista.data ?? [],
        totais: t ? {
          qtd_notas: t.qtd_notas,
          valor_empenhado: t.valor_empenhado,
          valor_pago: t.valor_pago,
          saldo_a_pagar: Math.max((t.valor_empenhado ?? 0) - (t.valor_pago ?? 0), 0),
        } : null,
        pagina,
        ano,
        fonte: 'Portal da Transparência do Pará — busca do próprio portal',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Modo desconhecido: ${modo}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Falha na consulta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
