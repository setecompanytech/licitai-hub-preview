import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useParticipacoesDoRobo,
  type CapacidadeDoServico,
  type DisputaCarregada,
  type ParticipacaoCarregada,
} from '@/hooks/useParticipacoesDoRobo';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { linhaParaLance } from './disputa-do-robo';

/**
 * A disputa aberta em `/robo-lances/disputa/:id` — a linha e a situação dela.
 *
 * Duas leituras, e cada uma responde uma coisa:
 *
 *  1. A LINHA, por id, direto em `robo_lances_disputas`. Quem decide se a
 *     pessoa pode vê-la é a RLS — a tela não filtra pela empresa ativa, senão
 *     trocar de empresa no topo faria uma disputa real parecer inexistente.
 *  2. A SITUAÇÃO (fase, sessão, estado do robô), por `useParticipacoesDoRobo`
 *     — o MESMO carregamento e a mesma projeção da lista, com a empresa e o
 *     processo da própria disputa. Calcular a fase de outro jeito aqui foi
 *     exatamente como painel e pasta passaram a discordar.
 *
 * ── "Não conseguimos carregar" ≠ "não existe" ───────────────────────────────
 *
 * Consulta que falhou é problema nosso e se resolve tentando de novo; linha
 * ausente é endereço morto e se resolve voltando à lista. Mandar quem caiu no
 * primeiro procurar na lista é mandar procurar uma disputa que está lá.
 *
 * Nada aqui escreve nem dá ordem ao robô.
 */
export type EstadoDaCarga = 'carregando' | 'nao_encontrada' | 'erro' | 'pronta';

export interface DisputaDoRobo {
  estado: EstadoDaCarga;
  /** Mensagem real do banco quando `estado === 'erro'`. */
  erro: string | null;
  linha: DisputaCarregada | null;
  lance: LanceConfig | null;
  participacao: ParticipacaoCarregada | null;
  /** A linha chegou e a situação ainda não teve a primeira leitura. */
  situacaoPendente: boolean;
  /** A leitura da situação falhou (a linha pode estar na tela mesmo assim). */
  erroDaSituacao: string | null;
  lidoEm: Date | null;
  capacidade: CapacidadeDoServico;
  /** Relê linha e situação. Não inicia nem para nada. */
  recarregar: () => Promise<void>;
}

interface Carga {
  id: string | null;
  estado: EstadoDaCarga;
  erro: string | null;
  linha: DisputaCarregada | null;
}

/** Id que não é UUID: o banco responde 22P02. É endereço que não existe, não falha. */
const ID_MAL_FORMADO = '22P02';

export function useDisputaDoRobo(id: string | undefined): DisputaDoRobo {
  const [carga, setCarga] = useState<Carga>({ id: null, estado: 'carregando', erro: null, linha: null });
  const pedido = useRef(0);
  const carregadaParaId = useRef<string | null>(null);

  const ler = useCallback(async () => {
    const meu = ++pedido.current;
    if (!id) {
      setCarga({ id: null, estado: 'nao_encontrada', erro: null, linha: null });
      return;
    }
    // Releitura da MESMA disputa (depois de salvar, marcar fase) não apaga a
    // tela; troca de id apaga, para a disputa A nunca aparecer no endereço de B.
    if (carregadaParaId.current !== id) setCarga({ id, estado: 'carregando', erro: null, linha: null });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela fora do types.ts (congelado em 16/08)
      const { data, error } = await (supabase as any).from('robo_lances_disputas').select('*').eq('id', id).maybeSingle();
      if (meu !== pedido.current) return;
      if (error && error.code !== ID_MAL_FORMADO) throw error;
      const linha = (error ? null : data ?? null) as DisputaCarregada | null;
      carregadaParaId.current = linha ? id : null;
      setCarga({ id, estado: linha ? 'pronta' : 'nao_encontrada', erro: null, linha });
    } catch (e) {
      if (meu !== pedido.current) return;
      const mensagem = (e as { message?: string })?.message || 'Sem resposta do banco.';
      if (carregadaParaId.current === id) {
        // Já há disputa na tela: a releitura que falhou não a apaga, mas avisa.
        toast.error(`Não foi possível reler a disputa: ${mensagem}`, { duration: 12000 });
        return;
      }
      setCarga({ id, estado: 'erro', erro: mensagem, linha: null });
    }
  }, [id]);

  useEffect(() => {
    void ler();
  }, [ler]);

  const daMesmaDisputa = carga.id === id;
  const linha = daMesmaDisputa ? carga.linha : null;

  const situacao = useParticipacoesDoRobo({
    empresaId: linha?.empresa_id ?? null,
    licitacaoId: linha?.licitacao_id ?? null,
    intervaloSegundos: 15,
  });

  const participacao = useMemo(
    () => situacao.participacoes.find((p) => p.disputa.id === id) ?? null,
    [situacao.participacoes, id],
  );
  const lance = useMemo(() => (linha ? linhaParaLance(linha as unknown as Record<string, unknown>) : null), [linha]);

  const recarregarSituacao = situacao.recarregar;
  const recarregar = useCallback(async () => {
    await Promise.all([ler(), recarregarSituacao()]);
  }, [ler, recarregarSituacao]);

  return {
    estado: daMesmaDisputa || !id ? carga.estado : 'carregando',
    erro: daMesmaDisputa ? carga.erro : null,
    linha,
    lance,
    participacao,
    situacaoPendente: !!linha && !situacao.lidoEm && !situacao.erro,
    erroDaSituacao: linha ? situacao.erro : null,
    lidoEm: situacao.lidoEm,
    capacidade: situacao.capacidade,
    recarregar,
  };
}
