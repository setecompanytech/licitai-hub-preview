/**
 * VÁRIAS DISPUTAS AO MESMO TEMPO — quem precisa de atenção agora.
 *
 * Pedido do Ian em 02/10/2026, junto da diretriz de UX: *"não sei como isso
 * será quando o robô conseguir entrar em vários pregões ao mesmo tempo
 * futuramente, tudo isso tem que ser pensado"*.
 *
 * O agente aguenta quatro disputas simultâneas, e a operação descreve manhãs
 * com mais de um pregão como rotina. Com várias no ar, a pergunta deixa de ser
 * "como mostrar uma disputa" e passa a ser **"como mostrar quatro sem a pessoa
 * perder a que importa"** — e a resposta não é quatro abas para alternar.
 *
 * Este módulo resume CADA disputa num cartão e as ordena por urgência. Funções
 * puras: a tela só desenha.
 */
import {
  itensDoQuadro,
  tempoRestanteAgora,
  urgenciaDoItem,
  type EstadoNoQuadro,
  type TempoNaTela,
} from '@/lib/robo/quadro-da-sala';

export interface DisputaParaResumir {
  id: string;
  edital: string | null;
  orgao?: string | null;
  portal?: string | null;
  licitacaoId?: string | null;
  /** O estado que o robô mandou na última leitura. */
  estadoSala?: EstadoNoQuadro | null;
  estadoSalaEm?: string | null;
  /** `ativo`, `pausado`, `enviando`, `encerrado`… */
  status?: string | null;
  /** O robô está parado esperando alguém (captcha, certificado). */
  esperandoPessoa?: boolean;
}

export interface ResumoDaDisputa {
  id: string;
  edital: string | null;
  orgao: string | null;
  licitacaoId: string | null;
  status: string | null;
  viva: boolean;
  pausada: boolean;
  esperandoPessoa: boolean;
  /** Itens com a etapa aberta agora. */
  emDisputa: number;
  /** Desses, em quantos estamos perdendo. */
  perdendo: number;
  /** Itens já encerrados pelo portal. */
  encerrados: number;
  totalDeItens: number;
  /** O menor cronômetro entre os itens abertos — o que aperta primeiro. */
  menorTempo: TempoNaTela | null;
  /** Peso para ordenar; maior = mais urgente. */
  urgencia: number;
  /** Uma linha dizendo por que esta disputa está no topo (ou não). */
  porque: string;
}

const STATUS_VIVO = ['ativo', 'enviando', 'pausado'];

/**
 * O resumo de UMA disputa.
 *
 * A urgência da disputa é a do item mais urgente dela — e não a média: uma
 * disputa com 181 itens tranquilos e um item perdendo com 20 segundos **é**
 * urgente, e a média a esconderia.
 */
export function resumirDisputa(d: DisputaParaResumir, agora: Date = new Date()): ResumoDaDisputa {
  const viva = STATUS_VIVO.includes(String(d.status));
  const pausada = d.status === 'pausado';

  const itens = d.estadoSala ? itensDoQuadro(d.estadoSala) : [];
  const comTempo = itens.map((estado) => ({
    estado,
    tempo: tempoRestanteAgora(estado.segundos_restantes, d.estadoSalaEm, agora),
  }));

  const abertos = comTempo.filter(({ estado }) => estado.fase === 'aberta');
  const perdendo = abertos.filter(({ estado }) => estado.sou_lider === false).length;
  const encerrados = itens.filter((e) => e.fase === 'encerrada').length;

  // O menor cronômetro CONFIÁVEL entre os abertos. Tempo estimado sobre leitura
  // velha não entra: a tela não inventa pressa a partir de número velho.
  const tempos = abertos
    .map(({ tempo }) => tempo)
    .filter((t) => t.confiavel && t.segundos !== null);
  const menorTempo = tempos.length
    ? tempos.reduce((a, b) => ((a.segundos ?? Infinity) <= (b.segundos ?? Infinity) ? a : b))
    : null;

  // Esperar uma pessoa é o estado mais urgente que existe: o robô PAROU, e
  // só um clique humano o destrava. Supera qualquer cronômetro.
  let urgencia = 0;
  if (d.esperandoPessoa) urgencia += 1000;
  if (viva && !pausada) {
    urgencia += comTempo.reduce((maior, { estado, tempo }) => Math.max(maior, urgenciaDoItem(estado, tempo)), 0);
  }

  return {
    id: d.id,
    edital: d.edital ?? null,
    orgao: d.orgao ?? null,
    licitacaoId: d.licitacaoId ?? null,
    status: d.status ?? null,
    viva,
    pausada,
    esperandoPessoa: d.esperandoPessoa === true,
    emDisputa: abertos.length,
    perdendo,
    encerrados,
    totalDeItens: itens.length,
    menorTempo,
    urgencia,
    porque: porqueEstaAqui({ esperandoPessoa: d.esperandoPessoa === true, pausada, viva, perdendo, abertos: abertos.length, menorTempo }),
  };
}

/**
 * A FRASE que explica a posição do cartão.
 *
 * Existe porque uma lista ordenada por um número invisível é uma lista que a
 * pessoa não confia: ela precisa ver POR QUE aquela disputa está no topo, e
 * conferir com os próprios olhos se concorda.
 */
function porqueEstaAqui(x: {
  esperandoPessoa: boolean; pausada: boolean; viva: boolean;
  perdendo: number; abertos: number; menorTempo: TempoNaTela | null;
}): string {
  if (x.esperandoPessoa) return 'O robô parou e está esperando uma pessoa';
  if (!x.viva) return 'Sessão encerrada';
  if (x.pausada) return 'Robô pausado nesta disputa';
  if (x.abertos === 0) return 'Nenhum item com a etapa aberta agora';

  const partes: string[] = [];
  if (x.perdendo > 0) {
    partes.push(x.perdendo === 1 ? 'perdendo em 1 item' : `perdendo em ${x.perdendo} itens`);
  } else {
    partes.push(x.abertos === 1 ? 'liderando o item aberto' : `liderando os ${x.abertos} itens abertos`);
  }
  if (x.menorTempo?.texto) partes.push(`o mais apertado fecha em ${x.menorTempo.texto}`);
  return partes.join(' · ');
}

/**
 * Todas as disputas, da mais urgente para a menos.
 *
 * Empate desfeito pelo menor cronômetro: duas disputas igualmente perdidas,
 * ganha a que fecha antes.
 */
export function disputasAoVivo(
  disputas: DisputaParaResumir[],
  agora: Date = new Date(),
): ResumoDaDisputa[] {
  const lista = Array.isArray(disputas) ? disputas : [];
  return lista
    .map((d) => resumirDisputa(d, agora))
    .sort((a, b) => {
      if (b.urgencia !== a.urgencia) return b.urgencia - a.urgencia;
      const ta = a.menorTempo?.segundos ?? Infinity;
      const tb = b.menorTempo?.segundos ?? Infinity;
      if (ta !== tb) return ta - tb;
      return String(a.edital ?? '').localeCompare(String(b.edital ?? ''));
    });
}
