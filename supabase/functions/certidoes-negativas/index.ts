import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj, razaoSocial } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: "CNPJ é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Você é um especialista em licitações públicas brasileiras (Lei 14.133/2021).
Para a empresa com CNPJ ${cnpj}${razaoSocial ? ` (${razaoSocial})` : ''}, gere uma análise completa de certidões negativas necessárias para participação em licitações.

Para cada certidão, informe:
1. Nome da certidão
2. Órgão emissor
3. URL oficial para emissão
4. Validade padrão (em dias)
5. Documentos necessários para emissão
6. Status provável (baseado no tipo de empresa)
7. Observações importantes

As certidões obrigatórias são:
- CND Federal (Receita Federal + PGFN)
- CRF FGTS (Caixa Econômica)
- CNDT Trabalhista (TST)
- Certidão Negativa Estadual (SEFAZ)
- Certidão Negativa Municipal (Prefeitura)
- Certidão de Falência e Concordata (TJ)
- SICAF (Portal de Fornecedores do Governo Federal)
- Certidão do CEIS (Cadastro de Empresas Inidôneas)
- Certidão do CNEP (Cadastro Nacional de Empresas Punidas)

Responda APENAS com JSON válido no formato:
{
  "certidoes": [
    {
      "nome": "string",
      "orgao": "string",
      "url": "string",
      "validadeDias": number,
      "documentosNecessarios": ["string"],
      "statusProvavel": "regular" | "pendente" | "verificar",
      "observacoes": "string"
    }
  ],
  "resumo": "string com análise geral",
  "recomendacoes": ["string"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um assistente jurídico especializado em licitações brasileiras. Responda apenas com JSON válido." },
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro certidões:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao consultar certidões" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
