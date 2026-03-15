import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmissaoResult = {
  certidao: string;
  status: "emitida" | "pendente" | "erro" | "captcha";
  conteudo?: string;
  codigo?: string;
  validade?: string;
  dataEmissao?: string;
  url?: string;
  detalhes: string;
  screenshot?: string;
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// ══════════════════════════════════════════════════════════════
// CNDT – Tribunal Superior do Trabalho
// ══════════════════════════════════════════════════════════════
async function emitirCNDT(cnpj: string, FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string): Promise<EmissaoResult> {
  const cnpjFmt = formatCnpj(cnpj);
  const url = "https://cndt-certidao.tst.jus.br/inicio.faces";

  try {
    console.log("CNDT: Tentando emissão via scrape+actions para CNPJ:", cnpjFmt);

    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "screenshot"],
        waitFor: 3000,
        timeout: 30000,
        actions: [
          { type: "wait", milliseconds: 2000 },
          { type: "write", text: cnpj, selector: "input[id*='cnpj'], input[name*='cnpj'], input[id*='CNPJ'], input[name*='CNPJ'], input[id*='nrCnpj'], input.campo" },
          { type: "wait", milliseconds: 500 },
          { type: "click", selector: "input[type='submit'], button[type='submit'], input[value*='Emitir'], button[id*='btnEmitir'], input[id*='btnEmitir']" },
          { type: "wait", milliseconds: 5000 },
          { type: "screenshot" },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.log("CNDT scrape error:", resp.status, body);
      return { certidao: "CNDT/TST", status: "erro", detalhes: `Erro no scraping: ${resp.status}`, url };
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const screenshot = data.data?.screenshot || data.screenshot || "";

    console.log("CNDT markdown length:", markdown.length);

    // Check for CAPTCHA indicators
    if (markdown.toLowerCase().includes("captcha") || markdown.toLowerCase().includes("recaptcha") || markdown.toLowerCase().includes("hcaptcha")) {
      return {
        certidao: "CNDT/TST",
        status: "captcha",
        detalhes: "Portal requer CAPTCHA. Não foi possível emitir automaticamente.",
        url,
        screenshot,
      };
    }

    // Use AI to extract certificate data from the scraped content
    if (markdown.length > 100) {
      const aiResult = await extractCertidaoIA(markdown, "CNDT", cnpjFmt, LOVABLE_API_KEY);
      if (aiResult) {
        return { ...aiResult, certidao: "CNDT/TST", url, screenshot };
      }
    }

    return {
      certidao: "CNDT/TST",
      status: "pendente",
      detalhes: "Não foi possível extrair dados da certidão. Verifique manualmente no portal.",
      url,
      screenshot,
    };
  } catch (e) {
    console.error("CNDT error:", e);
    return { certidao: "CNDT/TST", status: "erro", detalhes: `Falha: ${e.message}`, url };
  }
}

// ══════════════════════════════════════════════════════════════
// CRF/FGTS – Caixa Econômica Federal
// ══════════════════════════════════════════════════════════════
async function emitirCRF(cnpj: string, FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string): Promise<EmissaoResult> {
  const url = "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf";

  try {
    console.log("CRF: Tentando emissão via scrape+actions para CNPJ:", cnpj);

    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "screenshot"],
        waitFor: 3000,
        timeout: 30000,
        actions: [
          { type: "wait", milliseconds: 2000 },
          { type: "write", text: cnpj, selector: "input[id*='cnpj'], input[name*='cnpj'], input[id*='inscricao'], input[id*='txtCNPJ'], input.campo" },
          { type: "wait", milliseconds: 500 },
          { type: "click", selector: "input[type='submit'], button[type='submit'], input[value*='Consultar'], button[id*='btnConsultar'], input[id*='btnConsultar']" },
          { type: "wait", milliseconds: 5000 },
          { type: "screenshot" },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.log("CRF scrape error:", resp.status, body);
      return { certidao: "CRF/FGTS", status: "erro", detalhes: `Erro no scraping: ${resp.status}`, url };
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const screenshot = data.data?.screenshot || data.screenshot || "";

    if (markdown.toLowerCase().includes("captcha") || markdown.toLowerCase().includes("recaptcha")) {
      return {
        certidao: "CRF/FGTS",
        status: "captcha",
        detalhes: "Portal requer CAPTCHA. Não foi possível emitir automaticamente.",
        url,
        screenshot,
      };
    }

    if (markdown.length > 100) {
      const aiResult = await extractCertidaoIA(markdown, "CRF/FGTS", formatCnpj(cnpj), LOVABLE_API_KEY);
      if (aiResult) {
        return { ...aiResult, certidao: "CRF/FGTS", url, screenshot };
      }
    }

    return {
      certidao: "CRF/FGTS",
      status: "pendente",
      detalhes: "Não foi possível extrair dados do CRF. Verifique manualmente no portal.",
      url,
      screenshot,
    };
  } catch (e) {
    console.error("CRF error:", e);
    return { certidao: "CRF/FGTS", status: "erro", detalhes: `Falha: ${e.message}`, url };
  }
}

// ══════════════════════════════════════════════════════════════
// CND Federal – Receita Federal / PGFN
// ══════════════════════════════════════════════════════════════
async function emitirCNDFederal(cnpj: string, FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string): Promise<EmissaoResult> {
  const url = "https://servicos.receitafederal.gov.br/servico/certidoes/#/home";

  try {
    console.log("CND Federal: Tentando emissão via scrape+actions para CNPJ:", cnpj);

    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "screenshot"],
        waitFor: 3000,
        timeout: 30000,
        actions: [
          { type: "wait", milliseconds: 2000 },
          { type: "write", text: cnpj, selector: "input[id*='NI'], input[name*='NI'], input[id*='cnpj'], input[name*='cnpj'], input[id*='Ni'], #NI" },
          { type: "wait", milliseconds: 500 },
          { type: "click", selector: "input[type='submit'], button[type='submit'], input[value*='Consultar'], #validar, input[id*='validar']" },
          { type: "wait", milliseconds: 5000 },
          { type: "screenshot" },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.log("CND Federal scrape error:", resp.status, body);
      return { certidao: "CND Federal", status: "erro", detalhes: `Erro no scraping: ${resp.status}`, url };
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const screenshot = data.data?.screenshot || data.screenshot || "";

    if (markdown.toLowerCase().includes("captcha") || markdown.toLowerCase().includes("recaptcha")) {
      return {
        certidao: "CND Federal",
        status: "captcha",
        detalhes: "Portal requer CAPTCHA. A emissão da CND Federal geralmente exige certificado digital ou gov.br.",
        url,
        screenshot,
      };
    }

    if (markdown.length > 100) {
      const aiResult = await extractCertidaoIA(markdown, "CND Federal", formatCnpj(cnpj), LOVABLE_API_KEY);
      if (aiResult) {
        return { ...aiResult, certidao: "CND Federal", url, screenshot };
      }
    }

    return {
      certidao: "CND Federal",
      status: "pendente",
      detalhes: "Não foi possível emitir automaticamente. A CND Federal geralmente requer certificado digital ou gov.br.",
      url,
      screenshot,
    };
  } catch (e) {
    console.error("CND Federal error:", e);
    return { certidao: "CND Federal", status: "erro", detalhes: `Falha: ${e.message}`, url };
  }
}

// ══════════════════════════════════════════════════════════════
// CEIS/CNEP/CEPIM – Portal da Transparência (consulta direta)
// ══════════════════════════════════════════════════════════════
async function consultarTransparencia(cnpj: string, FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string): Promise<EmissaoResult[]> {
  const cnpjFmt = formatCnpj(cnpj);
  const results: EmissaoResult[] = [];

  const portais = [
    { nome: "CEIS", endpoint: "ceis", descricao: "Empresas Inidôneas e Suspensas" },
    { nome: "CNEP", endpoint: "cnep", descricao: "Empresas Punidas" },
    { nome: "CEPIM", endpoint: "cepim", descricao: "Entidades Privadas Impedidas" },
  ];

  for (const portal of portais) {
    try {
      const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `"${cnpj}" ${portal.endpoint} site:portaldatransparencia.gov.br`,
          limit: 3,
          lang: "pt-br",
          country: "BR",
        }),
      });

      if (searchResp.ok) {
        const data = await searchResp.json();
        const found = (data?.data || []).some((r: any) => {
          const text = (r.description || r.markdown || "").toLowerCase();
          return text.includes(cnpj) && (text.includes("sanção") || text.includes("punição") || text.includes("impedid"));
        });

        results.push({
          certidao: `${portal.nome} (${portal.descricao})`,
          status: found ? "erro" : "emitida",
          detalhes: found
            ? `⚠️ Possível registro encontrado no ${portal.nome}`
            : `✅ Nenhum registro no ${portal.nome} – situação REGULAR`,
          dataEmissao: new Date().toISOString(),
          url: `https://portaldatransparencia.gov.br/sancoes/${portal.endpoint}`,
        });
      } else {
        await searchResp.text();
        results.push({
          certidao: `${portal.nome} (${portal.descricao})`,
          status: "pendente",
          detalhes: "Não foi possível consultar. Verifique manualmente.",
          url: `https://portaldatransparencia.gov.br/sancoes/${portal.endpoint}`,
        });
      }
    } catch {
      results.push({
        certidao: `${portal.nome} (${portal.descricao})`,
        status: "erro",
        detalhes: "Falha na consulta",
        url: `https://portaldatransparencia.gov.br/sancoes/${portal.endpoint}`,
      });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════
// Receita Federal – Situação Cadastral (via BrasilAPI)
// ══════════════════════════════════════════════════════════════
async function consultarSituacaoCadastral(cnpj: string): Promise<EmissaoResult> {
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!resp.ok) {
      return {
        certidao: "Situação Cadastral (Receita Federal)",
        status: "erro",
        detalhes: "Não foi possível consultar a situação cadastral",
        url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home",
      };
    }
    const data = await resp.json();

    if (data.situacao_cadastral === 2) {
      return {
        certidao: "Situação Cadastral (Receita Federal)",
        status: "emitida",
        detalhes: `Situação: ATIVA | Razão Social: ${data.razao_social} | CNAE: ${data.cnae_fiscal_descricao}`,
        dataEmissao: new Date().toISOString(),
        url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home",
      };
    }

    const situacoes: Record<number, string> = { 1: "NULA", 3: "SUSPENSA", 4: "INAPTA", 8: "BAIXADA" };
    return {
      certidao: "Situação Cadastral (Receita Federal)",
      status: "erro",
      detalhes: `Situação: ${situacoes[data.situacao_cadastral] || "IRREGULAR"} – ${data.motivo_situacao_cadastral || ""}`,
      url: "https://servicos.receitafederal.gov.br/servico/certidoes/#/home",
    };
  } catch (e) {
    return {
      certidao: "Situação Cadastral (Receita Federal)",
      status: "erro",
      detalhes: `Erro: ${e.message}`,
    };
  }
}

// ══════════════════════════════════════════════════════════════
// IA – Extrair dados da certidão do conteúdo scrapeado
// ══════════════════════════════════════════════════════════════
async function extractCertidaoIA(
  markdown: string,
  tipoCertidao: string,
  cnpj: string,
  LOVABLE_API_KEY: string
): Promise<Partial<EmissaoResult> | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um extrator de dados de certidões brasileiras. Analise o conteúdo scrapeado de um portal governamental e extraia informações da ${tipoCertidao} para o CNPJ ${cnpj}.

Responda APENAS com JSON:
{
  "encontrou_certidao": true/false,
  "tipo_certidao": "negativa" | "positiva" | "positiva_com_efeito_negativa" | "nao_identificada",
  "codigo_certidao": "string ou null",
  "validade": "YYYY-MM-DD ou null",
  "data_emissao": "YYYY-MM-DD ou null",
  "situacao": "regular" | "irregular" | "pendente",
  "detalhes": "string descritiva do resultado",
  "tem_captcha": true/false,
  "pagina_erro": true/false
}`
          },
          { role: "user", content: markdown.slice(0, 5000) },
        ],
      }),
    });

    if (!resp.ok) { await resp.text(); return null; }

    const aiData = await resp.json();
    let content = (aiData.choices?.[0]?.message?.content || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(content);

    console.log(`IA ${tipoCertidao} extraction:`, JSON.stringify(parsed));

    if (parsed.tem_captcha) {
      return {
        status: "captcha",
        detalhes: parsed.detalhes || "Portal requer CAPTCHA para emissão",
      };
    }

    if (parsed.pagina_erro) {
      return {
        status: "erro",
        detalhes: parsed.detalhes || "Página retornou erro",
      };
    }

    if (parsed.encontrou_certidao) {
      return {
        status: "emitida",
        codigo: parsed.codigo_certidao || undefined,
        validade: parsed.validade || undefined,
        dataEmissao: parsed.data_emissao || new Date().toISOString().split("T")[0],
        detalhes: parsed.detalhes || `Certidão ${parsed.tipo_certidao} encontrada`,
      };
    }

    return {
      status: "pendente",
      detalhes: parsed.detalhes || "Certidão não encontrada no conteúdo extraído",
    };
  } catch (e) {
    console.error(`IA extraction error for ${tipoCertidao}:`, e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: "CNPJ é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Iniciando emissão de certidões para CNPJ: ${cnpjLimpo}`);

    // Execute all emissions in parallel
    const [cndt, crf, cndFederal, transparencia, situacao] = await Promise.all([
      emitirCNDT(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      emitirCRF(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      emitirCNDFederal(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      consultarTransparencia(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      consultarSituacaoCadastral(cnpjLimpo),
    ]);

    const resultados: EmissaoResult[] = [situacao, ...transparencia, cndt, crf, cndFederal];

    const emitidas = resultados.filter(r => r.status === "emitida").length;
    const captcha = resultados.filter(r => r.status === "captcha").length;
    const erros = resultados.filter(r => r.status === "erro").length;

    console.log(`Emissão concluída: ${emitidas} emitidas, ${captcha} CAPTCHA, ${erros} erros`);

    return new Response(JSON.stringify({
      resultados,
      resumo: {
        total: resultados.length,
        emitidas,
        captcha,
        pendentes: resultados.filter(r => r.status === "pendente").length,
        erros,
      },
      dataConsulta: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro emissão certidões:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao emitir certidões" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
