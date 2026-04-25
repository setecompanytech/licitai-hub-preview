import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";

export type DFCClasse = "operacional" | "investimento" | "financiamento";

export type DFCLinhaRaw = {
  competencia: string;
  classe: DFCClasse;
  entradas: number;
  saidas: number;
  liquido: number;
};

export type DFCMes = {
  competencia: string; // YYYY-MM
  operacional: number;
  investimento: number;
  financiamento: number;
  caixaLiquido: number;
};

export type DFCResumo = {
  meses: DFCMes[];
  // Totais consolidados do período
  totalOperacional: number;
  totalInvestimento: number;
  totalFinanciamento: number;
  totalCaixaLiquido: number;
  // Métricas de runway
  saldoAtual: number;
  burnRateMensal: number; // média 3m do operacional, somente quando negativo
  runwayMeses: number | null; // null = sem queima ou caixa infinito
};

/**
 * DFC mensal (CPC 03 — método indireto simplificado).
 * Calcula também Burn Rate (média 3m do operacional negativo) e Runway.
 */
export function useDFC(meses = 6) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-dfc", empresaId, meses],
    enabled: !!empresaId,
    queryFn: async (): Promise<DFCResumo> => {
      const [dfcRes, contasRes] = await Promise.all([
        supabase.rpc("financeiro_dfc_mensal" as never, {
          p_empresa_id: empresaId,
          p_meses: meses,
        } as never),
        supabase
          .from("financeiro_contas")
          .select("saldo_atual")
          .eq("empresa_id", empresaId!)
          .eq("ativa", true),
      ]);
      if (dfcRes.error) throw dfcRes.error;
      if (contasRes.error) throw contasRes.error;

      const linhas = (dfcRes.data ?? []) as unknown as DFCLinhaRaw[];
      const saldoAtual = (contasRes.data ?? []).reduce(
        (s, c) => s + Number(c.saldo_atual ?? 0),
        0,
      );

      // Inicializa todos os meses (mesmo sem dados)
      const hoje = new Date();
      const ordem: string[] = [];
      const mapa = new Map<string, DFCMes>();
      for (let i = meses - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        ordem.push(key);
        mapa.set(key, {
          competencia: key,
          operacional: 0,
          investimento: 0,
          financiamento: 0,
          caixaLiquido: 0,
        });
      }

      linhas.forEach((l) => {
        const key = String(l.competencia).slice(0, 7);
        const m = mapa.get(key);
        if (!m) return;
        const v = Number(l.liquido ?? 0);
        if (l.classe === "operacional") m.operacional += v;
        else if (l.classe === "investimento") m.investimento += v;
        else if (l.classe === "financiamento") m.financiamento += v;
        m.caixaLiquido = m.operacional + m.investimento + m.financiamento;
      });

      const mesesArr = ordem.map((k) => mapa.get(k)!);

      const totalOperacional = mesesArr.reduce((s, m) => s + m.operacional, 0);
      const totalInvestimento = mesesArr.reduce((s, m) => s + m.investimento, 0);
      const totalFinanciamento = mesesArr.reduce((s, m) => s + m.financiamento, 0);
      const totalCaixaLiquido = mesesArr.reduce((s, m) => s + m.caixaLiquido, 0);

      // Burn rate: média dos últimos 3 meses do operacional, considerando só queima (negativo)
      const ult3 = mesesArr.slice(-3);
      const mediaOperacional3m =
        ult3.length > 0 ? ult3.reduce((s, m) => s + m.operacional, 0) / ult3.length : 0;
      const burnRateMensal = mediaOperacional3m < 0 ? Math.abs(mediaOperacional3m) : 0;

      const runwayMeses =
        burnRateMensal > 0 && saldoAtual > 0 ? saldoAtual / burnRateMensal : null;

      return {
        meses: mesesArr,
        totalOperacional,
        totalInvestimento,
        totalFinanciamento,
        totalCaixaLiquido,
        saldoAtual,
        burnRateMensal,
        runwayMeses,
      };
    },
  });
}
