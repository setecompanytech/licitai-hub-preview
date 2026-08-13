// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  STATUS_DECIDIDOS,
  RESULTADOS_ENCERRADORES,
  DIAS_CARENCIA_ARQUIVAMENTO,
  DIAS_RETENCAO_ARQUIVO,
} from "../_shared/licitacao-status.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET to prevent unauthorized access
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!cronSecret || token !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Expurgo: arquivados há mais de 120 dias saem do banco.
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DIAS_RETENCAO_ARQUIVO);

    const { data: deleted, error } = await supabase
      .from('licitacoes')
      .delete()
      .not('arquivado_em', 'is', null)
      .lt('arquivado_em', cutoffDate.toISOString())
      .select('id, numero');

    if (error) throw error;

    // Arquivamento automático — só depois da carência, para dar tempo de
    // Contratos e Financeiro engancharem no processo ganho.
    //
    // A versão anterior procurava ['Homologado', 'Contrato Assinado', 'Deserto',
    // 'Fracassado', 'Revogado', 'Anulado'] na coluna `status`. Nenhum desses
    // valores é escrito ali: o Kanban grava 'Homologada' (feminino) e os demais
    // são valores da coluna `resultado`. A interseção era vazia e este bloco
    // nunca arquivou uma linha sequer.
    const carencia = new Date();
    carencia.setDate(carencia.getDate() - DIAS_CARENCIA_ARQUIVAMENTO);
    const carenciaISO = carencia.toISOString();

    const { data: porStatus, error: erroStatus } = await supabase
      .from('licitacoes')
      .update({ arquivado_em: new Date().toISOString() })
      .in('status', STATUS_DECIDIDOS)
      .is('arquivado_em', null)
      .lt('updated_at', carenciaISO)
      .select('id, numero');

    if (erroStatus) throw erroStatus;

    const { data: porResultado, error: erroResultado } = await supabase
      .from('licitacoes')
      .update({ arquivado_em: new Date().toISOString() })
      .in('resultado', RESULTADOS_ENCERRADORES)
      .is('arquivado_em', null)
      .lt('updated_at', carenciaISO)
      .select('id, numero');

    if (erroResultado) throw erroResultado;

    const archived = [...(porStatus || []), ...(porResultado || [])];

    return new Response(
      JSON.stringify({
        deleted: deleted?.length || 0,
        archived: archived.length,
        archived_por_status: porStatus?.length || 0,
        archived_por_resultado: porResultado?.length || 0,
        cutoff: cutoffDate.toISOString(),
        carencia: carenciaISO,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
