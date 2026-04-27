// Edge Function: reconciliation-engine
// Faz matching automático entre movimentos do extrato e lançamentos previstos.
// Heurística: mesmo valor (sinal correto), data ±5 dias, descrição similar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ").filter((w) => w.length >= 3));
  const B = new Set(normalize(b).split(" ").filter((w) => w.length >= 3));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size, B.size);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

interface Movimento {
  id: string;
  conta_id: string;
  valor: number;
  data_movimento: string;
  descricao: string;
}
interface Lancamento {
  id: string;
  conta_id: string | null;
  natureza: string;
  valor: number;
  data_vencimento: string | null;
  data_competencia: string;
  descricao: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      empresa_id,
      extrato_id,
      conta_id,
      auto_aplicar = false,
      score_minimo = 70,
      usar_ia = false,
    } = body;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase.rpc("is_empresa_member", {
      _user_id: user.id,
      _empresa_id: empresa_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca movimentos não conciliados
    let qMov = supabase
      .from("financeiro_extrato_movimentos")
      .select("id, conta_id, valor, data_movimento, descricao")
      .eq("empresa_id", empresa_id)
      .eq("conciliado", false);
    if (extrato_id) qMov = qMov.eq("extrato_id", extrato_id);
    if (conta_id) qMov = qMov.eq("conta_id", conta_id);
    const { data: movimentos, error: errMov } = await qMov.limit(500);
    if (errMov) throw errMov;

    // Busca lançamentos pendentes (previstos)
    const { data: lancamentos, error: errLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("id, conta_id, natureza, valor, data_vencimento, data_competencia, descricao, status")
      .eq("empresa_id", empresa_id)
      .in("status", ["previsto", "realizado"])
      .limit(2000);
    if (errLanc) throw errLanc;

    const matches: Array<{
      movimento_id: string;
      lancamento_id: string;
      score: number;
      motivos: Record<string, unknown>;
    }> = [];

    const lancUsados = new Set<string>();

    for (const mov of (movimentos || []) as Movimento[]) {
      const valorAbs = Math.abs(mov.valor);
      const naturezaEsperada = mov.valor >= 0 ? "credito" : "debito";

      const candidatos = (lancamentos || []).filter((l: Lancamento) => {
        if (lancUsados.has(l.id)) return false;
        if (l.natureza !== naturezaEsperada) return false;
        if (Math.abs(Number(l.valor) - valorAbs) > 0.02) return false;
        const dataLanc = l.data_vencimento || l.data_competencia;
        if (daysBetween(dataLanc, mov.data_movimento) > 5) return false;
        if (l.conta_id && l.conta_id !== mov.conta_id) return false;
        return true;
      });

      if (candidatos.length === 0) continue;

      let melhor: { lanc: Lancamento; score: number; motivos: Record<string, unknown> } | null = null;
      for (const l of candidatos as Lancamento[]) {
        const dataLanc = l.data_vencimento || l.data_competencia;
        const diffDias = daysBetween(dataLanc, mov.data_movimento);
        const sim = similarity(l.descricao, mov.descricao);
        const scoreValor = 50;
        const scoreData = Math.max(0, 25 - diffDias * 5);
        const scoreDescricao = sim * 25;
        const scoreConta = l.conta_id === mov.conta_id ? 0 : -10;
        const score = Math.round(scoreValor + scoreData + scoreDescricao + scoreConta);
        const motivos = {
          valor_match: true,
          diferenca_dias: diffDias,
          similaridade_descricao: Math.round(sim * 100) / 100,
          mesma_conta: l.conta_id === mov.conta_id,
        };
        if (!melhor || score > melhor.score) melhor = { lanc: l, score, motivos };
      }

      if (melhor && melhor.score >= score_minimo) {
        matches.push({
          movimento_id: mov.id,
          lancamento_id: melhor.lanc.id,
          score: melhor.score,
          motivos: melhor.motivos,
        });
        lancUsados.add(melhor.lanc.id);
      }
    }

    let aplicados = 0;
    if (auto_aplicar && matches.length > 0) {
      for (const m of matches) {
        // Insere conciliação
        const { error: errCon } = await supabase
          .from("financeiro_conciliacoes")
          .insert({
            empresa_id,
            extrato_movimento_id: m.movimento_id,
            lancamento_id: m.lancamento_id,
            score: m.score,
            metodo: "auto",
            motivos: m.motivos,
            conciliado_por: user.id,
          });
        if (errCon) {
          console.error("erro conciliacao:", errCon);
          continue;
        }
        // Atualiza movimento
        await supabase
          .from("financeiro_extrato_movimentos")
          .update({ conciliado: true, lancamento_id: m.lancamento_id })
          .eq("id", m.movimento_id);
        // Atualiza lançamento
        await supabase
          .from("financeiro_lancamentos")
          .update({ status: "conciliado", data_conciliado: new Date().toISOString() })
          .eq("id", m.lancamento_id);
        aplicados++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        movimentos_analisados: movimentos?.length || 0,
        sugestoes: matches.length,
        aplicados,
        matches: auto_aplicar ? [] : matches,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reconciliation-engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
