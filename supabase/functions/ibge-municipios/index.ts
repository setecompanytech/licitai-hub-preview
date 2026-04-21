// Proxy resiliente para listar municípios por UF.
// Tenta IBGE oficial → BrasilAPI → erro 502.
// Cacheado em memória do worker (TTL 24h) e cache HTTP de 7 dias.

const CACHE: Record<string, { data: any[]; expira: number }> = {};
const TTL_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UFS_VALIDAS = new Set([
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
]);

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Praefectus/1.0" } });
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function buscarIBGE(uf: string) {
  const r = await fetchWithTimeout(
    `https://servicosdados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    8000,
  );
  if (!r.ok) throw new Error(`IBGE ${r.status}`);
  const data = await r.json();
  return data.map((m: any) => ({ id: m.id, nome: m.nome, uf }));
}

async function buscarBrasilAPI(uf: string) {
  const r = await fetchWithTimeout(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, 8000);
  if (!r.ok) throw new Error(`BrasilAPI ${r.status}`);
  const data = await r.json();
  return data.map((m: any) => ({ id: Number(m.codigo_ibge), nome: m.nome, uf }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const uf = (url.searchParams.get("uf") || "").toUpperCase().trim();
    if (!UFS_VALIDAS.has(uf)) {
      return new Response(JSON.stringify({ error: "uf inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cached = CACHE[uf];
    if (cached && cached.expira > Date.now()) {
      return new Response(JSON.stringify({ uf, fonte: "cache", municipios: cached.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
      });
    }

    let municipios: any[] | null = null;
    let fonte = "ibge";
    try {
      municipios = await buscarIBGE(uf);
    } catch (e1) {
      console.warn(`IBGE falhou para ${uf}:`, (e1 as Error).message);
      try {
        municipios = await buscarBrasilAPI(uf);
        fonte = "brasilapi";
      } catch (e2) {
        console.error(`BrasilAPI também falhou para ${uf}:`, (e2 as Error).message);
        return new Response(
          JSON.stringify({ error: "Fontes indisponíveis", detalhe: (e2 as Error).message }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    municipios!.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    CACHE[uf] = { data: municipios!, expira: Date.now() + TTL_MS };

    return new Response(JSON.stringify({ uf, fonte, municipios }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
