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

interface LicitacaoUnificada {
  titulo: string;
  orgao: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  status: string | null;
  numero_processo: string | null;
  modalidade: string | null;
  objeto: string | null;
  codigo_uasg: string | null;
  portal: string | null;
  url_edital: string | null;
  url_portal: string | null;
  fonte: string;
  urgencia?: 'critica' | 'alta' | 'normal';
  horas_restantes?: number;
}

function parseDataAberturaSimples(raw: string | null): Date | null {
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, h = '09', min = '00'] = isoMatch;
    return new Date(`${y}-${m}-${d}T${h}:${min}:00-03:00`);
  }
  const brMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yy] = brMatch;
    const timeMatch = raw.match(/(\d{2}):(\d{2})/);
    return new Date(`${yy}-${mm}-${dd}T${timeMatch ? timeMatch[1] : '09'}:${timeMatch ? timeMatch[2] : '00'}:00-03:00`);
  }
  return null;
}

function classificarUrgencia(lic: LicitacaoUnificada): LicitacaoUnificada {
  const dataAb = parseDataAberturaSimples(lic.data_abertura);
  if (!dataAb) return { ...lic, urgencia: 'normal' };
  const horas = Math.max(0, Math.round((dataAb.getTime() - Date.now()) / (1000 * 60 * 60)));
  if (horas <= 24) return { ...lic, urgencia: 'critica', horas_restantes: horas };
  if (horas <= 72) return { ...lic, urgencia: 'alta', horas_restantes: horas };
  return { ...lic, urgencia: 'normal', horas_restantes: horas };
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

function matchesSegmentos(texto: string, segmentos: string[]): boolean {
  if (!segmentos || segmentos.length === 0) return true;
  const textoLower = texto?.toLowerCase() || '';
  return segmentos.some(segId => {
    const keywords = SEGMENTO_KEYWORDS[segId] || [];
    return keywords.some(kw => textoLower.includes(kw.toLowerCase()));
  });
}

// ═══════════════════════════════════════════════
// Fetch from monitoramento_editais
// ═══════════════════════════════════════════════
async function fetchMonitoramentoEditais(supabase: any, tipo: string, ufsInteresse: string[]): Promise<LicitacaoUnificada[]> {
  let query = supabase
    .from("monitoramento_editais")
    .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, status, numero_processo, modalidade, objeto, codigo_uasg, portal, url_edital")
    .order("created_at", { ascending: false })
    .limit(200);

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

  const { data } = await query;
  return (data || []).map((l: any) => ({
    titulo: l.titulo || l.objeto || '',
    orgao: l.orgao || '',
    valor_estimado: l.valor_estimado,
    uf: l.uf,
    municipio: l.municipio,
    data_abertura: l.data_abertura,
    status: l.status,
    numero_processo: l.numero_processo,
    modalidade: l.modalidade,
    objeto: l.objeto || l.titulo,
    codigo_uasg: l.codigo_uasg,
    portal: l.portal,
    url_edital: l.url_edital || null,
    url_portal: null,
    fonte: 'monitoramento',
  }));
}

// ═══════════════════════════════════════════════
// Fetch from pncp_editais_cache (PNCP + Comprasnet)
// ═══════════════════════════════════════════════
async function fetchPncpEditaisCache(supabase: any, tipo: string, ufsInteresse: string[]): Promise<LicitacaoUnificada[]> {
  // Get editais published in the last 24h
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemISO = ontem.toISOString();

  let query = supabase
    .from("pncp_editais_cache")
    .select("objeto, orgao, valor_total_estimado, uf, municipio, data_abertura_proposta, situacao, numero_compra, modalidade_nome, uasg_codigo, fonte, link_comprasnet, link_sistema_origem, data_publicacao_pncp, lei_base, cnpj_orgao")
    .gte("created_at", ontemISO)
    .order("created_at", { ascending: false })
    .limit(500);

  if (ufsInteresse.length > 0) {
    query = query.in("uf", ufsInteresse);
  }

  // Filter by situacao based on tipo
  if (tipo === "manha") {
    // New tenders — any situation that indicates open/published
    query = query.in("situacao", ["Divulgada no PNCP", "Aberta", "Publicada", "divulgada", "Em andamento", "Suspensa e Reaberta"]);
  } else if (tipo === "meiodia") {
    query = query.in("situacao", ["Suspensa", "Revogada", "Anulada", "Retificada", "Adiada"]);
  } else {
    query = query.in("situacao", ["Homologada", "Adjudicada", "Encerrada", "Concluída", "Deserta", "Fracassada"]);
  }

  const { data } = await query;
  return (data || []).map((r: any) => {
    const numero = r.numero_compra || '';
    const modalidade = r.modalidade_nome || '';
    const tituloFormatado = modalidade && numero
      ? `${modalidade} Nº ${numero}`
      : numero || modalidade || 'Processo sem número';

    // Build best URL available
    const urlEdital = r.link_sistema_origem || null;
    const urlPortal = r.link_comprasnet ||
      (r.cnpj_orgao && numero ? `https://pncp.gov.br/app/editais/${r.cnpj_orgao}/${new Date().getFullYear()}/${numero}` : null) ||
      (numero ? `https://pncp.gov.br/app/editais?q=${encodeURIComponent(numero)}` : null);

    return {
      titulo: tituloFormatado,
      orgao: r.orgao || '',
      valor_estimado: r.valor_total_estimado,
      uf: r.uf,
      municipio: r.municipio,
      data_abertura: r.data_abertura_proposta,
      status: r.situacao,
      numero_processo: tituloFormatado,
      modalidade: modalidade,
      objeto: r.objeto,
      codigo_uasg: r.uasg_codigo,
      portal: r.link_comprasnet ? 'Compras.gov.br' : 'PNCP',
      url_edital: urlEdital,
      url_portal: urlPortal,
      fonte: r.fonte || 'pncp',
    };
  });
}

// ═══════════════════════════════════════════════
// Merge & deduplicate
// ═══════════════════════════════════════════════
function mergeAndDeduplicate(monitoramento: LicitacaoUnificada[], pncp: LicitacaoUnificada[]): LicitacaoUnificada[] {
  const seen = new Set<string>();
  const result: LicitacaoUnificada[] = [];

  for (const item of [...pncp, ...monitoramento]) {
    const key = `${item.orgao?.toLowerCase()?.slice(0, 30)}|${item.objeto?.toLowerCase()?.slice(0, 50)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════
// Apply subscriber filters
// ═══════════════════════════════════════════════
async function applyFilters(
  supabase: any, tipo: string, sub: any, licitacoes: LicitacaoUnificada[]
): Promise<LicitacaoUnificada[]> {
  const segmentos = sub.segmentos || [];
  let filtered = [...licitacoes];

  // Segment filter for morning
  if (tipo === "manha" && segmentos.length > 0) {
    filtered = filtered.filter(l => matchesSegmentos(l.objeto || l.titulo, segmentos));
  }

  // CNPJ filter for midday
  if (tipo === "meiodia" && (sub.filtrar_alteracoes_por_cnpj ?? false)) {
    filtered = await filterByCnpj(supabase, sub, filtered, licitacoes);
  }

  // Participation filter for afternoon
  if (tipo === "tarde" && (sub.filtrar_resultados_por_participacao ?? false)) {
    filtered = await filterByParticipacao(supabase, sub, filtered);
  }

  // Classify urgency and sort: critica first, then alta, then normal
  filtered = filtered.map(classificarUrgencia);
  filtered.sort((a, b) => {
    const order = { critica: 0, alta: 1, normal: 2 };
    return (order[a.urgencia || 'normal'] ?? 2) - (order[b.urgencia || 'normal'] ?? 2);
  });

  return filtered.slice(0, 50);
}

// ═══════════════════════════════════════════════
// Deduplication: remove editais already sent to this user
// ═══════════════════════════════════════════════
async function deduplicateForUser(
  supabase: any, userId: string, licitacoes: LicitacaoUnificada[]
): Promise<LicitacaoUnificada[]> {
  if (licitacoes.length === 0) return [];

  const janela24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: jaEnviados } = await supabase
    .from("notificacoes_enviadas")
    .select("alerta_ref_id")
    .eq("user_id", userId)
    .eq("canal", "email")
    .in("status", ["enviado", "entregue"])
    .gte("enviado_em", janela24h);

  if (!jaEnviados || jaEnviados.length === 0) return licitacoes;

  const idsEnviados = new Set(jaEnviados.map((n: any) => n.alerta_ref_id));

  return licitacoes.filter(lic => {
    const refId = lic.numero_processo || lic.titulo || '';
    return !idsEnviados.has(refId);
  });
}

// ═══════════════════════════════════════════════
// Generate dynamic subject line
// ═══════════════════════════════════════════════
function generateDynamicSubject(tipo: string, licitacoes: LicitacaoUnificada[], index: number): string {
  const total = licitacoes.length;
  const urgentes = licitacoes.filter(l => l.urgencia === 'critica').length;
  const lic = licitacoes[index];

  // If there's urgency info on this specific item
  if (lic.urgencia === 'critica') {
    const local = [lic.municipio, lic.uf].filter(Boolean).join('/');
    return `URGENTE — ${lic.numero_processo || lic.titulo}${local ? ` - ${local}` : ''} [${index + 1}/${total}]`;
  }

  if (lic.urgencia === 'alta') {
    return `PRAZO — ${lic.numero_processo || lic.titulo} [${index + 1}/${total}]`;
  }

  // Normal — include count context
  const prefix = total > 1 ? `[${index + 1}/${total}] ` : '';
  return `${prefix}${lic.numero_processo || lic.titulo} — ${lic.orgao?.substring(0, 30) || 'Novo edital'}`;
}

async function filterByCnpj(supabase: any, sub: any, filtered: LicitacaoUnificada[], allLicitacoes: LicitacaoUnificada[]) {
  const { data: profile } = await supabase
    .from("profiles").select("empresa_ativa_id").eq("user_id", sub.user_id).single();
  if (!profile?.empresa_ativa_id) return filtered;

  const { data: empresa } = await supabase
    .from("empresas").select("cnpj, razao_social, nome_fantasia").eq("id", profile.empresa_ativa_id).single();
  if (!empresa) return filtered;

  const searchTerms = [
    empresa.cnpj?.replace(/\D/g, ''),
    empresa.razao_social?.toLowerCase(),
    empresa.nome_fantasia?.toLowerCase(),
  ].filter(Boolean) as string[];

  const result = filtered.filter(l => {
    const texto = `${l.titulo} ${l.orgao} ${l.objeto}`.toLowerCase();
    return searchTerms.some(term => texto.includes(term));
  });

  const { data: userLicitacoes } = await supabase
    .from("licitacoes").select("numero").eq("user_id", sub.user_id).not("status", "eq", "arquivado");
  if (userLicitacoes?.length) {
    const nums = userLicitacoes.map((l: any) => l.numero).filter(Boolean);
    const existing = new Set(result.map(l => l.titulo));
    for (const l of allLicitacoes) {
      if (!existing.has(l.titulo) && nums.some((n: string) => l.titulo?.includes(n))) result.push(l);
    }
  }
  return result;
}

async function filterByParticipacao(supabase: any, sub: any, filtered: LicitacaoUnificada[]) {
  const { data: userLicitacoes } = await supabase
    .from("licitacoes").select("numero, empresa_id").eq("user_id", sub.user_id);
  if (!userLicitacoes?.length) return [];

  const nums = userLicitacoes.map((l: any) => l.numero).filter(Boolean);
  const empresaIds = [...new Set(userLicitacoes.map((l: any) => l.empresa_id).filter(Boolean))];
  let cnpjs: string[] = [];
  if (empresaIds.length > 0) {
    const { data: empresas } = await supabase.from("empresas").select("cnpj").in("id", empresaIds as string[]);
    cnpjs = (empresas || []).map((e: any) => e.cnpj?.replace(/\D/g, '')).filter(Boolean);
  }

  return filtered.filter(l => {
    const texto = `${l.titulo} ${l.objeto}`.toLowerCase();
    if (nums.some((n: string) => texto.includes(n.toLowerCase()))) return true;
    if (cnpjs.some((c: string) => texto.includes(c))) return true;
    return false;
  });
}

// ═══════════════════════════════════════════════
// Send email per licitação
// ═══════════════════════════════════════════════
async function sendEmail(supabaseUrl: string, serviceKey: string, email: string, tipo: string, lic: LicitacaoUnificada, subjectOverride?: string) {
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
    url_edital: lic.url_edital || '',
    url_portal: lic.url_portal || '',
    urgencia: lic.urgencia || 'normal',
    horas_restantes: lic.horas_restantes,
  };

  const payload: Record<string, any> = {
    templateName: 'boletim-diario',
    recipientEmail: email,
    templateData,
  };

  // Override subject if provided
  if (subjectOverride) {
    payload.subjectOverride = subjectOverride;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify(payload),
  });

  return { ok: res.ok, status: res.status, body: await res.text().catch(() => '') };
}

// ═══════════════════════════════════════════════
// Send WhatsApp per licitação
// ═══════════════════════════════════════════════
async function sendWhatsApp(supabase: any, supabaseUrl: string, serviceKey: string, userId: string, telefone: string, lic: LicitacaoUnificada) {
  const local = [lic.municipio, lic.uf].filter(Boolean).join('/');
  const valor = lic.valor_estimado ? `R$ ${Number(lic.valor_estimado).toLocaleString("pt-BR")}` : '';
  const linkEdital = lic.url_edital || lic.url_portal || '';

  const mensagem = [
    `PRAEFECTUS`,
    ``,
    lic.numero_processo || lic.titulo || 'Novo processo',
    lic.orgao ? `Orgao: ${lic.orgao}` : '',
    lic.objeto ? `Objeto: ${lic.objeto.slice(0, 200)}` : '',
    local ? `Local: ${local}` : '',
    valor ? `Valor: ${valor}` : '',
    lic.data_abertura ? `Abertura: ${lic.data_abertura}` : '',
    lic.portal ? `Portal: ${lic.portal}` : '',
    linkEdital ? `Edital: ${linkEdital}` : '',
    ``,
    `Acesse: https://app.praefectus.com.br/monitoramento-editais`,
  ].filter(Boolean).join('\n');

  try {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-envio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        telefone,
        setor: 'licitações',
        user_id: userId,
        tipo: 'alerta',
        mensagem_custom: mensagem,
      }),
    });
  } catch (err) {
    console.error(`Erro WhatsApp para ${telefone}:`, err);
  }
}

// ═══════════════════════════════════════════════
// Get WhatsApp number for subscriber
// ═══════════════════════════════════════════════
async function getWhatsAppNumber(supabase: any, userId: string): Promise<string | null> {
  // Check boletim_preferencias for notificacao_push (WhatsApp enabled)
  const { data: pref } = await supabase
    .from("boletim_preferencias")
    .select("notificacao_push")
    .eq("user_id", userId)
    .single();

  if (!pref?.notificacao_push) return null;

  // Get phone from whatsapp_config
  const { data: whatsConfig } = await supabase
    .from("whatsapp_config")
    .select("numero_principal")
    .eq("user_id", userId)
    .single();

  if (whatsConfig?.numero_principal) return whatsConfig.numero_principal;

  // Fallback: check profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("telefone")
    .eq("user_id", userId)
    .single();

  return profile?.telefone || null;
}

// ═══════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════
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
      .select("user_id, email, segmentos, ufs_interesse, filtrar_alteracoes_por_cnpj, filtrar_resultados_por_participacao, notificacao_push")
      .eq(prefColumn, true);

    if (user_id) query = query.eq("user_id", user_id);

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
        const ufsInteresse = (sub as any).ufs_interesse || [];

        // Fetch from both sources in parallel
        const [monitoramento, pncpCache] = await Promise.all([
          fetchMonitoramentoEditais(supabase, tipo, ufsInteresse),
          fetchPncpEditaisCache(supabase, tipo, ufsInteresse),
        ]);

        // Merge and deduplicate
        const merged = mergeAndDeduplicate(monitoramento, pncpCache);

        // Apply subscriber-specific filters
        const filtered = await applyFilters(supabase, tipo, sub, merged);

        if (filtered.length === 0) {
          allResults.push({ email: sub.email, success: true, licitacoes_count: 0, detail: "Nenhuma licitação encontrada" });
          continue;
        }

        // Deduplicate: remove editais already sent to this user in last 24h
        const deduplicated = await deduplicateForUser(supabase, sub.user_id, filtered);

        if (deduplicated.length === 0) {
          allResults.push({ email: sub.email, success: true, licitacoes_count: 0, detail: "Todos editais já enviados anteriormente" });
          continue;
        }

        // Get WhatsApp number if enabled
        const whatsappNumber = await getWhatsAppNumber(supabase, sub.user_id);

        let emailsOk = 0;
        let emailsFail = 0;

        for (let i = 0; i < deduplicated.length; i++) {
          const lic = deduplicated[i];

          // Generate dynamic subject
          const dynamicSubject = generateDynamicSubject(tipo, deduplicated, i);

          // Send email with dynamic subject override
          const emailResult = await sendEmail(supabaseUrl, supabaseServiceKey, sub.email, tipo, lic, dynamicSubject);
          if (emailResult.ok) {
            emailsOk++;
            // Log to notificacoes_enviadas for future deduplication
            await supabase.from("notificacoes_enviadas").insert({
              user_id: sub.user_id,
              alerta_ref_id: lic.numero_processo || lic.titulo || '',
              alerta_tipo: "boletim_" + tipo,
              alerta_titulo: (lic.objeto || lic.titulo || '').substring(0, 120),
              canal: "email",
              destinatario: sub.email,
              status: "enviado",
              enviado_em: new Date().toISOString(),
            });
          } else {
            emailsFail++;
          }

          // Send WhatsApp if enabled
          if (whatsappNumber) {
            await sendWhatsApp(supabase, supabaseUrl, supabaseServiceKey, sub.user_id, whatsappNumber, lic);
          }
        }

        // Log
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo,
          email: sub.email,
          status: emailsFail === 0 ? "enviado" : emailsFail === deduplicated.length ? "erro" : "parcial",
          erro: emailsFail > 0 ? `${emailsFail}/${deduplicated.length} falharam` : null,
        });

        allResults.push({
          email: sub.email,
          success: true,
          licitacoes_count: deduplicated.length,
          licitacoes_filtradas: filtered.length,
          licitacoes_deduplicadas: filtered.length - deduplicated.length,
          fontes: { monitoramento: monitoramento.length, pncp_comprasnet: pncpCache.length },
          emails_sent: emailsOk,
          emails_failed: emailsFail,
          whatsapp: whatsappNumber ? 'enviado' : 'desabilitado',
        });
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
