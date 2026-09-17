/**
 * A disputa ainda tem lance a dar? — processos vencidos no cadastro do robô.
 *
 * O Rafael, dono do produto, em 17/09/2026: o cadastro "cadastra processos
 * vencidos, processos fora do prazo, não faz sentido. Se o processo passou,
 * qual seria a finalidade de usar o robô? Ele não enviaria lances. A não ser
 * para acompanhamento." O caso que ele viu: a compra 90029/2026, com propostas
 * até 30/07/2026, cadastrada normalmente em 17/09.
 *
 * Duas regras moram aqui, em texto testável:
 * 1. `prazoDaDisputa` — no diálogo de cadastro: sessão de DIA ANTERIOR trava o
 *    cadastro para lance, e só deixa salvar como acompanhamento.
 * 2. `processoEncerradoNaLista` — na lista "Seus Processos Licitatórios": o que
 *    já terminou fica escondido até a pessoa pedir.
 *
 * ─── POR QUE "DIA ANTERIOR", E NÃO "ANTES DE AGORA" ─────────────────────────
 * No Compras.gov a sessão abre no fim do prazo de propostas e pode durar horas,
 * item a item. Uma sessão que abriu às 09:00 ainda pode estar em disputa às
 * 11:00, com a empresa que já mandou proposta precisando do robô — travar ali
 * seria tirar o robô de quem mais precisa. Do dia anterior para trás, a fase
 * de lances acabou. No mesmo dia, depois da hora, a tela avisa sem travar.
 */
import { ehDecidido, faixaDe } from '@/lib/licitacao/status';

const FUSO = 'America/Sao_Paulo';

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

/** 'AAAA-MM-DD' do instante, em Brasília. */
export function diaEmBrasilia(instante: Date): string {
  return DIA.format(instante);
}

const paraBr = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

export type TipoDoPrazo = 'aberto' | 'sem-data' | 'comecou-hoje' | 'encerrado';

/** Interface simples, e não união: o tsconfig do app não estreita uniões. */
export interface PrazoDaDisputa {
  tipo: TipoDoPrazo;
  /** Para a frase: "30/07/2026 às 09:30" (encerrado) ou "09:30" (começou hoje). */
  quando: string | null;
  /** De onde veio a data: a compra lida no portal ou a data digitada na disputa. */
  fonte: 'compra' | 'disputa' | null;
}

/**
 * @param e.encerramentoPropostas fim das propostas da compra lida no Compras.gov (ISO), quando houver
 * @param e.dataSessao 'AAAA-MM-DD' da disputa
 * @param e.horario 'HH:MM' da disputa
 */
export function prazoDaDisputa(e: {
  encerramentoPropostas?: string | null;
  dataSessao?: string | null;
  horario?: string | null;
  agora: Date;
}): PrazoDaDisputa {
  const hoje = diaEmBrasilia(e.agora);

  // A compra publicada manda: é a data que o portal vai respeitar.
  const daCompra = e.encerramentoPropostas ? new Date(e.encerramentoPropostas) : null;
  if (daCompra && !Number.isNaN(daCompra.getTime())) {
    return classificar(diaEmBrasilia(daCompra), daCompra, hoje, e.agora, 'compra');
  }

  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(e.dataSessao ?? '')) ? String(e.dataSessao) : null;
  if (!dia) return { tipo: 'sem-data', quando: null, fonte: null };
  const hora = /^\d{2}:\d{2}/.test(String(e.horario ?? '')) ? String(e.horario).slice(0, 5) : null;
  // Brasília não tem horário de verão desde 2019: -03:00 fixo.
  const instante = hora ? new Date(`${dia}T${hora}:00-03:00`) : null;
  return classificar(dia, instante, hoje, e.agora, 'disputa');
}

function classificar(
  dia: string,
  instante: Date | null,
  hoje: string,
  agora: Date,
  fonte: 'compra' | 'disputa',
): PrazoDaDisputa {
  if (dia < hoje) {
    const hora = instante ? ` às ${HORA.format(instante)}` : '';
    return { tipo: 'encerrado', quando: `${paraBr(dia)}${hora}`, fonte };
  }
  if (dia === hoje && instante && instante.getTime() <= agora.getTime()) {
    return { tipo: 'comecou-hoje', quando: HORA.format(instante), fonte };
  }
  return { tipo: 'aberto', quando: null, fonte };
}

export type MotivoDeEncerrado = 'arquivado' | 'decidido' | 'prazo';

/**
 * O processo da lista já terminou para o robô? Arquivado, decidido (Vencida,
 * Homologada, Perdida — cancelado e revogado caem em Perdida — ou com desfecho
 * em `resultado`, como Deserto e Fracassado), ou com o prazo de propostas num
 * dia anterior. A régua de status é a de `lib/licitacao/status.ts`, a única.
 */
export function processoEncerradoNaLista(
  p: { status: string; resultado?: string | null; arquivado_em?: string | null; data_encerramento?: string | null },
  agora: Date,
): MotivoDeEncerrado | null {
  if (faixaDe(p.status, p.arquivado_em ?? null) === 'arquivo') return 'arquivado';
  if (ehDecidido(p.status, p.resultado ?? null)) return 'decidido';
  if (p.data_encerramento) {
    const fim = new Date(p.data_encerramento);
    if (!Number.isNaN(fim.getTime()) && diaEmBrasilia(fim) < diaEmBrasilia(agora)) return 'prazo';
  }
  return null;
}
