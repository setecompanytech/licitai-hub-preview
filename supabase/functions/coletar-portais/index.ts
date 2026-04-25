// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optionally filter by portal_id from body
    let portalFilter: string | null = null;
    try {
      const body = await req.json();
      portalFilter = body?.portal_id || null;
    } catch { /* no body */ }

    let query = supabase.from("portais_monitorados").select("*").eq("ativo", true);
    if (portalFilter) {
      query = query.eq("id", portalFilter);
    }
    const { data: portais, error: portaisError } = await query;

    if (portaisError) throw portaisError;

    const resultados: any[] = [];

    for (const portal of portais ?? []) {
      try {
        let editais: any[] = [];

        if (portal.tipo === "api" && portal.nome === "PNCP Federal") {
          editais = await coletarPNCP(portal);
        } else if (portal.tipo === "api" && portal.nome === "ComprasNet Federal") {
          editais = await coletarComprasNet(portal);
        } else if (portal.tipo === "api" && portal.nome === "Querido Diário") {
          editais = await coletarQueridoDiario(portal);
        } else if (portal.tipo === "api" && portal.nome === "BLL") {
          editais = await coletarBLL(portal);
        } else if (portal.tipo === "rss") {
          editais = await coletarRSS(portal);
        } else if (portal.tipo === "scraping") {
          editais = await coletarViaFirecrawl(portal);
        }

        let inseridos = 0;
        for (const edital of editais) {
          const segmento = await classificarSegmento(edital.objeto);

          const { error: upsertError } = await supabase
            .from("editais_coletados")
            .upsert(
              {
                ...edital,
                portal_id: portal.id,
                segmento_codigo: segmento.codigo,
                segmento_nome: segmento.nome,
                palavras_chave: segmento.palavras_chave,
              },
              { onConflict: "identificador_ext", ignoreDuplicates: true }
            );

          if (!upsertError) inseridos++;
        }

        await supabase
          .from("portais_monitorados")
          .update({ ultima_coleta: new Date().toISOString() })
          .eq("id", portal.id);

        resultados.push({
          portal: portal.nome,
          coletados: editais.length,
          inseridos,
          status: "ok",
        });

        console.log(`[COLETAR] ${portal.nome}: ${editais.length} editais coletados, ${inseridos} inseridos`);
      } catch (e) {
        console.error(`[COLETAR] Erro no portal ${portal.nome}:`, e);
        resultados.push({
          portal: portal.nome,
          coletados: 0,
          inseridos: 0,
          status: "erro",
          erro: String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[COLETAR] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── COLETA PNCP ──────────────────────────────────────────────
async function coletarPNCP(portal: any) {
  const hoje = new Date().toISOString().split("T")[0];
  const ontem = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const ufs = ["PA", "AM", "AC", "RO", "RR", "AP", "TO", "MA", "MT", "GO", "DF", "SP", "RJ", "MG", "BA", "CE", "PE", "PR", "SC", "RS"];
  const editais: any[] = [];

  for (const uf of ufs) {
    try {
      const url = `${portal.endpoint_api}?dataInicial=${ontem}&dataFinal=${hoje}&pagina=1&tamanhoPagina=50&uf=${uf}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();

      for (const item of data?.data ?? []) {
        editais.push({
          identificador_ext: "pncp_" + item.numeroControlePNCP,
          modalidade: item.modalidadeNome,
          numero: item.numeroCompra,
          orgao: item.orgaoEntidade?.razaoSocial || "Não informado",
          uf: item.unidadeOrgao?.ufSigla,
          municipio: item.unidadeOrgao?.municipioNome,
          objeto: item.objetoCompra || "Objeto não informado",
          valor_estimado: item.valorTotalEstimado,
          data_abertura: item.dataAberturaLances || item.dataInicial,
          data_publicacao: item.dataPublicacaoPncp,
          url_edital: "https://pncp.gov.br/app/editais/" + item.numeroControlePNCP,
        });
      }
    } catch (e) {
      console.error(`[PNCP] Erro UF ${uf}:`, e);
    }
  }
  return editais;
}

// ── COLETA COMPRASNET ────────────────────────────────────────
async function coletarComprasNet(portal: any) {
  try {
    const resp = await fetch(`${portal.endpoint_api}?offset=0&limit=50`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?._embedded?.licitacoes ?? []).map((item: any) => ({
      identificador_ext: "comprasnet_" + item.identificador,
      modalidade: item.modalidade,
      numero: item.numero,
      orgao: item.uasg_nome || "Não informado",
      uf: item.uf,
      municipio: item.municipio,
      objeto: item.objeto || "Objeto não informado",
      valor_estimado: item.valor_estimado,
      data_abertura: item.data_abertura_proposta,
      data_publicacao: item.data_publicacao,
      url_edital: item.link_edital || portal.url_base,
    }));
  } catch (e) {
    console.error("[ComprasNet] Erro:", e);
    return [];
  }
}

// ── COLETA QUERIDO DIÁRIO ────────────────────────────────────
async function coletarQueridoDiario(portal: any) {
  try {
    const ontem = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const url = `${portal.endpoint_api}?published_since=${ontem}&querystring=licitação%20pregão&size=30`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.gazettes ?? []).map((g: any) => ({
      identificador_ext: "qd_" + g.territory_id + "_" + g.date + "_" + (g.edition || Date.now()),
      objeto: g.excerpts?.[0] || g.territory_name + " - Aviso de Licitação",
      orgao: g.territory_name || "Não informado",
      uf: g.state_code,
      data_publicacao: g.date,
      url_edital: g.url,
      modalidade: "Diário Oficial",
    }));
  } catch (e) {
    console.error("[Querido Diário] Erro:", e);
    return [];
  }
}

// ── COLETA BLL ───────────────────────────────────────────────
async function coletarBLL(portal: any) {
  try {
    const resp = await fetch(`${portal.endpoint_api}?page=1&per_page=30`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.data ?? data ?? []).map((item: any) => ({
      identificador_ext: "bll_" + (item.id || item.numero || Date.now()),
      modalidade: item.modalidade || "Pregão Eletrônico",
      numero: item.numero,
      orgao: item.orgao || "Não informado",
      uf: item.uf,
      municipio: item.municipio,
      objeto: item.objeto || "Objeto não informado",
      valor_estimado: item.valor_estimado,
      data_abertura: item.data_abertura,
      data_publicacao: item.data_publicacao || new Date().toISOString(),
      url_edital: item.url || portal.url_base,
    }));
  } catch (e) {
    console.error("[BLL] Erro:", e);
    return [];
  }
}

// ── COLETA RSS (Licitanet, etc) ──────────────────────────────
async function coletarRSS(portal: any) {
  try {
    const resp = await fetch(portal.endpoint_api);
    if (!resp.ok) return [];
    const text = await resp.text();
    const items = text.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    return items.slice(0, 50).map((item: string) => {
      const get = (tag: string) => {
        const match = item.match(
          new RegExp(
            `<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}>([\\s\\S]*?)<\\/${tag}>`
          )
        );
        return match?.[1] || match?.[2] || "";
      };
      return {
        identificador_ext: portal.nome.toLowerCase().replace(/\s/g, "_") + "_" + (get("guid") || get("link") || Date.now()),
        objeto: get("title") || "Sem título",
        orgao: get("author") || get("dc:creator") || portal.nome,
        url_edital: get("link"),
        data_publicacao: get("pubDate") ? new Date(get("pubDate")).toISOString() : new Date().toISOString(),
        modalidade: "Pregão Eletrônico",
      };
    });
  } catch (e) {
    console.error("[RSS] Erro:", e);
    return [];
  }
}

// ── COLETA VIA FIRECRAWL (TCM-PA, BanParaNet, etc) ───────────
async function coletarViaFirecrawl(portal: any) {
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_KEY) {
    console.warn(`[FIRECRAWL] API key não configurada, pulando ${portal.nome}`);
    return [];
  }

  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + FIRECRAWL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: portal.endpoint_api,
        formats: ["json"],
        jsonOptions: {
          schema: {
            type: "object",
            properties: {
              editais: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    numero: { type: "string" },
                    orgao: { type: "string" },
                    objeto: { type: "string" },
                    data_abertura: { type: "string" },
                    url_edital: { type: "string" },
                    url_pdf: { type: "string" },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!resp.ok) {
      console.error(`[FIRECRAWL] HTTP ${resp.status} para ${portal.nome}`);
      return [];
    }

    const data = await resp.json();
    return (data?.data?.editais ?? []).map((e: any) => ({
      ...e,
      orgao: e.orgao || "Não informado",
      objeto: e.objeto || "Objeto não informado",
      identificador_ext: portal.nome.toLowerCase().replace(/\s/g, "_") + "_" + (e.numero || Date.now()),
      uf: portal.uf,
      modalidade: "Pregão Eletrônico",
      data_publicacao: new Date().toISOString(),
    }));
  } catch (e) {
    console.error(`[FIRECRAWL] Erro ${portal.nome}:`, e);
    return [];
  }
}

// ── CLASSIFICAR SEGMENTO VIA LOVABLE AI (Gemini Flash) ───────
async function classificarSegmento(objeto: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return classificarPorPalavrasChave(objeto);
  }

  try {
    const resp = await fetch("https://lovable.dev/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Classifique o objeto de licitação e retorne SOMENTE JSON puro sem markdown: " +
              '{"codigo":"TI-001","nome":"Equipamentos de informática","palavras_chave":["computador","notebook"]}. ' +
              "Códigos: ALI-001 Alimentos, ALI-002 Cestas Básicas, ALI-003 Merenda Escolar, ALI-004 Carnes, ALI-005 Hortifruti, ALI-006 Bebidas, " +
              "TI-001 Equip.Informática, TI-002 Software, TI-003 Redes, TI-004 Impressoras, TI-005 Serviços TI, " +
              "LIM-001 Materiais Limpeza, LIM-002 Serviço Limpeza, LIM-003 Higiene, LIM-004 Descartáveis, " +
              "ESC-001 Mat.Escritório, ESC-002 Mob.Escritório, " +
              "MED-001 Medicamentos, MED-002 Equip.Hospitalares, MED-003 Mat.Lab, " +
              "OBR-001 Obras Civis, OBR-002 Reforma, OBR-003 Pavimentação, " +
              "VEI-001 Veículos, VEI-002 Peças/Pneus, COM-001 Combustíveis, UNI-001 Uniformes/Fardamento, " +
              "GRA-001 Gráfica, EVE-001 Eventos, SEG-001 Seg.Patrimonial. Se não enquadrar: OUTROS.",
          },
          { role: "user", content: "Objeto: " + objeto.substring(0, 500) },
        ],
      }),
    });

    if (!resp.ok) {
      console.warn("[CLASSIFICAR] AI indisponível, usando palavras-chave");
      return classificarPorPalavrasChave(objeto);
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return classificarPorPalavrasChave(objeto);
  } catch (e) {
    console.warn("[CLASSIFICAR] Fallback por palavras-chave:", e);
    return classificarPorPalavrasChave(objeto);
  }
}

// ── FALLBACK: classificação por palavras-chave ───────────────
function classificarPorPalavrasChave(objeto: string) {
  const obj = objeto.toLowerCase();
  const regras: [RegExp, { codigo: string; nome: string; palavras_chave: string[] }][] = [
    [/computador|notebook|monitor|servidor|desktop|switch|roteador|firewall/, { codigo: "TI-001", nome: "Equipamentos de Informática", palavras_chave: ["computador", "notebook", "monitor"] }],
    [/software|licen[cç]a|sistema|microsoft|windows|antiv[ií]rus/, { codigo: "TI-002", nome: "Software e Licenças", palavras_chave: ["software", "licença", "sistema"] }],
    [/impressora|toner|cartucho|multifuncional/, { codigo: "TI-004", nome: "Impressoras e Suprimentos", palavras_chave: ["impressora", "toner", "cartucho"] }],
    [/cesta\s*b[áa]sica|aliment[oa]|g[êe]nero|merenda/, { codigo: "ALI-002", nome: "Cestas Básicas / Alimentos", palavras_chave: ["cesta básica", "alimento", "gênero"] }],
    [/carne|frango|peixe|bovino|su[ií]no/, { codigo: "ALI-004", nome: "Carnes e Derivados", palavras_chave: ["carne", "frango", "bovino"] }],
    [/medicamento|f[áa]rmaco|rem[ée]dio|comprimido/, { codigo: "MED-001", nome: "Medicamentos", palavras_chave: ["medicamento", "fármaco"] }],
    [/hospitalar|cir[úu]rgico|m[ée]dico.*equip|autoclave/, { codigo: "MED-002", nome: "Equipamentos Hospitalares", palavras_chave: ["hospitalar", "cirúrgico"] }],
    [/limpeza|detergente|desinfetante|saneante/, { codigo: "LIM-001", nome: "Materiais de Limpeza", palavras_chave: ["limpeza", "detergente"] }],
    [/escrit[óo]rio|papel.*a4|caneta|l[áa]pis|grampeador/, { codigo: "ESC-001", nome: "Material de Escritório", palavras_chave: ["escritório", "papel", "caneta"] }],
    [/ve[ií]culo|autom[óo]vel|caminh[ãa]o|[ôo]nibus/, { codigo: "VEI-001", nome: "Veículos", palavras_chave: ["veículo", "automóvel"] }],
    [/pneu|pe[çc]a.*ve[ií]cul|lubrificante|[óo]leo.*motor/, { codigo: "VEI-002", nome: "Peças e Pneus", palavras_chave: ["pneu", "peça", "lubrificante"] }],
    [/combust[ií]vel|gasolina|diesel|etanol|abastecimento/, { codigo: "COM-001", nome: "Combustíveis", palavras_chave: ["combustível", "gasolina", "diesel"] }],
    [/obra|constru[çc][ãa]o|engenharia|edifica[çc]/, { codigo: "OBR-001", nome: "Obras Civis", palavras_chave: ["obra", "construção"] }],
    [/reforma|manuten[çc][ãa]o.*predial|pintura.*predial/, { codigo: "OBR-002", nome: "Reforma e Manutenção Predial", palavras_chave: ["reforma", "manutenção predial"] }],
    [/pavimenta[çc]|asfalto|drenagem|terraplanagem/, { codigo: "OBR-003", nome: "Pavimentação", palavras_chave: ["pavimentação", "asfalto"] }],
    [/uniforme|fardamento|vestimenta|camisa.*farda/, { codigo: "UNI-001", nome: "Uniformes e Fardamento", palavras_chave: ["uniforme", "fardamento"] }],
    [/gr[áa]fica|impress[ãa]o.*gr[áa]f|encaderna/, { codigo: "GRA-001", nome: "Serviços Gráficos", palavras_chave: ["gráfica", "impressão"] }],
    [/evento|coffee.*break|buffet|sonoriza[çc]/, { codigo: "EVE-001", nome: "Eventos", palavras_chave: ["evento", "coffee break"] }],
    [/vigil[âa]ncia|seguran[çc]a.*patrimon|portaria|monitoramento.*cftv/, { codigo: "SEG-001", nome: "Segurança Patrimonial", palavras_chave: ["vigilância", "segurança"] }],
  ];

  for (const [regex, resultado] of regras) {
    if (regex.test(obj)) return resultado;
  }

  return { codigo: "OUTROS", nome: "Outros", palavras_chave: [] };
}
