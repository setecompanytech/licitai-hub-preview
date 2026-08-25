import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * Os indicadores que ligam o Financeiro ao comercial.
 *
 * O percentual de despesas administrativas era digitado à mão na calculadora —
 * e um número inventado ali produz preço que não cobre a estrutura (ou que a
 * cobre duas vezes e perde o certame). Aqui ele nasce dos lançamentos
 * conciliados, por competência, numa janela móvel.
 *
 * O cálculo é vivo; a ADOÇÃO é um ato datado (`adotar`), porque proposta
 * entregue não se reescreve com o percentual do mês seguinte.
 */

export type IndicadoresGerenciais = {
  periodo: { inicio: string; fim: string; meses: number };
  receita_bruta: number;
  deducoes: number;
  cmv: number;
  despesa_operacional: number;
  despesa_financeira: number;
  media_mensal: {
    receita: number;
    despesa_operacional: number;
    despesa_financeira: number;
  };
  /** Convenção 0–100 (ver CLAUDE.md: alíquota transcrita, não fração). */
  pct_despesa_administrativa: number | null;
  pct_despesa_financeira: number | null;
  pct_cmv: number | null;
  cobertura: {
    despesa: number | null;
    receita: number | null;
    despesa_sem_categoria: number;
    receita_sem_categoria: number;
  };
  /** Há receita e a classificação cobre ao menos 80% do movimento. */
  confiavel: boolean;
};

export function useIndicadoresGerenciais(meses = 12) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [indicadores, setIndicadores] = useState<IndicadoresGerenciais | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) { setIndicadores(null); return; }
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.rpc('financeiro_indicadores_gerenciais' as never, {
      p_empresa_id: empresaAtiva.id,
      p_referencia: new Date().toISOString().slice(0, 10),
      p_meses: meses,
    } as never);
    setCarregando(false);
    if (error) {
      // Falha aqui não pode ser silenciosa: sem indicador, quem precifica
      // precisa SABER que está digitando à mão, não supor que veio pronto.
      setErro(error.message);
      setIndicadores(null);
      return;
    }
    setIndicadores(data as unknown as IndicadoresGerenciais);
  }, [empresaAtiva?.id, meses]);

  useEffect(() => { void carregar(); }, [carregar]);

  /**
   * A versão em vigor — a última adotada. É ela que o comercial deve usar:
   * o cálculo do momento muda a cada conciliação, e preço não pode oscilar
   * conforme a hora em que a proposta foi montada.
   */
  const [adotado, setAdotado] = useState<{
    pct_despesa_administrativa: number | null;
    pct_despesa_financeira: number | null;
    adotado_em: string;
    meses: number;
  } | null>(null);

  const carregarAdotado = useCallback(async () => {
    if (!empresaAtiva?.id) { setAdotado(null); return; }
    const { data } = await supabase
      .from('financeiro_indicadores_adotados' as never)
      .select('pct_despesa_administrativa, pct_despesa_financeira, adotado_em, meses')
      .eq('empresa_id', empresaAtiva.id)
      .order('adotado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAdotado((data as never) ?? null);
  }, [empresaAtiva?.id]);

  useEffect(() => { void carregarAdotado(); }, [carregarAdotado]);

  /** Congela a versão usada para precificar — com data, autor e o retrato. */
  const adotar = useCallback(async (observacao?: string) => {
    if (!empresaAtiva?.id || !indicadores) return false;
    const { error } = await supabase.from('financeiro_indicadores_adotados' as never).insert({
      empresa_id: empresaAtiva.id,
      adotado_por: user?.id ?? null,
      referencia: indicadores.periodo.fim,
      meses: indicadores.periodo.meses,
      pct_despesa_administrativa: indicadores.pct_despesa_administrativa,
      pct_despesa_financeira: indicadores.pct_despesa_financeira,
      indicadores: indicadores as unknown as Record<string, unknown>,
      observacao: observacao ?? null,
    } as never);
    if (!error) await carregarAdotado();
    return !error;
  }, [empresaAtiva?.id, user?.id, indicadores, carregarAdotado]);

  return { indicadores, adotado, carregando, erro, recarregar: carregar, adotar };
}
