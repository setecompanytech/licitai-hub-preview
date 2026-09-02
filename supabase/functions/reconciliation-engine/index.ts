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

    /**
     * Lançamentos que podem casar com um movimento.
     *
     * `previsto` e `realizado` são os óbvios. `conciliado` entra também — mas
     * só quando NÃO há registro em `financeiro_conciliacoes` apontando para
     * ele: nesse caso a marca existe e o vínculo não, e o lançamento está
     * livre para casar de novo.
     *
     * Sem isso, apagar um extrato e reimportá-lo produzia pendências
     * insolúveis. A exclusão leva a conciliação junto (ON DELETE CASCADE) mas
     * deixa `status = conciliado` no lançamento; na reimportação o motor não o
     * enxergava, nenhum match era achado, e não havia como reconciliar pela
     * tela — o outro lado estava marcado como já feito. Na base há 209
     * lançamentos assim, somando R$ 13,5 milhões.
     */
    const { data: lancamentosBrutos, error: errLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("id, conta_id, natureza, valor, data_vencimento, data_competencia, descricao, status")
      .eq("empresa_id", empresa_id)
      .in("status", ["previsto", "realizado", "conciliado"])
      .limit(4000);
    if (errLanc) throw errLanc;

    // Quem já tem vínculo sai da disputa: conciliado COM conciliação está
    // resolvido, e oferecê-lo de novo criaria dupla contagem.
    const { data: jaVinculados } = await supabase
      .from("financeiro_conciliacoes")
      .select("lancamento_id")
      .eq("empresa_id", empresa_id);
    const comVinculo = new Set(
      (jaVinculados ?? []).map((k: { lancamento_id: string }) => k.lancamento_id),
    );
    const lancamentos = (lancamentosBrutos ?? []).filter(
      (l: { id: string; status: string }) => l.status !== "conciliado" || !comVinculo.has(l.id),
    );

    const matches: Array<{
      movimento_id: string;
      lancamento_id: string;
      score: number;
      metodo: string;
      motivos: Record<string, unknown>;
      justificativa_ia?: string;
    }> = [];

    const lancUsados = new Set<string>();

    for (const mov of (movimentos || []) as Movimento[]) {
      const valorAbs = Math.abs(mov.valor);
      // Lançamento fala receita/despesa — comparar com "credito"/"debito"
      // fazia TODO candidato reprovar, e o motor nunca sugeria nada.
      const naturezaEsperada = mov.valor >= 0 ? "receita" : "despesa";

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
          metodo: "heuristica",
          motivos: melhor.motivos,
        });
        lancUsados.add(melhor.lanc.id);
      }
    }

    // ===== Camada IA (Lovable AI Gateway) =====
    // Para cada movimento ainda sem match, monta candidatos relaxados (±15 dias, valor ±5%)
    // e pede ao Gemini Flash que escolha o melhor (ou nenhum) com justificativa.
    let ia_consultados = 0;
    let ia_sugeridos = 0;
    if (usar_ia) {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        console.warn("OPENAI_API_KEY ausente — pulando camada IA");
      } else {
        const movsSemMatch = ((movimentos || []) as Movimento[]).filter(
          (m) => !matches.find((x) => x.movimento_id === m.id)
        );
        // Limita para controlar custo/latência
        const MAX_IA = 30;
        for (const mov of movsSemMatch.slice(0, MAX_IA)) {
          const valorAbs = Math.abs(mov.valor);
          const naturezaEsperada = mov.valor >= 0 ? "receita" : "despesa";
          const candidatos = (lancamentos || [])
            .filter((l: Lancamento) => {
              if (lancUsados.has(l.id)) return false;
              if (l.natureza !== naturezaEsperada) return false;
              const dataLanc = l.data_vencimento || l.data_competencia;
              if (daysBetween(dataLanc, mov.data_movimento) > 15) return false;
              const diffPct = Math.abs(Number(l.valor) - valorAbs) / Math.max(valorAbs, 0.01);
              if (diffPct > 0.05) return false; // 5% de tolerância (taxas, juros)
              return true;
            })
            .slice(0, 8); // top 8 candidatos
          if (candidatos.length === 0) continue;
          ia_consultados++;
          try {
            const prompt = `Você é um contador especialista em conciliação bancária brasileira. Analise o movimento bancário e os lançamentos previstos candidatos. Escolha o ÚNICO lançamento que melhor corresponde, ou retorne null se nenhum for confiável (ex: divergências grandes, descrições incompatíveis).

Movimento bancário:
- Data: ${mov.data_movimento}
- Valor: R$ ${mov.valor.toFixed(2)} (${naturezaEsperada})
- Descrição: "${mov.descricao}"

Candidatos (lançamentos previstos):
${candidatos.map((c: Lancamento, i: number) => `${i + 1}. ID=${c.id} | data=${c.data_vencimento || c.data_competencia} | valor=R$ ${Number(c.valor).toFixed(2)} | descrição="${c.descricao}"`).join("\n")}

Responda em JSON estrito: {"escolha_id": "<o ID exato do candidato escolhido, ou null>", "confianca": <0-100>, "justificativa": "<frase curta em PT-BR explicando o match ou a recusa>"}`;

            const resp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
              }),
            });
            if (!resp.ok) {
              if (resp.status === 429) console.warn("IA rate-limited");
              else if (resp.status === 402) console.warn("IA sem créditos");
              continue;
            }
            const json = await resp.json();
            const content = json?.choices?.[0]?.message?.content;
            if (!content) continue;
            const parsed = JSON.parse(content);
            // Escolha por ID textual: a lista numerada de 0 fazia "1" (o
            // primeiro, na cabeça do modelo) selecionar o SEGUNDO candidato; e
            // resposta não-numérica virava NaN, que passava no guard de faixa
            // (NaN < 0 é false) e explodia adiante, engolida pelo catch.
            const escolhaId = parsed?.escolha_id ?? parsed?.escolha ?? null;
            const confianca = Number(parsed?.confianca ?? 0);
            const justificativa = String(parsed?.justificativa ?? "").slice(0, 280);
            if (escolhaId === null || escolhaId === undefined) continue;
            const lancEscolhido = candidatos.find(
              (c: Lancamento) => c.id === String(escolhaId).trim(),
            ) as Lancamento | undefined;
            if (!lancEscolhido) continue;
            if (!Number.isFinite(confianca) || confianca < 60) continue; // gate mínimo
            const dataLanc = lancEscolhido.data_vencimento || lancEscolhido.data_competencia;
            matches.push({
              movimento_id: mov.id,
              lancamento_id: lancEscolhido.id,
              score: Math.min(100, Math.round(confianca)),
              metodo: "ia",
              motivos: {
                ia: true,
                confianca,
                diferenca_dias: daysBetween(dataLanc, mov.data_movimento),
                diferenca_valor: Math.abs(Number(lancEscolhido.valor) - valorAbs),
              },
              justificativa_ia: justificativa,
            });
            lancUsados.add(lancEscolhido.id);
            ia_sugeridos++;
          } catch (e) {
            console.error("Erro IA match:", e);
          }
        }
      }
    }

    let aplicados = 0;
    // Auto-aplica somente matches com confiança >= 90 (preferência do usuário)
    // matches abaixo ficam como sugestão para revisão manual.
    const LIMITE_AUTO = 90;
    if (auto_aplicar && matches.length > 0) {
      for (const m of matches) {
        if (m.score < LIMITE_AUTO) continue;
        const motivosFinal: Record<string, unknown> = { ...m.motivos };
        if (m.justificativa_ia) motivosFinal.justificativa_ia = m.justificativa_ia;
        const { error: errCon } = await supabase
          .from("financeiro_conciliacoes")
          .insert({
            empresa_id,
            extrato_movimento_id: m.movimento_id,
            lancamento_id: m.lancamento_id,
            score: m.score,
            metodo: m.metodo === "ia" ? "ia" : "auto",
            motivos: motivosFinal,
            conciliado_por: user.id,
          });
        if (errCon) {
          console.error("erro conciliacao:", errCon);
          continue;
        }
        await supabase
          .from("financeiro_extrato_movimentos")
          .update({ conciliado: true, lancamento_id: m.lancamento_id })
          .eq("id", m.movimento_id);
        // A data do pagamento é a do BANCO — sem ela, o lançamento conciliado
        // conta pela competência e a curva mensal deriva (a doença de julho).
        const movDoMatch = ((movimentos || []) as Movimento[]).find(
          (x) => x.id === m.movimento_id,
        );
        await supabase
          .from("financeiro_lancamentos")
          .update({
            status: "conciliado",
            data_conciliado: new Date().toISOString(),
            ...(movDoMatch ? { data_realizado: movDoMatch.data_movimento } : {}),
          })
          .eq("id", m.lancamento_id);
        // Log reversível
        await supabase.from("fin_conciliacao_log").insert({
          empresa_id,
          movimento_id: m.movimento_id,
          lancamento_id: m.lancamento_id,
          acao: "auto_match",
          confianca: m.score,
          metodo: m.metodo === "ia" ? "ia_descritor" : "deterministico",
          detalhes: motivosFinal,
          user_id: user.id,
        });
        aplicados++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        movimentos_analisados: movimentos?.length || 0,
        sugestoes: matches.length,
        aplicados,
        ia_consultados,
        ia_sugeridos,
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
