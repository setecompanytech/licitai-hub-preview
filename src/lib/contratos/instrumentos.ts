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

/**
 * Como a ATA será executada — e o que a lei exige de cada caminho.
 *
 * O art. 95 permite substituir o termo de contrato pela nota de empenho, mas só
 * em duas hipóteses. Fora delas — entrega parcelada, serviço contínuo, qualquer
 * obrigação que se estenda no tempo — o contrato formal é obrigatório, e usar
 * só o empenho é falha grave do processo administrativo.
 *
 * Declarar a forma é o que permite ao sistema perceber a contradição depois:
 * uma ATA registrada como entrega imediata e integral que acumula pedidos ao
 * longo dos meses está sendo executada de forma parcelada.
 */
export type FormaExecucao = 'contrato_formal' | 'empenho';

export const FORMAS_EXECUCAO: Record<FormaExecucao, { nome: string; desc: string }> = {
  contrato_formal: {
    nome: 'Termo de contrato',
    desc: 'O caminho padrão. Obrigatório quando houver entrega parcelada, serviço contínuo ou qualquer obrigação futura do fornecedor.',
  },
  empenho: {
    nome: 'Nota de empenho (sem contrato)',
    desc: 'Substitui o termo de contrato nas hipóteses do art. 95. Exige que a execução se esgote no ato.',
  },
};

export type FundamentoArt95 = 'entrega_imediata' | 'valor_dispensa';

export const FUNDAMENTOS_ART95: Record<FundamentoArt95, { nome: string; desc: string }> = {
  entrega_imediata: {
    nome: 'Entrega imediata e integral',
    desc: 'Bens entregues de uma só vez, com pagamento imediato e SEM obrigação futura — nem assistência técnica, nem garantia de execução continuada.',
  },
  valor_dispensa: {
    nome: 'Valor dentro do limite de dispensa',
    desc: 'O valor total cabe no limite de dispensa por valor, ainda que o preço venha de licitação maior.',
  },
};

export const AMPARO_ART95 = 'Lei 14.133/2021, art. 95';

/**
 * A contradição que o sistema pode detectar: execução declarada como imediata e
 * integral, mas com mais de um pedido — o que caracteriza parcelamento.
 *
 * Devolve o aviso, ou null quando não há o que apontar. Não bloqueia: quem
 * conhece o processo pode ter razão que o sistema não vê, e travar aqui
 * empurraria a pessoa para registrar fora do sistema.
 */
export function avisoDeExecucaoIncompativel(params: {
  formaExecucao: string | null | undefined;
  fundamento: string | null | undefined;
  quantidadePedidos: number;
}): string | null {
  if (params.formaExecucao !== 'empenho') return null;
  if (params.fundamento !== 'entrega_imediata') return null;
  if (params.quantidadePedidos <= 1) return null;
  return (
    `Esta ATA foi declarada como entrega imediata e integral, mas já tem ` +
    `${params.quantidadePedidos} pedidos. Entrega parcelada exige termo de contrato ` +
    `(${AMPARO_ART95}) — confira se a hipótese ainda se aplica.`
  );
}

// ─── Reajuste × revisão ─────────────────────────────────────────────────────
/**
 * Dois institutos que o sistema tratava como um só "valor sem limite".
 *
 * Estar ambos fora do teto do art. 125 está correto — nenhum dos dois acresce
 * objeto. Mas o que cada um exige é diferente, e pedir os campos errados faz o
 * pedido nascer sem a prova que o sustenta:
 *
 *  - **Reajuste** é a inflação rotineira, prevista no contrato: aplica-se um
 *    índice oficial a partir de uma data-base. Não se discute mérito.
 *  - **Revisão / reequilíbrio** é evento extraordinário: exige fato imprevisível
 *    (ou previsível de consequências incalculáveis) POSTERIOR à proposta,
 *    ausência de culpa do contratado e prova documental do impacto.
 */
export type NaturezaDoValor = 'reajuste' | 'revisao';

export const NATUREZA_DO_VALOR: Record<NaturezaDoValor, {
  nome: string;
  desc: string;
  amparo: string;
  exige: string[];
}> = {
  reajuste: {
    nome: 'Reajuste',
    desc: 'Recomposição da inflação rotineira, pelo índice e periodicidade previstos no contrato.',
    amparo: 'Lei 14.133/2021, art. 92, § 3º',
    exige: ['Índice contratual', 'Data-base', 'Periodicidade cumprida'],
  },
  revisao: {
    nome: 'Revisão / Reequilíbrio econômico-financeiro',
    desc: 'Recomposição por evento extraordinário que rompeu a equação econômico-financeira.',
    amparo: 'Lei 14.133/2021, art. 124, II, "d" · CF, art. 37, XXI',
    exige: [
      'Fato imprevisível, ou previsível de consequências incalculáveis',
      'Ocorrido APÓS a apresentação da proposta',
      'Ausência de culpa do contratado',
      'Prova documental do aumento de custos',
    ],
  },
};

/** Tipos de aditivo que carregam natureza de valor — os demais não. */
export const TIPOS_REAJUSTE = ['reajuste', 'repactuacao'];
export const TIPOS_REVISAO = ['revisao', 'reequilibrio'];

export const naturezaDoTipo = (tipo: string): NaturezaDoValor | null =>
  TIPOS_REAJUSTE.includes(tipo) ? 'reajuste'
  : TIPOS_REVISAO.includes(tipo) ? 'revisao'
  : null;

/**
 * Preclusão lógica: assinar prorrogação sem ressalva depois do fato gerador
 * pode ser lido como aceitação dos preços antigos — e renúncia ao reequilíbrio.
 *
 * O sistema tem os dados para apontar isso (datas e tipos dos aditivos) e não os
 * cruzava. Avisa, não impede: a interpretação é jurídica, e quem responde pelo
 * contrato pode ter ressalva registrada fora do sistema.
 */
export function avisoDePreclusao(params: {
  dataFatoGerador: string | null | undefined;
  /** Aditivos de prorrogação já assinados no contrato. */
  prorrogacoes: { data_assinatura: string | null; com_ressalva?: boolean | null }[];
}): string | null {
  const fato = params.dataFatoGerador?.slice(0, 10);
  if (!fato) return null;

  const posteriores = params.prorrogacoes.filter(
    (a) => a.data_assinatura && a.data_assinatura.slice(0, 10) > fato && !a.com_ressalva,
  );
  if (posteriores.length === 0) return null;

  const datas = posteriores
    .map((a) => new Date(a.data_assinatura!.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR'))
    .join(', ');

  return (
    `Há prorrogação assinada sem ressalva depois do fato gerador (${datas}). ` +
    'Assinar prorrogação sem ressalvar os preços pode ser interpretado como aceitação ' +
    'dos valores antigos e renúncia ao reequilíbrio. Verifique se houve ressalva no termo.'
  );
}

// ─── Vigência por espécie do objeto ─────────────────────────────────────────
/**
 * O teto de 120 meses valia para tudo, e não é assim: dez anos só cabem em
 * serviço ou fornecimento contínuo. Compra com entrega imediata se esgota no
 * ato; locação de informática tem teto próprio.
 *
 * Os limites orientam quem preenche — o caso concreto e o edital mandam.
 */
export type EspecieObjeto =
  | 'compra_entrega_imediata'
  | 'servico_continuo'
  | 'servico_escopo'
  | 'informatica';

export const ESPECIES_OBJETO: Record<EspecieObjeto, {
  nome: string;
  limiteMeses: number;
  desc: string;
  amparo: string;
}> = {
  compra_entrega_imediata: {
    nome: 'Compra com entrega imediata e integral',
    limiteMeses: 12,
    desc: 'Esgota-se na entrega. Não se prorroga: nova necessidade pede nova contratação.',
    amparo: 'Lei 14.133/2021, art. 105',
  },
  servico_continuo: {
    nome: 'Serviço ou fornecimento contínuo',
    limiteMeses: 120,
    desc: 'Vigência inicial de até 5 anos, prorrogável sucessivamente até 10 anos no total.',
    amparo: 'Lei 14.133/2021, arts. 106 e 107',
  },
  servico_escopo: {
    nome: 'Serviço por escopo (obra ou entrega definida)',
    limiteMeses: 60,
    desc: 'Dura o necessário para concluir o objeto; a prorrogação acompanha o cronograma.',
    amparo: 'Lei 14.133/2021, art. 111',
  },
  informatica: {
    nome: 'Locação de equipamentos ou programas de informática',
    limiteMeses: 48,
    desc: 'Prazo máximo de 4 anos.',
    amparo: 'Lei 14.133/2021, art. 109',
  },
};

/** Aviso quando a vigência informada passa do que a espécie comporta. */
export function avisoDeVigencia(
  especie: string | null | undefined,
  meses: number | null | undefined,
): string | null {
  const e = ESPECIES_OBJETO[especie as EspecieObjeto];
  if (!e || !meses || meses <= e.limiteMeses) return null;
  return (
    `${meses} meses ultrapassa o limite de ${e.limiteMeses} para ${e.nome.toLowerCase()} ` +
    `(${e.amparo}). Confira a espécie do objeto ou o prazo informado.`
  );
}
