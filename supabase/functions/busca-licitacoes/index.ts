import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function gerarDadosExemplo(query: string, uf: string, modalidade: string) {
  const orgaos = [
    "Prefeitura Municipal de Belém",
    "Secretaria de Educação do Estado do Pará",
    "Tribunal de Justiça do Estado do Pará",
    "UFPA - Universidade Federal do Pará",
    "Prefeitura Municipal de Marabá",
    "SESPA - Secretaria de Saúde do Pará",
    "Prefeitura Municipal de Ananindeua",
    "SEDUC - Secretaria de Educação",
    "Prefeitura Municipal de Santarém",
    "IFPA - Instituto Federal do Pará",
  ];
  const objetos = [
    `Aquisição de ${query || "materiais diversos"} para atendimento das necessidades do órgão`,
    `Contratação de empresa especializada em ${query || "serviços gerais"}`,
    `Pregão eletrônico para fornecimento de ${query || "equipamentos"}`,
    `Registro de preços para aquisição de ${query || "gêneros alimentícios"}`,
    `Contratação de serviços de ${query || "manutenção predial"}`,
    `Aquisição de ${query || "material de expediente"} e suprimentos`,
    `Prestação de serviços de ${query || "tecnologia da informação"}`,
    `Fornecimento de ${query || "equipamentos hospitalares"}`,
  ];
  const municipios = ["Belém", "Marabá", "Ananindeua", "Santarém", "Castanhal", "Parauapebas", "Altamira", "Cametá"];
  const statusList = ["Aberto", "Em andamento", "Publicado"];

  const items = [];
  const count = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const now = new Date();
    const daysAhead = Math.floor(Math.random() * 30) + 5;
    const dataAbertura = new Date(now.getTime() + daysAhead * 86400000);
    const valor = Math.floor(Math.random() * 5000000) + 50000;
    items.push({
      numero: `PE ${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}/${now.getFullYear()}`,
      orgao: orgaos[Math.floor(Math.random() * orgaos.length)],
      objeto: objetos[Math.floor(Math.random() * objetos.length)],
      modalidade: modalidade || "Pregão Eletrônico",
      status: statusList[Math.floor(Math.random() * statusList.length)],
      valor_estimado: valor,
      uf: uf || "PA",
      municipio: municipios[Math.floor(Math.random() * municipios.length)],
      data_abertura: dataAbertura.toISOString().split("T")[0],
      portal: "PNCP",
      url: "https://pncp.gov.br",
    });
  }
  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, uf, modalidade, pagina } = await req.json();

    // Tentar API real do PNCP
    const params = new URLSearchParams();
    if (query) params.set("termoPesquisa", query);
    if (uf) params.set("uf", uf);
    if (modalidade) params.set("codigoModalidadeContratacao", modalidade === "Pregão Eletrônico" ? "6" : "");
    params.set("pagina", String(pagina || 1));
    params.set("tamanhoPagina", "20");

    let items: any[] = [];
    let total = 0;
    let fonte = "pncp";

    try {
      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        items = data.data || data.resultado || data.items || [];
        total = data.totalRegistros || data.total || items.length;
      } else {
        await response.text(); // consume body
        throw new Error(`PNCP status ${response.status}`);
      }
    } catch (apiError) {
      console.warn("PNCP indisponível, gerando dados de demonstração:", apiError);
      items = gerarDadosExemplo(query || "", uf || "PA", modalidade || "Pregão Eletrônico");
      total = items.length;
      fonte = "demonstracao";
    }

    return new Response(JSON.stringify({
      items,
      total,
      pagina: pagina || 1,
      fonte,
      mensagem: fonte === "demonstracao"
        ? "Dados de demonstração — API do PNCP temporariamente indisponível."
        : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Licitacoes search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na busca" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
