/**
 * Unidades de medida — autoridade única.
 *
 * Havia cinco listas no sistema, cada uma num arquivo e com conteúdo próprio:
 * Compras tinha 63 unidades, a Calculadora 16, Itens do Contrato 12, e a
 * referência de NF-e a sua. A unidade escolhida no produto podia não existir na
 * calculadora, e a da calculadora não existir no contrato — o item viajava pelo
 * fluxo perdendo a unidade pelo caminho.
 *
 * Mesma doença do vocabulário de status (princípio 1 do CLAUDE.md), em outro
 * vocabulário. Aqui a lista é uma só; cada tela recorta o que precisa.
 *
 * Duas coisas que este módulo resolve além da lista:
 *
 *  - **Sinônimos.** Telas diferentes gravaram o mesmo conceito de formas
 *    diferentes ("UNID", "Unid.", "UNIDADE"), e extração de edital traz o que o
 *    órgão escreveu. `normalizarUnidade` traz tudo para o código canônico, para
 *    o mesmo produto não contar duas vezes em relatório.
 *  - **O que a SEFAZ aceita.** A NF-e não admite código inventado. `paraNfe`
 *    diz o que enviar, e avisa quando não há correspondência — melhor saber na
 *    emissão do que na rejeição.
 */

export type Unidade = {
  /** Código canônico, como é gravado no banco. */
  codigo: string;
  nome: string;
  /** Grafias que já existem nos dados ou que o usuário digita. */
  sinonimos?: string[];
};

/**
 * Códigos canônicos. Onde havia dois para o mesmo conceito, o que já estava nos
 * dados venceu e o outro virou sinônimo — trocar o código gravado exigiria
 * migrar quatorze tabelas para ganhar estética.
 */
export const UNIDADES: Unidade[] = [
  { codigo: 'UN',    nome: 'Unidade',            sinonimos: ['UNID', 'UNID.', 'UNIDADE', 'UND', 'U'] },
  { codigo: 'PC',    nome: 'Peça',               sinonimos: ['PECA', 'PEÇA', 'PÇ'] },
  { codigo: 'CX',    nome: 'Caixa',              sinonimos: ['CAIXA', 'CX.'] },
  { codigo: 'KG',    nome: 'Quilograma',         sinonimos: ['QUILO', 'QUILOS', 'KG.', 'K'] },
  { codigo: 'G',     nome: 'Grama',              sinonimos: ['GRAMA', 'GRAMAS', 'GR.'] },
  { codigo: 'MG',    nome: 'Miligrama' },
  { codigo: 'TON',   nome: 'Tonelada',           sinonimos: ['T', 'TONELADAS'] },
  { codigo: 'L',     nome: 'Litro',              sinonimos: ['LT.', 'LITRO', 'LITROS'] },
  { codigo: 'ML',    nome: 'Mililitro' },
  { codigo: 'M',     nome: 'Metro',              sinonimos: ['METRO', 'METROS'] },
  { codigo: 'M2',    nome: 'Metro quadrado',     sinonimos: ['M²'] },
  { codigo: 'M3',    nome: 'Metro cúbico',       sinonimos: ['M³'] },
  { codigo: 'MM',    nome: 'Milímetro' },
  { codigo: 'CM',    nome: 'Centímetro' },
  { codigo: 'PCT',   nome: 'Pacote',             sinonimos: ['PACOTE', 'PACOTES', 'PCTE'] },
  { codigo: 'FD',    nome: 'Fardo',              sinonimos: ['FARDO'] },
  { codigo: 'SC',    nome: 'Saco',               sinonimos: ['SACO', 'SACA', 'SACOS'] },
  { codigo: 'EMB',   nome: 'Embalagem',          sinonimos: ['EMBALAGEM'] },
  { codigo: 'FR',    nome: 'Frasco',             sinonimos: ['FRC', 'FRASCO', 'FRASCOS'] },
  { codigo: 'AMP',   nome: 'Ampola',             sinonimos: ['AMPOLA'] },
  { codigo: 'LT',    nome: 'Lata',               sinonimos: ['LATA', 'LATAS'] },
  { codigo: 'GF',    nome: 'Garrafa',            sinonimos: ['GARRAFA'] },
  { codigo: 'GL',    nome: 'Galão',              sinonimos: ['GALAO', 'GALÃO'] },
  { codigo: 'BD',    nome: 'Balde' },
  { codigo: 'BOMB',  nome: 'Bombona' },
  { codigo: 'POTE',  nome: 'Pote' },
  { codigo: 'TB',    nome: 'Tubo' },
  { codigo: 'BSA',   nome: 'Bolsa' },
  { codigo: 'EN',    nome: 'Envelope' },
  { codigo: 'CRT',   nome: 'Cartela' },
  { codigo: 'CPS',   nome: 'Cápsula' },
  { codigo: 'BLC',   nome: 'Bloco',              sinonimos: ['BLOCO', 'BL'] },
  { codigo: 'RES',   nome: 'Resma',              sinonimos: ['RESMA'] },
  { codigo: 'RL',    nome: 'Rolo',               sinonimos: ['ROLO'] },
  { codigo: 'BO',    nome: 'Bobina' },
  { codigo: 'PAR',   nome: 'Par' },
  { codigo: 'JG',    nome: 'Jogo',               sinonimos: ['JOGO'] },
  { codigo: 'CJ',    nome: 'Conjunto',           sinonimos: ['CONJUNTO'] },
  { codigo: 'KIT',   nome: 'Kit' },
  { codigo: 'DZ',    nome: 'Dúzia',              sinonimos: ['DUZIA', 'DÚZIA'] },
  { codigo: 'CT',    nome: 'Cento' },
  { codigo: 'GR',    nome: 'Grosa' },
  { codigo: 'CXE',   nome: 'Caixa com embalagem' },
  { codigo: 'HR',    nome: 'Hora',               sinonimos: ['HORA', 'HORAS', 'H'] },
  { codigo: 'DIA',   nome: 'Dia',                sinonimos: ['DIAS'] },
  { codigo: 'MES',   nome: 'Mês',                sinonimos: ['MÊS', 'MESES'] },
  { codigo: 'SERV',  nome: 'Serviço',            sinonimos: ['SV', 'SERVICO', 'SERVIÇO'] },
];

/** As que aparecem primeiro no seletor. Recorte da lista, não outra lista. */
export const CODIGOS_MAIS_USADOS = ['UN', 'PC', 'CX', 'KG', 'L', 'M', 'PCT', 'SC'];

const POR_CODIGO = new Map(UNIDADES.map((u) => [u.codigo, u]));

/** Índice de busca: código e sinônimos, todos em maiúsculas sem pontuação. */
const INDICE = (() => {
  const m = new Map<string, string>();
  for (const u of UNIDADES) {
    m.set(chave(u.codigo), u.codigo);
    m.set(chave(u.nome), u.codigo);
    for (const s of u.sinonimos ?? []) m.set(chave(s), u.codigo);
  }
  return m;
})();

function chave(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Traz uma grafia qualquer para o código canônico. Devolve o texto original em
 * maiúsculas quando não reconhece — unidade vinda de edital não pode ser
 * descartada só porque não está na lista.
 *
 * Os dados reais trouxeram exemplos de por que não descartar: 'Embalagem 2 L',
 * 'Botijão 13 KG', 'Caixa 1 L' são descrição no campo errado, e 'QCG' é código
 * que não reconhecemos. Nenhum vira outra coisa por adivinhação — quem decide
 * o que fazer com eles é quem conhece o edital.
 */
export function normalizarUnidade(texto: string | null | undefined): string {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return '';
  return INDICE.get(chave(bruto)) ?? bruto.toUpperCase();
}

/** "Quilograma (KG)" — o que o seletor mostra. */
export function rotuloDaUnidade(codigo: string | null | undefined): string {
  const c = normalizarUnidade(codigo);
  const u = POR_CODIGO.get(c);
  return u ? `${u.nome} (${u.codigo})` : c;
}

export const unidadesMaisUsadas = (): Unidade[] =>
  CODIGOS_MAIS_USADOS.map((c) => POR_CODIGO.get(c)!).filter(Boolean);

/** Busca por código ou nome, para o campo com filtro. */
export function buscarUnidades(termo: string): Unidade[] {
  const t = chave(termo);
  if (!t) return UNIDADES;
  return UNIDADES.filter((u) =>
    chave(u.codigo).includes(t) ||
    chave(u.nome).includes(t) ||
    (u.sinonimos ?? []).some((s) => chave(s).includes(t)));
}

/**
 * O que a SEFAZ aceita. Código fora desta lista é recusado na emissão, então
 * vale saber antes: `null` significa "não há correspondência — escolha outra".
 */
const NFE = new Set(['UN', 'PC', 'CX', 'KG', 'G', 'L', 'ML', 'M', 'M2', 'M3', 'PAR', 'DZ', 'GF', 'PCT', 'SC', 'TON']);

export function paraNfe(codigo: string | null | undefined): string | null {
  const c = normalizarUnidade(codigo);
  return NFE.has(c) ? c : null;
}
