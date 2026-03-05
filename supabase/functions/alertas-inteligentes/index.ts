import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const in3Days = new Date(now.getTime() + 3 * 86400000).toISOString();
  const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Get all active users
  const { data: users } = await supabase.from('profiles').select('user_id');
  if (!users || users.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let totalNotifs = 0;

  for (const u of users) {
    const userId = u.user_id;
    const notifs: { titulo: string; mensagem: string; tipo: string; link: string | null }[] = [];

    // 1. Licitações com encerramento em 3 dias
    const { data: urgentes } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, data_encerramento')
      .eq('user_id', userId)
      .not('status', 'in', '("Vencida","Perdida","Homologada","Arquivada")')
      .gte('data_encerramento', `${today}T00:00:00`)
      .lte('data_encerramento', in3Days);

    for (const lic of urgentes || []) {
      const dataEnc = new Date(lic.data_encerramento!);
      const diffH = Math.round((dataEnc.getTime() - now.getTime()) / 3600000);
      notifs.push({
        titulo: `⏰ Prazo urgente: ${lic.numero}`,
        mensagem: `Licitação ${lic.numero} (${lic.orgao}) encerra em ${diffH < 24 ? diffH + 'h' : Math.ceil(diffH / 24) + ' dias'}.`,
        tipo: 'prazo',
        link: '/kanban',
      });
    }

    // 2. Documentos com validade vencendo em 7 dias
    const { data: docsVencendo } = await supabase
      .from('documentos')
      .select('id, nome, validade')
      .eq('user_id', userId)
      .not('validade', 'is', null)
      .gte('validade', today)
      .lte('validade', in7Days.split('T')[0]);

    for (const doc of docsVencendo || []) {
      const valDate = new Date(doc.validade!);
      const diffDias = Math.ceil((valDate.getTime() - now.getTime()) / 86400000);
      notifs.push({
        titulo: `📄 Documento vencendo: ${doc.nome}`,
        mensagem: `O documento "${doc.nome}" vence em ${diffDias} dia(s) (${valDate.toLocaleDateString('pt-BR')}).`,
        tipo: 'documento',
        link: '/documentos',
      });
    }

    // 3. Certificados de empresa vencendo em 7 dias
    const { data: membros } = await supabase
      .from('empresa_membros')
      .select('empresa_id, empresas(razao_social, certificado_validade)')
      .eq('user_id', userId);

    for (const m of membros || []) {
      const emp = (m as any).empresas;
      if (emp?.certificado_validade) {
        const certDate = new Date(emp.certificado_validade);
        const diffDias = Math.ceil((certDate.getTime() - now.getTime()) / 86400000);
        if (diffDias >= 0 && diffDias <= 7) {
          notifs.push({
            titulo: `🔐 Certificado vencendo: ${emp.razao_social}`,
            mensagem: `O certificado digital de "${emp.razao_social}" vence em ${diffDias} dia(s).`,
            tipo: 'documento',
            link: '/empresas',
          });
        }
      }
    }

    // 4. Novos editais compatíveis (não lidos, score > 70)
    const { data: editaisNovos } = await supabase
      .from('monitoramento_editais')
      .select('id, titulo, orgao, relevancia_score')
      .eq('user_id', userId)
      .eq('lido', false)
      .eq('cnae_compativel', true)
      .gte('relevancia_score', 70)
      .gte('created_at', new Date(now.getTime() - 24 * 3600000).toISOString())
      .limit(5);

    if (editaisNovos && editaisNovos.length > 0) {
      notifs.push({
        titulo: `🎯 ${editaisNovos.length} edital(is) compatível(is)`,
        mensagem: `Novos editais com alta relevância: ${editaisNovos.map(e => e.orgao).slice(0, 3).join(', ')}${editaisNovos.length > 3 ? '...' : ''}.`,
        tipo: 'edital',
        link: '/monitoramento-editais',
      });
    }

    // Deduplicate: check existing notifications from today
    if (notifs.length > 0) {
      const { data: existing } = await supabase
        .from('notificacoes')
        .select('titulo')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`);

      const existingTitles = new Set((existing || []).map((n: any) => n.titulo));
      const newNotifs = notifs.filter(n => !existingTitles.has(n.titulo));

      if (newNotifs.length > 0) {
        await supabase.from('notificacoes').insert(
          newNotifs.map(n => ({ ...n, user_id: userId }))
        );
        totalNotifs += newNotifs.length;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, notifications_created: totalNotifs }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
