import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";

export type KpiExecutivo = {
  // Liquidez
  saldoTotal: number;
  saldoDisponivel: number;
  saldoBloqueado: number;

  // Recebíveis / Pagáveis
  aReceberTotal: number;
  aReceberVencido: number;
  aPagarTotal: number;
  aPagarVencido: number;
  capitalGiroLiquido: number; // aReceber - aPagar

  // Inadimplência
  inadimplenciaPerc: number; // vencido / total a receber
  diasMedioRecebimento: number;

  // Resultado mensal
  receitaMes: number;
  despesaMes: number;
  resultadoMes: number;
  margemLiquidaMes: number; // resultado / receita

  // Comparativos
  receitaMesAnterior: number;
  variacaoReceitaMoM: number | null; // %
  receitaAnoAnterior: number;
  variacaoReceitaYoY: number | null; // %

  // Ticket médio
  ticketMedioReceita: number;
  ticketMedioDespesa: number;
  qtdLancamentosMes: number;

  // Top concentrações
  topClientes: { nome: string; total: number; perc: number }[];
  topFornecedores: { nome: string; total: number; perc: number }[];

  // Série temporal (12 meses)
  serieReceitaDespesa: { mes: string; receita: number; despesa: number; resultado: number }[];

  // Aging recebíveis
  aging: { faixa: string; valor: number }[];
};

const inicioMes = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
const fimMes = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);

export function useDashboardExecutivo() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-dashboard-executivo", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<KpiExecutivo> => {
      const hoje = new Date();
      const inicio12m = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 10);
      const mesAtualKey = hoje.toISOString().slice(0, 7);
      const mesAnteriorKey = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 7);
      const mesYoYKey = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1).toISOString().slice(0, 7);
      const hojeStr = hoje.toISOString().slice(0, 10);

      const [contasRes, lancRes] = await Promise.all([
        supabase
          .from("financeiro_contas")
          .select("saldo_atual, ativa")
          .eq("empresa_id", empresaId!),
        supabase
          .from("financeiro_lancamentos")
          .select("valor, tipo, status, natureza, data_competencia, data_vencimento, data_realizado, pessoa:financeiro_pessoas(nome)")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", inicio12m)
          .limit(5000),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (lancRes.error) throw lancRes.error;

      const contas = contasRes.data ?? [];
      const lancs = lancRes.data ?? [];

      // ----- Liquidez -----
      const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const saldoDisponivel = contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const saldoBloqueado = saldoTotal - saldoDisponivel;

      // ----- Recebíveis/Pagáveis -----
      const isAberto = (s: string | null) => s === "previsto" || s === "em_atraso";
      const isVencido = (l: { data_vencimento: string | null; status: string | null }) =>
        isAberto(l.status) && l.data_vencimento && l.data_vencimento < hojeStr;

      const receberAbertos = lancs.filter((l) => l.tipo === "a_receber" && isAberto(l.status));
      const pagarAbertos = lancs.filter((l) => l.tipo === "a_pagar" && isAberto(l.status));
      const aReceberTotal = receberAbertos.reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const aReceberVencido = receberAbertos.filter(isVencido).reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const aPagarTotal = pagarAbertos.reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const aPagarVencido = pagarAbertos.filter(isVencido).reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const capitalGiroLiquido = aReceberTotal - aPagarTotal;
      const inadimplenciaPerc = aReceberTotal > 0 ? (aReceberVencido / aReceberTotal) * 100 : 0;

      // ----- Dias médio recebimento (PMR) -----
      const recebidos = lancs.filter(
        (l) => l.tipo === "a_receber" && l.status === "realizado" && l.data_vencimento && l.data_realizado
      );
      const diasMedioRecebimento =
        recebidos.length > 0
          ? recebidos.reduce((s, l) => {
              const venc = new Date(l.data_vencimento!).getTime();
              const real = new Date(l.data_realizado!).getTime();
              return s + Math.max(0, (real - venc) / (1000 * 60 * 60 * 24));
            }, 0) / recebidos.length
          : 0;

      // ----- Mês atual -----
      const realizadoMes = lancs.filter(
        (l) => l.status !== "cancelado" && (l.data_realizado ?? l.data_competencia ?? "").startsWith(mesAtualKey)
      );
      const receitaMes = realizadoMes
        .filter((l) => l.natureza === "receita")
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const despesaMes = realizadoMes
        .filter((l) => l.natureza === "despesa")
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const resultadoMes = receitaMes - despesaMes;
      const margemLiquidaMes = receitaMes > 0 ? (resultadoMes / receitaMes) * 100 : 0;

      // ----- Comparativos MoM / YoY -----
      const receitaMesAnterior = lancs
        .filter(
          (l) =>
            l.natureza === "receita" &&
            l.status !== "cancelado" &&
            (l.data_realizado ?? l.data_competencia ?? "").startsWith(mesAnteriorKey)
        )
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const receitaAnoAnterior = lancs
        .filter(
          (l) =>
            l.natureza === "receita" &&
            l.status !== "cancelado" &&
            (l.data_realizado ?? l.data_competencia ?? "").startsWith(mesYoYKey)
        )
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const variacaoReceitaMoM =
        receitaMesAnterior > 0 ? ((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100 : null;
      const variacaoReceitaYoY =
        receitaAnoAnterior > 0 ? ((receitaMes - receitaAnoAnterior) / receitaAnoAnterior) * 100 : null;

      // ----- Ticket médio -----
      const recMes = realizadoMes.filter((l) => l.natureza === "receita");
      const desMes = realizadoMes.filter((l) => l.natureza === "despesa");
      const ticketMedioReceita = recMes.length > 0 ? receitaMes / recMes.length : 0;
      const ticketMedioDespesa = desMes.length > 0 ? despesaMes / desMes.length : 0;
      const qtdLancamentosMes = realizadoMes.length;

      // ----- Top clientes / fornecedores (12m) -----
      const clientesMap = new Map<string, number>();
      const fornecedoresMap = new Map<string, number>();
      lancs.forEach((l) => {
        if (l.status === "cancelado") return;
        const nome = (l.pessoa as { nome?: string } | null)?.nome ?? "Sem cadastro";
        if (l.natureza === "receita") {
          clientesMap.set(nome, (clientesMap.get(nome) ?? 0) + Number(l.valor ?? 0));
        } else if (l.natureza === "despesa") {
          fornecedoresMap.set(nome, (fornecedoresMap.get(nome) ?? 0) + Number(l.valor ?? 0));
        }
      });
      const totalReceitas12m = Array.from(clientesMap.values()).reduce((s, v) => s + v, 0);
      const totalDespesas12m = Array.from(fornecedoresMap.values()).reduce((s, v) => s + v, 0);
      const topClientes = Array.from(clientesMap.entries())
        .map(([nome, total]) => ({ nome, total, perc: totalReceitas12m > 0 ? (total / totalReceitas12m) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      const topFornecedores = Array.from(fornecedoresMap.entries())
        .map(([nome, total]) => ({ nome, total, perc: totalDespesas12m > 0 ? (total / totalDespesas12m) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // ----- Série 12 meses -----
      const serieMap = new Map<string, { receita: number; despesa: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        serieMap.set(d.toISOString().slice(0, 7), { receita: 0, despesa: 0 });
      }
      lancs.forEach((l) => {
        if (l.status === "cancelado") return;
        const mes = (l.data_realizado ?? l.data_competencia ?? "").slice(0, 7);
        const bucket = serieMap.get(mes);
        if (!bucket) return;
        const v = Number(l.valor ?? 0);
        if (l.natureza === "receita") bucket.receita += v;
        else if (l.natureza === "despesa") bucket.despesa += v;
      });
      const serieReceitaDespesa = Array.from(serieMap.entries()).map(([mes, v]) => ({
        mes,
        receita: v.receita,
        despesa: v.despesa,
        resultado: v.receita - v.despesa,
      }));

      // ----- Aging de recebíveis -----
      const faixas = [
        { label: "A vencer", min: -Infinity, max: 0 },
        { label: "1-30 dias", min: 1, max: 30 },
        { label: "31-60 dias", min: 31, max: 60 },
        { label: "61-90 dias", min: 61, max: 90 },
        { label: "+90 dias", min: 91, max: Infinity },
      ];
      const aging = faixas.map((f) => ({ faixa: f.label, valor: 0 }));
      receberAbertos.forEach((l) => {
        if (!l.data_vencimento) return;
        const dias = Math.floor((new Date(hojeStr).getTime() - new Date(l.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        const idx = faixas.findIndex((f) => dias >= f.min && dias <= f.max);
        if (idx >= 0) aging[idx].valor += Number(l.valor ?? 0);
      });

      return {
        saldoTotal,
        saldoDisponivel,
        saldoBloqueado,
        aReceberTotal,
        aReceberVencido,
        aPagarTotal,
        aPagarVencido,
        capitalGiroLiquido,
        inadimplenciaPerc,
        diasMedioRecebimento,
        receitaMes,
        despesaMes,
        resultadoMes,
        margemLiquidaMes,
        receitaMesAnterior,
        variacaoReceitaMoM,
        receitaAnoAnterior,
        variacaoReceitaYoY,
        ticketMedioReceita,
        ticketMedioDespesa,
        qtdLancamentosMes,
        topClientes,
        topFornecedores,
        serieReceitaDespesa,
        aging,
      };
    },
  });
}
