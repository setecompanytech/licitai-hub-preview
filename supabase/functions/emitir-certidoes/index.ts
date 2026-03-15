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
// CND Conjunta de Débitos Relativos a Tributos Federais e à Dívida Ativa da União
// ══════════════════════════════════════════════════════════════
async function emitirCNDConjunta(cnpj: string, FIRECRAWL_API_KEY: string, LOVABLE_API_KEY: string): Promise<EmissaoResult> {
  const certidaoNome = "CND Conjunta (Tributos Federais e Dívida Ativa da União)";
  const url = "https://servicos.receitafederal.gov.br/servico/certidoes/#/home";

  // First try BrasilAPI for quick situação cadastral check
  let situacaoDetalhes = "";
  try {
    const brasilResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (brasilResp.ok) {
      const brasilData = await brasilResp.json();
      if (brasilData.situacao_cadastral === 2) {
        situacaoDetalhes = `Situação Cadastral: ATIVA | Razão Social: ${brasilData.razao_social} | CNAE: ${brasilData.cnae_fiscal_descricao}. `;
      } else {
        const situacoes: Record<number, string> = { 1: "NULA", 3: "SUSPENSA", 4: "INAPTA", 8: "BAIXADA" };
        return {
          certidao: certidaoNome,
          status: "erro",
          detalhes: `Situação Cadastral: ${situacoes[brasilData.situacao_cadastral] || "IRREGULAR"} – ${brasilData.motivo_situacao_cadastral || ""}. Empresa com restrição cadastral, CND provavelmente indisponível.`,
          url,
        };
      }
    }
  } catch (e) {
    console.log("BrasilAPI check failed, continuing with scraping:", e.message);
  }

  try {
    console.log("CND Conjunta: Tentando emissão via scrape+actions para CNPJ:", cnpj);

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
      console.log("CND Conjunta scrape error:", resp.status, body);
      return {
        certidao: certidaoNome,
        status: situacaoDetalhes ? "pendente" : "erro",
        detalhes: `${situacaoDetalhes}Erro no scraping do portal: ${resp.status}. Acesse o portal manualmente.`,
        url,
      };
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const screenshot = data.data?.screenshot || data.screenshot || "";

    if (markdown.toLowerCase().includes("captcha") || markdown.toLowerCase().includes("recaptcha")) {
      return {
        certidao: certidaoNome,
        status: "captcha",
        detalhes: `${situacaoDetalhes}Portal requer CAPTCHA. A emissão da CND Conjunta geralmente exige certificado digital ou gov.br.`,
        url,
        screenshot,
      };
    }

    if (markdown.length > 100) {
      const aiResult = await extractCertidaoIA(markdown, "CND Conjunta (Tributos Federais e Dívida Ativa)", formatCnpj(cnpj), LOVABLE_API_KEY);
      if (aiResult) {
        return { ...aiResult, certidao: certidaoNome, url, screenshot, detalhes: `${situacaoDetalhes}${aiResult.detalhes || ""}` };
      }
    }

    return {
      certidao: certidaoNome,
      status: "pendente",
      detalhes: `${situacaoDetalhes}Não foi possível emitir automaticamente. A CND Conjunta geralmente requer certificado digital ou gov.br.`,
      url,
      screenshot,
    };
  } catch (e) {
    console.error("CND Conjunta error:", e);
    return { certidao: certidaoNome, status: "erro", detalhes: `${situacaoDetalhes}Falha: ${e.message}`, url };
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
// Certidões Estaduais e Municipais (scraping nos portais)
// ══════════════════════════════════════════════════════════════
type PortalInfo = { nome: string; url: string; tipo: string; descricao: string; requerLogin?: boolean };

async function emitirCertidoesRegionais(
  portais: PortalInfo[],
  cnpj: string,
  FIRECRAWL_API_KEY: string,
  LOVABLE_API_KEY: string
): Promise<EmissaoResult[]> {
  const results: EmissaoResult[] = [];

  for (const portal of portais) {
    if (portal.requerLogin) {
      results.push({
        certidao: portal.nome,
        status: "pendente",
        detalhes: `${portal.descricao}. Portal requer login/autenticação para emissão.`,
        url: portal.url,
      });
      continue;
    }

    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: portal.url,
          formats: ["markdown", "screenshot"],
          waitFor: 3000,
          timeout: 25000,
          actions: [
            { type: "wait", milliseconds: 2000 },
            { type: "write", text: cnpj, selector: "input[id*='cnpj'], input[name*='cnpj'], input[id*='CNPJ'], input[name*='CNPJ'], input[id*='inscricao'], input[type='text']" },
            { type: "wait", milliseconds: 500 },
            { type: "click", selector: "input[type='submit'], button[type='submit'], button[type='button'], input[value*='Emitir'], input[value*='Consultar'], button:has-text('Emitir'), button:has-text('Consultar')" },
            { type: "wait", milliseconds: 4000 },
            { type: "screenshot" },
          ],
        }),
      });

      if (!resp.ok) {
        results.push({
          certidao: portal.nome,
          status: "pendente",
          detalhes: `${portal.descricao}. Não foi possível acessar o portal automaticamente.`,
          url: portal.url,
        });
        continue;
      }

      const data = await resp.json();
      const markdown = data.data?.markdown || data.markdown || "";
      const screenshot = data.data?.screenshot || data.screenshot || "";

      if (markdown.toLowerCase().includes("captcha") || markdown.toLowerCase().includes("recaptcha")) {
        results.push({
          certidao: portal.nome,
          status: "captcha",
          detalhes: `${portal.descricao}. Portal requer CAPTCHA.`,
          url: portal.url,
          screenshot,
        });
        continue;
      }

      if (markdown.length > 100) {
        const aiResult = await extractCertidaoIA(markdown, portal.nome, formatCnpj(cnpj), LOVABLE_API_KEY);
        if (aiResult) {
          results.push({ ...aiResult, certidao: portal.nome, url: portal.url, screenshot } as EmissaoResult);
          continue;
        }
      }

      results.push({
        certidao: portal.nome,
        status: "pendente",
        detalhes: `${portal.descricao}. Acesse o portal para emissão manual.`,
        url: portal.url,
        screenshot,
      });
    } catch (e) {
      results.push({
        certidao: portal.nome,
        status: "erro",
        detalhes: `${portal.descricao}. Falha: ${e.message}`,
        url: portal.url,
      });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj, uf, municipio, portaisRegionais } = await req.json();
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

    console.log(`Iniciando emissão de certidões para CNPJ: ${cnpjLimpo}, UF: ${uf || 'N/A'}, Município: ${municipio || 'N/A'}`);

    // Execute federal emissions in parallel
    const federalPromises = [
      emitirCNDT(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      emitirCRF(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      emitirCNDConjunta(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
      consultarTransparencia(cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY),
    ];

    // Add regional certificates if portals provided
    const regionalPromise = portaisRegionais && portaisRegionais.length > 0
      ? emitirCertidoesRegionais(portaisRegionais, cnpjLimpo, FIRECRAWL_API_KEY, LOVABLE_API_KEY)
      : Promise.resolve([]);

    const [cndt, crf, cndConjunta, transparencia, regionais] = await Promise.all([
      ...federalPromises,
      regionalPromise,
    ]);

    const resultados: EmissaoResult[] = [
      cndConjunta as EmissaoResult,
      ...(transparencia as EmissaoResult[]),
      cndt as EmissaoResult,
      crf as EmissaoResult,
      ...(regionais as EmissaoResult[]),
    ];

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
