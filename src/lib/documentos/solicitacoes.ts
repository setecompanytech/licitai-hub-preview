import { diasAteVencer } from './lembretes';
import { diaDaValidade } from './situacao';
import { montarData } from './validade';

/**
 * Solicitação de certidão ao órgão — fase 2 das Certidões (23/09/2026).
 *
 * Certidão que não sai por site sai por PEDIDO: Belém atende por e-mail, e
 * muitos municípios fora do mapa também. Entre o pedido e o PDF há dias, um
 * protocolo e um prazo — e era isso que o cofre não guardava: a pessoa
 * mandava o e-mail e a vaga continuava "Ausente", sem dizer que alguém já
 * tinha pedido, quando, nem até quando esperar.
 *
 * A tabela `documentos_solicitacoes` (migration 20260923000005) guarda uma
 * linha por pedido. A vaga mostra "solicitada em DD/MM, prazo DD/MM" até o
 * PDF chegar: quando o arquivo é anexado à vaga, a solicitação aberta é
 * encerrada (`encerrada_em`). Nada aqui escreve no banco — são as regras.
 */
export interface SolicitacaoDeDocumento {
  id: string;
  empresa_id: string;
  /** ⚠️ A vaga do cofre, pelo nome exato (`previstos.ts`). */
  documento_nome: string;
  orgao: string;
  email_destino: string | null;
  /** timestamptz — quando o pedido foi feito. */
  solicitada_em: string;
  /** Digitado depois, quando o órgão responde com um número. */
  protocolo: string | null;
  /** date `AAAA-MM-DD` — até quando se espera a resposta. */
  prazo_resposta: string | null;
  observacao: string | null;
  user_id: string;
  created_at: string;
  /** Preenchido quando o PDF chegou (ou o pedido foi abandonado). */
  encerrada_em: string | null;
}

export type SituacaoDaSolicitacao = 'aguardando' | 'prazo_hoje' | 'prazo_vencido' | 'encerrada';

export const ROTULO_DA_SITUACAO_DA_SOLICITACAO: Record<SituacaoDaSolicitacao, string> = {
  aguardando: 'Aguardando resposta',
  prazo_hoje: 'Prazo de resposta vence hoje',
  prazo_vencido: 'Prazo de resposta vencido',
  encerrada: 'Encerrada',
};

export function situacaoDaSolicitacao(s: SolicitacaoDeDocumento, hoje = new Date()): SituacaoDaSolicitacao {
  if (s.encerrada_em) return 'encerrada';
  if (!s.prazo_resposta) return 'aguardando';
  const dias = diasAteVencer(s.prazo_resposta, hoje);
  if (dias === null) return 'aguardando';
  if (dias < 0) return 'prazo_vencido';
  if (dias === 0) return 'prazo_hoje';
  return 'aguardando';
}

const ordemPorData = (a: SolicitacaoDeDocumento, b: SolicitacaoDeDocumento) =>
  new Date(b.solicitada_em).getTime() - new Date(a.solicitada_em).getTime();

/** A solicitação ABERTA mais recente de uma vaga, ou nada. */
export function solicitacaoAberta(lista: SolicitacaoDeDocumento[], nomeDaVaga: string): SolicitacaoDeDocumento | null {
  return lista
    .filter((s) => s.documento_nome === nomeDaVaga && !s.encerrada_em)
    .sort(ordemPorData)[0] ?? null;
}

/** As abertas, uma por vaga (a mais recente), chaveadas pelo nome exato. */
export function abertasPorVaga(lista: SolicitacaoDeDocumento[]): Record<string, SolicitacaoDeDocumento> {
  const mapa: Record<string, SolicitacaoDeDocumento> = {};
  for (const s of [...lista].sort(ordemPorData)) {
    if (s.encerrada_em || mapa[s.documento_nome]) continue;
    mapa[s.documento_nome] = s;
  }
  return mapa;
}

const diaMes = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/** O dia em que se pediu, no fuso de quem lê (a coluna é timestamptz). */
export function diaDaSolicitacao(s: SolicitacaoDeDocumento): Date {
  return new Date(s.solicitada_em);
}

/**
 * A frase curta que a vaga mostra até o PDF chegar:
 * "Solicitada em 22/09, prazo 07/10" — com o atraso dito quando o prazo passou,
 * e o protocolo quando o órgão deu um.
 */
export function fraseDaSolicitacao(s: SolicitacaoDeDocumento, hoje = new Date()): string {
  const partes = [`Solicitada em ${diaMes(diaDaSolicitacao(s))}`];
  if (s.prazo_resposta) {
    const situacao = situacaoDaSolicitacao(s, hoje);
    const dias = diasAteVencer(s.prazo_resposta, hoje) ?? 0;
    const prazo = `prazo ${diaMes(diaDaValidade(s.prazo_resposta))}`;
    if (situacao === 'prazo_vencido') {
      const atraso = Math.abs(dias);
      partes.push(`${prazo} — vencido há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`);
    } else if (situacao === 'prazo_hoje') {
      partes.push(`${prazo} — vence hoje`);
    } else {
      partes.push(prazo);
    }
  } else {
    partes.push('sem prazo informado');
  }
  if (s.protocolo?.trim()) partes.push(`protocolo ${s.protocolo.trim()}`);
  return partes.join(', ');
}

/* ── O que a pessoa digita ao solicitar ─────────────────────────────────── */

export interface DadosDaSolicitacao {
  orgao: string;
  emailDestino?: string;
  /** `AAAA-MM-DD`, opcional. */
  prazoResposta?: string;
  observacao?: string;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Os erros de preenchimento, por extenso. Vazio = pode gravar. */
export function validarSolicitacao(d: DadosDaSolicitacao, hoje = new Date()): string[] {
  const erros: string[] = [];
  if (!d.orgao?.trim()) erros.push('Informe o órgão a quem a solicitação é dirigida.');
  const email = d.emailDestino?.trim();
  if (email && !EMAIL_VALIDO.test(email)) erros.push('O e-mail do órgão não parece válido.');
  const prazo = d.prazoResposta?.trim();
  if (prazo) {
    // `montarData` recusa 31/02 em vez de deslocá-lo para março — a conta de
    // dias, sozinha, aceitaria a data impossível sem reclamar.
    const m = prazo.match(DATA_ISO);
    const data = m ? montarData(Number(m[1]), Number(m[2]), Number(m[3])) : null;
    if (!data) {
      erros.push('O prazo de resposta precisa ser uma data.');
    } else if ((diasAteVencer(prazo, hoje) ?? 0) < 0) {
      erros.push('O prazo de resposta não pode ser anterior a hoje.');
    }
  }
  return erros;
}

/** A linha a inserir em `documentos_solicitacoes`, já limpa. */
export function linhaParaGravar(
  d: DadosDaSolicitacao,
  contexto: { empresaId: string; userId: string; documentoNome: string; agora?: Date },
) {
  return {
    empresa_id: contexto.empresaId,
    user_id: contexto.userId,
    documento_nome: contexto.documentoNome,
    orgao: d.orgao.trim(),
    email_destino: d.emailDestino?.trim() || null,
    prazo_resposta: d.prazoResposta?.trim() || null,
    observacao: d.observacao?.trim() || null,
    solicitada_em: (contexto.agora ?? new Date()).toISOString(),
  };
}

/** Texto discreto enquanto a migration não foi colada — nunca um alarme vermelho. */
export const AVISO_SOLICITACOES_INDISPONIVEIS =
  'O registro de solicitações ao órgão fica disponível após a atualização do banco (migration 20260923000005). O e-mail continua funcionando.';
