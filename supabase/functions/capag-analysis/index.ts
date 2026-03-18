import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EstadoCapag = {
  uf: string;
  indicador1: string;
  nota1: string;
  indicador2: string;
  nota2: string;
  indicador3: string;
  nota3: string;
  classificacao: string;
  qualidade: string;
  observacao: string;
};

async function fetchEstadosCapag(): Promise<EstadoCapag[]> {
  try {
    // First get latest resource URL from CKAN API
    const pkgRes = await fetch(
      "https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=capag-estados",
      { signal: AbortSignal.timeout(8000) }
    );
    const pkgData = await pkgRes.json();
    const resources = pkgData?.result?.resources || [];
    
    // Get the latest CSV resource (last position, excluding metadata PDFs)
    const csvResources = resources
      .filter((r: any) => r.format === "CSV" && !r.name.includes("Metadados"))
      .sort((a: any, b: any) => b.position - a.position);
    
    const latestUrl = csvResources[0]?.url;
    if (!latestUrl) throw new Error("No CSV resource found");

    console.log("Fetching CAPAG estados from:", latestUrl);
    const csvRes = await fetch(latestUrl, { signal: AbortSignal.timeout(10000) });
    const csvText = await csvRes.text();

    const lines = csvText.trim().split("\n");
    const results: EstadoCapag[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < 8) continue;
      results.push({
        uf: cols[0].trim(),
        indicador1: cols[1].trim(),
        nota1: cols[2].trim(),
        indicador2: cols[3].trim(),
        nota2: cols[4].trim(),
        indicador3: cols[5].trim(),
        nota3: cols[6].trim(),
        classificacao: cols[7].trim(),
        qualidade: cols[8]?.trim() || "",
        observacao: cols[9]?.trim() || "",
      });
    }

    return results;
  } catch (e) {
    console.error("Error fetching estados CAPAG:", e);
    return [];
  }
}

function mapClassificacaoToNota(classificacao: string): "A" | "B" | "C" | "D" {
  if (classificacao.startsWith("A")) return "A";
  if (classificacao.startsWith("B")) return "B";
  if (classificacao === "D") return "D";
  return "C";
}

function parsePercentual(val: string): number {
  return parseFloat(val.replace(",", ".").replace("%", "")) || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await requireAuth(req, { functionName: "capag-analysis", maxRequests: 10, windowMinutes: 5 });
    } catch (authResp) {
      if (authResp instanceof Response) return authResp;
      throw authResp;
    }
    const { orgao, uf, municipio } = await req.json();
    if (!orgao) {
      return new Response(JSON.stringify({ error: "Órgão é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Step 1: Fetch real CAPAG data from Tesouro Nacional
    const estadosCapag = await fetchEstadosCapag();
    const ufNormalizada = (uf || "").toUpperCase().trim();
    const estadoData = estadosCapag.find(e => e.uf === ufNormalizada);

    let dadosReais = "";
    let capagReal: any = null;

    if (estadoData) {
      capagReal = {
        uf: estadoData.uf,
        classificacao: estadoData.classificacao,
        nota_geral: mapClassificacaoToNota(estadoData.classificacao),
        endividamento: { percentual: parsePercentual(estadoData.indicador1), nota: estadoData.nota1 },
        poupanca_corrente: { percentual: parsePercentual(estadoData.indicador2), nota: estadoData.nota2 },
        liquidez: { percentual: parsePercentual(estadoData.indicador3), nota: estadoData.nota3 },
        qualidade_info: estadoData.qualidade,
      };

      dadosReais = `
DADOS REAIS DO TESOURO NACIONAL (Fonte oficial: tesourotransparente.gov.br):
- Estado: ${estadoData.uf}
- CAPAG Oficial: ${estadoData.classificacao}
- Indicador 1 (Endividamento DC/RCL): ${estadoData.indicador1} - Nota ${estadoData.nota1}
- Indicador 2 (Poupança Corrente): ${estadoData.indicador2} - Nota ${estadoData.nota2}  
- Indicador 3 (Liquidez): ${estadoData.indicador3} - Nota ${estadoData.nota3}
- Qualidade da Informação: ${estadoData.qualidade}
${estadoData.observacao ? `- Observação: ${estadoData.observacao}` : ""}

USE OBRIGATORIAMENTE estes dados reais para o estado. Se o órgão é municipal, use os dados do estado como referência e estime a situação do município com base no contexto.`;
    }

    // Step 2: Use AI for contextual analysis enriched with real data
    const prompt = `Você é um analista fiscal especialista em CAPAG do Tesouro Nacional.

Analise o ente federativo vinculado ao órgão "${orgao}"${uf ? ` (UF: ${uf})` : ''}${municipio ? ` (Município: ${municipio})` : ''}.

${dadosReais}

REGRAS:
- Se o órgão é subordinado a um município ou estado, analise o ente federativo correspondente.
- SEMPRE forneça valores numéricos para os três indicadores CAPAG.
- ${estadoData ? "USE os dados reais do Tesouro Nacional fornecidos acima. Para municípios, adapte os indicadores considerando que o município pode ter situação diferente do estado." : "Forneça a MELHOR ESTIMATIVA possível baseada em dados históricos."}
- A classificação dos indicadores DEVE ser "A", "B" ou "C".
- Indique na descrição quando os dados são oficiais (Tesouro Nacional) vs estimativas.

Responda APENAS com JSON válido:
{
  "capag": {
    "nota": "A"|"B"|"C"|"D",
    "confianca": "alta"|"media"|"baixa",
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
  "resumo_executivo": "string",
  "dados_oficiais": ${estadoData ? "true" : "false"}
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
          { role: "system", content: "Você é um analista fiscal especializado em CAPAG do Tesouro Nacional. SEMPRE forneça dados numéricos. Responda apenas com JSON válido, sem markdown." },
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

    // Enrich response with real data source info
    parsed.fonte_dados = estadoData
      ? { tipo: "oficial", portal: "Tesouro Transparente", url: "https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag", uf_dados: capagReal }
      : { tipo: "estimativa_ia", portal: null };

    // Override with real data for state-level queries
    if (estadoData && !municipio) {
      parsed.capag.nota = capagReal.nota_geral;
      parsed.capag.endividamento.classificacao = capagReal.endividamento.nota;
      parsed.capag.endividamento.percentual_estimado = capagReal.endividamento.percentual;
      parsed.capag.poupanca_corrente.classificacao = capagReal.poupanca_corrente.nota;
      parsed.capag.poupanca_corrente.percentual_estimado = capagReal.poupanca_corrente.percentual;
      parsed.capag.liquidez.classificacao = capagReal.liquidez.nota;
      parsed.capag.liquidez.percentual_estimado = capagReal.liquidez.percentual;
      parsed.capag.confianca = "alta";
    }

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
