import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Apuracao } from "./useApuracaoTributaria";

export interface DivergenciaApuracao {
  competencia: string;
  regime: string;
  campo: string;
  valor_apurado: number;
  valor_plano: number;
  diferenca: number;
  diferenca_perc: number;
  severidade: "alta" | "media" | "baixa";
  observacao: string;
}

const TOL_PERC = 1; // 1% de tolerância
const TOL_ABS = 1; // R$ 1 absoluto

function classificar(diff: number, base: number): { sev: DivergenciaApuracao["severidade"]; perc: number } {
  const perc = base > 0 ? (Math.abs(diff) / base) * 100 : 0;
  let sev: DivergenciaApuracao["severidade"] = "baixa";
  if (perc >= 5) sev = "alta";
  else if (perc >= TOL_PERC) sev = "media";
  return { sev, perc };
}

export function useValidacaoApuracao() {
  const { empresaAtiva } = useEmpresa();

  /**
   * Compara cada apuração com os valores reais do plano de contas
   * (lançamentos realizados/conciliados na competência).
   */
  const validar = useCallback(async (apuracoes: Apuracao[]): Promise<DivergenciaApuracao[]> => {
    if (!empresaAtiva?.id || apuracoes.length === 0) return [];

    const competencias = apuracoes.map(a => a.competencia);
    const min = competencias.reduce((m, c) => (c < m ? c : m), competencias[0]);
    const max = competencias.reduce((m, c) => (c > m ? c : m), competencias[0]);

    // Período expandido: do início do menor mês até o fim do maior
    const dataInicio = min;
    const [yMax, mMax] = max.split("-").map(Number);
    const fimMes = new Date(yMax, mMax, 0).toISOString().slice(0, 10);

    const { data: lanc, error } = await (supabase as any)
      .from("financeiro_lancamentos")
      .select("data_competencia,natureza,valor,status,categoria_id,financeiro_categorias!inner(tipo_servico,natureza)")
      .eq("empresa_id", empresaAtiva.id)
      .in("status", ["realizado", "conciliado"])
      .gte("data_competencia", dataInicio)
      .lte("data_competencia", fimMes);

    if (error) throw new Error(error.message);

    const divergencias: DivergenciaApuracao[] = [];

    for (const ap of apuracoes) {
      const [y, m] = ap.competencia.split("-").map(Number);
      const inicio = `${y}-${String(m).padStart(2, "0")}-01`;
      const fim = new Date(y, m, 0).toISOString().slice(0, 10);

      const linhasMes = (lanc ?? []).filter((l: any) =>
        l.data_competencia >= inicio && l.data_competencia <= fim
      );

      // Receitas por tipo de serviço (plano de contas)
      let recComercio = 0;
      let recServico = 0;
      for (const l of linhasMes) {
        if (l.natureza !== "receita") continue;
        const tipoServ = l.financeiro_categorias?.tipo_servico;
        const v = Number(l.valor) || 0;
        if (tipoServ === "servico") recServico += v;
        else recComercio += v;
      }

      const recTotal = recComercio + recServico;

      // Compara receita comércio
      const dC = ap.receita_bruta_comercio - recComercio;
      if (Math.abs(dC) > TOL_ABS) {
        const { sev, perc } = classificar(dC, recComercio);
        if (perc >= TOL_PERC) {
          divergencias.push({
            competencia: ap.competencia, regime: ap.regime,
            campo: "Receita Comércio/Indústria",
            valor_apurado: ap.receita_bruta_comercio, valor_plano: recComercio,
            diferenca: dC, diferenca_perc: perc, severidade: sev,
            observacao: dC > 0 ? "Apuração maior que plano de contas" : "Plano de contas maior que apuração",
          });
        }
      }

      // Compara receita serviço
      const dS = ap.receita_bruta_servico - recServico;
      if (Math.abs(dS) > TOL_ABS) {
        const { sev, perc } = classificar(dS, recServico);
        if (perc >= TOL_PERC) {
          divergencias.push({
            competencia: ap.competencia, regime: ap.regime,
            campo: "Receita Serviços",
            valor_apurado: ap.receita_bruta_servico, valor_plano: recServico,
            diferenca: dS, diferenca_perc: perc, severidade: sev,
            observacao: dS > 0 ? "Apuração maior que plano de contas" : "Plano de contas maior que apuração",
          });
        }
      }

      // Compara receita total (consistência geral)
      const dT = ap.receita_bruta_total - recTotal;
      if (Math.abs(dT) > TOL_ABS) {
        const { sev, perc } = classificar(dT, recTotal);
        if (perc >= TOL_PERC) {
          divergencias.push({
            competencia: ap.competencia, regime: ap.regime,
            campo: "Receita Bruta Total",
            valor_apurado: ap.receita_bruta_total, valor_plano: recTotal,
            diferenca: dT, diferenca_perc: perc, severidade: sev,
            observacao: "Soma da apuração diverge do total realizado no plano de contas",
          });
        }
      }

      // Sanidade: receita registrada mas sem categoria com tipo_servico
      const semClassif = linhasMes.filter((l: any) =>
        l.natureza === "receita" && !l.financeiro_categorias?.tipo_servico
      ).length;
      if (semClassif > 0) {
        divergencias.push({
          competencia: ap.competencia, regime: ap.regime,
          campo: "Categorias sem classificação fiscal",
          valor_apurado: 0, valor_plano: semClassif,
          diferenca: semClassif, diferenca_perc: 0, severidade: "media",
          observacao: `${semClassif} lançamento(s) de receita sem 'tipo_servico' definido na categoria — podem distorcer a apuração`,
        });
      }
    }

    return divergencias;
  }, [empresaAtiva?.id]);

  return { validar };
}
