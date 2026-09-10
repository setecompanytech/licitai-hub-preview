// @ts-nocheck
// Análise CAPAG com TRÊS camadas de dado oficial (Opção 2 do Conecta, 10/09):
//   1) Estados: CSV pequeno do Tesouro Transparente, baixado na hora (como antes);
//   2) Municípios: tabela capag_municipios — a planilha oficial de 24MB do
//      Tesouro (aba "Prévia da CAPAG") semeada no banco, porque baixar e
//      parsear XLSX na edge a cada chamada é inviável;
//   3) SICONFI ao vivo (apidatalake.tesouro.gov.br): RCL dos últimos 12 meses
//      e população do ente, do RREO Anexo 03 mais recente publicado.
// A IA continua fazendo a leitura contextual, mas os NÚMEROS oficiais
// sobrescrevem a estimativa sempre que existem.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

/** Comparação de nome de município insensível a caixa e acento. */
function normalizarNome(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Código IBGE dos estados — id_ente do SICONFI para consultas estaduais. */
const UF_COD_IBGE: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
  MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43,
  MS: 50, MT: 51, GO: 52, DF: 53,
};

/** CAPAG municipal oficial, da tabela semeada com a planilha do Tesouro. */
async function fetchMunicipioCapag(supabase: any, municipio: string, uf: string) {
  const { data } = await supabase
    .from("capag_municipios")
    .select("*")
    .eq("uf", uf.toUpperCase().trim());
  if (!data?.length) return null;
  const alvo = normalizarNome(municipio);
  return data.find((m: any) => normalizarNome(m.municipio) === alvo) ?? null;
}

/** RCL (últimos 12 meses) e população do ente, do RREO Anexo 03 mais recente
 *  no SICONFI. Anda para trás a partir do bimestre corrente; melhor esforço —
 *  ente que não declarou devolve null sem derrubar a análise. */
async function fetchRclSiconfi(idEnte: number) {
  const agora = new Date();
  const tentativas: { ano: number; periodo: number }[] = [];
  let ano = agora.getUTCFullYear();
  let per = Math.max(1, Math.min(6, Math.ceil((agora.getUTCMonth() + 1) / 2) - 1));
  for (let i = 0; i < 5; i++) {
    tentativas.push({ ano, periodo: per });
    per--;
    if (per < 1) { ano--; per = 6; }
  }
  for (const t of tentativas) {
    try {
      const url = `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=${t.ano}&nr_periodo=${t.periodo}&co_tipo_demonstrativo=RREO&no_anexo=${encodeURIComponent("RREO-Anexo 03")}&id_ente=${idEnte}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data?.items ?? [];
      if (!items.length) continue;
      const rcl = items.find((i: any) =>
        String(i.conta || "").toUpperCase().startsWith("RECEITA CORRENTE LÍQUIDA (III)") &&
        String(i.coluna || "").toUpperCase().includes("12 MESES"));
      if (!rcl) continue;
      return {
        rcl_12m: Number(rcl.valor) || null,
        populacao: Number(items[0]?.populacao) || null,
        periodo: `${t.periodo}º bimestre/${t.ano}`,
        instituicao: String(items[0]?.instituicao || ""),
      };
    } catch (_) { /* tenta o período anterior */ }
  }
  return null;
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Step 1: Fetch real CAPAG data from Tesouro Nacional
    const estadosCapag = await fetchEstadosCapag();
    const ufNormalizada = (uf || "").toUpperCase().trim();
    const estadoData = estadosCapag.find(e => e.uf === ufNormalizada);

    // Step 1b: CAPAG municipal oficial (tabela semeada da planilha do Tesouro)
    let municipioData: any = null;
    let capagMunReal: any = null;
    if (municipio && ufNormalizada) {
      municipioData = await fetchMunicipioCapag(supabase, municipio, ufNormalizada);
      const semNota = !municipioData?.capag || ["n.d.", "n.e."].includes(municipioData.capag);
      if (municipioData && !semNota) {
        // Indicadores gravados como fração 0–1 (razão derivada) → % para exibição.
        const pct = (v: number | null) => (typeof v === "number" ? Math.round(v * 1000) / 10 : null);
        capagMunReal = {
          cod_ibge: municipioData.cod_ibge,
          municipio: municipioData.municipio,
          uf: municipioData.uf,
          classificacao: municipioData.capag,
          nota_geral: mapClassificacaoToNota(municipioData.capag),
          endividamento: { percentual: pct(municipioData.indicador1), nota: municipioData.nota1 },
          poupanca_corrente: { percentual: pct(municipioData.indicador2), nota: municipioData.nota2 },
          liquidez: { percentual: pct(municipioData.indicador3), nota: municipioData.nota3 },
          icf: municipioData.icf,
          posicao: municipioData.posicao,
          origem_nota: municipioData.origem_nota,
        };
      }
    }

    // Step 1c: SICONFI ao vivo — RCL 12 meses e população do ente.
    const idEnte = municipioData?.cod_ibge ?? (ufNormalizada ? UF_COD_IBGE[ufNormalizada] : undefined);
    const siconfi = idEnte ? await fetchRclSiconfi(idEnte) : null;

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

    if (capagMunReal) {
      const posBr = String(capagMunReal.posicao || "").split("-").reverse().join("/");
      dadosReais += `

DADOS REAIS DO MUNICÍPIO (CAPAG oficial do Tesouro Nacional, posição ${posBr}):
- Município: ${capagMunReal.municipio}/${capagMunReal.uf} (IBGE ${capagMunReal.cod_ibge})
- CAPAG Oficial do MUNICÍPIO: ${capagMunReal.classificacao} (${capagMunReal.origem_nota})
- Indicador 1 (Endividamento DC/RCL): ${capagMunReal.endividamento.percentual}% - Nota ${capagMunReal.endividamento.nota}
- Indicador 2 (Poupança Corrente): ${capagMunReal.poupanca_corrente.percentual}% - Nota ${capagMunReal.poupanca_corrente.nota}
- Indicador 3 (Liquidez): ${capagMunReal.liquidez.percentual}% - Nota ${capagMunReal.liquidez.nota}
- ICF (qualidade da informação): ${capagMunReal.icf || "n.d."}
${municipioData?.observacao ? `- Observação: ${municipioData.observacao}` : ""}

O órgão é MUNICIPAL e há dado oficial do próprio município: USE OBRIGATORIAMENTE estes dados, que prevalecem sobre os do estado.`;
    } else if (municipioData) {
      dadosReais += `

O Tesouro Nacional registra o município ${municipioData.municipio}/${municipioData.uf} SEM nota CAPAG apurada (${municipioData.capag || "sem dado"}) — informe isso e trate a análise como estimativa.`;
    }

    if (siconfi?.rcl_12m) {
      dadosReais += `

DADOS AO VIVO DO SICONFI (RREO Anexo 03, ${siconfi.periodo}):
- Receita Corrente Líquida (últimos 12 meses): R$ ${siconfi.rcl_12m.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
${siconfi.populacao ? `- População do ente: ${siconfi.populacao.toLocaleString("pt-BR")}` : ""}

Use a RCL real para dimensionar a capacidade de pagamento e o porte do ente.`;
    }

    // Step 2: Use AI for contextual analysis enriched with real data
    const prompt = `Você é um analista fiscal especialista em CAPAG do Tesouro Nacional.

Analise o ente federativo vinculado ao órgão "${orgao}"${uf ? ` (UF: ${uf})` : ''}${municipio ? ` (Município: ${municipio})` : ''}.

${dadosReais}

REGRAS:
- Se o órgão é subordinado a um município ou estado, analise o ente federativo correspondente.
- SEMPRE forneça valores numéricos para os três indicadores CAPAG.
- ${capagMunReal ? "USE os dados oficiais do MUNICÍPIO fornecidos acima — não estime o que já é oficial." : estadoData ? "USE os dados reais do Tesouro Nacional fornecidos acima. Para municípios, adapte os indicadores considerando que o município pode ter situação diferente do estado." : "Forneça a MELHOR ESTIMATIVA possível baseada em dados históricos."}
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
  "dados_oficiais": ${capagMunReal || estadoData ? "true" : "false"}
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
    const detalhes: string[] = [];
    if (capagMunReal) detalhes.push(`CAPAG oficial do município (posição ${String(capagMunReal.posicao || "").split("-").reverse().join("/")})`);
    else if (estadoData) detalhes.push("CAPAG oficial do estado");
    if (siconfi?.rcl_12m) detalhes.push(`RCL SICONFI ${siconfi.periodo}`);

    parsed.fonte_dados = capagMunReal || estadoData
      ? {
          tipo: "oficial",
          portal: siconfi ? "Tesouro Transparente + SICONFI" : "Tesouro Transparente",
          url: "https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag",
          uf_dados: capagReal,
          municipio_dados: capagMunReal,
          siconfi,
          detalhe: detalhes.join(" · "),
        }
      : { tipo: "estimativa_ia", portal: null, siconfi, detalhe: detalhes.join(" · ") || undefined };

    // Override with real data: o dado do MUNICÍPIO prevalece; o do estado
    // só sobrescreve quando a consulta é estadual.
    const oficial = capagMunReal ?? (estadoData && !municipio ? capagReal : null);
    if (oficial) {
      parsed.capag.nota = oficial.nota_geral;
      parsed.capag.endividamento.classificacao = oficial.endividamento.nota;
      parsed.capag.endividamento.percentual_estimado = oficial.endividamento.percentual;
      parsed.capag.poupanca_corrente.classificacao = oficial.poupanca_corrente.nota;
      parsed.capag.poupanca_corrente.percentual_estimado = oficial.poupanca_corrente.percentual;
      parsed.capag.liquidez.classificacao = oficial.liquidez.nota;
      parsed.capag.liquidez.percentual_estimado = oficial.liquidez.percentual;
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
