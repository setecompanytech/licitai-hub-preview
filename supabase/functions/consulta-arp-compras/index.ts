// Atas de Registro de Preços — API OFICIAL de dados abertos do Compras.gov.br
// (dadosabertos.compras.gov.br, sem chave). Substitui a aba Contratos Gov que
// ficou oca após a aposentadoria do scraper de IA (08/09): agora ela espelha
// o que o contratos.gov.br mostra, filtrado pelo CNPJ do FORNECEDOR — a
// empresa consultando as próprias atas, com item, quantidade homologada,
// quantidade JÁ EMPENHADA, valores e vigência.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://dadosabertos.compras.gov.br/modulo-arp/2_consultarARPItem';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const cnpj = String(body.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) {
      return new Response(JSON.stringify({ error: 'Informe o CNPJ do fornecedor (14 dígitos).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Janela pela VIGÊNCIA INICIAL da ata (exigência da API): atas iniciadas
    // nos últimos N meses. 36 é o teto — ata dura 1 ano; 3 anos de início
    // cobre tudo que ainda pode estar vigente e o histórico recente.
    const meses = Math.min(Math.max(Number(body.meses) || 24, 1), 60);
    const hoje = new Date();
    const ini = new Date(hoje);
    ini.setMonth(ini.getMonth() - meses);
    const f = (d: Date) => d.toISOString().slice(0, 10);
    const pagina = Math.max(Number(body.pagina) || 1, 1);

    const url = `${BASE}?dataVigenciaInicialMin=${f(ini)}&dataVigenciaInicialMax=${f(hoje)}`
      + `&niFornecedor=${cnpj}&pagina=${pagina}&tamanhoPagina=200`;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      return new Response(JSON.stringify({
        error: `A API do Compras.gov.br respondeu ${r.status}: ${texto.slice(0, 150)}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const dados = await r.json() as {
      resultado?: unknown[]; totalRegistros?: number; totalPaginas?: number;
    };

    return new Response(JSON.stringify({
      success: true,
      itens: dados.resultado ?? [],
      totalRegistros: dados.totalRegistros ?? (dados.resultado ?? []).length,
      pagina,
      fonte: 'Compras.gov.br — API oficial de dados abertos (módulo ARP)',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Falha na consulta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
