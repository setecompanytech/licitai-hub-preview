import { useQuery, useMutation } from "@tanstack/react-query";
import { dataLocal, mesLocal, somarDiasLocal } from '@/lib/financeiro/data-local';
import { ehMovimentacao } from '@/lib/financeiro/movimentacao';
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { toast } from "sonner";

export type IndicadoresCFO = {
  // Rentabilidade (realizado do mês, sem movimentação, por grupo do DRE)
  receitaLiquida: number;
  custosOperacionais: number;
  despesasOperacionais: number;
  resultadoFinanceiro: number;
  ebitda: number;
  margemEbitda: number; // %
  lucroLiquido: number;
  margemLiquida: number; // %

  // Liquidez (do BP mais recente). `null` = sem Balanço publicado: não há
  // número, e zero seria afirmar "liquidez nenhuma".
  ativoCirculante: number;
  passivoCirculante: number;
  estoques: number;
  liquidezCorrente: number | null; // AC / PC
  liquidezSeca: number | null; // (AC - Estoques) / PC

  // Endividamento
  passivoTotal: number;
  patrimonioLiquido: number;
  endividamentoGeral: number | null; // PT / AT * 100
  composicaoEndividamento: number | null; // PC / PT * 100

  // Retorno
  ativoTotal: number;
  roi: number | null; // Lucro / Ativo Total * 100
  roe: number | null; // Lucro / PL * 100

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
      const inicio6m = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1));
      const hojeStr = dataLocal(hoje);

      // Paginação para evitar truncamento silencioso (limite default Supabase: 1000)
      const fetchLancsPaginado = async () => {
        const PAGE = 1000;
        let from = 0;
        const acc: any[] = [];
        // teto de segurança 50k registros (≈ 25 páginas)
        for (let i = 0; i < 50; i++) {
          const { data, error } = await supabase
            .from("financeiro_lancamentos")
            .select("valor, tipo, status, natureza, data_competencia, data_vencimento, data_realizado, categoria_id, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(natureza, grupo_dre)")
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
      // Janela: usa o mês corrente; se vazio, faz fallback para o último mês com dados (ambientes mock)
      const mesCorrente = mesLocal(hoje);
      const mesesComDados = Array.from(
        new Set(
          lancs
            .filter((l) => l.status !== "cancelado")
            .map((l) => (l.data_realizado ?? l.data_competencia ?? "").slice(0, 7))
            .filter(Boolean)
        )
      ).sort();
      const temDadosNoMes = mesesComDados.includes(mesCorrente);
      const mesAtualKey = temDadosNoMes ? mesCorrente : mesesComDados[mesesComDados.length - 1] ?? mesCorrente;
      const realizadoMes = lancs.filter(
        // "Realizado" de verdade: previsto/em_atraso inflavam os cards (M3).
        // E sem movimentação: transferência entre contas próprias entrava como
        // receita e como despesa (R$ 133 mil em setembro/2026, ETHOS).
        (l) => ["realizado", "conciliado"].includes(l.status as string) &&
               (l.data_realizado ?? l.data_competencia ?? "").startsWith(mesAtualKey) &&
               !ehMovimentacao(l)
      );
      const soma = (ls: typeof realizadoMes) => ls.reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const grupo = (l: (typeof realizadoMes)[number]) => (l.categoria as { grupo_dre?: string | null } | null)?.grupo_dre ?? null;
      const receitas = realizadoMes.filter((l) => l.natureza === "receita");
      const despesas = realizadoMes.filter((l) => l.natureza === "despesa");
      // Pelo grupo do DRE da categoria — a régua de `montarDRE` —, e não pelo
      // rateio fixo 60/40 que estava aqui: EBITDA saía igual ao "Resultado do
      // mês" com uma decomposição inventada.
      const receitaLiquida =
        soma(receitas.filter((l) => grupo(l) !== "receita_financeira")) - soma(despesas.filter((l) => grupo(l) === "deducoes"));
      const custosOperacionais = soma(despesas.filter((l) => grupo(l) === "cmv_cps"));
      const despesasOperacionais = soma(despesas.filter((l) => !["cmv_cps", "deducoes", "desp_financeira"].includes(grupo(l) ?? "")));
      const resultadoFinanceiro =
        soma(receitas.filter((l) => grupo(l) === "receita_financeira")) - soma(despesas.filter((l) => grupo(l) === "desp_financeira"));
      const ebitda = receitaLiquida - custosOperacionais - despesasOperacionais;
      const margemEbitda = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;
      // Estimativas declaradas na tela: D&A 5% da receita, IR/CSLL 15% sobre lucro positivo.
      const depreciacao = receitaLiquida * 0.05;
      const lair = ebitda + resultadoFinanceiro - depreciacao;
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

      // Sem Balanço publicado não há indicador — há ausência. O zero de antes
      // passava pelos semáforos e pintava "liquidez nenhuma" (vermelho) e
      // "dívida nenhuma" (verde) ao mesmo tempo, ambos falsos.
      const temBP = !!bp;
      const razao = (num: number, den: number) => (temBP && den > 0 ? num / den : null);
      const liquidezCorrente = razao(ativoCirculante, passivoCirculante);
      const liquidezSeca = razao(ativoCirculante - estoques, passivoCirculante);
      const endividamentoGeral = razao(passivoTotal * 100, ativoTotal);
      const composicaoEndividamento = razao(passivoCirculante * 100, passivoTotal);
      const roi = razao(lucroLiquido * 100, ativoTotal);
      const roe = razao(lucroLiquido * 100, patrimonioLiquido);

      // ===== Caixa =====
      const saldoCaixaAtual = contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      // Burn dos últimos 3 meses
      const burns: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const ref = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)).slice(0, 7);
        // Queima de caixa é o que saiu de fato: realizado, sem movimentação.
        const doMes = lancs.filter(
          (l) => ["realizado", "conciliado"].includes(l.status as string) &&
                 (l.data_realizado ?? l.data_competencia ?? "").startsWith(ref) && !ehMovimentacao(l),
        );
        const recM = doMes.filter((l) => l.natureza === "receita").reduce((s, l) => s + Number(l.valor ?? 0), 0);
        const desM = doMes.filter((l) => l.natureza === "despesa").reduce((s, l) => s + Number(l.valor ?? 0), 0);
        burns.push(desM - recM);
      }
      const burnMensal = burns.length > 0 ? burns.reduce((a, b) => a + b, 0) / burns.length : 0;
      const runwayMeses = burnMensal > 0 && saldoCaixaAtual > 0 ? saldoCaixaAtual / burnMensal : null;

      // ===== Projeção 90d — algoritmo O(n+90) com varredura única =====
      const proximos90 = somarDiasLocal(90, hoje);
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
      // Ou títulos, ou burn — NUNCA os dois: os previstos JÁ SÃO as contas
      // dos próximos 90 dias, e o burn é a média das mesmas contas; subtrair
      // os dois deixava a curva R$ 300 mil abaixo do real (M4 da auditoria).
      // Com carteira lançada, projeta-se pelos títulos; sem carteira, o burn
      // médio é a única informação disponível e assume o posto.
      const usarBurn = previstos.length === 0;
      let idx = 0;
      for (let d = 0; d <= 90; d++) {
        const dia = somarDiasLocal(d, hoje);
        // aplica todos os eventos cujo vencimento <= dia, marcha avante
        while (idx < previstos.length && previstos[idx].data_vencimento! <= dia) {
          const v = Number(previstos[idx].valor ?? 0);
          saldoAcum += previstos[idx].tipo === "a_receber" ? v : -v;
          idx++;
        }
        const saldoFinal = usarBurn ? saldoAcum - burnDiario * d : saldoAcum;
        if (d % 3 === 0) {
          projecao90d.push({
            dia,
            saldo_projetado: Number.isFinite(saldoFinal) ? saldoFinal : 0,
          });
        }
      }

      // sanitiza qualquer NaN/Infinity decorrente de divisões por zero
      const safe = (n: number) => (Number.isFinite(n) ? n : 0);
      const safeOuNulo = (n: number | null) => (n === null ? null : safe(n));

      return {
        receitaLiquida: safe(receitaLiquida),
        custosOperacionais: safe(custosOperacionais),
        despesasOperacionais: safe(despesasOperacionais),
        resultadoFinanceiro: safe(resultadoFinanceiro),
        ebitda: safe(ebitda),
        margemEbitda: safe(margemEbitda),
        lucroLiquido: safe(lucroLiquido),
        margemLiquida: safe(margemLiquida),
        ativoCirculante: safe(ativoCirculante),
        passivoCirculante: safe(passivoCirculante),
        estoques: safe(estoques),
        liquidezCorrente: safeOuNulo(liquidezCorrente),
        liquidezSeca: safeOuNulo(liquidezSeca),
        passivoTotal: safe(passivoTotal),
        patrimonioLiquido: safe(patrimonioLiquido),
        endividamentoGeral: safeOuNulo(endividamentoGeral),
        composicaoEndividamento: safeOuNulo(composicaoEndividamento),
        ativoTotal: safe(ativoTotal),
        roi: safeOuNulo(roi),
        roe: safeOuNulo(roe),
        saldoCaixaAtual: safe(saldoCaixaAtual),
        burnMensal: safe(burnMensal),
        runwayMeses: runwayMeses != null && Number.isFinite(runwayMeses) ? runwayMeses : null,
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
          contexto: { mes: mesLocal(hoje) },
          indicadores: {
            ebitda: indicadores.ebitda,
            margemEbitda: indicadores.margemEbitda,
            lucroLiquido: indicadores.lucroLiquido,
            margemLiquida: indicadores.margemLiquida,
            // Sem BP os seis vão como `undefined` e somem do JSON: a IA não
            // recebe um zero com cara de medida.
            liquidezCorrente: indicadores.liquidezCorrente ?? undefined,
            liquidezSeca: indicadores.liquidezSeca ?? undefined,
            endividamentoGeral: indicadores.endividamentoGeral ?? undefined,
            composicaoEndividamento: indicadores.composicaoEndividamento ?? undefined,
            roi: indicadores.roi ?? undefined,
            roe: indicadores.roe ?? undefined,
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
