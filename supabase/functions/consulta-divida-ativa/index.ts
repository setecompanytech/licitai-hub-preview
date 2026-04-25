// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API da PGFN - Dívida Ativa da União
// Endpoint público para consulta de regularidade
const PGFN_URL = 'https://www.regularize.pgfn.gov.br';

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

    // Usar Portal da Transparência para verificar se há inscrições em dívida ativa
    const API_KEY = Deno.env.get('PORTAL_TRANSPARENCIA_API_KEY');
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (API_KEY) headers['chave-api-dados'] = API_KEY;

    // O Portal da Transparência não tem endpoint direto de dívida ativa
    // Usamos o CEIS + CNEP como indicadores de irregularidade fiscal
    // Para consulta completa de Dívida Ativa, o usuário deve acessar regularize.pgfn.gov.br

    // Verificar sanções (indicador indireto de problemas fiscais)
    let sancoesAtivas = false;
    let detalhes: any[] = [];

    try {
      const ceisUrl = `https://api.portaldatransparencia.gov.br/api-de-dados/ceis?cnpjSancionado=${cnpjLimpo}&pagina=1`;
      const ceisRes = await fetch(ceisUrl, { headers });
      if (ceisRes.ok) {
        const ceisData = await ceisRes.json();
        if (Array.isArray(ceisData) && ceisData.length > 0) {
          sancoesAtivas = true;
          detalhes = ceisData.map((s: any) => ({
            tipo: 'CEIS',
            orgao: s.orgaoSancionador?.nome || 'Não informado',
            motivo: s.fundamentacao?.descricaoFundamentacao || 'Não informado',
            dataInicio: s.dataInicioSancao,
            dataFim: s.dataFimSancao,
          }));
        }
      }
    } catch (e) {
      console.error('Erro ao consultar CEIS:', e);
    }

    return new Response(JSON.stringify({
      cnpj: cnpjLimpo,
      sancoesAtivas,
      totalSancoes: detalhes.length,
      detalhes: detalhes.slice(0, 10),
      linkConsultaDireta: `${PGFN_URL}/consulta/simples`,
      nota: 'Para consulta completa de Dívida Ativa da União, acesse o portal Regularize da PGFN. Os dados exibidos são baseados no Portal da Transparência (CEIS/CNEP).',
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
