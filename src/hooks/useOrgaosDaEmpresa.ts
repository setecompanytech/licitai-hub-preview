import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tabelaAusente } from '@/lib/banco/tabela-ausente';
import type { OrgaoCadastradoPelaEmpresa } from '@/data/certidoes-catalogo';
import { AVISO_ORGAOS_INDISPONIVEIS, orgaosDasLinhas, type LinhaDeOrgao } from '@/lib/documentos/orgaos-da-empresa';

/**
 * Os órgãos municipais cadastrados pela empresa ativa
 * (`certidoes_orgaos_da_empresa`) — leitura, gravação e remoção.
 *
 * A tabela nasce na migration 20260923000005, colada à mão: tabela ausente
 * vira `indisponivel` (a tela avisa discretamente; o catálogo segue com o
 * mapa e o "a cadastrar"); qualquer outro erro é erro de verdade, com a
 * mensagem real (princípio 3).
 */
const COLUNAS = 'id, empresa_id, esfera, uf, municipio, nome_orgao, site, email, instrucoes, validade_dias, user_id, created_at, updated_at';

// O `types.ts` gerado não conhece a tabela nova; o cast fica aqui, uma vez.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = (): any => (supabase.from as any)('certidoes_orgaos_da_empresa');

export type ResultadoDeEscrita = { ok: boolean; erro?: string };

export function useOrgaosDaEmpresa(empresaId: string | null | undefined) {
  const [linhas, setLinhas] = useState<LinhaDeOrgao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const recarregar = useCallback(async () => {
    if (!empresaId) {
      setLinhas([]);
      setErro(null);
      setIndisponivel(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await tabela().select(COLUNAS).eq('empresa_id', empresaId).order('municipio');
    setCarregando(false);
    if (error) {
      if (tabelaAusente(error)) {
        setIndisponivel(true);
        setErro(null);
        setLinhas([]);
        return;
      }
      setErro(error.message);
      return;
    }
    setIndisponivel(false);
    setErro(null);
    setLinhas((data ?? []) as LinhaDeOrgao[]);
  }, [empresaId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const orgaos: OrgaoCadastradoPelaEmpresa[] = useMemo(() => orgaosDasLinhas(linhas), [linhas]);

  /** Grava um cadastro novo, ou corrige o existente quando `id` vem. */
  const salvar = useCallback(async (linha: Record<string, unknown>, id?: string): Promise<ResultadoDeEscrita> => {
    if (indisponivel) return { ok: false, erro: AVISO_ORGAOS_INDISPONIVEIS };
    if (id) {
      const { data, error } = await tabela().update(linha).eq('id', id).select('id');
      if (error) return { ok: false, erro: error.message };
      if (!data?.length) return { ok: false, erro: 'Sem permissão para alterar este cadastro.' };
    } else {
      const { error } = await tabela().insert(linha);
      if (error) return { ok: false, erro: error.message };
    }
    await recarregar();
    return { ok: true };
  }, [indisponivel, recarregar]);

  /** Remoção é do Admin da empresa (RLS); zero linhas sem erro é o "não" dele. */
  const remover = useCallback(async (id: string): Promise<ResultadoDeEscrita> => {
    const { data, error } = await tabela().delete().eq('id', id).select('id');
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: 'Só o Admin da empresa remove o cadastro de um órgão.' };
    await recarregar();
    return { ok: true };
  }, [recarregar]);

  return { orgaos, carregando, erro, indisponivel, recarregar, salvar, remover };
}
