// Boletim Diário (modo Comprasnet) — sem curadoria por "relevância".
// Lista TODOS os editais publicados nas últimas 24h que batem com as preferências
// (UF da sede + UFs de interesse + segmentos), priorizando a UF sede no topo.
// IA é usada apenas para escrever um resumo executivo curto (contagens), não para escolher.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { autorizadoComoCron } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const SEGMENTO_KEYWORDS: Record<string, string[]> = {
  generos_alimenticios: ['aliment', 'merenda', 'cesta básica', 'cesta basica', 'perecív', 'pereciv', 'hortifruti', 'gênero', 'genero', 'refeição', 'refeicao', 'rancho'],
  informatica: ['informática', 'informatica', 'computador', 'notebook', 'servidor', 'software', 'rede', 'impressora', 'toner', 'cartucho', 'monitor', 'tecnologia da informação', 'switch', 'firewall'],
  higiene_limpeza: ['limpeza', 'higiene', 'higienização', 'desinfetante', 'detergente', 'saneante', 'produto químico'],
  descartaveis: ['descartáv', 'descartav', 'copo descart', 'luva descart', 'embalagem', 'sacola'],
  material_escritorio: ['escritório', 'escritorio', 'papelaria', 'papel a4', 'caneta', 'material de expediente'],
  medicamentos: ['medicament', 'fármaco', 'farmaco', 'hospitalar', 'insumo hospitalar', 'saúde', 'saude', 'laboratorial', 'material médico', 'material medico'],
  construcao: ['construção', 'construcao', 'obra', 'engenharia', 'cimento', 'material de construção', 'reforma', 'pavimentação'],
  veiculos: ['veículo', 'veiculo', 'automóvel', 'automovel', 'combustível', 'combustivel', 'pneu', 'lubrificante'],
  mobiliario: ['mobiliário', 'mobiliario', 'móvel', 'movel', 'cadeira', 'mesa', 'estante', 'armário', 'armario'],
  uniformes: ['uniforme', 'fardamento', 'vestuário', 'vestuario', 'calçado', 'calcado', 'epi', 'equipamento de proteção'],
  servicos_gerais: ['serviço de limpeza', 'vigilância', 'vigilancia', 'manutenção predial', 'conservação', 'portaria', 'terceirização', 'terceirizacao'],
  servicos_ti: ['serviço de ti', 'desenvolvimento de sistema', 'suporte técnico', 'suporte tecnico', 'cloud', 'outsourcing', 'hosting', 'consultoria em ti'],
  grafica: ['gráfica', 'grafica', 'impressão', 'impressao', 'material gráfico', 'banner', 'adesivo', 'serigrafia'],
  eletroeletronicos: ['eletroeletrônic', 'eletroeletronic', 'ar-condicionado', 'eletrodoméstic', 'eletrodomestic', 'áudio', 'audio', 'vídeo', 'video'],
  equipamentos_industriais: ['máquina', 'maquina', 'ferramenta', 'equipamento industrial', 'equipamento pesado', 'gerador', 'compressor'],
};

function matchSegmentos(texto: string, segmentos: string[]): boolean {
  if (!segmentos?.length) return true;
  const t = (texto || '').toLowerCase();
  return segmentos.some(s => (SEGMENTO_KEYWORDS[s] || []).some(kw => t.includes(kw.toLowerCase())));
}

interface Edital {
  id: string; pncp_id?: string; numero_compra?: string;
  orgao?: string; uf?: string; municipio?: string;
  objeto?: string; valor_total_estimado?: number | null;
  data_abertura_proposta?: string | null;
  data_publicacao_pncp?: string | null;
  url_pncp?: string; link_sistema_origem?: string;
}

async function buscarEditais(supabase: any, ufs: string[], segmentos: string[]): Promise<Edital[]> {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from('pncp_editais_cache')
    .select('id,pncp_id,numero_compra,orgao,uf,municipio,objeto,valor_total_estimado,data_abertura_proposta,data_publicacao_pncp,url_pncp,link_sistema_origem')
    .gte('data_publicacao_pncp', ontem)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(500);
  if (ufs?.length) q = q.in('uf', ufs);
  const { data } = await q;
  const lista: Edital[] = data || [];
  return lista.filter(e => matchSegmentos(`${e.objeto || ''} ${e.orgao || ''}`, segmentos));
}

/** IA usada apenas para resumo executivo curto (NÃO escolhe quais editais entram). */
async function gerarResumoExecutivo(
  editais: Edital[],
  ufSede: string | null,
): Promise<string> {
  if (editais.length === 0) {
    return 'Nenhum edital novo nas últimas 24h dentro do seu perfil de monitoramento.';
  }

  const totalUfSede = ufSede ? editais.filter(e => (e.uf || '').toUpperCase() === ufSede).length : 0;
  const totalAcima1M = editais.filter(e => (e.valor_total_estimado || 0) >= 1_000_000).length;
  const ufsCount: Record<string, number> = {};
  editais.forEach(e => {
    const uf = (e.uf || 'N/I').toUpperCase();
    ufsCount[uf] = (ufsCount[uf] || 0) + 1;
  });
  const topUfs = Object.entries(ufsCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([uf, n]) => `${uf} (${n})`).join(', ');

  const stats = {
    total: editais.length,
    na_uf_sede: ufSede ? `${totalUfSede} no ${ufSede}` : null,
    acima_de_1_milhao: totalAcima1M,
    top_ufs: topUfs,
  };

  const systemPrompt = `Você é AURÉLIA, consultora em licitações. Escreva APENAS um resumo executivo de 2 frases curtas e objetivas, em português, sobre o lote de editais publicados nas últimas 24h. NÃO selecione, NÃO ranqueie, NÃO recomende. Só descreva o panorama (volume, distribuição geográfica, faixas de valor). Tom: técnico, direto, sem adjetivos vendedores.`;
  const userMsg = `ESTATÍSTICAS:\n${JSON.stringify(stats, null, 2)}\n\nGere o resumo executivo agora.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
      }),
    });
    if (!resp.ok) throw new Error(`AI ${resp.status}`);
    const json = await resp.json();
    const txt = json.choices?.[0]?.message?.content?.trim();
    return txt || `${stats.total} editais publicados nas últimas 24h${stats.na_uf_sede ? `, sendo ${stats.na_uf_sede}` : ''}.`;
  } catch (e) {
    console.warn('Resumo IA falhou, usando fallback:', e);
    return `${stats.total} editais publicados nas últimas 24h${stats.na_uf_sede ? `, sendo ${stats.na_uf_sede}` : ''}. ${stats.acima_de_1_milhao} acima de R$ 1 milhão. Top UFs: ${stats.top_ufs}.`;
  }
}

async function processarUsuario(supabase: any, pref: any) {
  // Buscar UF da sede da empresa do usuário
  const { data: membro } = await supabase
    .from('empresa_membros').select('empresa_id').eq('user_id', pref.user_id).limit(1).maybeSingle();
  let ufSede: string | null = null;
  if (membro?.empresa_id) {
    const { data: emp } = await supabase
      .from('empresas').select('uf').eq('id', membro.empresa_id).maybeSingle();
    ufSede = (emp?.uf || '').toUpperCase().trim() || null;
  }

  const segmentos = pref.segmentos || [];
  const ufsInteresse = pref.ufs_interesse || [];
  // UFs combinadas: sede + interesse (sem duplicar). Vazio = Brasil inteiro.
  const ufs = Array.from(new Set([...(ufSede ? [ufSede] : []), ...ufsInteresse]));

  const editais = await buscarEditais(supabase, ufs, segmentos);

  // Ordenar: UF da sede primeiro, depois data de publicação desc
  editais.sort((a, b) => {
    if (ufSede) {
      const aSede = (a.uf || '').toUpperCase() === ufSede;
      const bSede = (b.uf || '').toUpperCase() === ufSede;
      if (aSede && !bSede) return -1;
      if (!aSede && bSede) return 1;
    }
    const da = new Date(a.data_publicacao_pncp || 0).getTime();
    const db = new Date(b.data_publicacao_pncp || 0).getTime();
    return db - da;
  });

  const resumo = await gerarResumoExecutivo(editais, ufSede);

  // Buscar nome do usuário
  const { data: profile } = await supabase
    .from('profiles').select('nome_completo').eq('user_id', pref.user_id).maybeSingle();
  const primeiroNome = (profile?.nome_completo || '').split(' ')[0] || undefined;

  // Mapear editais para o formato do template (todos, sem ranking, sem score)
  const editaisTemplate = editais.slice(0, 100).map(e => ({
    pncp_id: e.pncp_id,
    numero_compra: e.numero_compra,
    orgao: e.orgao,
    uf: e.uf,
    municipio: e.municipio,
    objeto: e.objeto,
    valor_total_estimado: e.valor_total_estimado,
    data_abertura: e.data_abertura_proposta,
    url: e.url_pncp || e.link_sistema_origem,
    is_uf_sede: ufSede ? (e.uf || '').toUpperCase() === ufSede : false,
  }));

  const { error } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'boletim-ia-resumo',
      recipientEmail: pref.email,
      idempotencyKey: `boletim-ia-${pref.user_id}-${new Date().toISOString().slice(0, 10)}`,
      templateData: {
        nome: primeiroNome,
        data_geracao: new Date().toLocaleDateString('pt-BR'),
        total_editais: editais.length,
        uf_sede: ufSede,
        resumo_executivo: resumo,
        editais: editaisTemplate,
      },
    },
  });

  await supabase.from('boletim_envios').insert({
    user_id: pref.user_id, email: pref.email, tipo: 'ia_diario',
    status: error ? 'erro' : 'enviado', erro: error?.message || null,
  });

  return { user_id: pref.user_id, email: pref.email, total: editais.length, uf_sede: ufSede, error: error?.message };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, test_mode } = body;

    const authHeader = req.headers.get('authorization') || '';
    const isCron = autorizadoComoCron(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    if (test_mode && user_id) {
      // Esta função passou a ter `verify_jwt = false` para o cron conseguir
      // chegar até aqui. Antes, o gateway do Supabase é que barrava quem não
      // estivesse autenticado — este caminho não checava nada.
      //
      // Duas coisas são validadas agora, e a segunda já era um furo antes:
      //   1. o token precisa ser de um usuário real;
      //   2. o `user_id` do corpo precisa ser o DONO do token. Sem isso,
      //      qualquer usuário logado podia disparar o boletim de qualquer
      //      outro e ler as preferências dele passando um uuid alheio.
      if (!isCron) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const { data: auth } = token
          ? await supabase.auth.getUser(token)
          : { data: { user: null } };

        if (!auth?.user || auth.user.id !== user_id) {
          return new Response(JSON.stringify({ error: 'Não autorizado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const { data: pref } = await supabase
        .from('boletim_preferencias').select('*').eq('user_id', user_id).maybeSingle();
      if (!pref) {
        return new Response(JSON.stringify({ error: 'Preferências não encontradas. Salve sua configuração primeiro.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await processarUsuario(supabase, pref);
      return new Response(JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!isCron) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: prefs } = await supabase
      .from('boletim_preferencias').select('*').eq('boletim_manha', true);

    const resultados = [];
    for (const pref of (prefs || [])) {
      try {
        const r = await processarUsuario(supabase, pref);
        resultados.push(r);
        await new Promise(r => setTimeout(r, 800));
      } catch (e: any) {
        console.error('Erro usuário', pref.user_id, e);
        resultados.push({ user_id: pref.user_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processados: resultados.length, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('boletim-ia-diario erro:', e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
