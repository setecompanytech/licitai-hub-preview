import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type VerificacaoReal = {
  fonte: string;
  status: "regular" | "irregular" | "erro" | "verificando";
  detalhes: string;
  dataConsulta: string;
  url?: string;
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// Helper: Firecrawl search
async function firecrawlSearch(query: string, limit = 3): Promise<any[]> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, lang: "pt-br", country: "BR" }),
    });
    if (!resp.ok) { await resp.text(); return []; }
    const data = await resp.json();
    return data?.data || [];
  } catch { return []; }
}

// Helper: AI analysis of search results
async function aiAnalyze(systemPrompt: string, userContent: string): Promise<{ status: string; detalhes: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || userContent.length < 80) return null;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.slice(0, 4000) },
        ],
      }),
    });
    if (!resp.ok) { await resp.text(); return null; }
    const aiData = await resp.json();
    const content = (aiData.choices?.[0]?.message?.content || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(content);
  } catch { return null; }
}

// Portal da Transparência (CEIS/CNEP/CEPIM)
async function consultarTransparencia(endpoint: string, cnpj: string, nomeFonte: string, descSingular: string): Promise<VerificacaoReal> {
  const url = `https://portaldatransparencia.gov.br/sancoes/${endpoint.toLowerCase()}`;
  try {
    const results = await firecrawlSearch(`"${cnpj}" ${endpoint} site:portaldatransparencia.gov.br`);
    if (results.length === 0) {
      return { fonte: nomeFonte, status: "regular", detalhes: `Nenhuma ${descSingular} encontrada em busca pública`, dataConsulta: new Date().toISOString(), url };
    }
    const found = results.some((r: any) => {
      const text = (r.description || r.markdown || r.title || "").toLowerCase();
      return text.includes(cnpj) && (text.includes("sanção") || text.includes("punição") || text.includes("impedid"));
    });
    return {
      fonte: nomeFonte,
      status: found ? "irregular" : "regular",
      detalhes: found ? `Possível ${descSingular} encontrada via busca pública` : `Nenhuma ${descSingular} encontrada em busca pública`,
      dataConsulta: new Date().toISOString(), url,
    };
  } catch (e) {
    console.error(`Erro ${nomeFonte}:`, e);
    return { fonte: nomeFonte, status: "erro", detalhes: `Falha: ${e.message}`, dataConsulta: new Date().toISOString() };
  }
}

async function consultarCEIS(cnpj: string): Promise<VerificacaoReal> { return consultarTransparencia("CEIS", cnpj, "CEIS", "sanção"); }
async function consultarCNEP(cnpj: string): Promise<VerificacaoReal> { return consultarTransparencia("CNEP", cnpj, "CNEP", "punição"); }
async function consultarCEPIM(cnpj: string): Promise<VerificacaoReal> { return consultarTransparencia("CEPIM", cnpj, "CEPIM", "impedimento"); }

// CNDT (TST) – busca por débitos trabalhistas em fontes públicas + IA
async function consultarCNDT(cnpj: string): Promise<VerificacaoReal> {
  const cnpjFmt = formatCnpj(cnpj);
  const urlPortal = "https://cndt-certidao.tst.jus.br/inicio.faces";
  try {
    const [r1, r2] = await Promise.all([
      firecrawlSearch(`"${cnpjFmt}" débitos trabalhistas OR "execução trabalhista" OR "certidão positiva"`, 3),
      firecrawlSearch(`"${cnpjFmt}" TST OR TRT "processo trabalhista"`, 3),
    ]);
    const combined = [...r1, ...r2].map((r: any) => `[${r.url}] ${(r.markdown || r.description || "").slice(0, 1500)}`).join("\n\n");

    const parsed = await aiAnalyze(
      "Analise os resultados e determine se há indícios de débitos trabalhistas ou execuções ativas contra o CNPJ. Responda APENAS com JSON: {\"status\": \"regular\"|\"irregular\"|\"inconclusivo\", \"detalhes\": \"explicação breve\"}",
      `CNPJ: ${cnpjFmt}\n\nResultados:\n${combined}`
    );

    if (parsed?.status === "irregular") {
      return { fonte: "CNDT/TST", status: "irregular", detalhes: parsed.detalhes || "Possíveis débitos trabalhistas identificados", dataConsulta: new Date().toISOString(), url: urlPortal };
    }
    return { fonte: "CNDT/TST", status: "regular", detalhes: parsed?.detalhes || "Nenhum débito trabalhista encontrado em fontes públicas. Para certidão oficial, acesse o portal do TST.", dataConsulta: new Date().toISOString(), url: urlPortal };
  } catch (e) {
    console.error("Erro CNDT:", e);
    return { fonte: "CNDT/TST", status: "erro", detalhes: `Falha na consulta: ${e.message}`, dataConsulta: new Date().toISOString(), url: urlPortal };
  }
}

// CRF/FGTS – busca por irregularidades FGTS em fontes públicas + IA
async function consultarCRF(cnpj: string): Promise<VerificacaoReal> {
  const cnpjFmt = formatCnpj(cnpj);
  const urlPortal = "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf";
  try {
    const [r1, r2] = await Promise.all([
      firecrawlSearch(`"${cnpjFmt}" FGTS regularidade OR CRF OR "débito FGTS"`, 3),
      firecrawlSearch(`"${cnpjFmt}" "Caixa Econômica" FGTS irregularidade`, 3),
    ]);
    const combined = [...r1, ...r2].map((r: any) => `[${r.url}] ${(r.markdown || r.description || "").slice(0, 1500)}`).join("\n\n");

    const parsed = await aiAnalyze(
      "Analise os resultados e determine se há indícios de irregularidade com FGTS para o CNPJ. Responda APENAS com JSON: {\"status\": \"regular\"|\"irregular\"|\"inconclusivo\", \"detalhes\": \"explicação breve\"}",
      `CNPJ: ${cnpjFmt}\n\nResultados:\n${combined}`
    );

    if (parsed?.status === "irregular") {
      return { fonte: "CRF/FGTS", status: "irregular", detalhes: parsed.detalhes || "Possível irregularidade FGTS identificada", dataConsulta: new Date().toISOString(), url: urlPortal };
    }
    return { fonte: "CRF/FGTS", status: "regular", detalhes: parsed?.detalhes || "Nenhuma irregularidade FGTS encontrada em fontes públicas. Para CRF oficial, acesse o portal da Caixa.", dataConsulta: new Date().toISOString(), url: urlPortal };
  } catch (e) {
    console.error("Erro CRF:", e);
    return { fonte: "CRF/FGTS", status: "erro", detalhes: `Falha na consulta: ${e.message}`, dataConsulta: new Date().toISOString(), url: urlPortal };
  }
}

// CND Conjunta (Tributos Federais e Dívida Ativa da União) – via BrasilAPI
async function consultarCNDConjunta(cnpj: string): Promise<VerificacaoReal> {
  const certNome = "CND Conjunta";
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!resp.ok) {
      return { fonte: certNome, status: "erro", detalhes: "Não foi possível consultar dados cadastrais", dataConsulta: new Date().toISOString(), url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home" };
    }
    const data = await resp.json();
    if (data.situacao_cadastral === 2) {
      return { fonte: certNome, status: "regular", detalhes: `Situação cadastral: ATIVA. Razão Social: ${data.razao_social}. CNAE: ${data.cnae_fiscal_descricao}`, dataConsulta: new Date().toISOString(), url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home" };
    }
    const situacoes: Record<number, string> = { 1: "NULA", 3: "SUSPENSA", 4: "INAPTA", 8: "BAIXADA" };
    return { fonte: certNome, status: "irregular", detalhes: `Situação cadastral: ${situacoes[data.situacao_cadastral] || data.descricao_situacao_cadastral || "IRREGULAR"}. ${data.motivo_situacao_cadastral || ""}`, dataConsulta: new Date().toISOString(), url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home" };
  } catch (e) {
    console.error("Erro CND Conjunta:", e);
    return { fonte: certNome, status: "erro", detalhes: `Erro: ${e.message}`, dataConsulta: new Date().toISOString() };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj, razaoSocial } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: "CNPJ é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // 1. Verificações reais em paralelo
    console.log(`Iniciando verificações reais para CNPJ: ${cnpjLimpo}`);
    const [ceis, cnep, cepim, cndt, crf, cndConjunta] = await Promise.all([
      consultarCEIS(cnpjLimpo), consultarCNEP(cnpjLimpo), consultarCEPIM(cnpjLimpo),
      consultarCNDT(cnpjLimpo), consultarCRF(cnpjLimpo), consultarCNDConjunta(cnpjLimpo),
    ]);

    const verificacoesReais: VerificacaoReal[] = [ceis, cnep, cepim, cndt, crf, cndConjunta];
    console.log("Verificações reais concluídas:", verificacoesReais.map(v => `${v.fonte}: ${v.status}`));

    // 2. Análise complementar com IA
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const verificacoesTexto = verificacoesReais.map(v => `${v.fonte}: ${v.status} - ${v.detalhes}`).join("\n");

    const prompt = `Você é um especialista em licitações públicas brasileiras (Lei 14.133/2021).
Para a empresa com CNPJ ${cnpj}${razaoSocial ? ` (${razaoSocial})` : ''}, já realizamos verificações automáticas com os seguintes resultados:

${verificacoesTexto}

Com base nesses resultados REAIS, gere uma análise complementar das certidões negativas necessárias para participação em licitações.

Para cada certidão que NÃO foi verificada automaticamente (Certidão Estadual, Certidão Municipal, Certidão de Falência), informe:
1. Nome da certidão
2. Órgão emissor
3. URL oficial para emissão
4. Validade padrão (em dias)
5. Status como "verificar" (já que não foi verificada automaticamente)
6. Observações e documentos necessários

NÃO repita as certidões já verificadas automaticamente (CEIS, CNEP, CEPIM, CNDT, CRF, CND Conjunta).

Responda APENAS com JSON válido:
{
  "certidoes_complementares": [
    {
      "nome": "string",
      "orgao": "string",
      "url": "string",
      "validadeDias": number,
      "documentosNecessarios": ["string"],
      "statusProvavel": "verificar",
      "observacoes": "string"
    }
  ],
  "resumo": "string - análise geral considerando os resultados reais",
  "recomendacoes": ["string"],
  "alertas": ["string - alertas baseados nos resultados reais"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um assistente jurídico especializado em licitações brasileiras. Responda apenas com JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({
          verificacoesReais,
          certidoes: [],
          resumo: "Limite de requisições excedido para análise IA. Resultados parciais (verificações reais) disponíveis.",
          recomendacoes: [],
          alertas: verificacoesReais.filter(v => v.status === "irregular").map(v => `⚠️ ${v.fonte}: ${v.detalhes}`),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(content);

    // 3. Combinar resultados
    const certidoesReais = verificacoesReais.map(v => ({
      nome: v.fonte === "CEIS" ? "Certidão CEIS (Empresas Inidôneas)" :
            v.fonte === "CNEP" ? "Certidão CNEP (Empresas Punidas)" :
            v.fonte === "CEPIM" ? "Certidão CEPIM (Entidades Impedidas)" :
            v.fonte === "CNDT/TST" ? "CNDT – Certidão Negativa de Débitos Trabalhistas" :
            v.fonte === "CRF/FGTS" ? "CRF – Certificado de Regularidade do FGTS" :
            "CND Conjunta de Débitos Relativos a Tributos Federais e à Dívida Ativa da União",
      orgao: v.fonte === "CEIS" || v.fonte === "CNEP" || v.fonte === "CEPIM" ? "Portal da Transparência" :
             v.fonte === "CNDT/TST" ? "Tribunal Superior do Trabalho" :
             v.fonte === "CRF/FGTS" ? "Caixa Econômica Federal" :
             "Receita Federal do Brasil / PGFN",
      url: v.url || "#",
      validadeDias: v.fonte === "CNDT/TST" ? 180 : v.fonte === "CRF/FGTS" ? 30 : 0,
      documentosNecessarios: ["CNPJ"],
      statusProvavel: v.status === "regular" ? "regular" : v.status === "irregular" ? "pendente" : "verificar",
      observacoes: v.detalhes,
      verificacaoReal: true,
      dataVerificacao: v.dataConsulta,
      fonteVerificacao: v.fonte,
    }));

    const certidoesComplementares = (parsed.certidoes_complementares || []).map((c: any) => ({
      ...c,
      verificacaoReal: false,
    }));

    return new Response(JSON.stringify({
      verificacoesReais,
      certidoes: [...certidoesReais, ...certidoesComplementares],
      resumo: parsed.resumo || "Análise concluída com verificações reais e complemento IA.",
      recomendacoes: parsed.recomendacoes || [],
      alertas: [
        ...verificacoesReais.filter(v => v.status === "irregular").map(v => `⚠️ ${v.fonte}: ${v.detalhes}`),
        ...(parsed.alertas || []),
      ],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro certidões:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao consultar certidões" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
