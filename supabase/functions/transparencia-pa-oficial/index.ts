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
      const credor = String(body.credor || '').trim().toUpperCase();
      if (credor.length < 4) {
        return new Response(JSON.stringify({ error: 'Informe o nome do credor com pelo menos 4 letras.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const POR_PAGINA = 2000;
      const MAX_PAGINAS = Math.min(Number(body.maxPaginas) || 12, 20);
      let pagina = Math.max(Number(body.paginaInicial) || 1, 1);
      const achados: NotaEmpenho[] = [];
      let varridos = 0;
      let acabou = false;

      for (let i = 0; i < MAX_PAGINAS; i++, pagina++) {
        const r = await fetch(
          `${BASE}/notas-empenho?ano=${ano}&pagina=${pagina}&qtdRegistros=${POR_PAGINA}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) },
        );
        if (!r.ok) {
          return new Response(JSON.stringify({
            error: `API do Pará respondeu ${r.status} na página ${pagina}`,
            achados, varridos, proximaPagina: pagina,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const lote = await r.json() as NotaEmpenho[];
        if (!Array.isArray(lote) || lote.length === 0) { acabou = true; break; }
        varridos += lote.length;
        for (const n of lote) {
          if (n.credor && n.credor.toUpperCase().includes(credor)) achados.push(n);
        }
        if (lote.length < POR_PAGINA) { acabou = true; pagina++; break; }
      }

      return new Response(JSON.stringify({
        success: true, achados, varridos, ano,
        // null = varredura completa; número = de onde continuar.
        proximaPagina: acabou ? null : pagina,
        fonte: 'Portal da Transparência do Pará — API oficial de dados abertos',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Modo desconhecido: ${modo}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Falha na consulta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
