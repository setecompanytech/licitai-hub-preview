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
export type Faceta = { valor: string; quantidade: number };
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
