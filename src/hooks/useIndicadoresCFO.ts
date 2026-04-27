import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { toast } from "sonner";

export type IndicadoresCFO = {
  // Rentabilidade
  receitaLiquida: number;
  custosOperacionais: number;
  despesasOperacionais: number;
  ebitda: number;
  margemEbitda: number; // %
  lucroLiquido: number;
  margemLiquida: number; // %

  // Liquidez (do BP mais recente, se houver)
  ativoCirculante: number;
  passivoCirculante: number;
  estoques: number;
  liquidezCorrente: number; // AC / PC
  liquidezSeca: number; // (AC - Estoques) / PC

  // Endividamento
  passivoTotal: number;
  patrimonioLiquido: number;
  endividamentoGeral: number; // PT / (PT + PL) * 100
  composicaoEndividamento: number; // PC / PT * 100

  // Retorno
  ativoTotal: number;
  roi: number; // Lucro / Ativo Total * 100
  roe: number; // Lucro / PL * 100

  // Caixa
  saldoCaixaAtual: number;
  burnMensal: number; // queima média (despesa - receita) últimos 3m, se negativo
  runwayMeses: number | null;

  // Projeção 90d
  projecao90d: { dia: string; saldo_projetado: number }[];

  // Metadados
  competenciaBp?: string;
  tem_balanco: boolean;
};

export function useIndicadoresCFO() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-cfo-indicadores", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<IndicadoresCFO> => {
      const hoje = new Date();
      const inicio6m = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString().slice(0, 10);
      const hojeStr = hoje.toISOString().slice(0, 10);

      // Paginação para evitar truncamento silencioso (limite default Supabase: 1000)
      const fetchLancsPaginado = async () => {
        const PAGE = 1000;
        let from = 0;
        const acc: any[] = [];
        // teto de segurança 50k registros (≈ 25 páginas)
        for (let i = 0; i < 50; i++) {
          const { data, error } = await supabase
            .from("financeiro_lancamentos")
            .select("valor, tipo, status, natureza, data_competencia, data_vencimento, data_realizado, categoria_id")
            .eq("empresa_id", empresaId!)
            .gte("data_competencia", inicio6m)
            .order("data_competencia", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          acc.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
        return acc;
      };

      const [contasRes, lancs, bpRes] = await Promise.all([
        supabase
          .from("financeiro_contas")
          .select("saldo_atual, ativa")
          .eq("empresa_id", empresaId!),
        fetchLancsPaginado(),
        supabase
          .from("financeiro_demonstracoes")
          .select("dados, total_ativo, total_passivo, resultado_liquido, competencia_fim")
          .eq("empresa_id", empresaId!)
          .eq("tipo", "balanco_patrimonial")
          .order("competencia_fim", { ascending: false })
          .limit(1),
      ]);

      if (contasRes.error) throw contasRes.error;

      const contas = contasRes.data ?? [];
      const bp = (bpRes.data ?? [])[0];

      // ===== Rentabilidade (DRE simplificada do mês corrente) =====
      const mesAtualKey = hoje.toISOString().slice(0, 7);
      const realizadoMes = lancs.filter(
        (l) => l.status !== "cancelado" && (l.data_realizado ?? l.data_competencia ?? "").startsWith(mesAtualKey)
      );
      const receitaLiquida = realizadoMes
        .filter((l) => l.natureza === "receita")
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const despesasTotal = realizadoMes
        .filter((l) => l.natureza === "despesa")
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      // Heurística: 60% custo / 40% despesa operacional quando não há classificação detalhada
      const custosOperacionais = despesasTotal * 0.6;
      const despesasOperacionais = despesasTotal * 0.4;
      const ebitda = receitaLiquida - custosOperacionais - despesasOperacionais;
      const margemEbitda = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;
      // Estimativa: D&A 5% receita, IR/CSLL 15% sobre lucro positivo
      const depreciacao = receitaLiquida * 0.05;
      const lair = ebitda - depreciacao;
      const ir = lair > 0 ? lair * 0.15 : 0;
      const lucroLiquido = lair - ir;
      const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

      // ===== Indicadores do BP =====
      type BpDados = {
        ativo_circulante?: number;
        passivo_circulante?: number;
        estoques?: number;
        patrimonio_liquido?: number;
      };
      const bpDados: BpDados = (bp?.dados as BpDados) ?? {};
      const ativoTotal = Number(bp?.total_ativo ?? 0);
      const passivoTotal = Number(bp?.total_passivo ?? 0);
      const ativoCirculante = Number(bpDados.ativo_circulante ?? ativoTotal * 0.4);
      const passivoCirculante = Number(bpDados.passivo_circulante ?? passivoTotal * 0.5);
      const estoques = Number(bpDados.estoques ?? 0);
      const patrimonioLiquido = Number(bpDados.patrimonio_liquido ?? Math.max(0, ativoTotal - passivoTotal));

      const liquidezCorrente = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
      const liquidezSeca = passivoCirculante > 0 ? (ativoCirculante - estoques) / passivoCirculante : 0;
      const endividamentoGeral = ativoTotal > 0 ? (passivoTotal / ativoTotal) * 100 : 0;
      const composicaoEndividamento = passivoTotal > 0 ? (passivoCirculante / passivoTotal) * 100 : 0;
      const roi = ativoTotal > 0 ? (lucroLiquido / ativoTotal) * 100 : 0;
      const roe = patrimonioLiquido > 0 ? (lucroLiquido / patrimonioLiquido) * 100 : 0;

      // ===== Caixa =====
      const saldoCaixaAtual = contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      // Burn dos últimos 3 meses
      const burns: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1).toISOString().slice(0, 7);
        const recM = lancs
          .filter((l) => l.natureza === "receita" && l.status !== "cancelado" && (l.data_realizado ?? l.data_competencia ?? "").startsWith(ref))
          .reduce((s, l) => s + Number(l.valor ?? 0), 0);
        const desM = lancs
          .filter((l) => l.natureza === "despesa" && l.status !== "cancelado" && (l.data_realizado ?? l.data_competencia ?? "").startsWith(ref))
          .reduce((s, l) => s + Number(l.valor ?? 0), 0);
        burns.push(desM - recM);
      }
      const burnMensal = burns.length > 0 ? burns.reduce((a, b) => a + b, 0) / burns.length : 0;
      const runwayMeses = burnMensal > 0 && saldoCaixaAtual > 0 ? saldoCaixaAtual / burnMensal : null;

      // ===== Projeção 90d — algoritmo O(n+90) com varredura única =====
      const proximos90 = new Date(hoje.getTime() + 90 * 86400000).toISOString().slice(0, 10);
      const previstos = lancs
        .filter(
          (l) =>
            (l.status === "previsto" || l.status === "em_atraso") &&
            l.data_vencimento &&
            l.data_vencimento >= hojeStr &&
            l.data_vencimento <= proximos90
        )
        .sort((a, b) => (a.data_vencimento! < b.data_vencimento! ? -1 : 1));

      const projecao90d: { dia: string; saldo_projetado: number }[] = [];
      let saldoAcum = saldoCaixaAtual;
      const burnDiario = burnMensal / 30;
      let idx = 0;
      for (let d = 0; d <= 90; d++) {
        const dia = new Date(hoje.getTime() + d * 86400000).toISOString().slice(0, 10);
        // aplica todos os eventos cujo vencimento <= dia, marcha avante
        while (idx < previstos.length && previstos[idx].data_vencimento! <= dia) {
          const v = Number(previstos[idx].valor ?? 0);
          saldoAcum += previstos[idx].tipo === "a_receber" ? v : -v;
          idx++;
        }
        // burn diário acumulado
        const saldoFinal = saldoAcum - burnDiario * d;
        if (d % 3 === 0) {
          projecao90d.push({
            dia,
            saldo_projetado: Number.isFinite(saldoFinal) ? saldoFinal : 0,
          });
        }
      }

      // sanitiza qualquer NaN/Infinity decorrente de divisões por zero
      const safe = (n: number) => (Number.isFinite(n) ? n : 0);


      return {
        receitaLiquida,
        custosOperacionais,
        despesasOperacionais,
        ebitda,
        margemEbitda,
        lucroLiquido,
        margemLiquida,
        ativoCirculante,
        passivoCirculante,
        estoques,
        liquidezCorrente,
        liquidezSeca,
        passivoTotal,
        patrimonioLiquido,
        endividamentoGeral,
        composicaoEndividamento,
        ativoTotal,
        roi,
        roe,
        saldoCaixaAtual,
        burnMensal,
        runwayMeses,
        projecao90d,
        competenciaBp: bp?.competencia_fim ?? undefined,
        tem_balanco: !!bp,
      };
    },
    staleTime: 60_000,
  });
}

export type CFOInsights = {
  saude_score: number;
  saude_nivel: "critico" | "atencao" | "saudavel" | "excelente";
  resumo: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  acoes_prioritarias: { titulo: string; impacto: string; prazo: string }[];
};

export function useGerarInsightsCFO() {
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (indicadores: IndicadoresCFO): Promise<CFOInsights> => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const hoje = new Date();
      const { data, error } = await supabase.functions.invoke("cfo-insights", {
        body: {
          empresa_id: empresaId,
          contexto: { mes: hoje.toISOString().slice(0, 7) },
          indicadores: {
            ebitda: indicadores.ebitda,
            margemEbitda: indicadores.margemEbitda,
            lucroLiquido: indicadores.lucroLiquido,
            margemLiquida: indicadores.margemLiquida,
            liquidezCorrente: indicadores.liquidezCorrente,
            liquidezSeca: indicadores.liquidezSeca,
            endividamentoGeral: indicadores.endividamentoGeral,
            composicaoEndividamento: indicadores.composicaoEndividamento,
            roi: indicadores.roi,
            roe: indicadores.roe,
            saldoCaixaAtual: indicadores.saldoCaixaAtual,
            burnMensal: indicadores.burnMensal,
            runwayMeses: indicadores.runwayMeses,
            tem_balanco: indicadores.tem_balanco,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.insights as CFOInsights;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
