import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Portal da Transparência - APIs públicas abertas
const TRANSPARENCIA_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

type VerificacaoReal = {
  fonte: string;
  status: "regular" | "irregular" | "erro" | "verificando";
  detalhes: string;
  dataConsulta: string;
  url?: string;
};

// Helper para consultar Portal da Transparência (CEIS/CNEP/CEPIM)
async function consultarTransparencia(endpoint: string, cnpj: string, nomeFonte: string, descSingular: string): Promise<VerificacaoReal> {
  const url = `https://portaldatransparencia.gov.br/sancoes/${endpoint.toLowerCase()}`;
  try {
    // A API pública do Portal da Transparência requer scraping via Firecrawl
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return { fonte: nomeFonte, status: "verificar", detalhes: "Consulte diretamente no Portal da Transparência", dataConsulta: new Date().toISOString(), url };
    }

    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `"${cnpj}" ${endpoint} site:portaldatransparencia.gov.br`,
        limit: 3,
        lang: "pt-br",
        country: "BR",
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.log(`${nomeFonte} search response:`, resp.status, body);
      return { fonte: nomeFonte, status: "verificar", detalhes: "Consulte diretamente no Portal da Transparência", dataConsulta: new Date().toISOString(), url };
    }

    const data = await resp.json();
    const results = data?.data || [];
    const found = results.some((r: any) => {
      const text = (r.description || r.markdown || r.title || "").toLowerCase();
      return text.includes(cnpj) && (text.includes("sanção") || text.includes("punição") || text.includes("impedid"));
    });

    if (found) {
      return { fonte: nomeFonte, status: "irregular", detalhes: `Possível ${descSingular} encontrada via busca pública`, dataConsulta: new Date().toISOString(), url };
    }
    return { fonte: nomeFonte, status: "regular", detalhes: `Nenhuma ${descSingular} encontrada em busca pública`, dataConsulta: new Date().toISOString(), url };
  } catch (e) {
    console.error(`Erro ${nomeFonte}:`, e);
    return { fonte: nomeFonte, status: "erro", detalhes: `Falha: ${e.message}`, dataConsulta: new Date().toISOString() };
  }
}

// Consulta CEIS
async function consultarCEIS(cnpj: string): Promise<VerificacaoReal> {
  return consultarTransparencia("CEIS", cnpj, "CEIS", "sanção");
}

// Consulta CNEP
async function consultarCNEP(cnpj: string): Promise<VerificacaoReal> {
  return consultarTransparencia("CNEP", cnpj, "CNEP", "punição");
}

// Consulta CEPIM
async function consultarCEPIM(cnpj: string): Promise<VerificacaoReal> {
  return consultarTransparencia("CEPIM", cnpj, "CEPIM", "impedimento");
}

// Scraping de CNDT (TST) via Firecrawl
async function consultarCNDT(cnpj: string): Promise<VerificacaoReal> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return { fonte: "CNDT/TST", status: "erro", detalhes: "Firecrawl não configurado para scraping", dataConsulta: new Date().toISOString(), url: "https://cndt-certidao.tst.jus.br/inicio.faces" };
  }

  try {
    // Tenta buscar informações sobre CNDT via search
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `CNDT certidão negativa débitos trabalhistas CNPJ ${cnpj} site:tst.jus.br OR site:jusbrasil.com.br`,
        limit: 3,
        lang: "pt-br",
        country: "BR",
        tbs: "qdr:m",
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.log("Firecrawl CNDT search:", resp.status, body);
      return { fonte: "CNDT/TST", status: "verificar", detalhes: "Consulte diretamente no portal do TST", dataConsulta: new Date().toISOString(), url: "https://cndt-certidao.tst.jus.br/inicio.faces" };
    }

    const data = await resp.json();
    const results = data?.data || [];

    if (results.length > 0) {
      const hasDebito = results.some((r: any) =>
        (r.description || r.markdown || "").toLowerCase().includes("positiva") ||
        (r.description || r.markdown || "").toLowerCase().includes("débito")
      );

      if (hasDebito) {
        return { fonte: "CNDT/TST", status: "verificar", detalhes: "Possíveis débitos trabalhistas detectados na busca. Verifique diretamente no TST.", dataConsulta: new Date().toISOString(), url: "https://cndt-certidao.tst.jus.br/inicio.faces" };
      }
    }

    return { fonte: "CNDT/TST", status: "verificar", detalhes: "Emissão requer consulta direta (CAPTCHA). Use o link para verificar.", dataConsulta: new Date().toISOString(), url: "https://cndt-certidao.tst.jus.br/inicio.faces" };
  } catch (e) {
    console.error("Erro CNDT Firecrawl:", e);
    return { fonte: "CNDT/TST", status: "verificar", detalhes: "Consulte diretamente no portal do TST", dataConsulta: new Date().toISOString(), url: "https://cndt-certidao.tst.jus.br/inicio.faces" };
  }
}

// Scraping CRF/FGTS via Firecrawl
async function consultarCRF(cnpj: string): Promise<VerificacaoReal> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return { fonte: "CRF/FGTS", status: "erro", detalhes: "Firecrawl não configurado para scraping", dataConsulta: new Date().toISOString(), url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" };
  }

  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `CRF FGTS regularidade CNPJ ${cnpj} site:caixa.gov.br`,
        limit: 3,
        lang: "pt-br",
        country: "BR",
        tbs: "qdr:m",
      }),
    });

    if (!resp.ok) {
      return { fonte: "CRF/FGTS", status: "verificar", detalhes: "Consulte diretamente no portal da Caixa", dataConsulta: new Date().toISOString(), url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" };
    }

    return { fonte: "CRF/FGTS", status: "verificar", detalhes: "Emissão requer consulta direta (CAPTCHA). Use o link para verificar.", dataConsulta: new Date().toISOString(), url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" };
  } catch (e) {
    console.error("Erro CRF:", e);
    return { fonte: "CRF/FGTS", status: "verificar", detalhes: "Consulte diretamente no portal da Caixa", dataConsulta: new Date().toISOString(), url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" };
  }
}

// Consulta Receita Federal (dados cadastrais via BrasilAPI)
async function consultarReceitaFederal(cnpj: string): Promise<VerificacaoReal> {
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!resp.ok) {
      return { fonte: "Receita Federal", status: "verificar", detalhes: "Não foi possível consultar dados cadastrais", dataConsulta: new Date().toISOString(), url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" };
    }
    const data = await resp.json();

    if (data.situacao_cadastral === 2) {
      return {
        fonte: "Receita Federal",
        status: "regular",
        detalhes: `Situação cadastral: ATIVA. Razão Social: ${data.razao_social}. CNAE: ${data.cnae_fiscal_descricao}`,
        dataConsulta: new Date().toISOString(),
        url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
      };
    }

    const situacoes: Record<number, string> = { 1: "NULA", 3: "SUSPENSA", 4: "INAPTA", 8: "BAIXADA" };
    return {
      fonte: "Receita Federal",
      status: "irregular",
      detalhes: `Situação cadastral: ${situacoes[data.situacao_cadastral] || data.descricao_situacao_cadastral || "IRREGULAR"}. ${data.motivo_situacao_cadastral || ""}`,
      dataConsulta: new Date().toISOString(),
      url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
    };
  } catch (e) {
    console.error("Erro Receita:", e);
    return { fonte: "Receita Federal", status: "erro", detalhes: `Erro: ${e.message}`, dataConsulta: new Date().toISOString() };
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

    // 1. Executar verificações reais em paralelo
    console.log(`Iniciando verificações reais para CNPJ: ${cnpjLimpo}`);
    const [ceis, cnep, cepim, cndt, crf, receita] = await Promise.all([
      consultarCEIS(cnpjLimpo),
      consultarCNEP(cnpjLimpo),
      consultarCEPIM(cnpjLimpo),
      consultarCNDT(cnpjLimpo),
      consultarCRF(cnpjLimpo),
      consultarReceitaFederal(cnpjLimpo),
    ]);

    const verificacoesReais: VerificacaoReal[] = [ceis, cnep, cepim, cndt, crf, receita];
    console.log("Verificações reais concluídas:", verificacoesReais.map(v => `${v.fonte}: ${v.status}`));

    // 2. Gerar análise complementar com IA
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const verificacoesTexto = verificacoesReais.map(v => `${v.fonte}: ${v.status} - ${v.detalhes}`).join("\n");

    const prompt = `Você é um especialista em licitações públicas brasileiras (Lei 14.133/2021).
Para a empresa com CNPJ ${cnpj}${razaoSocial ? ` (${razaoSocial})` : ''}, já realizamos verificações automáticas com os seguintes resultados:

${verificacoesTexto}

Com base nesses resultados REAIS, gere uma análise complementar das certidões negativas necessárias para participação em licitações.

Para cada certidão que NÃO foi verificada automaticamente (CND Federal tributária, Certidão Estadual, Certidão Municipal, Certidão de Falência), informe:
1. Nome da certidão
2. Órgão emissor
3. URL oficial para emissão
4. Validade padrão (em dias)
5. Status como "verificar" (já que não foi verificada automaticamente)
6. Observações e documentos necessários

NÃO repita as certidões já verificadas automaticamente (CEIS, CNEP, CEPIM, CNDT, CRF, Receita Federal).

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

    // 3. Combinar resultados reais com análise IA
    const certidoesReais = verificacoesReais.map(v => ({
      nome: v.fonte === "CEIS" ? "Certidão CEIS (Empresas Inidôneas)" :
            v.fonte === "CNEP" ? "Certidão CNEP (Empresas Punidas)" :
            v.fonte === "CEPIM" ? "Certidão CEPIM (Entidades Impedidas)" :
            v.fonte === "CNDT/TST" ? "CNDT – Certidão Negativa de Débitos Trabalhistas" :
            v.fonte === "CRF/FGTS" ? "CRF – Certificado de Regularidade do FGTS" :
            "Situação Cadastral – Receita Federal",
      orgao: v.fonte === "CEIS" || v.fonte === "CNEP" || v.fonte === "CEPIM" ? "Portal da Transparência" :
             v.fonte === "CNDT/TST" ? "Tribunal Superior do Trabalho" :
             v.fonte === "CRF/FGTS" ? "Caixa Econômica Federal" :
             "Receita Federal do Brasil",
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
