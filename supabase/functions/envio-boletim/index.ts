import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BoletimRequest {
  tipo: "manha" | "meiodia" | "tarde";
  user_id?: string;
}

// Mapping of segment IDs to search keywords for filtering
const SEGMENTO_KEYWORDS: Record<string, string[]> = {
  generos_alimenticios: ['aliment', 'merenda', 'cesta básica', 'cesta basica', 'perecív', 'pereciv', 'hortifruti', 'gênero', 'genero', 'refeição', 'refeicao', 'rancho'],
  informatica: ['informática', 'informatica', 'computador', 'notebook', 'servidor', 'software', 'rede', 'impressora', 'toner', 'cartucho', 'monitor', 'tecnologia da informação', 'suprimento de informática', 'switch', 'firewall'],
  higiene_limpeza: ['limpeza', 'higiene', 'higienização', 'desinfetante', 'detergente', 'saneante', 'produto químico'],
  descartaveis: ['descartáv', 'descartav', 'copo descart', 'luva descart', 'embalagem', 'sacola'],
  material_escritorio: ['escritório', 'escritorio', 'papelaria', 'papel a4', 'caneta', 'material de expediente'],
  medicamentos: ['medicament', 'fármaco', 'farmaco', 'hospitalar', 'insumo hospitalar', 'saúde', 'saude', 'laboratorial', 'material médico', 'material medico'],
  construcao: ['construção', 'construcao', 'obra', 'engenharia', 'cimento', 'material de construção', 'reforma', 'pavimentação'],
  veiculos: ['veículo', 'veiculo', 'automóvel', 'automovel', 'combustível', 'combustivel', 'manutenção de veículo', 'peça automotiva', 'pneu', 'lubrificante'],
  mobiliario: ['mobiliário', 'mobiliario', 'móvel', 'movel', 'cadeira', 'mesa', 'estante', 'armário', 'armario'],
  uniformes: ['uniforme', 'fardamento', 'vestuário', 'vestuario', 'calçado', 'calcado', 'epi', 'equipamento de proteção'],
  servicos_gerais: ['serviço de limpeza', 'vigilância', 'vigilancia', 'manutenção predial', 'conservação', 'portaria', 'terceirização', 'terceirizacao'],
  servicos_ti: ['serviço de ti', 'desenvolvimento de sistema', 'suporte técnico', 'suporte tecnico', 'cloud', 'outsourcing', 'hosting', 'consultoria em ti'],
  grafica: ['gráfica', 'grafica', 'impressão', 'impressao', 'material gráfico', 'banner', 'adesivo', 'serigrafia'],
  eletroeletronicos: ['eletroeletrônic', 'eletroeletronic', 'ar-condicionado', 'eletrodoméstic', 'eletrodomestic', 'áudio', 'audio', 'vídeo', 'video'],
  equipamentos_industriais: ['máquina', 'maquina', 'ferramenta', 'equipamento industrial', 'equipamento pesado', 'gerador', 'compressor'],
};

function matchesSegmentos(titulo: string, segmentos: string[]): boolean {
  if (!segmentos || segmentos.length === 0) return true; // no filter = all
  const tituloLower = titulo?.toLowerCase() || '';
  return segmentos.some(segId => {
    const keywords = SEGMENTO_KEYWORDS[segId] || [];
    return keywords.some(kw => tituloLower.includes(kw.toLowerCase()));
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tipo, user_id }: BoletimRequest = await req.json();

    const prefColumn = tipo === "manha" ? "boletim_manha" : tipo === "meiodia" ? "boletim_meiodia" : "boletim_tarde";

    let query = supabase
      .from("boletim_preferencias")
      .select("user_id, email, segmentos, ufs_interesse, filtrar_alteracoes_por_cnpj, filtrar_resultados_por_participacao")
      .eq(prefColumn, true);

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: subscribers, error: subError } = await query;
    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum assinante para este boletim", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const sub of subscribers) {
      try {
        const segmentos = (sub as any).segmentos || [];
        const ufsInteresse = (sub as any).ufs_interesse || [];
        const filtrarPorCnpj = (sub as any).filtrar_alteracoes_por_cnpj ?? false;
        const filtrarPorParticipacao = (sub as any).filtrar_resultados_por_participacao ?? false;

        // Build the query for licitações based on tipo
        let licitacoesQuery = supabase
          .from("monitoramento_editais")
          .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, status")
          .order("created_at", { ascending: false })
          .limit(50);

        // Apply UF filter if set
        if (ufsInteresse.length > 0) {
          licitacoesQuery = licitacoesQuery.in("uf", ufsInteresse);
        }

        if (tipo === "manha") {
          // Morning: new tenders, filtered by segments and UF
          licitacoesQuery = licitacoesQuery.eq("status", "novo");
        } else if (tipo === "meiodia") {
          // Midday: changes, suspensions, cancellations
          licitacoesQuery = licitacoesQuery.in("status", ["suspenso", "cancelado", "adiado", "alterado"]);
        } else {
          // Afternoon: results, homologations
          licitacoesQuery = licitacoesQuery.in("status", ["adjudicado", "homologado", "encerrado"]);
        }

        const { data: licitacoes } = await licitacoesQuery;

        let filteredLicitacoes = licitacoes || [];

        // Apply segment filter for morning bulletin
        if (tipo === "manha" && segmentos.length > 0) {
          filteredLicitacoes = filteredLicitacoes.filter(l => matchesSegmentos(l.titulo, segmentos));
        }

        // For meio-dia: filter by user's CNPJ/razão social if enabled
        if (tipo === "meiodia" && filtrarPorCnpj) {
          // Get user's empresa info
          const { data: profile } = await supabase
            .from("profiles")
            .select("empresa_ativa_id")
            .eq("user_id", sub.user_id)
            .single();

          if (profile?.empresa_ativa_id) {
            const { data: empresa } = await supabase
              .from("empresas")
              .select("cnpj, razao_social, nome_fantasia")
              .eq("id", profile.empresa_ativa_id)
              .single();

            if (empresa) {
              const searchTerms = [
                empresa.cnpj?.replace(/\D/g, ''),
                empresa.razao_social?.toLowerCase(),
                empresa.nome_fantasia?.toLowerCase(),
              ].filter(Boolean) as string[];

              // Also check monitoramento_editais with text search in titulo/orgao
              filteredLicitacoes = filteredLicitacoes.filter(l => {
                const textoCompleto = `${l.titulo} ${l.orgao}`.toLowerCase();
                return searchTerms.some(term => textoCompleto.includes(term!));
              });

              // Additionally, search in the user's tracked licitações
              const { data: userLicitacoes } = await supabase
                .from("licitacoes")
                .select("numero, orgao, objeto")
                .eq("user_id", sub.user_id)
                .not("status", "eq", "arquivado");

              if (userLicitacoes && userLicitacoes.length > 0) {
                const userNumeros = userLicitacoes.map(l => l.numero).filter(Boolean);
                // Include any licitação whose titulo matches a tracked process number
                const additionalMatches = (licitacoes || []).filter(l => {
                  return userNumeros.some(num => l.titulo?.includes(num!));
                });
                // Merge without duplicates
                const existingTitulos = new Set(filteredLicitacoes.map(l => l.titulo));
                additionalMatches.forEach(m => {
                  if (!existingTitulos.has(m.titulo)) {
                    filteredLicitacoes.push(m);
                  }
                });
              }
            }
          }
        }

        // For tarde: filter by participation history if enabled
        if (tipo === "tarde" && filtrarPorParticipacao) {
          // Get user's participated licitações
          const { data: userLicitacoes } = await supabase
            .from("licitacoes")
            .select("numero, orgao, objeto, empresa_id")
            .eq("user_id", sub.user_id);

          if (userLicitacoes && userLicitacoes.length > 0) {
            const userNumeros = userLicitacoes.map(l => l.numero).filter(Boolean);
            const userOrgaos = userLicitacoes.map(l => l.orgao?.toLowerCase()).filter(Boolean);

            // Also get empresa CNPJ for cross-reference
            const empresaIds = [...new Set(userLicitacoes.map(l => l.empresa_id).filter(Boolean))];
            let cnpjs: string[] = [];
            if (empresaIds.length > 0) {
              const { data: empresas } = await supabase
                .from("empresas")
                .select("cnpj")
                .in("id", empresaIds as string[]);
              cnpjs = (empresas || []).map(e => e.cnpj?.replace(/\D/g, '')).filter(Boolean) as string[];
            }

            filteredLicitacoes = filteredLicitacoes.filter(l => {
              const tituloLower = l.titulo?.toLowerCase() || '';
              const orgaoLower = l.orgao?.toLowerCase() || '';
              // Match by process number
              if (userNumeros.some(num => tituloLower.includes(num!.toLowerCase()))) return true;
              // Match by orgão + CNPJ in text
              if (cnpjs.some(cnpj => tituloLower.includes(cnpj!))) return true;
              return false;
            });
          } else {
            // No participation history — send empty
            filteredLicitacoes = [];
          }
        }

        // Limit to 20 results for the email
        filteredLicitacoes = filteredLicitacoes.slice(0, 20);

        // Send via transactional email
        const invokeRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({
            templateName: 'boletim-diario',
            recipientEmail: sub.email,
            templateData: {
              tipo,
              data: new Date().toLocaleDateString("pt-BR"),
              licitacoes: filteredLicitacoes.map(l => ({
                titulo: l.titulo,
                orgao: l.orgao,
                municipio: l.municipio,
                uf: l.uf,
                valor: l.valor_estimado ? `R$ ${Number(l.valor_estimado).toLocaleString("pt-BR")}` : '–',
              })),
            },
          }),
        });

        const invokeOk = invokeRes.ok;
        const invokeBody = await invokeRes.text().catch(() => '');
        const invokeErr = invokeOk ? null : `HTTP ${invokeRes.status}: ${invokeBody}`;

        // Log the send
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo,
          email: sub.email,
          status: invokeErr ? "erro" : "enviado",
          erro: invokeErr || null,
        });

        results.push({ email: sub.email, success: invokeOk, licitacoes_count: filteredLicitacoes.length });
      } catch (err: any) {
        results.push({ email: sub.email, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.success).length, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no envio de boletim:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
