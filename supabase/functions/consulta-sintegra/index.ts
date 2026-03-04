import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj, uf } = await req.json();
    if (!cnpj || !uf) {
      return new Response(JSON.stringify({ error: "CNPJ e UF são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const ufUpper = uf.toUpperCase();
    const cnpjFormatado = cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    
    let inscricaoEstadual = "";
    let statusIE = "";
    let fonte = "";

    // ── Source 1: CNPJA Open API ──
    try {
      const cnpjaResp = await fetch(`https://open.cnpja.com/office/${cnpjLimpo}`, {
        headers: { "Accept": "application/json" },
      });
      if (cnpjaResp.ok) {
        const cnpjaData = await cnpjaResp.json();
        if (cnpjaData.registrations?.length > 0) {
          const stateReg = cnpjaData.registrations.find(
            (r: any) => (r.state || "").toUpperCase() === ufUpper
          );
          if (stateReg?.number) {
            inscricaoEstadual = stateReg.number;
            statusIE = stateReg.enabled ? "ATIVA" : "INATIVA";
            fonte = "Cadastro de Contribuintes (CNPJA)";
          }
        }
      } else {
        await cnpjaResp.text();
      }
    } catch (e) {
      console.log("CNPJA error:", e);
    }

    // ── Source 2: Firecrawl Search + AI Extraction ──
    if (!inscricaoEstadual) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (FIRECRAWL_API_KEY && LOVABLE_API_KEY) {
        try {
          const searchQuery = `"${cnpjFormatado}" "inscrição estadual" ${ufUpper}`;
          console.log("Firecrawl search:", searchQuery);

          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: searchQuery,
              limit: 5,
              lang: "pt-br",
              country: "br",
              scrapeOptions: { formats: ["markdown"] },
            }),
          });

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const results = searchData.data || [];
            console.log(`Firecrawl: ${results.length} results`);

            // Combine all content for AI extraction
            const combinedContent = results
              .map((r: any) => `[Fonte: ${r.url}]\n${(r.markdown || r.description || "").slice(0, 2000)}`)
              .filter((s: string) => s.length > 20)
              .join("\n\n---\n\n")
              .slice(0, 6000);

            if (combinedContent.length > 100) {
              const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  tools: [{
                    type: "function",
                    function: {
                      name: "extract_ie",
                      description: "Extrair a Inscrição Estadual (IE) de uma empresa brasileira",
                      parameters: {
                        type: "object",
                        properties: {
                          inscricao_estadual: {
                            type: "string",
                            description: "Número da Inscrição Estadual. NÃO confundir com CNPJ, CPF ou Inscrição Municipal. A IE é um número de registro estadual diferente do CNPJ. Retornar string vazia se não encontrar."
                          },
                          confianca: {
                            type: "string",
                            enum: ["alta", "media", "baixa", "nao_encontrada"],
                            description: "Nível de confiança na extração"
                          },
                          fonte_url: {
                            type: "string",
                            description: "URL da fonte onde a IE foi encontrada"
                          }
                        },
                        required: ["inscricao_estadual", "confianca"],
                        additionalProperties: false
                      }
                    }
                  }],
                  tool_choice: { type: "function", function: { name: "extract_ie" } },
                  messages: [
                    {
                      role: "system",
                      content: `Você é um especialista em dados cadastrais brasileiros. Extraia a Inscrição Estadual (IE) do CNPJ ${cnpjFormatado} no estado ${ufUpper}.

REGRAS IMPORTANTES:
- A IE é DIFERENTE do CNPJ. O CNPJ tem formato XX.XXX.XXX/XXXX-XX. NÃO retorne o CNPJ como IE.
- A IE é DIFERENTE da Inscrição Municipal.
- Cada estado tem seu próprio formato de IE. Exemplos:
  - SP: 123.456.789.123 (12 dígitos)
  - RJ: 12.345.67-8 (8 dígitos)
  - MG: 123.456.789/1234 (13 dígitos)
  - PA: 15-123456-7 (8 dígitos)
- Se não encontrar uma IE claramente distinta do CNPJ, retorne string vazia com confianca "nao_encontrada".`
                    },
                    { role: "user", content: combinedContent }
                  ],
                }),
              });

              if (aiResp.ok) {
                const aiData = await aiResp.json();
                const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                if (toolCall) {
                  const args = JSON.parse(toolCall.function.arguments);
                  console.log("AI extraction:", JSON.stringify(args));
                  
                  // Validate: IE must be different from CNPJ
                  const ieClean = (args.inscricao_estadual || "").replace(/\D/g, "");
                  if (
                    args.confianca !== "nao_encontrada" &&
                    ieClean.length >= 6 &&
                    ieClean !== cnpjLimpo &&
                    !cnpjLimpo.includes(ieClean) &&
                    !ieClean.includes(cnpjLimpo)
                  ) {
                    inscricaoEstadual = args.inscricao_estadual;
                    statusIE = "ENCONTRADA";
                    fonte = args.fonte_url ? `Web + IA (${args.fonte_url})` : "Busca Web + IA";
                  }
                }
              } else {
                const errText = await aiResp.text();
                console.log("AI error:", aiResp.status, errText);
              }
            }
          } else {
            const errBody = await searchResp.text();
            console.log("Firecrawl error:", searchResp.status, errBody);
          }
        } catch (e) {
          console.error("Firecrawl+AI error:", e);
        }
      }
    }

    // ── Source 3: Speedio fallback ──
    if (!inscricaoEstadual) {
      try {
        const speedioResp = await fetch(`https://api-publica.speedio.com.br/buscarcnpj?cnpj=${cnpjLimpo}`);
        if (speedioResp.ok) {
          const d = await speedioResp.json();
          const ie = d["INSCRICAO ESTADUAL"] || "";
          if (ie && ie !== "ISENTO" && ie !== "0" && ie !== "*" && ie.length > 3) {
            const ieClean = ie.replace(/\D/g, "");
            if (ieClean !== cnpjLimpo) {
              inscricaoEstadual = ie;
              statusIE = "ENCONTRADA";
              fonte = "Speedio";
            }
          }
        } else {
          await speedioResp.text();
        }
      } catch { /* silent */ }
    }

    // ── Get company name ──
    let razaoSocial = "";
    let nomeFantasia = "";
    let municipio = "";
    try {
      const brasilResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (brasilResp.ok) {
        const d = await brasilResp.json();
        razaoSocial = d.razao_social || "";
        nomeFantasia = d.nome_fantasia || "";
        municipio = d.municipio || "";
      } else { await brasilResp.text(); }
    } catch { /* silent */ }

    console.log("SINTEGRA FINAL:", JSON.stringify({
      cnpj: cnpjFormatado, uf: ufUpper, ie: inscricaoEstadual, status: statusIE, fonte
    }));

    return new Response(JSON.stringify({
      cnpj: cnpjFormatado,
      inscricaoEstadual,
      statusInscricao: statusIE,
      fonte,
      razaoSocial,
      nomeFantasia,
      uf: ufUpper,
      municipio,
      dataConsulta: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro SINTEGRA:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
