// @ts-nocheck
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
    // Sem a chave a API devolve 401 — e a tela mostrava um erro genérico que
    // não dizia o que fazer. Falha com instrução é falha que se resolve.
    if (!API_KEY) {
      return new Response(JSON.stringify({
        error: 'A chave da API do Portal da Transparência ainda não foi configurada. '
          + 'Cadastre um e-mail em portaldatransparencia.gov.br/api-de-dados/cadastrar-email '
          + '(gratuito, resposta imediata) e informe a chave ao administrador do sistema.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'chave-api-dados': API_KEY,
    };

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
        // Licitações: a API EXIGE codigoOrgao (spec oficial, conferida em
        // 08/09). Sem ele, devolver a exigência com instrução — o 400 cru da
        // API não diz onde achar o código.
        if (!orgao) {
          return new Response(JSON.stringify({
            error: 'Para licitações federais a API exige o código SIAFI do órgão. '
              + 'Informe-o no campo "Código do órgão" (ex.: 26403 — IFPA; '
              + 'a lista completa está no Portal da Transparência, em Órgãos).',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${BASE_URL}/licitacoes`;
        params.set('codigoOrgao', orgao);
        if (dataInicio) params.set('dataInicial', dataInicio);
        if (dataFim) params.set('dataFinal', dataFim);
        break;
      }
      case 'contratos': {
        // Dois caminhos oficiais: por CNPJ do contratado (/contratos/cpf-cnpj,
        // parâmetro cpfCnpj — o caminho antigo cpfCnpjContratado não existe e
        // devolvia 403 mudo) ou por código SIAFI do órgão (/contratos).
        const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
        if (cnpjLimpo) {
          url = `${BASE_URL}/contratos/cpf-cnpj`;
          params.set('cpfCnpj', cnpjLimpo);
        } else if (orgao) {
          url = `${BASE_URL}/contratos`;
          params.set('codigoOrgao', orgao);
          if (dataInicio) params.set('dataInicial', dataInicio);
          if (dataFim) params.set('dataFinal', dataFim);
        } else {
          return new Response(JSON.stringify({
            error: 'Informe o CNPJ do contratado OU o código SIAFI do órgão — '
              + 'a API federal não lista contratos sem um dos dois.',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        break;
      }
      case 'contratos-cnpj': {
        // Contratos por CNPJ do contratado — caminho e parâmetro da spec.
        url = `${BASE_URL}/contratos/cpf-cnpj`;
        if (cnpj) params.set('cpfCnpj', cnpj.replace(/\D/g, ''));
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
      // Status 200 com {error}: repassar o 4xx fazia o invoke() do front
      // estourar com "non-2xx status code" — e a mensagem REAL da API
      // ("Informe um CNPJ válido…") ficava invisível (08/09). A tela já
      // renderiza data.error; o que a API disse chega ao usuário.
      let detalhe = text.substring(0, 200);
      try {
        const j = JSON.parse(text);
        detalhe = String(Object.values(j)[0] ?? detalhe);
      } catch { /* corpo não-JSON: fica o texto cru */ }
      return new Response(JSON.stringify({
        error: `A API do Portal da Transparência recusou a consulta: ${detalhe}`,
      }), {
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
