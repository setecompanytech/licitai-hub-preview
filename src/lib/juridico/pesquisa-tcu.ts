/**
 * Pesquisa ao vivo no TCU — o que a tela manda à edge `tcu-pesquisa` e como
 * mostra o que volta (27/09/2026). Puro: a tela só chama. A gramática do
 * filtro fica na edge (`_shared/tcu-pesquisa.ts`), uma só.
 */
export type OrdemTcu = 'relevancia' | 'recentes' | 'antigos';
export type FiltrosTcuTela = {
  termo: string;
  numero: string;
  ano: string;
  colegiado: string[];
  relator: string;
  processo: string;
  entidade: string;
  tipo: string[];
  dataDe: string;   // AAAA-MM-DD
  dataAte: string;
  ordem: OrdemTcu;
  pagina: number;
};
export const POR_PAGINA_TCU = 20;
export const FILTROS_TCU_INICIAIS: FiltrosTcuTela = { termo: '', numero: '', ano: '', colegiado: [], relator: '', processo: '', entidade: '', tipo: [], dataDe: '', dataAte: '', ordem: 'relevancia', pagina: 1 };
export const COLEGIADOS = ['Plenário', 'Primeira Câmara', 'Segunda Câmara'];
export const NOME_DA_ORDEM: Record<OrdemTcu, string> = { relevancia: 'Relevância', recentes: 'Mais recentes', antigos: 'Mais antigos' };

/** Os operadores do portal, para a ajuda ao lado do campo de termo. */
export const OPERADORES_TCU: Array<{ operador: string; exemplo: string; significado: string }> = [
  { operador: 'aspas', exemplo: '"capacidade técnica"', significado: 'a expressão exata' },
  { operador: 'e', exemplo: 'atestado e quantitativo', significado: 'as duas palavras (é o padrão entre palavras)' },
  { operador: 'ou', exemplo: 'reajuste ou repactuação', significado: 'qualquer uma' },
  { operador: 'não', exemplo: 'atestado não engenharia', significado: 'exclui a palavra' },
  { operador: 'adj', exemplo: 'atestado adj capacidade', significado: 'uma ao lado da outra, nesta ordem' },
  { operador: 'prox', exemplo: 'atestado prox quantitativo', significado: 'próximas uma da outra, em qualquer ordem' },
  { operador: 'mesmo', exemplo: 'atestado mesmo percentual', significado: 'no mesmo parágrafo' },
  { operador: '$', exemplo: 'reajust$', significado: 'qualquer terminação (reajuste, reajustamento…)' },
];

export type AcordaoDaTela = {
  key: string; tipo: string; titulo: string; numero: string; ano: string; colegiado: string; relator: string | null;
  data_sessao: string | null; data_sessao_br: string | null; numero_ata: string | null; processo: string | null; situacao: string | null;
  fragmentos: string[]; url_pdf: string | null; url_doc: string | null; url_portal: string;
};
export type Faceta = { valor: string; quantidade: number; grupo?: string };
export type RespostaDaTela = {
  total: number; inicio: number; documentos: AcordaoDaTela[];
  facetas: { tipo: Faceta[]; colegiado: Faceta[]; relator: Faceta[]; ano: Faceta[] };
  alerta: string | null; sugestao: string | null; filtro: string; na_base: string[]; so_sumario: string[];
};

/** O corpo do POST à edge: a tela manda campos, a edge monta o filtro. */
export function corpoDaPesquisa(f: FiltrosTcuTela): Record<string, unknown> {
  return {
    acao: 'pesquisar',
    termo: f.termo.trim(),
    filtros: {
      numero: f.numero.trim() || null, ano: f.ano.trim() || null, colegiado: f.colegiado, relator: f.relator.trim() || null,
      processo: f.processo.trim() || null, entidade: f.entidade.trim() || null, tipo: f.tipo, dataDe: f.dataDe || null, dataAte: f.dataAte || null,
    },
    ordem: f.termo.trim() ? f.ordem : (f.ordem === 'relevancia' ? 'recentes' : f.ordem),
    pagina: Math.max(f.pagina, 1),
    porPagina: POR_PAGINA_TCU,
  };
}

/** Tem algo para pesquisar? Termo ou ao menos um filtro; período coerente. */
export function pesquisaTcuValida(f: FiltrosTcuTela): string | null {
  if (f.dataDe && f.dataAte && f.dataDe > f.dataAte) return 'A data inicial é depois da final.';
  if (f.ano && !/^\d{4}$/.test(f.ano.trim())) return 'Ano com 4 dígitos.';
  const temFiltro = Boolean(f.numero.trim() || f.ano.trim() || f.colegiado.length || f.relator.trim() || f.processo.trim() || f.entidade.trim() || f.tipo.length || f.dataDe || f.dataAte);
  if (!f.termo.trim() && !temFiltro) return 'Informe um termo ou ao menos um filtro (número, ano, relator, período…).';
  return null;
}

/** O identificador no padrão da base, para saber se o acórdão já está guardado. */
export const identificadorDoResumo = (d: Pick<AcordaoDaTela, 'tipo' | 'numero' | 'ano' | 'colegiado'>) => `${/decis/i.test(d.tipo) ? 'Decisão' : 'Acórdão'} ${d.numero}/${d.ano}-${d.colegiado}`;

/** O trecho do portal vem com <em> em volta da palavra; aqui vira texto + destaque, sem HTML. */
export function segmentosDoFragmento(html: string): Array<{ texto: string; destaque: boolean }> {
  const partes: Array<{ texto: string; destaque: boolean }> = [];
  const limpo = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const re = /<em>(.*?)<\/em>/gis;
  let ultimo = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > ultimo) partes.push({ texto: limpo(html.slice(ultimo, m.index)), destaque: false });
    partes.push({ texto: limpo(m[1]), destaque: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < html.length) partes.push({ texto: limpo(html.slice(ultimo)), destaque: false });
  return partes.filter((p) => p.texto.length > 0);
}

/** "Página 2 de 1.027 · 20.536 acórdão(s)" */
export function resumoDaPagina(total: number, pagina: number, porPagina = POR_PAGINA_TCU): string {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return `${total.toLocaleString('pt-BR')} acórdão(s) · página ${Math.min(pagina, paginas).toLocaleString('pt-BR')} de ${paginas.toLocaleString('pt-BR')}`;
}

/** Os filtros em uso, como fichas removíveis. `limpar` é o pedaço que zera aquele filtro. */
export type Ficha = { chave: string; rotulo: string; limpar: Partial<FiltrosTcuTela> };
export function fichasAtivas(f: FiltrosTcuTela): Ficha[] {
  const r: Ficha[] = [];
  const br = (iso: string) => iso.split('-').reverse().join('/');
  if (f.numero.trim()) r.push({ chave: 'numero', rotulo: `nº ${f.numero.trim()}`, limpar: { numero: '' } });
  if (f.ano.trim()) r.push({ chave: 'ano', rotulo: `ano ${f.ano.trim()}`, limpar: { ano: '' } });
  for (const c of f.colegiado) r.push({ chave: `colegiado:${c}`, rotulo: c, limpar: { colegiado: f.colegiado.filter((v) => v !== c) } });
  if (f.relator.trim()) r.push({ chave: 'relator', rotulo: `relator ${f.relator.trim()}`, limpar: { relator: '' } });
  if (f.processo.trim()) r.push({ chave: 'processo', rotulo: `TC ${f.processo.trim()}`, limpar: { processo: '' } });
  if (f.entidade.trim()) r.push({ chave: 'entidade', rotulo: f.entidade.trim(), limpar: { entidade: '' } });
  for (const t of f.tipo) r.push({ chave: `tipo:${t}`, rotulo: t.toLowerCase(), limpar: { tipo: f.tipo.filter((v) => v !== t) } });
  if (f.dataDe || f.dataAte) r.push({ chave: 'periodo', rotulo: `sessão ${f.dataDe ? br(f.dataDe) : '…'} a ${f.dataAte ? br(f.dataAte) : 'hoje'}`, limpar: { dataDe: '', dataAte: '' } });
  return r;
}

/** Citação pronta para a peça: "Acórdão 2418/2026-Plenário, rel. Min. Benjamin Zymler, sessão de 09/09/2026 (TC 015.392/2026-0)". */
export function citacaoDoAcordao(d: Pick<AcordaoDaTela, 'tipo' | 'numero' | 'ano' | 'colegiado' | 'relator' | 'data_sessao_br' | 'processo'>): string {
  const nome = d.relator ? d.relator.toLowerCase().replace(/(^|\s)(\S)/g, (_m, sp: string, c: string) => sp + c.toUpperCase()).replace(/\b(De|Do|Da|Dos|Das)\b/g, (m) => m.toLowerCase()) : null;
  return [identificadorDoResumo(d), nome ? `rel. Min. ${nome}` : null, d.data_sessao_br ? `sessão de ${d.data_sessao_br}` : null].filter(Boolean).join(', ') + (d.processo ? ` (TC ${d.processo})` : '');
}

/** Pesquisas de exemplo para a tela vazia — cada uma mostra um operador. */
export const EXEMPLOS_TCU: Array<{ termo: string; porque: string }> = [
  { termo: '"atestado de capacidade técnica" e quantitativo', porque: 'expressão exata + outra palavra' },
  { termo: 'reajust$ e "data-base"', porque: 'radical com $ pega reajuste e reajustamento' },
  { termo: 'repactuação prox "convenção coletiva"', porque: 'palavras próximas, em qualquer ordem' },
  { termo: '"registro de preços" não adesão', porque: 'exclui uma palavra' },
];
