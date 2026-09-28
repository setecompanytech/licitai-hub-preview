// Ingestão normativa diária — a base que a IA pode citar (F3, 27/09/2026).
//
// Sem IA nenhuma. Três fontes REAIS, conferidas em 27/09:
//   • Planalto: texto compilado das leis acompanhadas, artigo por artigo
//     (`_shared/planalto-parser.ts`; revogado fora). Redação que mudou vira
//     `base_normativa_alteracoes` e aviso aos admins da plataforma.
//   • TCU: API de dados abertos de acórdãos (lista paginada, mais recentes
//     primeiro), filtrada por tema de contratação pública. Guarda o sumário,
//     relator, data e o link oficial — o inteiro teor fica no link.
//   • DOU: busca oficial do in.gov.br, seção 1, atos que citem a Lei 14.133
//     ou contratação pública, janela de uma semana com dedupe por URL.
// Teto: 200 documentos novos por execução (TCU + DOU). Cada fonte deixa
// rastro em `base_normativa_coletas`, inclusive o erro (princípio 3).
// Dispara pelo cron (CRON_SECRET) ou por admin da plataforma logado.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { artigosDoPlanalto, artigosPorTexto, textoLimpo, trechoEntre } from '../_shared/planalto-parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TETO_POR_EXECUCAO = 200;
const UA = 'Mozilla/5.0 (compatible; PraefectusNormativo/1.0)';

type Fonte = {
  identificador: string; tipo: string; url: string;
  /** 'planalto' = HTML com âncoras em windows-1252; 'texto' = página corrida em UTF-8 (gov.br). */
  formato?: 'planalto' | 'texto';
  /** Anexos guardados como dispositivo próprio (ex.: planilha de custos da IN 5/2017). */
  anexos?: Array<{ dispositivo: string; inicio: RegExp; fim: RegExp }>;
};
const LEIS: Fonte[] = [
  { identificador: 'Lei 14.133/2021', tipo: 'lei', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm' },
  { identificador: 'Lei 10.192/2001', tipo: 'lei', url: 'https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10192.htm' },
  { identificador: 'Lei Complementar 123/2006', tipo: 'lc', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm' },
  { identificador: 'Lei 8.906/1994', tipo: 'lei', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8906.htm' },
  { identificador: 'Lei 12.016/2009', tipo: 'lei', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm' },
  { identificador: 'Lei 4.320/1964', tipo: 'lei', url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm' },
  { identificador: 'Decreto 11.462/2023', tipo: 'decreto', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm' },
  // Apoio Contábil (28/09/2026): planilha de custos e encargos (Anexo VII-D) e pesquisa de preços.
  { identificador: 'IN SEGES/MP 5/2017', tipo: 'in', formato: 'texto', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada',
    anexos: [{ dispositivo: 'Anexo VII-D', inicio: /\n\s*ANEXO VII\s*-\s*D\b/, fim: /\n\s*ANEXO VII\s*-\s*E\b/ }] },
  { identificador: 'IN SEGES/ME 65/2021', tipo: 'in', formato: 'texto', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021' },
];

const TEMA_TCU = /licita|contrat|preg[aã]o|reajust|repactua|reequil|habilita|inabilita|registro de pre|ata de registro|impugna|recurso|san[cç][aã]o|inidon|aditiv|apostil|14\.133|8\.666|dispensa|inexigib/i;
const TERMOS_DOU = ['"Lei nº 14.133"', '"licitações e contratos"', '"contratação pública"'];

type Db = ReturnType<typeof createClient>;
type Registro = {
  fonte: string; tipo: string; identificador: string; dispositivo: string | null; titulo: string | null;
  ementa: string | null; texto: string; url: string | null; data_publicacao: string | null;
  /** Metadados estruturados (relator, colegiado, órgão, edição…): a pesquisa filtra e mostra por eles. */
  detalhe: Record<string, unknown>;
};

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Grava um registro: novo, igual (nada) ou alterado (trilha + versão nova). */
type Orcamento = { inseridos: number };

async function gravar(db: Db, r: Registro, contagem: { novos: number; alterados: number }, alteracoes: string[], orcamento?: Orcamento): Promise<void> {
  const hash = await sha256(r.texto);
  // Dispositivo nulo é o documento inteiro: filtro `is null`, não `eq ''`.
  const lido = r.dispositivo === null
    ? (await db.from('base_normativa').select('id, versao_hash, texto, detalhe').eq('fonte', r.fonte).eq('identificador', r.identificador).is('dispositivo', null).maybeSingle()).data
    : (await db.from('base_normativa').select('id, versao_hash, texto, detalhe').eq('fonte', r.fonte).eq('identificador', r.identificador).eq('dispositivo', r.dispositivo).maybeSingle()).data;
  if (!lido) {
    const { error } = await db.from('base_normativa').insert({ ...r, versao_hash: hash });
    if (error) throw new Error(`${r.identificador} ${r.dispositivo ?? ''}: ${error.message}`);
    contagem.novos += 1;
    if (orcamento) orcamento.inseridos += 1;
    return;
  }
  if (lido.versao_hash === hash) {
    // Texto igual, metadados novos (a coluna `detalhe` nasceu depois da 1ª carga): completa sem contar como alteração.
    if (JSON.stringify(lido.detalhe ?? {}) !== JSON.stringify(r.detalhe)) {
      await db.from('base_normativa').update({ detalhe: r.detalhe }).eq('id', lido.id);
    }
    return;
  }
  await db.from('base_normativa_alteracoes').insert({
    norma_id: lido.id, identificador: r.identificador, dispositivo: r.dispositivo,
    hash_anterior: lido.versao_hash, hash_novo: hash, texto_anterior: lido.texto,
  });
  const { error } = await db.from('base_normativa').update({ ...r, versao_hash: hash, atualizado_em: new Date().toISOString() }).eq('id', lido.id);
  if (error) throw new Error(`${r.identificador} ${r.dispositivo ?? ''}: ${error.message}`);
  contagem.alterados += 1;
  alteracoes.push(`${r.identificador}${r.dispositivo ? `, ${r.dispositivo}` : ''}`);
}

async function coletarPlanalto(db: Db, alteracoes: string[]) {
  const contagem = { documentos: 0, novos: 0, alterados: 0 };
  const erros: string[] = [];
  for (const lei of LEIS) {
    try {
      const res = await fetch(lei.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
      if (!res.ok) { erros.push(`${lei.identificador}: HTTP ${res.status}`); continue; }
      const bruto = await res.arrayBuffer();
      const html = lei.formato === 'texto' ? new TextDecoder('utf-8').decode(bruto) : new TextDecoder('windows-1252').decode(bruto);
      const artigos = lei.formato === 'texto' ? artigosPorTexto(html) : artigosDoPlanalto(html);
      if (artigos.length === 0) { erros.push(`${lei.identificador}: nenhum artigo reconhecido — a página mudou de formato?`); continue; }
      contagem.documentos += artigos.length + 1;
      const inteiro = textoLimpo(html);
      await gravar(db, { fonte: 'planalto', tipo: lei.tipo, identificador: lei.identificador, dispositivo: null, titulo: lei.identificador, ementa: inteiro.slice(0, 600), texto: inteiro, url: lei.url, data_publicacao: null, detalhe: { lei: lei.identificador, artigos: artigos.length, origem: lei.formato === 'texto' ? 'gov.br' : 'planalto' } }, contagem, alteracoes);
      for (const a of artigos) {
        const ancora = lei.formato === 'texto' ? '' : `#art${a.numero.toLowerCase().replace('-', '')}`;
        await gravar(db, { fonte: 'planalto', tipo: lei.tipo, identificador: lei.identificador, dispositivo: `art. ${a.numero}`, titulo: `${lei.identificador} — art. ${a.numero}`, ementa: null, texto: a.texto, url: `${lei.url}${ancora}`, data_publicacao: null, detalhe: { lei: lei.identificador, artigo: a.numero } }, contagem, alteracoes);
      }
      for (const anexo of lei.anexos ?? []) {
        const texto = trechoEntre(html, anexo.inicio, anexo.fim);
        if (!texto) { erros.push(`${lei.identificador}: ${anexo.dispositivo} não encontrado na página`); continue; }
        contagem.documentos += 1;
        await gravar(db, { fonte: 'planalto', tipo: lei.tipo, identificador: lei.identificador, dispositivo: anexo.dispositivo, titulo: `${lei.identificador} — ${anexo.dispositivo}`, ementa: texto.slice(0, 600), texto, url: lei.url, data_publicacao: null, detalhe: { lei: lei.identificador, anexo: anexo.dispositivo } }, contagem, alteracoes);
      }
    } catch (e) {
      erros.push(`${lei.identificador}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ...contagem, erros };
}

async function coletarTcu(db: Db, alteracoes: string[], restante: () => number, orcamento: Orcamento) {
  const contagem = { documentos: 0, novos: 0, alterados: 0 };
  const erros: string[] = [];
  try {
    // A API lista do mais recente para trás, em páginas. Anda até o teto do
    // dia ou até uma página inteira já conhecida: a base recua no tempo um
    // pouco por dia, sem pesar na fonte.
    const PAGINA = 200;
    let inicio = 0;
    let paginasSemNovidade = 0;
    while (inicio < 5000 && paginasSemNovidade < 2 && restante() > 0) {
      const res = await fetch(`https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio=${inicio}&quantidade=${PAGINA}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { erros.push(`TCU (inicio=${inicio}): HTTP ${res.status}`); break; }
      const lista = await res.json() as Array<Record<string, string>>;
      if (lista.length === 0) break;
      contagem.documentos += lista.length;
      const novosAntes = contagem.novos;
      for (const a of lista) {
        if (restante() <= 0) { erros.push('TCU: teto da execução atingido; o restante fica para amanhã'); break; }
        if (!TEMA_TCU.test(a.sumario ?? '')) continue;
        const [d, m, y] = String(a.dataSessao ?? '').split('/');
        const data = y && m && d ? `${y}-${m}-${d}` : null;
        const identificador = `Acórdão ${a.numeroAcordao}/${a.anoAcordao}-${a.colegiado ?? 'TCU'}`;
        await gravar(db, {
          fonte: 'tcu', tipo: 'acordao', identificador, dispositivo: null, titulo: a.titulo ?? identificador,
          ementa: (a.sumario ?? '').slice(0, 2000),
          texto: `${a.titulo ?? identificador}\nRelator: ${a.relator ?? '—'} · Sessão: ${a.dataSessao ?? '—'} · Situação: ${a.situacao ?? '—'}\n\n${a.sumario ?? ''}`,
          url: a.urlAcordao ?? a.urlArquivoPdf ?? null, data_publicacao: data,
          detalhe: { numero: a.numeroAcordao, ano: a.anoAcordao, colegiado: a.colegiado ?? null, relator: a.relator ?? null, situacao: a.situacao ?? null, numero_ata: a.numeroAta ?? null, data_sessao: data, url_pdf: a.urlArquivoPdf ?? null },
        }, contagem, alteracoes, orcamento);
      }
      paginasSemNovidade = contagem.novos === novosAntes ? paginasSemNovidade + 1 : 0;
      inicio += lista.length;
    }
  } catch (e) {
    erros.push(`TCU: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ...contagem, erros };
}

async function coletarDou(db: Db, alteracoes: string[], restante: () => number, orcamento: Orcamento) {
  const contagem = { documentos: 0, novos: 0, alterados: 0 };
  const erros: string[] = [];
  const vistos = new Set<string>();
  for (const termo of TERMOS_DOU) {
    try {
      const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(termo)}&s=do1&exactDate=semana&sortType=0&delta=20`;
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) { erros.push(`DOU ${termo}: HTTP ${res.status}`); continue; }
      const html = await res.text();
      const m = html.match(/type="application\/json">\s*(\{"jsonArray".*?\})\s*<\/script>/s);
      if (!m) { erros.push(`DOU ${termo}: a página não trouxe o JSON de resultados`); continue; }
      const itens = (JSON.parse(m[1]).jsonArray ?? []) as Array<Record<string, string>>;
      for (const it of itens) {
        if (!it.urlTitle || vistos.has(it.urlTitle)) continue;
        vistos.add(it.urlTitle);
        contagem.documentos += 1;
        if (restante() <= 0) { if (!erros.includes('DOU: teto da execução atingido; o restante fica para amanhã')) erros.push('DOU: teto da execução atingido; o restante fica para amanhã'); break; }
        const [d, mm, y] = String(it.pubDate ?? '').split('/');
        const conteudo = textoLimpo(String(it.content ?? ''));
        await gravar(db, {
          fonte: 'dou', tipo: (it.artType ?? 'ato').toLowerCase(), identificador: it.title ?? it.urlTitle, dispositivo: null,
          titulo: it.title ?? null, ementa: conteudo.slice(0, 600),
          texto: `${it.title ?? ''}\n${it.hierarchyStr ?? ''}\nDOU ${it.pubName ?? ''} de ${it.pubDate ?? ''}${it.numberPage ? `, p. ${it.numberPage}` : ''}\n\n${conteudo}`,
          url: `https://www.in.gov.br/web/dou/-/${it.urlTitle}`, data_publicacao: y && mm && d ? `${y}-${mm}-${d}` : null,
          detalhe: { orgao: it.hierarchyStr ?? null, tipo_ato: it.artType ?? null, secao: it.pubName ?? null, edicao: it.editionNumber ?? null, pagina: it.numberPage ?? null },
        }, contagem, alteracoes, orcamento);
      }
    } catch (e) {
      erros.push(`DOU ${termo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ...contagem, erros };
}

async function registrarColeta(db: Db, fonte: string, inicio: string, r: { documentos: number; novos: number; alterados: number; erros: string[] }, disparo: 'cron' | 'manual') {
  await db.from('base_normativa_coletas').insert({ fonte, iniciado_em: inicio, concluido_em: new Date().toISOString(), documentos: r.documentos, novos: r.novos, alterados: r.alterados, erros: r.erros, detalhe: { disparo } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const cronSecret = Deno.env.get('CRON_SECRET');
    let autorizado = !!cronSecret && token === cronSecret;
    if (!autorizado && token) {
      // Admin da plataforma pode disparar pela tela ("Atualizar agora").
      const auth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user } } = await auth.auth.getUser(token);
      if (user) {
        const { data: papel } = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        autorizado = !!papel;
      }
    }
    if (!autorizado) return json({ error: 'Unauthorized' }, 401);
    const disparo: 'cron' | 'manual' = !!cronSecret && token === cronSecret ? 'cron' : 'manual';

    const executar = async () => {
      const alteracoes: string[] = [];
      // O teto conta a CADA inserção (antes só somava ao fim de cada fonte, e o
      // TCU gravou 784 numa execução enquanto o DOU viu o teto já estourado).
      const orcamento: Orcamento = { inseridos: 0 };
      const restante = () => TETO_POR_EXECUCAO - orcamento.inseridos;

      const t1 = new Date().toISOString();
      const planalto = await coletarPlanalto(db, alteracoes);
      await registrarColeta(db, 'planalto', t1, planalto, disparo);

      // DOU antes do TCU: é pequeno (uma semana) e perecível; o TCU fica com o resto do teto.
      const t2 = new Date().toISOString();
      const dou = await coletarDou(db, alteracoes, restante, orcamento);
      await registrarColeta(db, 'dou', t2, dou, disparo);

      const t3 = new Date().toISOString();
      const tcu = await coletarTcu(db, alteracoes, restante, orcamento);
      await registrarColeta(db, 'tcu', t3, tcu, disparo);

      return { planalto, tcu, dou, alteracoes, inseridos: orcamento.inseridos };
    };
    const avisarAdmins = async (alteracoes: string[]) => {
      if (alteracoes.length === 0) return;
      const { data: admins } = await db.from('user_roles').select('user_id').eq('role', 'admin');
      const lista = alteracoes.slice(0, 12).join('; ') + (alteracoes.length > 12 ? ` e mais ${alteracoes.length - 12}` : '');
      for (const a of admins ?? []) {
        await db.from('notificacoes').insert({
          user_id: a.user_id, tipo: 'juridico',
          titulo: `Redação alterada na base normativa: ${alteracoes.length} dispositivo(s)`,
          mensagem: `A ingestão diária leu texto diferente do guardado em: ${lista}. A versão anterior está em base_normativa_alteracoes. Confira as peças e telas que citam esses dispositivos.`,
          link: '/apoio-juridico?tab=base-juridica',
        });
      }
    };

    if (disparo === 'cron') {
      // O pg_net não espera minutos: responde já e segue em segundo plano.
      // Sem isto a execução morria com a conexão (28/09: cron "succeeded" à
      // 01:30 e nenhuma coleta registrada).
      const tarefa = executar().then((r) => avisarAdmins(r.alteracoes)).catch((e) => console.error('ingestao-normativa (cron):', e));
      const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(tarefa); else await tarefa;
      return json({ ok: true, disparo, em_segundo_plano: Boolean(runtime?.waitUntil), teto: TETO_POR_EXECUCAO }, 202);
    }
    const r = await executar();
    await avisarAdmins(r.alteracoes);
    return json({ ok: true, disparo, ...r, teto: TETO_POR_EXECUCAO });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
