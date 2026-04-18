// Fase 2 — Boletim Diário com IA (AURÉLIA)
// Escaneia o cache PNCP, filtra por preferências do usuário, gera resumo via Lovable AI
// e envia por e-mail usando o template `boletim-ia-resumo`.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Mesmo dicionário de palavras-chave por segmento usado em envio-boletim
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
  // Últimas 24h, prioriza editais com prazo de proposta ainda aberto
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from('pncp_editais_cache')
    .select('id,pncp_id,numero_compra,orgao,uf,municipio,objeto,valor_total_estimado,data_abertura_proposta,data_publicacao_pncp,url_pncp,link_sistema_origem')
    .gte('data_publicacao_pncp', ontem)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(300);
  if (ufs?.length) q = q.in('uf', ufs);
  const { data } = await q;
  const lista: Edital[] = data || [];
  return lista.filter(e => matchSegmentos(`${e.objeto || ''} ${e.orgao || ''}`, segmentos));
}

async function gerarResumoIA(editais: Edital[], userCtx: { segmentos: string[]; ufs: string[] }) {
  if (editais.length === 0) {
    return {
      resumo_executivo: 'Nenhum edital relevante foi publicado nas últimas 24h dentro do seu perfil.',
      destaques: [], insights: [],
    };
  }

  const editaisCompactos = editais.slice(0, 30).map((e, i) => ({
    idx: i, num: e.numero_compra, orgao: e.orgao, uf: e.uf,
    objeto: (e.objeto || '').slice(0, 350),
    valor: e.valor_total_estimado, abertura: e.data_abertura_proposta,
  }));

  const systemPrompt = `Você é AURÉLIA, consultora sênior em licitações públicas. Receberá um lote de editais publicados nas últimas 24h e o perfil do usuário (segmentos e UFs de interesse). Sua missão:
1. Selecionar até 5 editais com MAIOR ALINHAMENTO ao perfil (score 0-100).
2. Para cada selecionado: justificar em 1 frase curta por que é relevante.
3. Escrever um resumo executivo (máx 3 frases) sobre o lote.
4. Listar 2-3 insights estratégicos (tendências, prazos críticos, oportunidades de mercado).
Seja objetiva, técnica e direta. NÃO invente dados — só use o que está nos editais fornecidos.`;

  const userMsg = `PERFIL: segmentos=[${userCtx.segmentos.join(', ') || 'todos'}], UFs=[${userCtx.ufs.join(', ') || 'todas'}]
EDITAIS (${editais.length} total, mostrando ${editaisCompactos.length}):
${JSON.stringify(editaisCompactos, null, 2)}`;

  const tool = {
    type: "function",
    function: {
      name: "gerar_boletim",
      description: "Retorna o boletim estruturado",
      parameters: {
        type: "object",
        properties: {
          resumo_executivo: { type: "string" },
          destaques: {
            type: "array",
            items: {
              type: "object",
              properties: {
                idx: { type: "integer", description: "Índice do edital no lote" },
                score: { type: "integer", minimum: 0, maximum: 100 },
                motivo: { type: "string" },
              },
              required: ["idx", "score", "motivo"],
              additionalProperties: false,
            },
          },
          insights: { type: "array", items: { type: "string" } },
        },
        required: ["resumo_executivo", "destaques", "insights"],
        additionalProperties: false,
      },
    },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "gerar_boletim" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("AI gateway error:", resp.status, txt);
    throw new Error(`IA falhou: ${resp.status}`);
  }
  const json = await resp.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = args ? JSON.parse(args) : null;
  if (!parsed) throw new Error("Resposta IA inválida");

  const destaques = (parsed.destaques || []).slice(0, 5).map((d: any) => {
    const e = editais[d.idx];
    if (!e) return null;
    return {
      pncp_id: e.pncp_id, numero_compra: e.numero_compra, orgao: e.orgao, uf: e.uf,
      objeto: e.objeto, valor_total_estimado: e.valor_total_estimado,
      data_abertura: e.data_abertura_proposta,
      url: e.url_pncp || e.link_sistema_origem,
      score: d.score, motivo: d.motivo,
    };
  }).filter(Boolean);

  return {
    resumo_executivo: parsed.resumo_executivo,
    destaques,
    insights: parsed.insights || [],
  };
}

async function processarUsuario(supabase: any, pref: any) {
  const segmentos = pref.segmentos || [];
  const ufs = pref.ufs_interesse || [];
  const editais = await buscarEditais(supabase, ufs, segmentos);
  const ia = await gerarResumoIA(editais, { segmentos, ufs });

  // Buscar nome do usuário
  const { data: profile } = await supabase
    .from('profiles').select('nome_completo').eq('user_id', pref.user_id).maybeSingle();
  const primeiroNome = (profile?.nome_completo || '').split(' ')[0] || undefined;

  // Disparar via send-transactional-email
  const { error } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'boletim-ia-resumo',
      recipientEmail: pref.email,
      idempotencyKey: `boletim-ia-${pref.user_id}-${new Date().toISOString().slice(0, 10)}`,
      templateData: {
        nome: primeiroNome,
        data_geracao: new Date().toLocaleDateString('pt-BR'),
        total_analisados: editais.length,
        ...ia,
      },
    },
  });

  // Log
  await supabase.from('boletim_envios').insert({
    user_id: pref.user_id, email: pref.email, tipo: 'ia_diario',
    status: error ? 'erro' : 'enviado', erro: error?.message || null,
  });

  return { user_id: pref.user_id, email: pref.email, total: editais.length, destaques: ia.destaques.length, error: error?.message };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, test_mode } = body;

    // Auth: cron secret OU usuário autenticado fazendo teste para si
    const authHeader = req.headers.get('authorization') || '';
    const isCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    if (test_mode && user_id) {
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

    // Modo cron: processa todos com boletim_manha ativo
    const { data: prefs } = await supabase
      .from('boletim_preferencias').select('*').eq('boletim_manha', true);

    const resultados = [];
    for (const pref of (prefs || [])) {
      try {
        const r = await processarUsuario(supabase, pref);
        resultados.push(r);
        await new Promise(r => setTimeout(r, 800)); // throttle suave
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
