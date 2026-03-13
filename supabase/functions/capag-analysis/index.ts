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

REGRAS IMPORTANTES:
- Se o órgão é subordinado a um município ou estado, analise o ente federativo correspondente (ex: "SEMED Belém" → analise "Município de Belém/PA").
- SEMPRE forneça estimativas numéricas para os três indicadores CAPAG, mesmo que aproximadas. Use dados públicos disponíveis do Tesouro Nacional, FINBRA, SICONFI, STN.
- A classificação dos indicadores DEVE ser sempre "A", "B" ou "C" (nunca "indisponível").
- O percentual_estimado DEVE ser sempre um número (nunca null ou 0 sem justificativa).
- Quando o dado exato não estiver disponível, forneça a MELHOR ESTIMATIVA possível baseada em dados históricos, porte do município, região e contexto fiscal conhecido. Indique na descrição que é uma estimativa.

Forneça uma análise COMPLETA contemplando:

1. **CAPAG**: Nota estimada (A, B, C ou D) com os três indicadores oficiais:
   - Endividamento (DC/RCL) - classificação A/B/C com percentual estimado
   - Poupança Corrente - classificação A/B/C com percentual estimado
   - Liquidez - classificação A/B/C com percentual estimado

2. **Indicadores Fiscais Complementares**: CND federal, precatórios, FGTS, empréstimos União, CADIN, transparência, ações judiciais, CAUC.
   - O status deve ser "regular", "atencao" ou "critico". Use "indisponivel" APENAS se realmente impossível estimar.

3. **Avaliação de Risco**: classificação geral com score numérico.

4. **Recomendações Estratégicas**: orientações práticas.

Responda APENAS com JSON válido:
{
  "capag": {
    "nota": "A" | "B" | "C" | "D",
    "confianca": "alta" | "media" | "baixa",
    "endividamento": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "poupanca_corrente": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "liquidez": { "classificacao": "A"|"B"|"C", "percentual_estimado": number, "descricao": "string" },
    "observacao": "string"
  },
  "indicadores_fiscais": [
    { "indicador": "string", "status": "regular"|"atencao"|"critico"|"indisponivel", "descricao": "string", "fonte": "string" }
  ],
  "risco_geral": { "nivel": "baixo"|"moderado"|"elevado"|"critico", "score": number, "justificativa": "string" },
  "recomendacoes": ["string"],
  "fontes_consulta": ["string"],
  "resumo_executivo": "string"
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
