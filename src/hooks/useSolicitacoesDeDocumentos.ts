import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tabelaAusente } from '@/lib/banco/tabela-ausente';
import {
  AVISO_SOLICITACOES_INDISPONIVEIS, type SolicitacaoDeDocumento,
} from '@/lib/documentos/solicitacoes';

/**
 * As solicitações de certidão ao órgão (`documentos_solicitacoes`) da
 * empresa ativa — leitura, registro, protocolo e encerramento.
 *
 * A tabela nasce na migration 20260923000005, colada à mão no SQL Editor: o
 * front pode chegar ao ar antes dela. Tabela ausente vira `indisponivel`
 * (a tela avisa discretamente e o e-mail continua funcionando); qualquer
 * outro erro é erro de verdade, com a mensagem real (princípio 3).
 */
const COLUNAS = 'id, empresa_id, documento_nome, orgao, email_destino, solicitada_em, protocolo, prazo_resposta, observacao, user_id, created_at, encerrada_em';

// O `types.ts` gerado não conhece a tabela nova; o cast fica aqui, uma vez,
// com o motivo escrito — o padrão de `AlertasVencimentoEmail`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (): any => (supabase.from as any)('documentos_solicitacoes');

/** `erro` só vem quando `ok` é falso — a mensagem real do banco, para a tela dizer. */
export type ResultadoDeEscrita = { ok: boolean; erro?: string };

export type CamposEditaveis = Partial<Pick<SolicitacaoDeDocumento,
  'protocolo' | 'prazo_resposta' | 'observacao' | 'email_destino' | 'encerrada_em'
>>;

export function useSolicitacoesDeDocumentos(empresaId: string | null | undefined) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDeDocumento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const recarregar = useCallback(async () => {
    if (!empresaId) {
      setSolicitacoes([]);
      setErro(null);
      setIndisponivel(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await tabela()
      .select(COLUNAS)
      .eq('empresa_id', empresaId)
      .order('solicitada_em', { ascending: false });
    setCarregando(false);
    if (error) {
      if (tabelaAusente(error)) {
        setIndisponivel(true);
        setErro(null);
        setSolicitacoes([]);
        return;
      }
      setErro(error.message);
      return;
    }
    setIndisponivel(false);
    setErro(null);
    setSolicitacoes((data ?? []) as SolicitacaoDeDocumento[]);
  }, [empresaId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  /** Grava o pedido. Sem a tabela, diz o que falta em vez de fingir que gravou. */
  const registrar = useCallback(async (linha: Record<string, unknown>): Promise<ResultadoDeEscrita> => {
    if (indisponivel) return { ok: false, erro: AVISO_SOLICITACOES_INDISPONIVEIS };
    const { error } = await tabela().insert(linha);
    if (error) return { ok: false, erro: error.message };
    await recarregar();
    return { ok: true };
  }, [indisponivel, recarregar]);

  const atualizar = useCallback(async (id: string, campos: CamposEditaveis): Promise<ResultadoDeEscrita> => {
    const { data, error } = await tabela().update(campos).eq('id', id).select('id');
    if (error) return { ok: false, erro: error.message };
    // Zero linhas sem erro é o RLS dizendo não — a tela precisa saber.
    if (!data?.length) return { ok: false, erro: 'Sem permissão para alterar esta solicitação.' };
    await recarregar();
    return { ok: true };
  }, [recarregar]);

  /**
   * Encerra as solicitações abertas de uma vaga — chamado quando o PDF é
   * anexado a ela. Sem a tabela não há o que encerrar; outro erro volta
   * para a tela dizer.
   */
  const encerrarAbertas = useCallback(async (documentoNome: string): Promise<{ encerradas: number; erro?: string }> => {
    if (!empresaId || indisponivel) return { encerradas: 0 };
    const { data, error } = await tabela()
      .update({ encerrada_em: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .eq('documento_nome', documentoNome)
      .is('encerrada_em', null)
      .select('id');
    if (error) return tabelaAusente(error) ? { encerradas: 0 } : { encerradas: 0, erro: error.message };
    const encerradas = data?.length ?? 0;
    if (encerradas > 0) await recarregar();
    return { encerradas };
  }, [empresaId, indisponivel, recarregar]);

  return { solicitacoes, carregando, erro, indisponivel, recarregar, registrar, atualizar, encerrarAbertas };
}
