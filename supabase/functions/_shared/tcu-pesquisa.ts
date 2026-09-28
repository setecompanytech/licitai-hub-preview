/**
 * Pesquisa Integrada do TCU — a mesma porta que o portal
 * https://pesquisa.apps.tcu.gov.br/pesquisa/acordao-completo usa (27/09/2026).
 *
 * Por que aqui e não só na base local: a API de dados abertos
 * (`recupera-acordaos`) lista do mais recente para trás e ignora filtros; a
 * base cresce um pouco por dia. O portal, não: pesquisa os 500 mil acórdãos
 * com operadores (e, ou, adj, não, prox, mesmo, $), filtros por número, ano,
 * colegiado, relator, processo, órgão e data da sessão, facetas e trechos com
 * a palavra marcada. A gramática abaixo foi lida do bundle do portal
 * (`getFiltroCampoSimples`, `getFiltroCamposDataRange`, `montaStringFiltro`)
 * e conferida ao vivo: `COLEGIADO:"Plenário" ANOACORDAO:"2025"
 * DTRELEVANCIA:[20250101 to 20250331]`.
 *
 * O firewall do TCU recusa cliente sem cabeçalhos de navegador (User-Agent e
 * Accept): a resposta vem como HTML "Requisição rejeitada" com HTTP 200.
 *
 * Sem Deno aqui: o módulo é testado pelo vitest a partir de src/.
 */
export const TCU_PESQUISA_URL = 'https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo';
export const TCU_PORTAL_URL = 'https://pesquisa.apps.tcu.gov.br/pesquisa/acordao-completo';

const CABECALHOS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: TCU_PORTAL_URL,
};

export type OrdemTcu = 'relevancia' | 'recentes' | 'antigos';
/** As três ordens do portal, como ele mesmo as manda (mais ",KEY asc" para a página ser estável). */
export const ORDENACAO_TCU: Record<OrdemTcu, string> = {
  recentes: 'DTRELEVANCIA desc, NUMACORDAOINT desc, COPIACOLEGIADO desc',
  antigos: 'DTRELEVANCIA asc, NUMACORDAOINT asc, COPIACOLEGIADO asc',
  relevancia: 'score desc',
};
export const COLEGIADOS_TCU = ['Plenário', 'Primeira Câmara', 'Segunda Câmara'] as const;

export type FiltrosTcu = {
  termo?: string | null;
  numero?: string | number | null;
  ano?: string | number | null;
  colegiado?: string[] | string | null;
  relator?: string | null;
  processo?: string | null;
  anoProcesso?: string | number | null;
  entidade?: string | null;
  tipo?: string[] | string | null;
  dataDe?: string | null;   // AAAA-MM-DD ou DD/MM/AAAA
  dataAte?: string | null;
};

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const lista = (v: string[] | string | null | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean);
const aspas = (v: string) => `"${v.replace(/"/g, '')}"`;

/** Data para o Solr do portal: AAAAMMDD. Aceita ISO e DD/MM/AAAA; qualquer outra coisa vira nulo. */
export function dataSolr(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}${m[2]}${m[1]}`;
  return null;
}

/** Campo com um ou vários valores: `CAMPO:"a"` ou `CAMPO:("a" OU "b")`. */
function campoMulti(nome: string, valores: string[]): string {
  if (valores.length === 0) return '';
  if (valores.length === 1) return `${nome}:${aspas(valores[0])}`;
  return `${nome}:(${valores.map(aspas).join(' OU ')})`;
}

/**
 * O parâmetro `filtro` do portal a partir de campos estruturados. Cada pedaço
 * é opcional; a ordem segue a do formulário do portal.
 */
export function filtroDoTcu(f: FiltrosTcu): string {
  const partes: string[] = [];
  const numero = soDigitos(f.numero);
  if (numero) partes.push(`NUMACORDAO:${aspas(String(parseInt(numero, 10)))}`);
  const ano = soDigitos(f.ano);
  if (ano) partes.push(`ANOACORDAO:${aspas(ano)}`);
  const de = dataSolr(f.dataDe); const ate = dataSolr(f.dataAte);
  if (de || ate) partes.push(`DTRELEVANCIA:[${de ?? '*'} to ${ate ?? '*'}]`);
  const processo = soDigitos(f.processo);
  if (processo) partes.push(`PROC:${aspas(processo)}`);
  const anoProcesso = soDigitos(f.anoProcesso);
  if (anoProcesso) partes.push(`ANOPROCESSO:${aspas(anoProcesso)}`);
  const relator = String(f.relator ?? '').trim();
  if (relator) partes.push(`RELATOR:${aspas(relator)}`);
  partes.push(campoMulti('COLEGIADO', lista(f.colegiado)));
  const entidade = String(f.entidade ?? '').trim();
  if (entidade) partes.push(`ENTIDADE:${aspas(entidade)}`);
  partes.push(campoMulti('COPIATIPO', lista(f.tipo)));
  return partes.filter(Boolean).join(' ');
}

/** Termo como o portal manda: vazio vira `*` (tudo). */
export function termoDoTcu(termo: string | null | undefined): string {
  const t = String(termo ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t : '*';
}

export type Faceta = { valor: string; quantidade: number };
export type FacetasTcu = { tipo: Faceta[]; colegiado: Faceta[]; relator: Faceta[]; ano: Faceta[] };
const NOME_DA_FACETA: Record<string, keyof FacetasTcu> = { COPIATIPO: 'tipo', COPIACOLEGIADO: 'colegiado', COPIARELATOR: 'relator', ANOACORDAO: 'ano' };

/** As facetas do portal vêm como lista achatada [valor, quantidade, valor, quantidade…]. */
export function facetasDoTcu(campos: Array<{ nome: string; itens?: unknown[] | null }> | null | undefined): FacetasTcu {
  const r: FacetasTcu = { tipo: [], colegiado: [], relator: [], ano: [] };
  for (const c of campos ?? []) {
    const chave = NOME_DA_FACETA[c.nome];
    if (!chave) continue;
    const itens = c.itens ?? [];
    for (let i = 0; i + 1 < itens.length; i += 2) {
      const valor = String(itens[i] ?? '').trim(); const quantidade = Number(itens[i + 1]);
      if (valor && Number.isFinite(quantidade)) r[chave].push({ valor, quantidade });
    }
  }
  r.ano.sort((a, b) => b.valor.localeCompare(a.valor));
  return r;
}

export type AcordaoResumido = {
  key: string; tipo: string; titulo: string; numero: string; ano: string; colegiado: string; relator: string | null;
  data_sessao: string | null; /** AAAA-MM-DD */
  data_sessao_br: string | null; numero_ata: string | null; processo: string | null; situacao: string | null;
  fragmentos: string[]; /** com <em> do portal */
  url_pdf: string | null; url_doc: string | null; url_portal: string;
};

export const dataIsoDaSessao = (v: unknown): string | null => {
  const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** "2170620255" → "021.706/2025-5" (TC nnn.nnn/aaaa-d). Já formatado, volta como veio. */
export function processoFormatado(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/\d{3}\.\d{3}\/\d{4}-\d/.test(s)) return s.match(/\d{3}\.\d{3}\/\d{4}-\d/)![0];
  const d = s.replace(/\D/g, '');
  if (d.length < 9 || d.length > 11) return s;
  const p = d.padStart(11, '0');
  return `${p.slice(0, 3)}.${p.slice(3, 6)}/${p.slice(6, 10)}-${p.slice(10)}`;
}

const nomeDoColegiado = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (/plen/i.test(s)) return 'Plenário';
  if (/primeira|1/i.test(s)) return 'Primeira Câmara';
  if (/segunda|2/i.test(s)) return 'Segunda Câmara';
  return s || 'TCU';
};

/** Identificador no padrão da base (o mesmo da ingestão diária): "Acórdão 2991/2025-Plenário". */
export function identificadorDoAcordao(d: { numero?: unknown; ano?: unknown; colegiado?: unknown; tipo?: unknown }): string {
  const tipo = /decis/i.test(String(d.tipo ?? '')) ? 'Decisão' : 'Acórdão';
  return `${tipo} ${String(d.numero ?? '').trim()}/${String(d.ano ?? '').trim()}-${nomeDoColegiado(d.colegiado)}`;
}

export const urlNoPortal = (key: string) => `https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/KEY:${encodeURIComponent(key)}/DTRELEVANCIA desc, NUMACORDAOINT desc, COPIACOLEGIADO desc/0`;

export function resumirAcordao(x: Record<string, unknown>): AcordaoResumido {
  const key = String(x.KEY ?? '');
  return {
    key, tipo: String(x.TIPO ?? 'ACÓRDÃO'), titulo: String(x.TITULO ?? ''), numero: String(x.NUMACORDAO ?? ''), ano: String(x.ANOACORDAO ?? ''),
    colegiado: nomeDoColegiado(x.COLEGIADO), relator: x.RELATOR ? String(x.RELATOR) : null,
    data_sessao: dataIsoDaSessao(x.DATASESSAO), data_sessao_br: x.DATASESSAO ? String(x.DATASESSAO) : null,
    numero_ata: x.NUMATA ? String(x.NUMATA) : null, processo: processoFormatado(x.PROC), situacao: x.SITUACAO ? String(x.SITUACAO) : null,
    fragmentos: [x.FRAGMENTO1, x.FRAGMENTO2].filter((f): f is string => typeof f === 'string' && f.trim().length > 0),
    url_pdf: x.URLARQUIVOPDF ? String(x.URLARQUIVOPDF) : null, url_doc: x.URLARQUIVO ? String(x.URLARQUIVO) : null, url_portal: urlNoPortal(key),
  };
}

export type RespostaTcu = { total: number; inicio: number; documentos: AcordaoResumido[]; facetas: FacetasTcu; alerta: string | null; sugestao: string | null };

/** jsdom não tem AbortSignal.timeout; no Deno tem. */
const prazo = (ms: number): AbortSignal | undefined => (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined);

async function lerJson(res: Response, oQue: string): Promise<Record<string, unknown>> {
  const corpo = await res.text();
  if (!res.ok) throw new Error(`TCU ${oQue}: HTTP ${res.status}`);
  if (/Requisi\S+ rejeitada|firewall/i.test(corpo) && corpo.trimStart().startsWith('<')) throw new Error('O firewall do TCU recusou a consulta. Tente de novo em instantes.');
  try { return JSON.parse(corpo) as Record<string, unknown>; } catch { throw new Error(`TCU ${oQue}: resposta não é JSON`); }
}

/** Uma página de resultados do portal, com total, facetas e trechos marcados. */
export async function pesquisarTcu(p: { termo?: string | null; filtro?: string; ordem?: OrdemTcu; quantidade?: number; inicio?: number }, fetchFn: typeof fetch = fetch): Promise<RespostaTcu> {
  const q = new URLSearchParams();
  q.set('termo', termoDoTcu(p.termo));
  if (p.filtro && p.filtro.trim()) q.set('filtro', p.filtro.trim());
  q.set('ordenacao', `${ORDENACAO_TCU[p.ordem ?? 'relevancia']},KEY asc`);
  q.set('quantidade', String(Math.min(Math.max(p.quantidade ?? 20, 1), 50)));
  q.set('inicio', String(Math.max(p.inicio ?? 0, 0)));
  q.set('sinonimos', 'true');
  const res = await fetchFn(`${TCU_PESQUISA_URL}/documentosResumidos?${q.toString()}`, { headers: CABECALHOS, signal: prazo(30000) });
  const j = await lerJson(res, 'pesquisa');
  const facetas = (j.facetas as { campos?: Array<{ nome: string; itens?: unknown[] }> } | undefined)?.campos;
  const spell = j.spell as { sugestao?: string; termoSugerido?: string } | string | null | undefined;
  return {
    total: Number(j.quantidadeEncontrada ?? 0), inicio: Number(j.inicio ?? 0),
    documentos: ((j.documentos ?? []) as Array<Record<string, unknown>>).map(resumirAcordao),
    facetas: facetasDoTcu(facetas),
    alerta: j.mensagemAlerta ? String(j.mensagemAlerta) : null,
    sugestao: typeof spell === 'string' ? spell : spell?.termoSugerido ?? spell?.sugestao ?? null,
  };
}

export type AcordaoCompleto = AcordaoResumido & { sumario: string; acordao: string; voto: string; relatorio: string; assunto: string; entidade: string; tipo_processo: string; unidade_tecnica: string };

/** HTML do portal em texto corrido: parágrafos viram quebras de linha; entidades comuns resolvidas. */
export function textoLimpoDoTcu(html: unknown): string {
  return String(html ?? '')
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[footnoteRef:\d+\]/g, '')
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** O acórdão inteiro (sumário, acórdão, relatório e voto) pela chave do portal. */
export async function documentoTcu(key: string, fetchFn: typeof fetch = fetch): Promise<AcordaoCompleto | null> {
  if (!/^ACORDAO-COMPLETO-\d+$/.test(key)) throw new Error('chave inválida');
  const q = new URLSearchParams({ termo: `${key}.KEY`, quantidade: '1', inicio: '0' });
  const res = await fetchFn(`${TCU_PESQUISA_URL}/documento?${q.toString()}`, { headers: CABECALHOS, signal: prazo(30000) });
  const j = await lerJson(res, 'documento');
  const x = ((j.documentos ?? []) as Array<Record<string, unknown>>).find((d) => d.KEY === key);
  if (!x) return null;
  return {
    ...resumirAcordao(x),
    sumario: textoLimpoDoTcu(x.SUMARIO), acordao: textoLimpoDoTcu(x.ACORDAO), voto: textoLimpoDoTcu(x.VOTO), relatorio: textoLimpoDoTcu(x.RELATORIO),
    assunto: textoLimpoDoTcu(x.ASSUNTO), entidade: textoLimpoDoTcu(x.ENTIDADE), tipo_processo: textoLimpoDoTcu(x.TIPOPROCESSO), unidade_tecnica: textoLimpoDoTcu(x.UNIDADETECNICA),
  };
}

/** O texto que vai para a base: cabeçalho, sumário, acórdão e voto inteiros; relatório limitado. */
export function textoParaBase(d: AcordaoCompleto): string {
  const cabecalho = [
    d.titulo || identificadorDoAcordao(d),
    `Relator: ${d.relator ?? '—'} · Sessão: ${d.data_sessao_br ?? '—'} · Ata: ${d.numero_ata ?? '—'} · Processo: ${d.processo ?? '—'} · Situação: ${d.situacao ?? '—'}`,
    d.assunto ? `Assunto: ${d.assunto}` : '', d.entidade && !/não há/i.test(d.entidade) ? `Entidade: ${d.entidade}` : '',
  ].filter(Boolean).join('\n');
  const secao = (nome: string, t: string, teto = Infinity) => (t ? `\n\n${nome}\n${t.length > teto ? `${t.slice(0, teto)}\n[…]` : t}` : '');
  return `${cabecalho}${secao('SUMÁRIO', d.sumario)}${secao('ACÓRDÃO', d.acordao)}${secao('VOTO', d.voto)}${secao('RELATÓRIO', d.relatorio, 60000)}`;
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** O mínimo do cliente Supabase que a gravação usa (service role: a tabela só aceita escrita da rotina). */
export type EscritorDaBase = {
  from: (t: 'base_normativa') => {
    select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { is: (c: string, v: null) => { maybeSingle: () => PromiseLike<{ data: { id: string; versao_hash: string } | null; error: { message: string } | null }> } } } };
    insert: (r: Record<string, unknown>) => { select: (c: string) => { single: () => PromiseLike<{ data: { id: string } | null; error: { message: string } | null }> } };
    update: (r: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }> };
  };
};

/**
 * Guarda um acórdão completo na base normativa (fonte `tcu`), no mesmo
 * formato da ingestão diária, para a redação poder citá-lo com número, ano e
 * colegiado vindos da fonte. Já existente com o mesmo texto: nada; com texto
 * mais completo (a ingestão só tinha o sumário): atualiza.
 */
export async function guardarAcordao(db: EscritorDaBase, d: AcordaoCompleto, extra: { guardado_por?: string | null; origem: 'pesquisa-integrada' | 'redacao' }): Promise<{ id: string; identificador: string; situacao: 'novo' | 'atualizado' | 'igual' }> {
  const identificador = identificadorDoAcordao(d);
  const texto = textoParaBase(d);
  const hash = await sha256(texto);
  const detalhe = {
    numero: d.numero, ano: d.ano, colegiado: d.colegiado, relator: d.relator, situacao: d.situacao, numero_ata: d.numero_ata, data_sessao: d.data_sessao,
    processo: d.processo, tipo_processo: d.tipo_processo || null, key: d.key, url_pdf: d.url_pdf, url_doc: d.url_doc, origem: extra.origem, guardado_por: extra.guardado_por ?? null, texto_completo: true,
  };
  const registro = {
    fonte: 'tcu', tipo: /decis/i.test(d.tipo) ? 'decisao' : 'acordao', identificador, dispositivo: null, titulo: d.titulo || identificador,
    ementa: (d.sumario || d.acordao).slice(0, 2000), texto, url: d.url_portal, data_publicacao: d.data_sessao, versao_hash: hash, detalhe, atualizado_em: new Date().toISOString(),
  };
  const lido = await db.from('base_normativa').select('id, versao_hash').eq('fonte', 'tcu').eq('identificador', identificador).is('dispositivo', null).maybeSingle();
  if (lido.error) throw new Error(lido.error.message);
  if (lido.data) {
    if (lido.data.versao_hash === hash) return { id: lido.data.id, identificador, situacao: 'igual' };
    const up = await db.from('base_normativa').update(registro).eq('id', lido.data.id);
    if (up.error) throw new Error(up.error.message);
    return { id: lido.data.id, identificador, situacao: 'atualizado' };
  }
  const ins = await db.from('base_normativa').insert(registro).select('id').single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'falha ao gravar');
  return { id: ins.data.id, identificador, situacao: 'novo' };
}
