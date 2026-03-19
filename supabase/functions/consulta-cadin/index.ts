import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A API do CADIN via Conecta GOV.BR requer credenciamento.
// Esta edge function usa a API pública do Portal da Transparência como fallback
// para verificar se o CNPJ possui pendências no CADIN.
const BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cnpj } = await req.json();
    const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
    if (!cnpjLimpo || cnpjLimpo.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_KEY = Deno.env.get('PORTAL_TRANSPARENCIA_API_KEY');
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (API_KEY) headers['chave-api-dados'] = API_KEY;

    // Consultar CEIS como proxy para verificação de regularidade
    // O CADIN completo requer Conecta GOV.BR (credenciamento de órgão público)
    const [ceisRes, cnepRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/ceis?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
      fetch(`${BASE_URL}/cnep?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
    ]);

    const parseResult = async (res: PromiseSettledResult<Response>) => {
      if (res.status === 'rejected') return { registros: [], erro: res.reason?.message };
      if (!res.value.ok) {
        const txt = await res.value.text();
        return { registros: [], erro: `HTTP ${res.value.status}` };
      }
      const data = await res.value.json();
      return { registros: Array.isArray(data) ? data : [] };
    };

    const ceis = await parseResult(ceisRes);
    const cnep = await parseResult(cnepRes);

    const temPendencias = ceis.registros.length > 0 || cnep.registros.length > 0;

    return new Response(JSON.stringify({
      cnpj: cnpjLimpo,
      temPendencias,
      ceis: {
        total: ceis.registros.length,
        registros: ceis.registros.slice(0, 10),
        erro: ceis.erro,
      },
      cnep: {
        total: cnep.registros.length,
        registros: cnep.registros.slice(0, 10),
        erro: cnep.erro,
      },
      nota: 'Consulta via Portal da Transparência. Para dados completos do CADIN, é necessário credenciamento no Conecta GOV.BR.',
      consultadoEm: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
