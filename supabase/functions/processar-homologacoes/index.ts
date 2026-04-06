import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get preferences with receber_homologacoes = true
    const { data: prefs } = await supabase
      .from("preferencias_alertas")
      .select("*")
      .eq("ativo", true)
      .eq("receber_homologacoes", true);

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active homologation preferences", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const publishedSince = ontem.toISOString().split('T')[0];
    const publishedUntil = hoje.toISOString().split('T')[0];
    const sixMonthsAgo = new Date(hoje);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let totalProcessed = 0;
    let totalAlertas = 0;

    for (const pref of prefs) {
      try {
        // 2. Get user's participated licitações from the last 6 months
        const { data: userLicitacoes } = await supabase
          .from("licitacoes")
          .select("id, numero, orgao, objeto, empresa_id, status")
          .eq("user_id", pref.user_id)
          .in("status", ["em_andamento", "proposta_enviada", "em_disputa", "habilitado", "classificado"])
          .gte("created_at", sixMonthsAgo.toISOString());

        if (!userLicitacoes || userLicitacoes.length === 0) continue;

        // Get empresa CNPJs
        const empresaIds = [...new Set(userLicitacoes.map(l => l.empresa_id).filter(Boolean))];
        let empresas: { id: string; cnpj: string; razao_social: string }[] = [];
        if (empresaIds.length > 0) {
          const { data } = await supabase
            .from("empresas")
            .select("id, cnpj, razao_social")
            .in("id", empresaIds as string[]);
          empresas = (data || []) as any[];
        }

        // Also use pref CNPJ
        const cnpjLimpo = pref.cnpj?.replace(/\D/g, '');
        const razaoSocial = pref.razao_social;

        // 3. For each licitação, search DOU for homologation
        for (const lic of userLicitacoes) {
          const searchTerms: string[] = [];
          if (lic.numero) searchTerms.push(lic.numero);
          if (lic.orgao) searchTerms.push(lic.orgao);

          const searchQuery = searchTerms.filter(Boolean).join(' ') + ' homologação';
          if (searchQuery.trim().length < 5) continue;

          try {
            const url = `https://queridodiario.ok.org.br/api/gazettes?querystring=${encodeURIComponent(searchQuery)}&published_since=${publishedSince}&published_until=${publishedUntil}&size=5`;
            const res = await fetch(url);
            if (!res.ok) continue;

            const data = await res.json();
            const gazettes = data?.gazettes || [];

            for (const gazette of gazettes) {
              const idUnico = `homolog-${lic.id}-${gazette.date}`;

              const { data: existing } = await supabase
                .from("publicacoes_dou_processadas")
                .select("id")
                .eq("identificador", idUnico)
                .maybeSingle();

              if (existing) continue;

              const excerpts = (gazette.excerpts || []).join(' ').toLowerCase();

              // Check if homologation/adjudication
              if (!excerpts.includes('homologa') && !excerpts.includes('adjudica') && !excerpts.includes('resultado')) continue;

              // Check if client is mentioned as winner
              let vencedor = false;
              if (cnpjLimpo && excerpts.includes(cnpjLimpo)) vencedor = true;
              if (razaoSocial && excerpts.includes(razaoSocial.toLowerCase())) vencedor = true;

              for (const emp of empresas) {
                const empCnpj = emp.cnpj?.replace(/\D/g, '');
                if (empCnpj && excerpts.includes(empCnpj)) vencedor = true;
                if (emp.razao_social && excerpts.includes(emp.razao_social.toLowerCase())) vencedor = true;
              }

              const titulo = vencedor
                ? `🏆 Homologação — ${lic.numero || lic.orgao || 'Processo'} — VENCEDOR`
                : `📊 Resultado — ${lic.numero || lic.orgao || 'Processo'}`;

              const descricao = vencedor
                ? `Sua empresa foi homologada como vencedora no processo ${lic.numero || ''} - ${lic.orgao || ''}. ${(gazette.excerpts?.[0] || '').slice(0, 300)}`
                : `Publicação de resultado para o processo ${lic.numero || ''} - ${lic.orgao || ''}. ${(gazette.excerpts?.[0] || '').slice(0, 300)}`;

              await supabase.from("alertas_gerados").insert({
                user_id: pref.user_id,
                tipo: vencedor ? 'homologacao' : 'resultado',
                titulo: titulo.slice(0, 200),
                descricao,
                orgao: lic.orgao || gazette.territory_name || null,
                uf: gazette.state_code || null,
                numero_processo: lic.numero || null,
                url_publicacao: gazette.url || null,
                fonte: 'DOU',
                urgente: false,
              });
              totalAlertas++;

              // Update licitação status if winner
              if (vencedor) {
                await supabase.from("licitacoes")
                  .update({ status: 'homologado', vencedor: true, data_homologacao: gazette.date })
                  .eq("id", lic.id);
              }

              // Mark as processed
              await supabase.from("publicacoes_dou_processadas").insert({
                identificador: idUnico,
                tipo_publicacao: 'homologacao',
                data_publicacao: gazette.date,
                orgao: lic.orgao,
                processo_mencionado: lic.numero,
                conteudo_resumo: titulo.slice(0, 200),
              });

              totalProcessed++;
            }
          } catch (err) {
            console.error(`Error searching homologation for ${lic.numero}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error processing user ${pref.user_id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, alerts_created: totalAlertas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
