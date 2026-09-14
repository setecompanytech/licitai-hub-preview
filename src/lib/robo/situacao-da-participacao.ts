/**
 * Onde cada participação aparece no painel do robô — e o que o robô está
 * fazendo nela. São DUAS perguntas, e a tela antiga as fundia:
 *
 *   1. Em que fase está o CERTAME?   → aba: Cadastradas · Configuradas ·
 *                                      Em disputa · Encerradas
 *   2. Em que estado está o ROBÔ?     → operando · parado · parada solicitada…
 *
 * Um certame pode estar em disputa com o robô parado. Um robô pode estar
 * "operando" com o último sinal de dez minutos atrás. Misturar as duas é o
 * caminho para exibir dado antigo como atual.
 *
 * ── De onde vêm os estados (mapeados em 14/09/2026) ─────────────────────────
 *
 *   robo_lances_disputas.status  aguardando · ativo · vencendo · perdendo ·
 *                                encerrado — gravado por CLIQUE do usuário
 *                                (menu Ações). Não passa pelo portal.
 *   sessoes_lance_real.status    pendente · enviando · ativo · erro ·
 *                                encerrado — `ativo` só após o agente responder
 *                                2xx ou mandar callback; `encerrado` também é
 *                                gravado ao parar manualmente.
 *   sessoes_lance_real.resultado preenchido pelo callback de encerramento.
 *
 * Por isso a fase carrega sempre QUEM a informou: o agente (que está na sala
 * do portal) ou uma marcação manual. A tela mostra a diferença; não a apaga.
 */

export type AbaDoPainel = 'cadastradas' | 'configuradas' | 'em_disputa' | 'encerradas';

export type EstadoDoRobo =
  | 'sem_sessao'
  | 'simulacao'
  | 'enviando'
  | 'operando'
  | 'sinal_desatualizado'
  | 'parada_solicitada'
  | 'parado'
  | 'erro'
  | 'desconhecido';

export type FonteDaFase = 'agente' | 'marcacao_manual';

export const ROTULO_DA_ABA: Record<AbaDoPainel, string> = {
  cadastradas: 'Cadastradas',
  configuradas: 'Configuradas',
  em_disputa: 'Em disputa',
  encerradas: 'Encerradas',
};

export const ROTULO_DO_ESTADO_DO_ROBO: Record<EstadoDoRobo, string> = {
  sem_sessao: 'Robô não iniciado',
  simulacao: 'Simulação — não envia ao portal',
  enviando: 'Iniciando no serviço',
  operando: 'Monitorando',
  sinal_desatualizado: 'Sem atualização recente',
  parada_solicitada: 'Parada solicitada — aguardando confirmação',
  parado: 'Parado',
  erro: 'Erro no serviço',
  desconhecido: 'Situação não reconhecida',
};

export interface DisputaParaProjecao {
  id: string;
  licitacao_id: string | null;
  portal: string | null;
  status: string;
  valor_inicial: number | null;
  valor_minimo: number | null;
  itens: unknown;
  precificacao_versao_id?: string | null;
}

export interface SessaoParaProjecao {
  id: string;
  status: string;
  modo: string | null;
  updated_at: string;
  parada_solicitada_em?: string | null;
  parada_confirmada_em?: string | null;
  resultado?: string | null;
  erro?: string | null;
}

export interface OpcoesDaProjecao {
  agora: Date;
  /** Portais em que o envio de lance está liberado (hoje: nenhum). */
  portaisComLanceLiberado: readonly string[];
  /** Sem sinal há mais que isto, "operando" vira "sem atualização recente". */
  limiteDoSinalSegundos?: number;
}

export interface Participacao {
  aba: AbaDoPainel;
  /** Quem informou que o certame está em disputa ou encerrado. */
  faseInformadaPor: FonteDaFase | null;
  estadoDoRobo: EstadoDoRobo;
  lanceLiberadoNoPortal: boolean;
  itensSemLimite: number;
  pendenciaPrincipal: string | null;
  proximaAcao: string | null;
}

const LIMITE_PADRAO_DO_SINAL = 120;
const FASE_EM_DISPUTA_MANUAL = new Set(['ativo', 'vencendo', 'perdendo']);
/** Resultados de sessão que dizem que o ROBÔ parou, não que o certame acabou. */
const RESULTADOS_DE_PARADA = new Set(['parada_emergencial']);

function normalizarPortal(p: string | null | undefined): string {
  return String(p ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * O erro do robô em linguagem de cliente.
 *
 * O `erro` da sessão é texto de máquina e às vezes de bastidor: em 14/09/2026 a
 * tabela do cliente mostrava "Signal timed out." e um parágrafo do agente com a
 * situação da CONTA usada no portal ("acesso vencido… 0 créditos"). O cliente
 * precisa saber o que aconteceu e o que fazer; o texto completo fica no Admin
 * Praefectus › Robô de Lances.
 *
 * A ordem das regras importa: "processo não encontrado" vem antes de "conta
 * vencida", porque quando os dois aparecem juntos a causa da falha é o primeiro.
 */
export interface ErroParaCliente {
  texto: string;
  acao: string;
}

export function resumirErroParaCliente(erro: string | null | undefined): ErroParaCliente {
  const e = String(erro ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!e.trim()) return { texto: 'O robô informou uma falha na sessão.', acao: 'Falar com o suporte' };
  if (/(nao (foi )?encontrad|nao localizad)/.test(e) && /(processo|pregao|edital|licitac|disputa)/.test(e)) {
    return { texto: 'O processo não foi localizado na conta do portal.', acao: 'Conferir o número do processo' };
  }
  if (/(timed? ?out|timeout|tempo (de resposta )?esgotado|sem resposta|nao respondeu)/.test(e)) {
    return { texto: 'O portal não respondeu a tempo.', acao: 'Tentar de novo mais tarde' };
  }
  if (/(certificado|\bpfx\b)/.test(e)) {
    return { texto: 'O portal não aceitou o certificado digital.', acao: 'Revisar o certificado digital' };
  }
  if (/(senha|credencia|login|autentica|usuario invalido)/.test(e)) {
    return { texto: 'O portal recusou o acesso com as credenciais cadastradas.', acao: 'Revisar o acesso ao portal' };
  }
  if (/(credito|vencid|expirad|assinatura|inadimpl)/.test(e)) {
    return { texto: 'A conta no portal precisa de regularização.', acao: 'Verificar a conta no portal' };
  }
  return { texto: 'O robô não conseguiu concluir a operação no portal.', acao: 'Falar com o suporte' };
}

export function lanceLiberadoNoPortal(portal: string | null, liberados: readonly string[]): boolean {
  const alvo = normalizarPortal(portal);
  if (!alvo) return false;
  return liberados.some((l) => normalizarPortal(l) === alvo);
}

export function estadoDoRobo(
  sessao: SessaoParaProjecao | null,
  agora: Date,
  limiteDoSinalSegundos = LIMITE_PADRAO_DO_SINAL,
): EstadoDoRobo {
  if (!sessao) return 'sem_sessao';
  // Parada vem antes de tudo: é o que a pessoa pediu por último, e a tela
  // não pode voltar a dizer "monitorando" enquanto a confirmação não chega.
  if (sessao.parada_confirmada_em) return 'parado';
  if (sessao.parada_solicitada_em) return 'parada_solicitada';
  if (sessao.modo === 'simulacao') return 'simulacao';

  switch (sessao.status) {
    case 'pendente':
    case 'enviando':
      return 'enviando';
    case 'erro':
      return 'erro';
    case 'encerrado':
      return 'parado';
    case 'ativo': {
      const idade = (agora.getTime() - new Date(sessao.updated_at).getTime()) / 1000;
      return Number.isFinite(idade) && idade <= limiteDoSinalSegundos ? 'operando' : 'sinal_desatualizado';
    }
    default:
      return 'desconhecido';
  }
}

function contarItensSemLimite(disputa: DisputaParaProjecao): number {
  const itens = Array.isArray(disputa.itens) ? (disputa.itens as Array<Record<string, unknown>>) : [];
  if (itens.length === 0) return Number(disputa.valor_minimo) > 0 ? 0 : 1;
  return itens.filter((i) => !(Number(i?.valorMinimo ?? i?.valor_minimo) > 0)).length;
}

export function projetarParticipacao(
  disputa: DisputaParaProjecao,
  sessao: SessaoParaProjecao | null,
  opcoes: OpcoesDaProjecao,
): Participacao {
  const limite = opcoes.limiteDoSinalSegundos ?? LIMITE_PADRAO_DO_SINAL;
  const robo = estadoDoRobo(sessao, opcoes.agora, limite);
  const liberado = lanceLiberadoNoPortal(disputa.portal, opcoes.portaisComLanceLiberado);
  const itensSemLimite = contarItensSemLimite(disputa);
  const sessaoReal = !!sessao && sessao.modo !== 'simulacao';

  // ── Fase do certame ───────────────────────────────────────────────────────
  let aba: AbaDoPainel;
  let faseInformadaPor: FonteDaFase | null = null;

  // `resultado` vem do callback `sessao-encerrada`: 'finalizado' quando a sala
  // fechou, 'parada_emergencial' quando uma PESSOA interrompeu o robô. Só o
  // primeiro fala do certame; o segundo fala do robô — o pregão continua.
  if (sessaoReal && sessao!.status === 'encerrado' && sessao!.resultado && !RESULTADOS_DE_PARADA.has(sessao!.resultado)) {
    aba = 'encerradas';
    faseInformadaPor = 'agente';
  } else if (disputa.status === 'encerrado') {
    aba = 'encerradas';
    faseInformadaPor = 'marcacao_manual';
  } else if (sessaoReal && ['operando', 'sinal_desatualizado', 'parada_solicitada'].includes(robo)) {
    aba = 'em_disputa';
    faseInformadaPor = 'agente';
  } else if (FASE_EM_DISPUTA_MANUAL.has(disputa.status)) {
    aba = 'em_disputa';
    faseInformadaPor = 'marcacao_manual';
  } else if (
    normalizarPortal(disputa.portal) &&
    Number(disputa.valor_inicial) > 0 &&
    itensSemLimite === 0 &&
    !!disputa.precificacao_versao_id
  ) {
    aba = 'configuradas';
  } else {
    aba = 'cadastradas';
  }

  // ── Pendência principal e próxima ação — a primeira que se aplica ─────────
  const erroDoCliente = resumirErroParaCliente(sessao?.erro);
  const regras: Array<[boolean, string, string]> = [
    [robo === 'parada_solicitada', 'Parada solicitada — o serviço ainda não confirmou.', 'Acompanhar a confirmação'],
    [robo === 'erro', erroDoCliente.texto, erroDoCliente.acao],
    [robo === 'sinal_desatualizado', `Sem atualização do serviço há mais de ${limite} s.`, 'Verificar a conexão do agente'],
    [robo === 'desconhecido', `Situação "${sessao?.status}" não reconhecida.`, 'Conferir a sessão'],
    [aba === 'encerradas', null as unknown as string, 'Consultar o resultado'],
    [!normalizarPortal(disputa.portal), 'Portal não informado.', 'Informar o portal'],
    [!(Number(disputa.valor_inicial) > 0), 'Preço inicial não definido.', 'Definir o preço inicial'],
    [
      itensSemLimite > 0,
      `${itensSemLimite} ${itensSemLimite === 1 ? 'item sem limite autorizado' : 'itens sem limite autorizado'}.`,
      'Definir os limites',
    ],
    [!disputa.precificacao_versao_id, 'Limites sem versão aprovada da precificação.', 'Aprovar limites na Precificação'],
    [
      !liberado,
      'Envio de lances indisponível neste portal — somente monitoramento.',
      aba === 'em_disputa' ? 'Acompanhar no portal' : 'Preparar o monitoramento',
    ],
    [
      aba === 'em_disputa' && faseInformadaPor === 'marcacao_manual',
      'Fase marcada manualmente — o portal não confirmou.',
      'Conferir no portal',
    ],
  ];

  const primeira = regras.find(([aplica]) => aplica);
  const pendenciaPrincipal = primeira ? primeira[1] ?? null : null;
  const proximaAcao = primeira
    ? primeira[2]
    : aba === 'em_disputa'
      ? 'Acompanhar a disputa'
      : aba === 'configuradas'
        ? 'Ativar o monitoramento'
        : null;

  return {
    aba,
    faseInformadaPor,
    estadoDoRobo: robo,
    lanceLiberadoNoPortal: liberado,
    itensSemLimite,
    pendenciaPrincipal,
    proximaAcao,
  };
}
