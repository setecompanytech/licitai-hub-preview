import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Usuário não autenticado");

    const userId = userData.user.id;

    // 1. Buscar perfis ativos do usuário
    const { data: perfis, error: perfisErr } = await supabase
      .from("perfis_alerta")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true);

    if (perfisErr) throw new Error(`Erro ao buscar perfis: ${perfisErr.message}`);
    if (!perfis || perfis.length === 0) {
      return jsonRes({ scores: [], message: "Nenhum perfil ativo encontrado", total_perfis: 0, total_licitacoes: 0, scores_calculados: 0 });
    }

    // 2. Buscar licitações recentes do cache (últimos 30 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const { data: licitacoes, error: licErr } = await supabase
      .from("pncp_editais_cache")
      .select("id, objeto, orgao, uf, municipio, modalidade, valor_estimado, data_abertura, data_encerramento, numero, portal")
      .gte("created_at", dataLimite.toISOString())
      .limit(500);

    if (licErr) throw new Error(`Erro ao buscar licitações: ${licErr.message}`);
    if (!licitacoes || licitacoes.length === 0) {
      return jsonRes({ scores: [], message: "Nenhuma licitação recente", total_perfis: perfis.length, total_licitacoes: 0, scores_calculados: 0 });
    }

    // 3. Calcular scores para cada perfil x licitação
    const allScores: any[] = [];

    for (const perfil of perfis) {
      for (const lic of licitacoes) {
        const score = calcularScore(perfil, lic);
        if (score.score_total > 0) {
          allScores.push({
            perfil_alerta_id: perfil.id,
            licitacao_cache_id: lic.id,
            user_id: userId,
            ...score,
          });
        }
      }
    }

    // 4. Upsert scores em batches
    let inserted = 0;
    for (let i = 0; i < allScores.length; i += 100) {
      const batch = allScores.slice(i, i + 100);
      const { error: upsertErr } = await supabase
        .from("licitacao_scores")
        .upsert(batch, { onConflict: "perfil_alerta_id,licitacao_cache_id" });
      if (!upsertErr) inserted += batch.length;
    }

    // 5. Create dispatch records for high-score matches (score >= 50)
    const highScores = allScores.filter(s => s.score_total >= 50);
    const dispatches: any[] = [];
    for (const s of highScores) {
      const perfil = perfis.find((p: any) => p.id === s.perfil_alerta_id);
      if (!perfil) continue;
      const lic = licitacoes.find((l: any) => l.id === s.licitacao_cache_id);
      const versao = lic?.versao || 1;
      const hash = lic?.hash_objeto || null;
      if (perfil.canal_sistema) {
        dispatches.push({ user_id: userId, perfil_alerta_id: s.perfil_alerta_id, licitacao_cache_id: s.licitacao_cache_id, canal: 'sistema', hash_enviado: hash, versao_enviada: versao, status: 'enviado', enviado_em: new Date().toISOString() });
      }
      if (perfil.canal_email) {
        dispatches.push({ user_id: userId, perfil_alerta_id: s.perfil_alerta_id, licitacao_cache_id: s.licitacao_cache_id, canal: 'email', hash_enviado: hash, versao_enviada: versao, status: 'pendente' });
      }
      if (perfil.canal_whatsapp) {
        dispatches.push({ user_id: userId, perfil_alerta_id: s.perfil_alerta_id, licitacao_cache_id: s.licitacao_cache_id, canal: 'whatsapp', hash_enviado: hash, versao_enviada: versao, status: 'pendente' });
      }
    }

    let dispatchesCreated = 0;
    for (let i = 0; i < dispatches.length; i += 100) {
      const batch = dispatches.slice(i, i + 100);
      const { error: dErr } = await supabase
        .from("alerta_dispatches")
        .upsert(batch, { onConflict: "perfil_alerta_id,licitacao_cache_id,canal,versao_enviada" });
      if (!dErr) dispatchesCreated += batch.length;
    }

    return jsonRes({
      total_perfis: perfis.length,
      total_licitacoes: licitacoes.length,
      scores_calculados: allScores.length,
      scores_inseridos: inserted,
      dispatches_criados: dispatchesCreated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calcularScore(perfil: any, lic: any) {
  const pesoTotal = perfil.peso_cnae + perfil.peso_palavra_chave + perfil.peso_regiao +
    perfil.peso_modalidade + perfil.peso_valor + perfil.peso_urgencia;

  const objetoLower = (lic.objeto || "").toLowerCase();
  const orgaoLower = (lic.orgao || "").toLowerCase();
  const textoCompleto = `${objetoLower} ${orgaoLower}`;

  // --- Score CNAE ---
  let scoreCnae = 0;
  if (perfil.cnaes?.length > 0) {
    for (const cnae of perfil.cnaes) {
      if (textoCompleto.includes(cnae.toLowerCase())) { scoreCnae = 100; break; }
    }
  }

  // --- Score palavras-chave ---
  let scorePalavra = 0;
  if (perfil.palavras_chave?.length > 0) {
    let matches = 0;
    for (const kw of perfil.palavras_chave) {
      if (objetoLower.includes(kw.toLowerCase())) matches++;
    }
    scorePalavra = Math.min(100, (matches / perfil.palavras_chave.length) * 100);
    if (perfil.palavras_negativas?.length > 0) {
      for (const neg of perfil.palavras_negativas) {
        if (objetoLower.includes(neg.toLowerCase())) scorePalavra = Math.max(0, scorePalavra - 50);
      }
    }
  }

  // --- Score região ---
  let scoreRegiao = 0;
  if (perfil.ufs?.length > 0 && lic.uf) {
    if (perfil.ufs.includes(lic.uf)) scoreRegiao = 100;
  }
  if (perfil.municipios?.length > 0 && lic.municipio) {
    for (const mun of perfil.municipios) {
      if ((lic.municipio || "").toLowerCase().includes(mun.toLowerCase())) { scoreRegiao = 100; break; }
    }
  }
  if (!perfil.ufs?.length && !perfil.municipios?.length) scoreRegiao = 50;

  // --- Score modalidade ---
  let scoreModalidade = 0;
  if (perfil.modalidades?.length > 0 && lic.modalidade) {
    for (const mod of perfil.modalidades) {
      if ((lic.modalidade || "").toLowerCase().includes(mod.toLowerCase())) { scoreModalidade = 100; break; }
    }
  }
  if (!perfil.modalidades?.length) scoreModalidade = 50;

  // --- Score valor ---
  let scoreValor = 50;
  const valor = lic.valor_estimado;
  if (valor != null && (perfil.valor_minimo != null || perfil.valor_maximo != null)) {
    const min = perfil.valor_minimo ?? 0;
    const max = perfil.valor_maximo ?? Infinity;
    if (valor >= min && valor <= max) scoreValor = 100;
    else if (valor < min) scoreValor = Math.max(0, 100 - ((min - valor) / min) * 100);
    else scoreValor = Math.max(0, 100 - ((valor - max) / max) * 100);
  }

  // --- Score urgência ---
  let scoreUrgencia = 0;
  if (lic.data_abertura) {
    const dias = Math.ceil((new Date(lic.data_abertura).getTime() - Date.now()) / 86400000);
    if (dias <= 0) scoreUrgencia = 0;
    else if (dias <= 3) scoreUrgencia = 100;
    else if (dias <= 7) scoreUrgencia = 80;
    else if (dias <= 15) scoreUrgencia = 60;
    else if (dias <= 30) scoreUrgencia = 40;
    else scoreUrgencia = 20;
  }

  // --- Órgão bloqueado ---
  if (perfil.orgaos_bloqueados?.length > 0 && lic.orgao) {
    for (const bloq of perfil.orgaos_bloqueados) {
      if (orgaoLower.includes(bloq.toLowerCase())) {
        return { score_total: 0, score_cnae: 0, score_palavra_chave: 0, score_regiao: 0, score_modalidade: 0, score_valor: 0, score_urgencia: 0, classificacao: "bloqueado" };
      }
    }
  }

  // --- Bonus órgão favorito ---
  if (perfil.orgaos_favoritos?.length > 0) {
    for (const fav of perfil.orgaos_favoritos) {
      if (orgaoLower.includes(fav.toLowerCase())) { scorePalavra = Math.min(100, scorePalavra + 20); break; }
    }
  }

  // --- Score total ponderado ---
  const scoreTotal = pesoTotal > 0 ? Math.round(
    (scoreCnae * perfil.peso_cnae + scorePalavra * perfil.peso_palavra_chave +
      scoreRegiao * perfil.peso_regiao + scoreModalidade * perfil.peso_modalidade +
      scoreValor * perfil.peso_valor + scoreUrgencia * perfil.peso_urgencia) / pesoTotal
  ) : 0;

  // --- Classificação automática ---
  let classificacao = "normal";
  if (scoreTotal >= 80 && scoreUrgencia >= 80) classificacao = "quente";
  else if (scoreUrgencia >= 80) classificacao = "urgente";
  else if (scoreTotal >= 70) classificacao = "premium";
  else if (scoreRegiao >= 80 && scoreTotal >= 50) classificacao = "regional";

  return {
    score_total: scoreTotal,
    score_cnae: Math.round(scoreCnae),
    score_palavra_chave: Math.round(scorePalavra),
    score_regiao: Math.round(scoreRegiao),
    score_modalidade: Math.round(scoreModalidade),
    score_valor: Math.round(scoreValor),
    score_urgencia: Math.round(scoreUrgencia),
    classificacao,
  };
}

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Content-Type": "application/json",
    },
  });
}
