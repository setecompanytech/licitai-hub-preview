import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Delete licitacoes archived more than 120 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 120);

    const { data: deleted, error } = await supabase
      .from('licitacoes')
      .delete()
      .not('arquivado_em', 'is', null)
      .lt('arquivado_em', cutoffDate.toISOString())
      .select('id, numero');

    if (error) throw error;

    // Auto-archive: licitacoes with final status that don't have arquivado_em yet
    const finalStatuses = ['Homologado', 'Contrato Assinado', 'Deserto', 'Fracassado', 'Revogado', 'Anulado'];
    const { data: archived, error: archiveError } = await supabase
      .from('licitacoes')
      .update({ arquivado_em: new Date().toISOString() })
      .in('status', finalStatuses)
      .is('arquivado_em', null)
      .select('id, numero');

    if (archiveError) throw archiveError;

    return new Response(
      JSON.stringify({
        deleted: deleted?.length || 0,
        archived: archived?.length || 0,
        cutoff: cutoffDate.toISOString(),
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
