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
  if (!segmentos || segmentos.length === 0) return true;
  const tituloLower = titulo?.toLowerCase() || '';
  return segmentos.some(segId => {
    const keywords = SEGMENTO_KEYWORDS[segId] || [];
    return keywords.some(kw => tituloLower.includes(kw.toLowerCase()));
  });
}

// Fetch filtered licitações for a subscriber
async function fetchLicitacoes(supabase: any, tipo: string, sub: any) {
  const segmentos = sub.segmentos || [];
  const ufsInteresse = sub.ufs_interesse || [];
  const filtrarPorCnpj = sub.filtrar_alteracoes_por_cnpj ?? false;
  const filtrarPorParticipacao = sub.filtrar_resultados_por_participacao ?? false;

  let query = supabase
    .from("monitoramento_editais")
    .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, status, numero_processo, modalidade, objeto, codigo_uasg, portal")
    .order("created_at", { ascending: false })
    .limit(50);

  if (ufsInteresse.length > 0) {
    query = query.in("uf", ufsInteresse);
  }

  if (tipo === "manha") {
    query = query.eq("status", "novo");
  } else if (tipo === "meiodia") {
    query = query.in("status", ["suspenso", "cancelado", "adiado", "alterado"]);
  } else {
    query = query.in("status", ["adjudicado", "homologado", "encerrado"]);
  }

  const { data: licitacoes } = await query;
  let filtered = licitacoes || [];

  if (tipo === "manha" && segmentos.length > 0) {
    filtered = filtered.filter((l: any) => matchesSegmentos(l.titulo || l.objeto, segmentos));
  }

  if (tipo === "meiodia" && filtrarPorCnpj) {
    filtered = await filterByCnpj(supabase, sub, filtered, licitacoes || []);
  }

  if (tipo === "tarde" && filtrarPorParticipacao) {
    filtered = await filterByParticipacao(supabase, sub, filtered);
  }

  return filtered.slice(0, 20);
}

async function filterByCnpj(supabase: any, sub: any, filtered: any[], allLicitacoes: any[]) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_ativa_id")
    .eq("user_id", sub.user_id)
    .single();

  if (!profile?.empresa_ativa_id) return filtered;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("cnpj, razao_social, nome_fantasia")
    .eq("id", profile.empresa_ativa_id)
    .single();

  if (!empresa) return filtered;

  const searchTerms = [
    empresa.cnpj?.replace(/\D/g, ''),
    empresa.razao_social?.toLowerCase(),
    empresa.nome_fantasia?.toLowerCase(),
  ].filter(Boolean) as string[];

  let result = filtered.filter((l: any) => {
    const texto = `${l.titulo} ${l.orgao}`.toLowerCase();
    return searchTerms.some(term => texto.includes(term));
  });

  const { data: userLicitacoes } = await supabase
    .from("licitacoes")
    .select("numero, orgao, objeto")
    .eq("user_id", sub.user_id)
    .not("status", "eq", "arquivado");

  if (userLicitacoes?.length) {
    const userNumeros = userLicitacoes.map((l: any) => l.numero).filter(Boolean);
    const existing = new Set(result.map((l: any) => l.titulo));
    for (const l of allLicitacoes) {
      if (!existing.has(l.titulo) && userNumeros.some((num: string) => l.titulo?.includes(num))) {
        result.push(l);
      }
    }
  }

  return result;
}

async function filterByParticipacao(supabase: any, sub: any, filtered: any[]) {
  const { data: userLicitacoes } = await supabase
    .from("licitacoes")
    .select("numero, orgao, objeto, empresa_id")
    .eq("user_id", sub.user_id);

  if (!userLicitacoes?.length) return [];

  const userNumeros = userLicitacoes.map((l: any) => l.numero).filter(Boolean);
  const empresaIds = [...new Set(userLicitacoes.map((l: any) => l.empresa_id).filter(Boolean))];

  let cnpjs: string[] = [];
  if (empresaIds.length > 0) {
    const { data: empresas } = await supabase
      .from("empresas")
      .select("cnpj")
      .in("id", empresaIds as string[]);
    cnpjs = (empresas || []).map((e: any) => e.cnpj?.replace(/\D/g, '')).filter(Boolean);
  }

  return filtered.filter((l: any) => {
    const tituloLower = l.titulo?.toLowerCase() || '';
    if (userNumeros.some((num: string) => tituloLower.includes(num.toLowerCase()))) return true;
    if (cnpjs.some((cnpj: string) => tituloLower.includes(cnpj))) return true;
    return false;
  });
}

// Send one email per licitação
async function sendIndividualEmails(
  supabaseUrl: string, 
  supabaseServiceKey: string, 
  supabase: any, 
  sub: any, 
  tipo: string, 
  licitacoes: any[]
) {
  const results = [];

  for (const lic of licitacoes) {
    try {
      const templateData: Record<string, any> = {
        tipo,
        data: new Date().toLocaleDateString("pt-BR"),
        numero_pregao: lic.numero_processo || lic.titulo || '',
        orgao: lic.orgao || '',
        codigo_uasg: lic.codigo_uasg || '',
        objeto: lic.objeto || lic.titulo || '',
        municipio: lic.municipio || '',
        uf: lic.uf || '',
        valor_estimado: lic.valor_estimado ? `R$ ${Number(lic.valor_estimado).toLocaleString("pt-BR")}` : '',
        data_abertura: lic.data_abertura || '',
        modalidade: lic.modalidade || '',
        portal: lic.portal || '',
      };

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
          templateData,
        }),
      });

      const ok = invokeRes.ok;
      const body = await invokeRes.text().catch(() => '');
      results.push({ titulo: lic.titulo, success: ok, error: ok ? null : `HTTP ${invokeRes.status}: ${body}` });
    } catch (err: any) {
      results.push({ titulo: lic.titulo, success: false, error: err.message });
    }
  }

  return results;
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

    const allResults = [];

    for (const sub of subscribers) {
      try {
        const licitacoes = await fetchLicitacoes(supabase, tipo, sub);

        if (licitacoes.length === 0) {
          allResults.push({ email: sub.email, success: true, licitacoes_count: 0, detail: "Nenhuma licitação encontrada" });
          continue;
        }

        const sendResults = await sendIndividualEmails(supabaseUrl, supabaseServiceKey, supabase, sub, tipo, licitacoes);

        const successCount = sendResults.filter(r => r.success).length;
        const failCount = sendResults.filter(r => !r.success).length;

        // Log the batch
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo,
          email: sub.email,
          status: failCount === 0 ? "enviado" : failCount === sendResults.length ? "erro" : "parcial",
          erro: failCount > 0 ? `${failCount}/${sendResults.length} falharam` : null,
        });

        allResults.push({ email: sub.email, success: true, licitacoes_count: licitacoes.length, emails_sent: successCount, emails_failed: failCount });
      } catch (err: any) {
        allResults.push({ email: sub.email, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ sent: allResults.filter(r => r.success).length, total: allResults.length, results: allResults }),
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
