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

    // 1. Get preferences with DOU monitoring enabled
    const { data: prefs } = await supabase
      .from("preferencias_alertas")
      .select("*")
      .eq("ativo", true)
      .or("receber_alteracoes.eq.true,receber_suspensoes.eq.true,receber_cancelamentos.eq.true");

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active preferences for DOU", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const publishedSince = ontem.toISOString().split('T')[0];
    const publishedUntil = hoje.toISOString().split('T')[0];

    let totalProcessed = 0;
    let totalAlertas = 0;

    // Get unique CNPJs and razao_socials
    const searchTerms: { userId: string; cnpj?: string; razaoSocial?: string }[] = [];
    for (const pref of prefs) {
      if (pref.cnpj || pref.razao_social) {
        searchTerms.push({
          userId: pref.user_id,
          cnpj: pref.cnpj?.replace(/\D/g, ''),
          razaoSocial: pref.razao_social,
        });
      }

      // Also get from empresa ativa
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_ativa_id")
        .eq("user_id", pref.user_id)
        .single();

      if (profile?.empresa_ativa_id) {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("cnpj, razao_social")
          .eq("id", profile.empresa_ativa_id)
          .single();

        if (empresa && !searchTerms.find(s => s.cnpj === empresa.cnpj?.replace(/\D/g, '') && s.userId === pref.user_id)) {
          searchTerms.push({
            userId: pref.user_id,
            cnpj: empresa.cnpj?.replace(/\D/g, ''),
            razaoSocial: empresa.razao_social,
          });
        }
      }
    }

    // 2. Query Querido Diário API for each unique search term
    const processedTerms = new Set<string>();
    for (const term of searchTerms) {
      const searchQuery = term.cnpj || term.razaoSocial || '';
      if (!searchQuery) continue;
      const termKey = `${term.userId}-${searchQuery}`;
      if (processedTerms.has(termKey)) continue;
      processedTerms.add(termKey);

      try {
        const url = `https://queridodiario.ok.org.br/api/gazettes?querystring=${encodeURIComponent(searchQuery)}&published_since=${publishedSince}&published_until=${publishedUntil}&size=20`;
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const gazettes = data?.gazettes || [];

        for (const gazette of gazettes) {
          const idUnico = `dou-${gazette.territory_id}-${gazette.date}-${searchQuery.slice(0, 14)}`;

          // Check if already processed
          const { data: existing } = await supabase
            .from("publicacoes_dou_processadas")
            .select("id")
            .eq("identificador", idUnico)
            .maybeSingle();

          if (existing) continue;

          // Analyze content to classify
          const excerpts = (gazette.excerpts || []).join(' ').toLowerCase();
          let tipo = 'alteracao';
          let urgente = false;

          if (excerpts.includes('suspens') || excerpts.includes('suspende')) {
            tipo = 'suspensao';
            urgente = true;
          } else if (excerpts.includes('cancel') || excerpts.includes('revoga')) {
            tipo = 'cancelamento';
            urgente = true;
          } else if (excerpts.includes('homologa') || excerpts.includes('adjudica')) {
            tipo = 'homologacao';
          } else if (excerpts.includes('altera') || excerpts.includes('retifica') || excerpts.includes('errata')) {
            tipo = 'alteracao';
          }

          // Check user preferences for this tipo
          const userPref = prefs.find(p => p.user_id === term.userId);
          if (!userPref) continue;
          if (tipo === 'alteracao' && !userPref.receber_alteracoes) continue;
          if (tipo === 'suspensao' && !userPref.receber_suspensoes) continue;
          if (tipo === 'cancelamento' && !userPref.receber_cancelamentos) continue;
          if (tipo === 'homologacao' && !userPref.receber_homologacoes) continue;

          const titulo = (gazette.excerpts?.[0] || '').slice(0, 200) || `Publicação no DO - ${gazette.territory_name || ''}`;
          const descricao = (gazette.excerpts || []).join('\n').slice(0, 500) || 'Publicação encontrada no Diário Oficial';

          // Extract process number if present
          const processMatch = excerpts.match(/(?:pregão|pregao|processo)\s*(?:eletrônico|eletronico)?\s*(?:n[ºo°.]?\s*)?(\d+[\/\-]\d+)/i);

          await supabase.from("alertas_gerados").insert({
            user_id: term.userId,
            tipo,
            titulo: titulo.slice(0, 200),
            descricao,
            orgao: gazette.territory_name || null,
            uf: gazette.state_code || null,
            numero_processo: processMatch?.[1] || null,
            url_publicacao: gazette.url || null,
            fonte: gazette.territory_id?.startsWith('br_') ? 'DOE' : 'DOU',
            urgente,
          });
          totalAlertas++;

          // Mark as processed
          await supabase.from("publicacoes_dou_processadas").insert({
            identificador: idUnico,
            tipo_publicacao: tipo,
            data_publicacao: gazette.date,
            orgao: gazette.territory_name,
            cnpj_mencionado: term.cnpj || null,
            conteudo_resumo: titulo.slice(0, 200),
          });

          totalProcessed++;
        }
      } catch (err) {
        console.error(`Error querying DOU for ${searchQuery}:`, err);
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
