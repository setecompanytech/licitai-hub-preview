import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req, { functionName: "consulta-ncm", maxRequests: 20, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { ncm, descricao, uf, regime } = await req.json();

    if (!ncm && !descricao) {
      return new Response(
        JSON.stringify({ error: "NCM ou descrição é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ncmClean = (ncm || "").replace(/[^0-9]/g, "");
    const resultados: any = {
      ncm: ncmClean,
      descricao_ncm: "",
      tipi: null,
      icms: null,
      ipi: null,
      pis_cofins: null,
      st: null,
      cest: null,
      fontes: [],
      fundamentacao: [],
    };

    // ── 1. Consulta IBPT (Tabela oficial de NCM + alíquotas médias) ──
    try {
      const ibptResp = await fetch(
        `https://brasilapi.com.br/api/ncm/v1/${ncmClean}`,
        { headers: { "Accept": "application/json" } }
      );
      if (ibptResp.ok) {
        const ibptData = await ibptResp.json();
        resultados.descricao_ncm = ibptData.descricao || "";
        resultados.tipi = {
          codigo: ibptData.codigo || ncmClean,
          descricao: ibptData.descricao,
          data_inicio: ibptData.data_inicio,
          data_fim: ibptData.data_fim,
          tipo_ato: ibptData.tipo_ato,
          numero_ato: ibptData.numero_ato,
          ano_ato: ibptData.ano_ato,
        };
        resultados.fontes.push({
          nome: "Brasil API / IBGE NCM",
          url: `https://brasilapi.com.br/api/ncm/v1/${ncmClean}`,
          tipo: "api_oficial",
        });
      }
    } catch (e) {
      console.error("Erro Brasil API NCM:", e);
    }

    // ── 2. Busca por descrição parcial se NCM não encontrado ──
    if (!resultados.descricao_ncm && descricao) {
      try {
        const searchResp = await fetch(
          `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(descricao.substring(0, 50))}`,
          { headers: { "Accept": "application/json" } }
        );
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            resultados.sugestoes_ncm = searchData.slice(0, 5).map((item: any) => ({
              codigo: item.codigo,
              descricao: item.descricao,
            }));
            resultados.fontes.push({
              nome: "Brasil API / Busca NCM por descrição",
              url: `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(descricao.substring(0, 50))}`,
              tipo: "api_oficial",
            });
          }
        }
      } catch (e) {
        console.error("Erro busca NCM por descrição:", e);
      }
    }

    // ── 3. Consulta CONFAZ / Tabela ICMS interestadual ──
    resultados.icms_interestadual = {
      norte_nordeste_co_es: 7,
      sul_sudeste: 12,
      importados: 4,
      fundamentacao: "Resolução do Senado Federal nº 22/1989 e EC 87/2015",
    };
    resultados.fontes.push({
      nome: "CONFAZ / Senado Federal",
      url: "https://www.confaz.fazenda.gov.br/",
      tipo: "legislacao_oficial",
    });

    // ── 4. IA Tributária com Lovable AI para análise profunda ──
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY) {
      try {
        const prompt = `Você é um auditor tributário federal, contador CRC ativo e advogado tributarista OAB. 
Analise o NCM ${ncmClean} ${descricao ? `(${descricao})` : ""} para o estado ${uf || "BR"}, regime ${regime || "Lucro Presumido"}.

CONSULTE OBRIGATORIAMENTE estas fontes oficiais:
1. TIPI (Tabela de Incidência do IPI) - Decreto 11.158/2022 atualizado
2. RICMS do estado ${uf || "BR"} - última consolidação
3. Convênios CONFAZ vigentes (especialmente ICMS 142/18 para ST, ICMS 52/91 para informática)
4. Tabela CEST (Convênio ICMS 142/18)
5. Lei Complementar 87/96 (Lei Kandir)
6. IN RFB 2.121/2022 (PIS/COFINS)
7. Decreto 2.931/2023 do PA (se UF=PA)

RETORNE EXCLUSIVAMENTE em JSON válido (sem markdown):
{
  "ncm": "${ncmClean}",
  "descricao_oficial": "Descrição oficial conforme TIPI",
  "capitulo": "Capítulo da NCM",
  "secao": "Seção da TIPI",
  "ipi_aliquota": 0,
  "ipi_fundamentacao": "Decreto/artigo",
  "pis_aliquota": 0,
  "cofins_aliquota": 0,
  "pis_cofins_regime": "cumulativo ou nao_cumulativo",
  "pis_cofins_fundamentacao": "Lei/artigo",
  "icms_interno_aliquota": 0,
  "icms_reducao_bc": null,
  "icms_isento": false,
  "icms_st": false,
  "icms_st_mva": null,
  "icms_diferido": false,
  "icms_fundamentacao": "RICMS/Decreto/artigo",
  "cest": null,
  "beneficios_fiscais": [],
  "convênios_confaz": [],
  "observacoes_legais": "Observações técnicas relevantes",
  "riscos_fiscais": "Alertas sobre contingências ou interpretações divergentes",
  "ultima_atualizacao_legislacao": "Data aproximada"
}`;

        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Você é um especialista tributário brasileiro. Responda APENAS em JSON válido, sem blocos de código markdown." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              resultados.analise_ia = parsed;
              resultados.icms = {
                aliquota_interna: parsed.icms_interno_aliquota,
                reducao_bc: parsed.icms_reducao_bc,
                isento: parsed.icms_isento,
                diferido: parsed.icms_diferido,
                fundamentacao: parsed.icms_fundamentacao,
              };
              resultados.ipi = {
                aliquota: parsed.ipi_aliquota,
                fundamentacao: parsed.ipi_fundamentacao,
              };
              resultados.pis_cofins = {
                pis: parsed.pis_aliquota,
                cofins: parsed.cofins_aliquota,
                regime: parsed.pis_cofins_regime,
                fundamentacao: parsed.pis_cofins_fundamentacao,
              };
              resultados.st = {
                aplicavel: parsed.icms_st,
                mva: parsed.icms_st_mva,
                cest: parsed.cest,
              };
              resultados.cest = parsed.cest;
              resultados.beneficios_fiscais = parsed.beneficios_fiscais || [];
              resultados.convenios_confaz = parsed.convênios_confaz || [];
              resultados.riscos_fiscais = parsed.riscos_fiscais;
              resultados.descricao_ncm = resultados.descricao_ncm || parsed.descricao_oficial;

              resultados.fundamentacao.push(
                ...(parsed.convênios_confaz || []).map((c: string) => ({ tipo: "CONFAZ", referencia: c })),
                { tipo: "RICMS", referencia: parsed.icms_fundamentacao },
                { tipo: "IPI/TIPI", referencia: parsed.ipi_fundamentacao },
                { tipo: "PIS/COFINS", referencia: parsed.pis_cofins_fundamentacao }
              );
            } catch (parseErr) {
              console.error("Erro parse IA:", parseErr);
              resultados.analise_ia_raw = content;
            }
          }

          resultados.fontes.push({
            nome: "Análise IA Tributária (Gemini 2.5 Flash)",
            url: "Lovable AI Gateway",
            tipo: "ia_especializada",
            nota: "Baseado em TIPI, RICMS, CONFAZ, LC 87/96, IN RFB 2.121/2022",
          });
        } else if (aiResp.status === 429) {
          resultados.ai_rate_limited = true;
        } else if (aiResp.status === 402) {
          resultados.ai_payment_required = true;
        }
      } catch (aiErr) {
        console.error("Erro IA tributária:", aiErr);
      }
    }

    // ── 5. Fontes governamentais de referência ──
    resultados.fontes_referencia = [
      { nome: "TIPI - Tabela IPI", url: "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/tipi" },
      { nome: "CONFAZ - Convênios ICMS", url: "https://www.confaz.fazenda.gov.br/legislacao/convenios" },
      { nome: "CEST - Substituição Tributária", url: "https://www.confaz.fazenda.gov.br/legislacao/convenios/2015/CV142_15" },
      { nome: "Tabela IBPT", url: "https://deolhonoimposto.ibpt.org.br/" },
      { nome: "Receita Federal - NCM", url: "https://portalunico.siscomex.gov.br/classif/" },
      { nome: "SEFA/PA - RICMS", url: uf === "PA" ? "https://www.sefa.pa.gov.br/" : `https://www.sefaz.${(uf || "sp").toLowerCase()}.gov.br/` },
    ];

    return new Response(JSON.stringify(resultados), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro consulta NCM:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
