/**
 * Pesquisa normativa — o que a tela pede ao banco e como rotula o que volta
 * (27/09/2026). Puro: a tela só chama.
 */
export type Fonte = 'planalto' | 'tcu' | 'dou';
export const FONTES: Fonte[] = ['planalto', 'tcu', 'dou'];
export const NOME_DA_FONTE: Record<string, string> = {
  planalto: 'Planalto', tcu: 'TCU', dou: 'DOU', ioepa: 'IOEPA', manual: 'Enviados à mão',
};
export const DESCRICAO_DA_FONTE: Record<Fonte, string> = {
  planalto: 'leis acompanhadas, artigo por artigo, texto compilado',
  tcu: 'acórdãos, pela API de dados abertos',
  dou: 'atos da seção 1 do Diário Oficial da União',
};

export type Filtros = {
  termo: string;
  fonte: Fonte | null;
  identificador: string | null;
  tipo: string | null;
  dataDe: string | null;
  dataAte: string | null;
  ordem: 'relevancia' | 'data';
  pagina: number;
};
export const POR_PAGINA = 20;
export const FILTROS_INICIAIS: Filtros = { termo: '', fonte: null, identificador: null, tipo: null, dataDe: null, dataAte: null, ordem: 'relevancia', pagina: 1 };

export type Registro = {
  id: string; fonte: string; tipo: string; identificador: string; dispositivo: string | null; titulo: string | null;
  ementa: string | null; trecho: string; url: string | null; data_publicacao: string | null; atualizado_em: string;
  detalhe: Record<string, unknown> | null; relevancia: number; correspondencia: 'todas' | 'parcial'; total: number;
};
export type Faceta = { faceta: string; valor: string | null; quantidade: number };

/** Os parâmetros da RPC, com o que a pessoa deixou em branco virando nulo. */
export function parametrosDaPesquisa(f: Filtros): Record<string, unknown> {
  const termo = f.termo.trim();
  return {
    p_termo: termo.length > 0 ? termo : null,
    p_fonte: f.fonte,
    p_identificador: f.identificador,
    p_tipo: f.tipo,
    p_data_de: f.dataDe || null,
    p_data_ate: f.dataAte || null,
    // Sem termo não há relevância: a ordem cai para a data.
    p_ordem: termo.length > 0 ? f.ordem : 'data',
    p_limite: POR_PAGINA,
    p_deslocamento: (Math.max(f.pagina, 1) - 1) * POR_PAGINA,
  };
}

/** Pesquisa vazia é a base inteira: exige ao menos termo, fonte com período, ou diploma. */
export function pesquisaValida(f: Filtros): string | null {
  const temTermo = f.termo.trim().length >= 3;
  if (f.termo.trim().length > 0 && !temTermo) return 'Digite ao menos 3 letras.';
  if (f.dataDe && f.dataAte && f.dataDe > f.dataAte) return 'A data inicial é depois da final.';
  if (!temTermo && !f.fonte && !f.identificador && !f.dataDe && !f.dataAte) return 'Informe um termo, ou escolha uma fonte e um período.';
  return null;
}

const dataBr = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);
const texto = (d: Record<string, unknown> | null, chave: string): string | null => {
  const v = d?.[chave];
  return typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
};

/** Título e linha de metadados de um registro, por fonte. */
export function rotuloDoRegistro(r: Pick<Registro, 'fonte' | 'identificador' | 'dispositivo' | 'titulo' | 'data_publicacao' | 'detalhe' | 'atualizado_em'>): { titulo: string; meta: string[] } {
  const d = r.detalhe ?? null;
  if (r.fonte === 'planalto') {
    return {
      titulo: `${r.identificador}${r.dispositivo ? `, ${r.dispositivo}` : ''}`,
      meta: [`texto compilado lido em ${dataBr(r.atualizado_em.slice(0, 10)) ?? '—'}`],
    };
  }
  if (r.fonte === 'tcu') {
    const meta: string[] = [];
    const relator = texto(d, 'relator'); const sessao = dataBr(texto(d, 'data_sessao') ?? r.data_publicacao); const situacao = texto(d, 'situacao'); const ata = texto(d, 'numero_ata');
    if (relator) meta.push(`Relator: ${relator}`);
    if (sessao) meta.push(`Sessão de ${sessao}`);
    if (ata) meta.push(`Ata ${ata}`);
    if (situacao) meta.push(situacao.toLowerCase());
    return { titulo: r.identificador, meta };
  }
  const meta: string[] = [];
  const orgao = texto(d, 'orgao'); const secao = texto(d, 'secao'); const pagina = texto(d, 'pagina'); const edicao = texto(d, 'edicao'); const data = dataBr(r.data_publicacao);
  if (orgao) meta.push(orgao);
  if (data) meta.push(`${secao ? `DOU ${secao}` : 'DOU'} de ${data}${edicao ? `, edição ${edicao}` : ''}${pagina ? `, p. ${pagina}` : ''}`);
  return { titulo: r.titulo ?? r.identificador, meta };
}

/** Facetas por nome, ordenadas por quantidade, para os seletores. */
export function facetasPorNome(facetas: Faceta[]): Record<string, Array<{ valor: string; quantidade: number }>> {
  const r: Record<string, Array<{ valor: string; quantidade: number }>> = {};
  for (const f of facetas) {
    if (f.valor === null || f.valor === undefined) continue;
    (r[f.faceta] ??= []).push({ valor: f.valor, quantidade: Number(f.quantidade) });
  }
  for (const k of Object.keys(r)) r[k].sort((a, b) => b.quantidade - a.quantidade || a.valor.localeCompare(b.valor, 'pt-BR'));
  return r;
}
