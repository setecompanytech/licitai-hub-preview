import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orgao, uf, municipio } = await req.json();
    if (!orgao) {
      return new Response(JSON.stringify({ error: "Órgão é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Você é um analista fiscal e financeiro especialista em finanças públicas brasileiras, com profundo conhecimento sobre o CAPAG (Capacidade de Pagamento) calculado pelo Tesouro Nacional.

Analise o ente federativo vinculado ao órgão "${orgao}"${uf ? ` (UF: ${uf})` : ''}${municipio ? ` (Município: ${municipio})` : ''}.

Forneça uma análise COMPLETA e DETALHADA contemplando:

1. **CAPAG (Capacidade de Pagamento)**: Nota estimada (A, B, C ou D) com base nos três indicadores oficiais:
   - Endividamento (DC/RCL)
   - Poupança Corrente (despesas correntes / receita corrente ajustada)
   - Liquidez (obrigações financeiras / disponibilidade de caixa)

2. **Indicadores Fiscais Complementares** para o fornecedor avaliar:
   - Situação de tributos federais e contribuições previdenciárias (CND federal)
   - Pagamento de precatórios judiciais
   - Regularidade com o FGTS
   - Adimplência em empréstimos/financiamentos com a União
   - Situação no CADIN
   - Histórico de pagamentos a fornecedores (Portal da Transparência)
   - Ações judiciais contra o órgão (cobranças judiciais)
   - Situação no CAUC (Serviço Auxiliar de Informações para Transferências Voluntárias)

3. **Avaliação de Risco para o Fornecedor**: classificação geral do risco de inadimplência ou atraso.

4. **Recomendações Estratégicas**: orientações práticas para o licitante.

Responda APENAS com JSON válido no formato:
{
  "capag": {
    "nota": "A" | "B" | "C" | "D",
    "confianca": "alta" | "media" | "baixa",
    "endividamento": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "poupanca_corrente": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "liquidez": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "observacao": "string com contexto sobre a nota"
  },
  "indicadores_fiscais": [
    {
      "indicador": "string (nome do indicador)",
      "status": "regular" | "atencao" | "critico" | "indisponivel",
      "descricao": "string detalhada",
      "fonte": "string (onde consultar)"
    }
  ],
  "risco_geral": {
    "nivel": "baixo" | "moderado" | "elevado" | "critico",
    "score": number (0-100, onde 100 = máximo risco),
    "justificativa": "string"
  },
  "recomendacoes": ["string"],
  "fontes_consulta": ["string com links ou nomes de portais oficiais"],
  "resumo_executivo": "string com 2-3 frases resumindo a análise"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista fiscal especializado em finanças públicas brasileiras e CAPAG do Tesouro Nacional. Responda apenas com JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro CAPAG:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao analisar CAPAG" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
