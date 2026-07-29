// Edge Function: classificar-lancamento
// Usa IA para sugerir tipo, categoria e pessoa ao criar lançamento a partir de movimento bancário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function heuristicaFallback(valor: number, descricao: string) {
  const isCredito = valor >= 0;
  const desc = descricao.toLowerCase();
  const tipoPagamento = [
    "pix", "ted", "doc", "boleto", "debito", "deb", "pagamento", "pgto",
    "fornecedor", "nota fiscal", "nf", "fatura", "compra",
  ].some((k) => desc.includes(k));
  const tipoRecebimento = [
    "recebimento", "receb", "deposito", "dep", "venda", "cliente", "remessa",
  ].some((k) => desc.includes(k));

  if (isCredito || tipoRecebimento)
    return { tipo: "a_receber", natureza: "receita" };
  if (!isCredito || tipoPagamento)
    return { tipo: "a_pagar", natureza: "despesa" };
  return { tipo: isCredito ? "a_receber" : "a_pagar", natureza: isCredito ? "receita" : "despesa" };
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const { empresa_id, descricao, valor, data_movimento } = body;

    if (!empresa_id || !descricao) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: empresa_id, descricao" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca dados da empresa para contextualizar a IA
    const [{ data: categorias }, { data: pessoas }, { data: historico }] = await Promise.all([
      supabase
        .from("financeiro_categorias")
        .select("id, nome, tipo")
        .eq("empresa_id", empresa_id)
        .limit(50),
      supabase
        .from("financeiro_pessoas")
        .select("id, nome, tipo")
        .eq("empresa_id", empresa_id)
        .limit(30),
      supabase
        .from("financeiro_lancamentos")
        .select("descricao, natureza, tipo, categoria_id, financeiro_categorias(nome)")
        .eq("empresa_id", empresa_id)
        .ilike("descricao", `%${String(descricao).slice(0, 25).trim()}%`)
        .limit(5),
    ]);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      const { tipo, natureza } = heuristicaFallback(Number(valor), String(descricao));
      return new Response(JSON.stringify({
        tipo,
        natureza,
        descricao_sugerida: descricao,
        categoria_id: null,
        categoria_nome: null,
        pessoa_id: null,
        pessoa_nome: null,
        confianca: 40,
        justificativa: "Classificação heurística (IA não configurada).",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isCredito = Number(valor) >= 0;
    const valorFmt = `R$ ${Math.abs(Number(valor)).toFixed(2)} (${isCredito ? "crédito — entrada" : "débito — saída"})`;

    const historicoTxt = (historico ?? [])
      .slice(0, 5)
      .map((h: any) => `- "${h.descricao}" → ${h.tipo} / ${h.natureza}${h.financeiro_categorias?.nome ? ` / ${h.financeiro_categorias.nome}` : ""}`)
      .join("\n");

    const categoriasTxt = (categorias ?? [])
      .map((c: any) => `- "${c.nome}" [${c.tipo}]`)
      .join("\n") || "Nenhuma categoria cadastrada";

    const pessoasTxt = (pessoas ?? [])
      .map((p: any) => `- "${p.nome}" [${p.tipo}]`)
      .join("\n") || "Nenhuma pessoa cadastrada";

    const prompt = `Você é um contador brasileiro especialista em contabilidade e conciliação bancária. Analise o movimento bancário e classifique-o para criar um lançamento financeiro.

MOVIMENTO BANCÁRIO:
- Data: ${data_movimento ?? "—"}
- Valor: ${valorFmt}
- Descrição do banco: "${descricao}"

${historicoTxt ? `HISTÓRICO DE LANÇAMENTOS SIMILARES NA EMPRESA:\n${historicoTxt}\n` : ""}
CATEGORIAS DISPONÍVEIS:
${categoriasTxt}

PESSOAS (FORNECEDORES/CLIENTES) DISPONÍVEIS:
${pessoasTxt}

INSTRUÇÕES:
- "tipo": use "a_pagar" para despesas/saídas, "a_receber" para receitas/entradas, "movimentacao" para transferências internas
- "natureza": "despesa", "receita" ou "movimentacao"
- "descricao_sugerida": descrição limpa e profissional para o lançamento (sem códigos bancários)
- "categoria_nome": copie EXATAMENTE um nome da lista de categorias, ou null
- "pessoa_nome": copie EXATAMENTE um nome da lista de pessoas, ou null
- "confianca": 0-100 indicando certeza da classificação
- "justificativa": frase curta explicando a decisão

Responda APENAS em JSON estrito:
{"tipo":"...","natureza":"...","descricao_sugerida":"...","categoria_nome":null,"pessoa_nome":null,"confianca":0,"justificativa":"..."}`;

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
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!resp.ok) {
      const { tipo, natureza } = heuristicaFallback(Number(valor), String(descricao));
      return new Response(JSON.stringify({
        tipo,
        natureza,
        descricao_sugerida: descricao,
        categoria_id: null,
        categoria_nome: null,
        pessoa_id: null,
        pessoa_nome: null,
        confianca: 40,
        justificativa: "IA indisponível no momento (rate limit ou erro).",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da IA");

    const parsed = JSON.parse(content);

    const catEncontrada = (categorias ?? []).find((c: any) => c.nome === parsed.categoria_nome);
    const pessoaEncontrada = (pessoas ?? []).find((p: any) => p.nome === parsed.pessoa_nome);

    return new Response(JSON.stringify({
      tipo: parsed.tipo ?? (isCredito ? "a_receber" : "a_pagar"),
      natureza: parsed.natureza ?? (isCredito ? "receita" : "despesa"),
      descricao_sugerida: parsed.descricao_sugerida || descricao,
      categoria_id: catEncontrada?.id ?? null,
      categoria_nome: parsed.categoria_nome ?? null,
      pessoa_id: pessoaEncontrada?.id ?? null,
      pessoa_nome: parsed.pessoa_nome ?? null,
      confianca: Math.min(100, Math.max(0, Number(parsed.confianca ?? 60))),
      justificativa: String(parsed.justificativa ?? "").slice(0, 300),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("classificar-lancamento error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
