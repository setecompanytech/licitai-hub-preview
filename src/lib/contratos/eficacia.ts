import { somarDiasUteis, diasAte } from '@/lib/contratos/prazo-de-entrega';
import { hojeLocal, deDataLocal } from '@/lib/financeiro/data-local';

/**
 * Validade e eficácia — duas coisas que a tela tratava como uma só.
 *
 * O contrato administrativo é VÁLIDO quando assinado por agente competente,
 * com objeto lícito e na forma prescrita em lei. Ele existe no mundo jurídico
 * a partir daí.
 *
 * Mas ele só é EFICAZ depois de divulgado. A Lei 14.133/2021, art. 94, é
 * explícita: a divulgação no Portal Nacional de Contratações Públicas é
 * "condição indispensável para a eficácia do contrato e de seus aditamentos".
 * Antes disso o ajuste não produz efeitos, não gera obrigação de execução e
 * não gera obrigação financeira.
 *
 * ── Por que isso importa para quem VENDE, e não para quem compra ────────────
 *
 * Publicar é dever do órgão, não do fornecedor. Mas quem paga o preço de
 * executar antes da eficácia é o fornecedor: entrega feita sob contrato ainda
 * ineficaz é entrega sem título que a sustente, e a conta a receber que nasce
 * dela nasce contestável.
 *
 * Por isso os alertas daqui nunca acusam o assinante de estar atrasado — o
 * prazo é do órgão. Eles dizem outra coisa: **ainda não comece**, e **cobre a
 * publicação**.
 */

/** Prazo do art. 94, contado da assinatura, em DIAS ÚTEIS. */
export const PRAZO_DIVULGACAO = {
  /** Art. 94, I — contrato decorrente de licitação. */
  licitacao: 20,
  /** Art. 94, II — contratação direta (dispensa, inexigibilidade). */
  direta: 10,
} as const;

export type OrigemDaContratacao = 'licitacao' | 'direta';

/**
 * Dispensa e inexigibilidade são contratação DIRETA — prazo de 10 dias úteis.
 * O resto (pregão, concorrência, concurso, leilão, diálogo competitivo) decorre
 * de licitação — 20 dias úteis.
 *
 * Na dúvida, devolve `licitacao`: 20 dias é o prazo mais LONGO, e supor o mais
 * longo evita acusar atraso que não existe. Alarme falso ensina a ignorar o
 * alarme.
 */
export function origemPelaModalidade(modalidade: string | null | undefined): OrigemDaContratacao {
  const m = (modalidade ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return /dispensa|inexigibilidade|inexigivel/.test(m) ? 'direta' : 'licitacao';
}

export type EstadoDaEficacia =
  | 'nao_assinado'
  | 'assinatura_incompleta'
  | 'aguardando_divulgacao'
  | 'divulgacao_atrasada'
  /**
   * O sistema não tem o extrato — e isso NÃO significa que não foi publicado.
   *
   * Distinção que custou caro em outros cantos deste produto: `grupo_dre` nulo
   * não quer dizer "é receita", e publicação não registrada não quer dizer
   * "não publicada". Um contrato que vem sendo executado há dois anos foi
   * publicado; o que falta é alguém ter digitado.
   *
   * Gritar "prazo vencido há 700 dias" num contrato desses é o alarme falso
   * que ensina a ignorar o alarme — e aí o próximo, verdadeiro, passa batido.
   */
  | 'publicacao_nao_registrada'
  | 'eficaz_por_urgencia'
  | 'eficaz';

export type SituacaoJuridica = {
  estado: EstadoDaEficacia;
  /** Pode começar a executar? É a pergunta que o fornecedor precisa responder. */
  podeExecutar: boolean;
  /** Data-limite do órgão para divulgar, quando aplicável. */
  limiteDivulgacao: string | null;
  /** Dias até (ou depois de) esse limite. */
  dias: number | null;
  titulo: string;
  detalhe: string;
  severidade: 'critico' | 'atencao' | 'ok';
};

export type EntradaDaEficacia = {
  dataAssinatura?: string | null;
  /** Quem assinou o instrumento. Documento com uma assinatura só não é ajuste. */
  assinaturaSituacao?: 'ambas' | 'so_contratada' | 'so_orgao' | 'nenhuma' | null;
  /** Data da divulgação no PNCP ou no diário — a que dá eficácia. */
  dataDivulgacao?: string | null;
  modalidade?: string | null;
  /** Art. 94, §1º: contrato de urgência tem eficácia da assinatura. */
  urgencia?: boolean;
  /**
   * O contrato já está sendo executado (tem pedido ou consumo)?
   *
   * Muda o sentido da falta de extrato: execução em curso é evidência de que a
   * publicação saiu e não foi registrada aqui. Sem execução nenhuma, a falta
   * de extrato é o que parece — e aí vale travar.
   */
  temExecucao?: boolean;
  feriados?: string[];
  hoje?: string;
};

/**
 * A situação jurídica do instrumento, em uma resposta.
 *
 * A ordem das checagens é a ordem da lei: primeiro existe (assinatura), depois
 * produz efeitos (divulgação). Não adianta cobrar publicação de um documento
 * que ninguém assinou.
 */
export function situacaoJuridica(e: EntradaDaEficacia): SituacaoJuridica {
  const hoje = e.hoje ?? hojeLocal();
  const base = { limiteDivulgacao: null, dias: null } as const;

  if (!e.dataAssinatura || e.assinaturaSituacao === 'nenhuma') {
    return {
      ...base,
      estado: 'nao_assinado',
      podeExecutar: false,
      severidade: 'critico',
      titulo: 'Instrumento sem assinatura',
      detalhe:
        'Sem assinatura das partes competentes o contrato não existe juridicamente — não há o que executar nem o que cobrar.',
    };
  }

  if (e.assinaturaSituacao === 'so_contratada' || e.assinaturaSituacao === 'so_orgao') {
    const quem = e.assinaturaSituacao === 'so_contratada' ? 'a contratada' : 'o órgão';
    const falta = e.assinaturaSituacao === 'so_contratada' ? 'o órgão' : 'a contratada';
    return {
      ...base,
      estado: 'assinatura_incompleta',
      podeExecutar: false,
      severidade: 'critico',
      titulo: 'Assinado por apenas uma das partes',
      detalhe:
        `O documento anexado traz a assinatura ${quem === 'a contratada' ? 'da contratada' : 'do órgão'}, mas não ${falta === 'o órgão' ? 'a do órgão' : 'a da contratada'}. ` +
        'Instrumento com uma assinatura só é proposta, não ajuste: não vincula ninguém e não inicia prazo nenhum.',
    };
  }

  // Assinado pelas duas partes. O contrato é VÁLIDO. Falta a eficácia.
  const origem = origemPelaModalidade(e.modalidade);
  const prazo = PRAZO_DIVULGACAO[origem];
  const limite = somarDiasUteis(e.dataAssinatura, prazo, e.feriados ?? []);
  const dias = diasAte(limite, hoje);
  const limiteBr = deDataLocal(limite).toLocaleDateString('pt-BR');
  const nomeDaOrigem = origem === 'direta' ? 'contratação direta' : 'licitação';

  if (e.dataDivulgacao) {
    return {
      estado: 'eficaz',
      podeExecutar: true,
      limiteDivulgacao: limite,
      dias,
      severidade: 'ok',
      titulo: 'Válido e eficaz',
      detalhe:
        `Assinado e divulgado em ${deDataLocal(e.dataDivulgacao).toLocaleDateString('pt-BR')}. ` +
        'A partir da divulgação o contrato produz efeitos e os prazos de vigência correm.',
    };
  }

  if (e.urgencia) {
    return {
      estado: 'eficaz_por_urgencia',
      podeExecutar: true,
      limiteDivulgacao: limite,
      dias,
      severidade: 'atencao',
      titulo: 'Eficaz por urgência — divulgação ainda pendente',
      detalhe:
        `Art. 94, §1º: contrato de urgência tem eficácia desde a assinatura. Mas a divulgação continua obrigatória até ${limiteBr}, sob pena de nulidade. ` +
        'Guarde o comprovante quando o órgão publicar.',
    };
  }

  if (dias < 0) {
    // Execução em curso é evidência de que a publicação saiu: o órgão não
    // recebe entrega sob contrato que ele sabe ineficaz. O que falta é o
    // registro, e o pedido tem de ser esse — não uma acusação de atraso.
    if (e.temExecucao) {
      return {
        estado: 'publicacao_nao_registrada',
        podeExecutar: true,
        limiteDivulgacao: limite,
        dias,
        severidade: 'atencao',
        titulo: 'Extrato de publicação não registrado',
        detalhe:
          'Este contrato já tem execução, o que indica que a publicação saiu — ela só não foi registrada aqui. ' +
          'Registre o extrato com a data em que saiu: é o que prova desde quando o contrato produz efeitos, e é o primeiro documento que se pede numa auditoria.',
      };
    }
    return {
      estado: 'divulgacao_atrasada',
      podeExecutar: false,
      limiteDivulgacao: limite,
      dias,
      severidade: 'critico',
      titulo: `Sem extrato registrado, ${Math.abs(dias)} dia(s) além do prazo`,
      detalhe:
        `O órgão tinha até ${limiteBr} para divulgar no PNCP (${prazo} dias úteis da assinatura, ${nomeDaOrigem}), e não há extrato registrado aqui. ` +
        'Se já foi publicado, registre o extrato. Se não foi, o contrato ainda não produz efeitos: executar agora é entregar sem título que sustente a cobrança — cobre a publicação por escrito e guarde o protocolo.',
    };
  }

  return {
    estado: 'aguardando_divulgacao',
    podeExecutar: false,
    limiteDivulgacao: limite,
    dias,
    severidade: 'atencao',
    titulo: 'Válido, ainda sem eficácia',
    detalhe:
      `Assinado, mas ainda não divulgado no PNCP. O órgão tem até ${limiteBr} (${prazo} dias úteis da assinatura, ${nomeDaOrigem}). ` +
      'Até lá o contrato não produz efeitos — não inicie a execução e registre a data da publicação quando ela sair.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Os extratos que precisam existir
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDePublicacao =
  | 'extrato_contrato'
  | 'extrato_ata'
  | 'extrato_aditivo'
  | 'designacao_fiscal'
  | 'outro';

export const ROTULO_PUBLICACAO: Record<TipoDePublicacao, string> = {
  extrato_contrato: 'Extrato do Contrato Administrativo',
  extrato_ata: 'Extrato da Ata de Registro de Preços',
  extrato_aditivo: 'Extrato do Termo Aditivo',
  designacao_fiscal: 'Extrato da Designação do Fiscal',
  outro: 'Outra publicação',
};

/**
 * Quais extratos este contrato precisa ter, e por quê.
 *
 * Não é lista fixa: depende do que o registro contém. Ata pede extrato de ata;
 * cada aditivo pede o seu; designação de fiscal é exigida sempre que há
 * execução a acompanhar (art. 117).
 */
export function extratosExigidos(opts: {
  tipoDocumento: string | null | undefined;
  quantidadeDeAditivos: number;
  temFiscalDesignado: boolean;
}): Array<{ tipo: TipoDePublicacao; rotulo: string; porque: string; quantos: number }> {
  const ehAta = opts.tipoDocumento === 'ata_srp';
  const lista: Array<{ tipo: TipoDePublicacao; rotulo: string; porque: string; quantos: number }> = [
    ehAta
      ? {
          tipo: 'extrato_ata',
          rotulo: ROTULO_PUBLICACAO.extrato_ata,
          porque: 'A ata só produz efeitos depois de divulgada (art. 94).',
          quantos: 1,
        }
      : {
          tipo: 'extrato_contrato',
          rotulo: ROTULO_PUBLICACAO.extrato_contrato,
          porque: 'Divulgação é condição de eficácia do contrato (art. 94).',
          quantos: 1,
        },
  ];

  if (opts.quantidadeDeAditivos > 0) {
    lista.push({
      tipo: 'extrato_aditivo',
      rotulo: ROTULO_PUBLICACAO.extrato_aditivo,
      porque:
        'O art. 94 fala em "contrato e seus aditamentos": cada termo aditivo precisa do próprio extrato para ter eficácia.',
      quantos: opts.quantidadeDeAditivos,
    });
  }

  if (opts.temFiscalDesignado) {
    lista.push({
      tipo: 'designacao_fiscal',
      rotulo: ROTULO_PUBLICACAO.designacao_fiscal,
      porque:
        'A fiscalização cabe a agente formalmente designado (art. 117). Sem o ato publicado, quem atesta a entrega não tem competência demonstrada — e o ateste é o que sustenta o pagamento.',
      quantos: 1,
    });
  }

  return lista;
}
