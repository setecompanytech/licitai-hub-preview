/**
 * ATA de Registro de Preços, Contrato Administrativo e Termo Aditivo —
 * vocabulário único dos instrumentos da contratação pública.
 *
 * Os três são etapas sequenciais de uma mesma compra, e o sistema os tratava
 * como rótulos de um seletor. Sem a distinção declarada, quem cadastra escolhe
 * pelo nome que parece certo — e ATA registrada como contrato quebra o controle
 * de saldo (a ATA não obriga a comprar; o contrato sim), enquanto aditivo
 * lançado como contrato novo duplica o valor nas metas e na bonificação.
 *
 * Mesma disciplina do vocabulário de status e do de unidades: uma fonte, um
 * lugar. As referências legais orientam quem preenche; não substituem a leitura
 * do edital nem a conferência de quem responde pelo processo.
 */

export type Instrumento = 'ata_srp' | 'contrato' | 'aditivo';

export const INSTRUMENTOS: Record<Instrumento, {
  nome: string;
  /** O que é, em uma frase — o que a tela mostra ao selecionar. */
  resumo: string;
  /** O papel dele na sequência da compra. */
  papel: string;
  amparo: string;
}> = {
  ata_srp: {
    nome: 'Ata de Registro de Preços',
    resumo:
      'Registra preços e fornecedores após a licitação. NÃO obriga a Administração a comprar — ' +
      'garante o preço por um prazo, para quando a compra for necessária.',
    papel:
      'É a base legal do contrato que vier depois. Genérica: vale para os itens registrados, ' +
      'sem definir quando nem quanto será efetivamente adquirido.',
    amparo: 'Lei 14.133/2021, arts. 82 a 86',
  },
  contrato: {
    nome: 'Contrato Administrativo',
    resumo:
      'O acordo real de compra ou serviço. Define prazos, valores e obrigações das duas partes.',
    papel:
      'Nasce quando a Administração precisa do item — em geral a partir de uma ATA, mas também ' +
      'direto da licitação. Específico: é ele que gera saldo a consumir e entrega a executar.',
    amparo: 'Lei 14.133/2021, arts. 89 e seguintes',
  },
  aditivo: {
    nome: 'Termo Aditivo',
    resumo:
      'Altera um contrato em execução: valor, quantidade ou prazo. Não é contrato novo.',
    papel:
      'Evita cancelar a compra e refazer a licitação quando a realidade muda. Lançar aditivo ' +
      'como contrato novo dobraria o valor no controle de saldo e nas metas.',
    amparo: 'Lei 14.133/2021, arts. 124 a 136',
  },
};

/** A sequência, para a tela poder mostrar onde o documento se encaixa. */
export const SEQUENCIA: Instrumento[] = ['ata_srp', 'contrato', 'aditivo'];

/**
 * Limites de alteração que a lei fixa — informativos, para quem preenche saber
 * quando o aditivo extrapola o que o contrato comporta.
 *
 * A conferência final é de quem responde pelo processo: há exceções e o
 * percentual incide sobre o valor inicial atualizado do contrato.
 */
export const LIMITES_ADITIVO = {
  acrescimoPadrao: 25,
  acrescimoReforma: 50,
  supressao: 25,
  observacao:
    'Acréscimos e supressões até 25% do valor inicial atualizado; 50% para acréscimo em ' +
    'reforma de edifício ou de equipamento (Lei 14.133/2021, art. 125).',
} as const;

/** Vigência da ATA, que é onde mais se erra ao cadastrar. */
export const VIGENCIA_ATA = {
  mesesPadrao: 12,
  observacao:
    'A ata vigora por 1 ano, prorrogável por igual período desde que comprovado preço vantajoso ' +
    '(Lei 14.133/2021, art. 84).',
} as const;

/** Rótulo curto para selos e cabeçalhos. */
export const rotuloInstrumento = (i: Instrumento): string => INSTRUMENTOS[i].nome;

/**
 * Traduz o `tipo_documento` gravado em `contratos` para o instrumento.
 * Aditivo não é linha de `contratos` — vive em `contrato_aditivos` —, por isso
 * não aparece aqui: é a própria distinção que o modelo já respeita.
 */
export function instrumentoDoTipo(tipo: string | null | undefined): Instrumento {
  return String(tipo ?? '') === 'ata_srp' ? 'ata_srp' : 'contrato';
}
