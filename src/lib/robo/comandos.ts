/**
 * Comandos ao serviço de execução do robô.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * Em 14/09/2026, três telas chamavam `invoke('robo-lances-webhook', { body:
 * { action: 'parar-sessao' } })`. A função lê a ação no ÚLTIMO SEGMENTO DA
 * URL, não no corpo — então "parar" respondia 404 "Ação desconhecida" e a
 * sessão continuava. Só o kill-switch, que chamava `robo-lances-webhook/
 * kill-switch`, chegava.
 *
 * O caminho certo mora aqui, uma vez, e toda tela passa por ele.
 *
 * ── Solicitada não é confirmada ────────────────────────────────────────────
 *
 * Parar tem dois tempos: a PraeFectus pede, o agente encerra. Esta função só
 * devolve `confirmada` com evidência do agente. Resposta sem confirmação é
 * `solicitada` — e a tela diz "aguardando confirmação", nunca "parado".
 * Parar o robô também não cancela lance já aceito pelo portal.
 */
import { supabase } from '@/integrations/supabase/client';

export type EstadoDaParada = 'confirmada' | 'solicitada' | 'falhou';

export interface ResultadoDaParada {
  estado: EstadoDaParada;
  sessaoId: string;
  solicitadaEm: string | null;
  confirmadaEm: string | null;
  motivo: string | null;
}

type Invocar = (
  nome: string,
  opcoes: { body: Record<string, unknown> },
) => Promise<{ data: unknown; error: { message?: string } | null }>;

/**
 * O motivo real de uma recusa da edge function.
 *
 * O `supabase-js` põe em `error.message` sempre a mesma frase — "Edge Function
 * returned a non-2xx status code". O motivo ("Você não pode parar esta
 * sessão", "Sessão não encontrada") está no CORPO da resposta, em
 * `error.context`. Sem lê-lo, a pessoa diante de uma parada recusada não sabe
 * por quê.
 */
export async function causaDoErro(error: { message?: string; context?: unknown }): Promise<string> {
  let detalhe = error?.message || 'O serviço respondeu com erro, sem mensagem.';
  try {
    const contexto = error?.context as Response | undefined;
    if (contexto && typeof contexto.json === 'function') {
      const leitor = typeof contexto.clone === 'function' ? contexto.clone() : contexto;
      const corpo = await leitor.json();
      if (corpo?.error) detalhe = String(corpo.error);
    }
  } catch {
    // Corpo que não é JSON: fica a mensagem que havia.
  }
  return detalhe;
}

const invocarPadrao: Invocar = async (nome, opcoes) => {
  const { data, error } = await supabase.functions.invoke(nome, opcoes);
  if (!error) return { data, error: null };
  return { data, error: { message: await causaDoErro(error as { message?: string; context?: unknown }) } };
};

function resumirTentativas(tentativas: unknown): string | null {
  if (!Array.isArray(tentativas) || tentativas.length === 0) return null;
  return tentativas
    .map((t: Record<string, unknown>) => [t?.agente, t?.motivo ?? t?.status].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' · ');
}

/**
 * Pede ao serviço que pare a sessão. Aceita as duas formas de resposta da
 * função: a antiga (`parou`) e a nova (`parada_solicitada_em` /
 * `parada_confirmada_em` / `agente_confirmou`).
 */
export async function solicitarParada(sessaoId: string, invocar: Invocar = invocarPadrao): Promise<ResultadoDaParada> {
  const base = { sessaoId, solicitadaEm: null, confirmadaEm: null };
  let resposta: Awaited<ReturnType<Invocar>>;
  try {
    resposta = await invocar('robo-lances-webhook/parar-sessao', { body: { sessao_id: sessaoId } });
  } catch (e) {
    return { ...base, estado: 'falhou', motivo: e instanceof Error ? e.message : 'Sem resposta do serviço.' };
  }

  if (resposta.error) {
    return { ...base, estado: 'falhou', motivo: resposta.error.message || 'O serviço recusou o pedido de parada.' };
  }

  const d = (resposta.data ?? {}) as Record<string, unknown>;
  const solicitadaEm = typeof d.parada_solicitada_em === 'string' ? d.parada_solicitada_em : null;
  const confirmadaEm = typeof d.parada_confirmada_em === 'string' ? d.parada_confirmada_em : null;

  if (confirmadaEm || d.agente_confirmou === true || d.parou === true) {
    return { sessaoId, estado: 'confirmada', solicitadaEm, confirmadaEm, motivo: null };
  }
  if (solicitadaEm || d.parou === false || d.agente_confirmou === false) {
    return {
      sessaoId,
      estado: 'solicitada',
      solicitadaEm,
      confirmadaEm: null,
      motivo: resumirTentativas(d.tentativas) ?? 'O agente ainda não confirmou o encerramento.',
    };
  }
  return { ...base, estado: 'falhou', motivo: 'Resposta do serviço sem confirmação reconhecível.' };
}

/** O que mudou numa sessão que já estava rodando — o agente devolve pronto, em português. */
export interface ResultadoDaAtualizacao {
  ok: boolean;
  mudancas: string[];
  motivo: string | null;
}

/** O que dá para mudar com a disputa em andamento. */
export interface MudancaNaSessao {
  valor_minimo?: number | null;
  intervalo_segundos?: number | null;
  max_lances?: number | null;
  modo_automatico?: boolean;
  itens?: Array<{
    numero: number;
    valor_minimo?: number | null;
    margem_desempate?: number | null;
    /** `true` tira o item do robô sem derrubar a sessão; `false` devolve. */
    parado?: boolean;
  }>;
}

/**
 * MUDAR A CONFIGURAÇÃO COM A DISPUTA RODANDO (02/10/2026).
 *
 * Antes disto, nada decidido antes da sessão podia ser revisto durante ela: se
 * o mercado mudasse no meio, baixar o piso de UM item exigia encerrar a disputa
 * inteira e recomeçar — levando junto os outros 181. Quem disputa muda de ideia
 * no meio.
 *
 * Devolve o que de FATO mudou ("piso do item 7: 10 → 8,50"), e não "salvo":
 * mudar preço sob pressão é decisão que precisa de confirmação visível.
 */
export async function atualizarSessaoDoRobo(
  sessaoId: string,
  mudanca: MudancaNaSessao,
  invocar: Invocar = invocarPadrao,
): Promise<ResultadoDaAtualizacao> {
  let resposta: Awaited<ReturnType<Invocar>>;
  try {
    resposta = await invocar('robo-lances-webhook/atualizar-sessao', {
      body: { sessao_id: sessaoId, ...mudanca },
    });
  } catch (e) {
    return { ok: false, mudancas: [], motivo: e instanceof Error ? e.message : 'Sem resposta do serviço.' };
  }

  if (resposta.error) {
    return { ok: false, mudancas: [], motivo: resposta.error.message || 'O serviço recusou a alteração.' };
  }

  const d = (resposta.data ?? {}) as Record<string, unknown>;
  const mudancas = Array.isArray(d.mudancas) ? (d.mudancas as string[]) : [];

  if (d.atualizou === true) {
    // Pedido aceito e nada mudou: dizer isso é melhor do que um "pronto" que
    // faria a pessoa achar que o novo piso está valendo.
    return { ok: true, mudancas, motivo: mudancas.length ? null : 'Nada mudou: os valores enviados já eram os que estavam valendo.' };
  }

  return {
    ok: false,
    mudancas,
    motivo: typeof d.error === 'string' ? d.error : 'O robô não confirmou a alteração. O que estava valendo continua valendo.',
  };
}

/**
 * PAUSAR OU RETOMAR o robô numa disputa, sem encerrar (02/10/2026).
 *
 * É diferente de parar: parar encerra a sessão e fecha o navegador; pausar
 * mantém tudo de pé e só suspende o laço. Serve para o caso que a operação
 * descreveu — o pregoeiro suspende a sessão por alguns minutos — e para quando
 * alguém quer olhar a sala sem o robô mexendo.
 *
 * O agente fazia as duas coisas desde sempre; faltava a tela alcançá-las.
 */
export async function pausarOuRetomarRobo(
  sessaoId: string,
  retomar: boolean,
  invocar: Invocar = invocarPadrao,
): Promise<{ ok: boolean; status: string | null; motivo: string | null }> {
  const rota = retomar ? 'retomar-sessao' : 'pausar-sessao';
  let resposta: Awaited<ReturnType<Invocar>>;
  try {
    resposta = await invocar(`robo-lances-webhook/${rota}`, { body: { sessao_id: sessaoId } });
  } catch (e) {
    return { ok: false, status: null, motivo: e instanceof Error ? e.message : 'Sem resposta do serviço.' };
  }
  if (resposta.error) {
    return { ok: false, status: null, motivo: resposta.error.message || 'O serviço recusou o pedido.' };
  }
  const d = (resposta.data ?? {}) as Record<string, unknown>;
  if (d.ok === true) {
    return { ok: true, status: typeof d.status === 'string' ? d.status : null, motivo: null };
  }
  // Sem confirmação, o robô segue como estava — e a tela precisa dizer isso,
  // não um "pronto" que faria alguém sair de perto achando que pausou.
  return {
    ok: false,
    status: null,
    motivo: typeof d.error === 'string'
      ? d.error
      : retomar ? 'O robô não confirmou que voltou. Ele continua pausado.' : 'O robô não confirmou a pausa. Ele continua trabalhando.',
  };
}
