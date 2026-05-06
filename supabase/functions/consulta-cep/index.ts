// Edge function: consulta-cep
// Resolve um CEP via APIs públicas no servidor (sem CORS no browser).
// Cadeia de tentativas: ViaCEP -> BrasilAPI v2 -> BrasilAPI v1 -> AwesomeAPI.
// Resposta normalizada:
// { cep, logradouro, complemento, bairro, municipio, uf, ibge, source }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CepOut = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  ibge: string;
  source: string;
};

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(t);
  }
}

async function tryViaCep(cep: string): Promise<CepOut | null> {
  try {
    const r = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.erro) return null;
    return {
      cep,
      logradouro: d.logradouro || "",
      complemento: d.complemento || "",
      bairro: d.bairro || "",
      municipio: d.localidade || "",
      uf: d.uf || "",
      ibge: d.ibge || "",
      source: "viacep",
    };
  } catch (_e) {
    return null;
  }
}

async function tryBrasilApiV2(cep: string): Promise<CepOut | null> {
  try {
    const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.cep) return null;
    return {
      cep,
      logradouro: d.street || "",
      complemento: "",
      bairro: d.neighborhood || "",
      municipio: d.city || "",
      uf: d.state || "",
      ibge: "",
      source: "brasilapi-v2",
    };
  } catch (_e) {
    return null;
  }
}

async function tryBrasilApiV1(cep: string): Promise<CepOut | null> {
  try {
    const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.cep) return null;
    return {
      cep,
      logradouro: d.street || "",
      complemento: "",
      bairro: d.neighborhood || "",
      municipio: d.city || "",
      uf: d.state || "",
      ibge: "",
      source: "brasilapi-v1",
    };
  } catch (_e) {
    return null;
  }
}

async function tryAwesomeApi(cep: string): Promise<CepOut | null> {
  try {
    const r = await fetchWithTimeout(`https://cep.awesomeapi.com.br/json/${cep}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.status === 400 || d.status === 404) return null;
    return {
      cep,
      logradouro: d.address || "",
      complemento: "",
      bairro: d.district || "",
      municipio: d.city || "",
      uf: d.state || "",
      ibge: d.city_ibge || "",
      source: "awesomeapi",
    };
  } catch (_e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.cep || "").replace(/\D/g, "");
    if (raw.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP inválido: informe 8 dígitos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tenta provedores em paralelo, retorna o primeiro com resultado válido
    // (privilegia ViaCEP por ser oficial dos Correios e trazer IBGE).
    const viacep = await tryViaCep(raw);
    if (viacep) {
      return new Response(JSON.stringify(viacep), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallbacks = await Promise.all([
      tryBrasilApiV2(raw),
      tryBrasilApiV1(raw),
      tryAwesomeApi(raw),
    ]);
    const ok = fallbacks.find((x) => !!x);
    if (ok) {
      return new Response(JSON.stringify(ok), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "CEP não localizado em nenhum provedor." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: `Falha interna: ${e?.message || "erro"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
