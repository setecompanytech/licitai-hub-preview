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
