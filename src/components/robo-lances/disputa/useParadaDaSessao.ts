import { useState } from 'react';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { solicitarParada, type ResultadoDaParada } from '@/lib/robo/comandos';
import type { EstadoDoRobo, SessaoParaProjecao } from '@/lib/robo/situacao-da-participacao';

/**
 * Parar o robô numa sessão — o pedido e a leitura honesta do que ele virou.
 *
 * Morava dentro de `workspace/robo/ControleDoRobo.tsx`. Saiu em 14/09/2026
 * quando a página da disputa (`/robo-lances/disputa/:id`) passou a ter
 * "Parar robô nesta disputa" como ação principal do cabeçalho: a pasta do
 * processo e o cabeçalho usam ESTE pedido, para "solicitada" e "confirmada"
 * nunca serem ditas de dois jeitos.
 *
 * ── Parar tem dois tempos ───────────────────────────────────────────────────
 *
 * A PraeFectus pede; o agente encerra. `solicitarParada` só devolve
 * `confirmada` com evidência do agente — pedido sem confirmação é "Parada
 * solicitada — aguardando confirmação", nunca "Parado". O pedido local
 * sobrepõe a leitura do banco de propósito: antes da migration de 14/09, parar
 * gravava `encerrado` ANTES de o agente responder.
 *
 * Nada aqui roda sozinho: montar, desmontar ou trocar de disputa não envia
 * comando algum — só o clique confirmado.
 */
export interface ParadaDaSessao {
  podeOperar: boolean;
  confirmando: boolean;
  definirConfirmando: (aberto: boolean) => void;
  parando: boolean;
  pedido: ResultadoDaParada | null;
  confirmarParada: () => Promise<void>;
}

export function useParadaDaSessao(
  sessaoId: string | null,
  recarregar: () => Promise<void> | void,
): ParadaDaSessao {
  const { podeOperar } = usePapelEmpresa();
  const [confirmando, setConfirmando] = useState(false);
  const [parando, setParando] = useState(false);
  const [pedido, setPedido] = useState<ResultadoDaParada | null>(null);

  const confirmarParada = async () => {
    if (!podeOperar || !sessaoId) return;
    setParando(true);
    try {
      setPedido(await solicitarParada(sessaoId));
    } finally {
      setParando(false);
      setConfirmando(false);
    }
    // Relê mesmo quando falhou: a verdade do banco pode ter mudado no meio.
    await recarregar();
  };

  return { podeOperar, confirmando, definirConfirmando: setConfirmando, parando, pedido, confirmarParada };
}

export interface LeituraDaParada {
  /** O estado do robô com o pedido local por cima da leitura do banco. */
  estado: EstadoDoRobo;
  /** Há o que parar: sessão existe e não está parada. */
  podeParar: boolean;
  /** O pedido só vale para a sessão em que foi feito. */
  pedidoDaSessao: ResultadoDaParada | null;
  confirmadaEm: string | null;
  solicitadaEm: string | null;
}

export function lerParada(
  sessao: SessaoParaProjecao | null,
  estadoProjetado: EstadoDoRobo,
  pedido: ResultadoDaParada | null,
): LeituraDaParada {
  if (!sessao) {
    return { estado: estadoProjetado, podeParar: false, pedidoDaSessao: null, confirmadaEm: null, solicitadaEm: null };
  }
  // Trocar de participação não carrega o "aguardando confirmação" de uma para a outra.
  const pedidoDaSessao = pedido?.sessaoId === sessao.id ? pedido : null;

  let estado: EstadoDoRobo = estadoProjetado;
  if (sessao.parada_confirmada_em || pedidoDaSessao?.estado === 'confirmada') estado = 'parado';
  else if (pedidoDaSessao?.estado === 'solicitada') estado = 'parada_solicitada';

  return {
    estado,
    podeParar: estado !== 'parado' && estado !== 'sem_sessao',
    pedidoDaSessao,
    confirmadaEm: sessao.parada_confirmada_em ?? pedidoDaSessao?.confirmadaEm ?? null,
    solicitadaEm: sessao.parada_solicitada_em ?? pedidoDaSessao?.solicitadaEm ?? null,
  };
}

/**
 * Há sessão do robô EM ANDAMENTO nesta disputa: a ação principal é parar, e
 * enviar outra não faz sentido. Sessão com erro já acabou — ali se envia de novo.
 */
export function sessaoEmAndamento(leitura: LeituraDaParada): boolean {
  return leitura.podeParar && leitura.estado !== 'erro';
}
