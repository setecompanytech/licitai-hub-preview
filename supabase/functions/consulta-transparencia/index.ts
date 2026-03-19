import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { tipo, cnpj, pagina = 1, termo, dataInicio, dataFim, orgao, uf } = await req.json();

    const API_KEY = Deno.env.get('PORTAL_TRANSPARENCIA_API_KEY');
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (API_KEY) {
      headers['chave-api-dados'] = API_KEY;
    }

    let url = '';
    const params = new URLSearchParams();
    params.set('pagina', String(pagina));

    switch (tipo) {
      case 'ceis': {
        // Cadastro de Empresas Inidôneas e Suspensas
        url = `${BASE_URL}/ceis`;
        if (cnpj) params.set('cnpjSancionado', cnpj.replace(/\D/g, ''));
        if (termo) params.set('nomeSancionado', termo);
        if (uf) params.set('ufSancionado', uf);
        break;
      }
      case 'cnep': {
        // Cadastro Nacional de Empresas Punidas
        url = `${BASE_URL}/cnep`;
        if (cnpj) params.set('cnpjSancionado', cnpj.replace(/\D/g, ''));
        if (termo) params.set('nomeSancionado', termo);
        if (uf) params.set('ufSancionado', uf);
        break;
      }
      case 'cepim': {
        // Cadastro de Entidades Privadas sem Fins Lucrativos Impedidas
        url = `${BASE_URL}/cepim`;
        if (cnpj) params.set('cnpjSancionado', cnpj.replace(/\D/g, ''));
        break;
      }
      case 'licitacoes': {
        // Licitações do Poder Executivo Federal
        url = `${BASE_URL}/licitacoes`;
        if (dataInicio) params.set('dataInicial', dataInicio);
        if (dataFim) params.set('dataFinal', dataFim);
        if (orgao) params.set('codigoOrgao', orgao);
        if (uf) params.set('uf', uf);
        break;
      }
      case 'contratos': {
        // Contratos do Poder Executivo Federal
        url = `${BASE_URL}/contratos`;
        if (cnpj) params.set('cpfCnpjContratado', cnpj.replace(/\D/g, ''));
        if (dataInicio) params.set('dataInicial', dataInicio);
        if (dataFim) params.set('dataFinal', dataFim);
        if (orgao) params.set('codigoOrgao', orgao);
        break;
      }
      case 'contratos-cnpj': {
        // Contratos por CNPJ do contratado
        url = `${BASE_URL}/contratos/cpfCnpjContratado`;
        if (cnpj) params.set('cpfCnpjContratado', cnpj.replace(/\D/g, ''));
        break;
      }
      case 'despesas': {
        // Despesas do Poder Executivo Federal
        url = `${BASE_URL}/despesas/recursos-recebidos`;
        if (cnpj) params.set('cpfCnpjFavorecido', cnpj.replace(/\D/g, ''));
        break;
      }
      case 'idoneidade': {
        // Verificação completa: CEIS + CNEP + CEPIM
        const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
        if (!cnpjLimpo) {
          return new Response(JSON.stringify({ error: 'CNPJ é obrigatório para verificação de idoneidade' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const [ceisRes, cnepRes, cepimRes] = await Promise.allSettled([
          fetch(`${BASE_URL}/ceis?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
          fetch(`${BASE_URL}/cnep?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
          fetch(`${BASE_URL}/cepim?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
        ]);

        const parseResult = async (res: PromiseSettledResult<Response>, nome: string) => {
          if (res.status === 'rejected') return { nome, status: 'erro', registros: [], total: 0, erro: res.reason?.message };
          const r = res.value;
          if (!r.ok) {
            const text = await r.text();
            return { nome, status: 'erro', registros: [], total: 0, erro: `HTTP ${r.status}: ${text.substring(0, 200)}` };
          }
          const data = await r.json();
          const registros = Array.isArray(data) ? data : [];
          return { nome, status: registros.length > 0 ? 'encontrado' : 'limpo', registros, total: registros.length };
        };

        const resultados = {
          ceis: await parseResult(ceisRes, 'CEIS'),
          cnep: await parseResult(cnepRes, 'CNEP'),
          cepim: await parseResult(cepimRes, 'CEPIM'),
          cnpj: cnpjLimpo,
          idonea: true,
          consultadoEm: new Date().toISOString(),
        };

        resultados.idonea = resultados.ceis.status === 'limpo' && resultados.cnep.status === 'limpo' && resultados.cepim.status === 'limpo';

        return new Response(JSON.stringify(resultados), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      default:
        return new Response(JSON.stringify({ error: `Tipo de consulta inválido: ${tipo}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const fullUrl = `${url}?${params.toString()}`;
    console.log('Consultando:', fullUrl);

    const response = await fetch(fullUrl, { headers });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Portal da Transparência API error [${response.status}]:`, text.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: `Erro na API do Portal da Transparência (${response.status})`,
        detalhes: text.substring(0, 200),
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      dados: Array.isArray(data) ? data : [],
      total: Array.isArray(data) ? data.length : 0,
      pagina,
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
