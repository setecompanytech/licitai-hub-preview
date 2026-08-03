/**
 * Normalização de modalidade para os códigos usados nos valores-alvo.
 *
 * `licitacoes.modalidade` e `contratos.modalidade` são texto livre e chegam com
 * grafias variadas ("Pregão Eletrônico", "Pregão - Eletrônico", "PREGAO
 * ELETRONICO", "Concorrência - Eletrônica"). Sem normalizar, a parametrização
 * por modalidade não casaria com o dado real.
 */

export type ModalidadeCodigo =
  | 'pregao_eletronico'
  | 'pregao_presencial'
  | 'dispensa'
  | 'inexigibilidade'
  | 'concorrencia'
  | 'concurso'
  | 'leilao'
  | 'tomada_precos'
  | 'convite'
  | 'credenciamento'
  | 'outra';

export const MODALIDADES: { codigo: ModalidadeCodigo; label: string }[] = [
  { codigo: 'pregao_eletronico', label: 'Pregão Eletrônico' },
  { codigo: 'pregao_presencial', label: 'Pregão Presencial' },
  { codigo: 'dispensa', label: 'Dispensa de Licitação' },
  { codigo: 'inexigibilidade', label: 'Inexigibilidade' },
  { codigo: 'concorrencia', label: 'Concorrência' },
  { codigo: 'tomada_precos', label: 'Tomada de Preços' },
  { codigo: 'convite', label: 'Convite' },
  { codigo: 'credenciamento', label: 'Credenciamento' },
  { codigo: 'concurso', label: 'Concurso' },
  { codigo: 'leilao', label: 'Leilão' },
  { codigo: 'outra', label: 'Outra' },
];

const LABEL_POR_CODIGO = new Map(MODALIDADES.map((m) => [m.codigo, m.label]));

/** Minúsculas, sem acento e sem pontuação — para comparar grafias diferentes. */
function achatar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Converte o texto livre da modalidade no código canônico.
 * A ordem importa: "pregão presencial" precisa ser testado antes de "pregão".
 */
export function normalizarModalidade(texto: string | null | undefined): ModalidadeCodigo {
  const t = achatar(texto ?? '');
  if (!t) return 'outra';

  const ehPregao = t.includes('pregao');
  if (ehPregao && (t.includes('presencial') || t.includes('nao eletronico'))) return 'pregao_presencial';
  if (ehPregao) return 'pregao_eletronico'; // pregão sem qualificador é eletrônico por padrão

  if (t.includes('dispensa')) return 'dispensa';
  if (t.includes('inexigib')) return 'inexigibilidade';
  if (t.includes('credenciamento')) return 'credenciamento';
  if (t.includes('tomada')) return 'tomada_precos';
  if (t.includes('convite')) return 'convite';
  if (t.includes('concorrencia')) return 'concorrencia';
  if (t.includes('concurso')) return 'concurso';
  if (t.includes('leilao')) return 'leilao';

  return 'outra';
}

export function rotuloModalidade(codigo: string): string {
  return LABEL_POR_CODIGO.get(codigo as ModalidadeCodigo) ?? codigo;
}
