import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { dataLocal, hojeLocal, mesLocal } from "@/lib/financeiro/data-local";
import { ehMovimentacao } from "@/lib/financeiro/movimentacao";
import { buscarTodos } from "@/lib/financeiro/paginar";

export type KpiExecutivo = {
  // Liquidez
  saldoTotal: number;
  saldoDisponivel: number;
  saldoBloqueado: number;

  // Recebíveis / Pagáveis — a carteira INTEIRA em aberto, sem movimentação
  aReceberTotal: number;
  aReceberVencido: number;
  aPagarTotal: number;
  aPagarVencido: number;
  /** A receber − A pagar em aberto. Não é o capital de giro contábil (AC − PC). */
  titulosEmAbertoLiquido: number;

  // Inadimplência (de recebíveis)
  inadimplenciaPerc: number; // vencido / total a receber
  /** PMR: dias médios entre vencimento e recebimento, nos títulos já recebidos. */
  diasMedioRecebimento: number;

  // Resultado mensal — realizado, sem movimentação patrimonial
  receitaMes: number;
  despesaMes: number;
  resultadoMes: number;
  margemLiquidaMes: number; // resultado / receita
  /** O que ficou de fora do resultado do mês por ser movimentação (transferência, aplicação…). */
  movimentacaoMes: number;

  // Comparativos (mesma régua do mês: realizado, sem movimentação)
  receitaMesAnterior: number;
  variacaoReceitaMoM: number | null; // %
  receitaAnoAnterior: number;
  variacaoReceitaYoY: number | null; // %

  // Ticket médio
  ticketMedioReceita: number;
  ticketMedioDespesa: number;
  qtdReceitasMes: number;
  qtdLancamentosMes: number;

  // Top concentrações
  topClientes: { nome: string; total: number; perc: number }[];
  topFornecedores: { nome: string; total: number; perc: number }[];

  // Série temporal (12 meses)
  serieReceitaDespesa: { mes: string; receita: number; despesa: number; resultado: number }[];

  // Aging recebíveis
  aging: { faixa: string; valor: number }[];
};

type Linha = {
  valor: number | null;
  tipo: string | null;
  status: string | null;
  natureza: string | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_realizado: string | null;
  pessoa: { nome?: string | null } | null;
  categoria: { natureza?: string | null; grupo_dre?: string | null } | null;
};

const COLUNAS =
  "valor, tipo, status, natureza, data_competencia, data_vencimento, data_realizado, " +
  "pessoa:financeiro_pessoas(nome), categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(natureza, grupo_dre)";

const REALIZADO = new Set(["realizado", "conciliado"]);
const ehRealizado = (l: Linha) => REALIZADO.has(l.status ?? "");
const mesDe = (l: Linha) => (l.data_realizado ?? l.data_competencia ?? "").slice(0, 7);
const soma = (ls: Linha[]) => ls.reduce((s, l) => s + Number(l.valor ?? 0), 0);

/**
 * KPIs da aba Executivo do painel financeiro.
 *
 * Auditoria de 19/09/2026 (ETHOS) — o que este hook deixou de fazer:
 *  - somar transferência entre contas próprias como receita e como despesa
 *    ("Receita R$ 184,3K" eram R$ 133 mil de transferência + R$ 51 mil de
 *    venda; agora a régua é `ehMovimentacao`, a mesma do DRE);
 *  - cortar a carteira em aberto pela janela de competência e por um `limit`
 *    sem paginação ("A receber" 8,28 mi aqui, 6,17 mi na aba Operacional, para
 *    uma carteira de 9,07 mi) — a carteira agora é buscada inteira;
 *  - comparar realizado de um mês com previsto+realizado do outro (MoM/YoY e
 *    a série de 12 meses usavam `status !== cancelado`);
 *  - procurar o mês do ano anterior numa janela de 12 meses que nunca o
 *    continha (YoY estruturalmente zero) — a janela passou a 13 meses;
 *  - datas em UTC (`toISOString`), que viram o dia às 21h em Belém — agora
 *    `data-local`.
 */
export function useDashboardExecutivo() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-dashboard-executivo", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<KpiExecutivo> => {
      const hoje = new Date();
      const hojeStr = hojeLocal();
      const mesAtualKey = mesLocal(hoje);
      const mesAnteriorKey = mesLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      const mesYoYKey = mesLocal(new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1));
      // Treze meses: o mês do ano anterior precisa estar dentro da janela.
      const inicioJanela = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1));

      const [contasRes, lancs, abertos] = await Promise.all([
        supabase.from("financeiro_contas").select("saldo_atual, ativa").eq("empresa_id", empresaId!),
        buscarTodos<Linha>((de, ate) =>
          supabase
            .from("financeiro_lancamentos")
            .select(COLUNAS)
            .eq("empresa_id", empresaId!)
            .gte("data_competencia", inicioJanela)
            .order("data_competencia")
            .order("id")
            .range(de, ate),
        ),
        // A carteira em aberto é a carteira inteira: título de competência
        // antiga continua devendo (ou sendo devido) até ser baixado.
        buscarTodos<Linha>((de, ate) =>
          supabase
            .from("financeiro_lancamentos")
            .select(COLUNAS)
            .eq("empresa_id", empresaId!)
            .in("tipo", ["a_pagar", "a_receber"])
            .in("status", ["previsto", "em_atraso"])
            .order("data_competencia")
            .order("id")
            .range(de, ate),
        ),
      ]);
      if (contasRes.error) throw contasRes.error;

      const contas = contasRes.data ?? [];

      // ----- Liquidez -----
      const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const saldoDisponivel = contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const saldoBloqueado = saldoTotal - saldoDisponivel;

      // ----- Recebíveis/Pagáveis (sem movimentação: resgate de aplicação
      // lançado como conta a receber não é recebível) -----
      const titulos = abertos.filter((l) => !ehMovimentacao(l));
      const isVencido = (l: Linha) => !!l.data_vencimento && l.data_vencimento < hojeStr;
      const receberAbertos = titulos.filter((l) => l.tipo === "a_receber");
      const pagarAbertos = titulos.filter((l) => l.tipo === "a_pagar");
      const aReceberTotal = soma(receberAbertos);
      const aReceberVencido = soma(receberAbertos.filter(isVencido));
      const aPagarTotal = soma(pagarAbertos);
      const aPagarVencido = soma(pagarAbertos.filter(isVencido));
      const titulosEmAbertoLiquido = aReceberTotal - aPagarTotal;
      const inadimplenciaPerc = aReceberTotal > 0 ? (aReceberVencido / aReceberTotal) * 100 : 0;

      // ----- Dias médio recebimento (PMR), nos títulos já recebidos -----
      const recebidos = lancs.filter(
        (l) => l.tipo === "a_receber" && ehRealizado(l) && l.data_vencimento && l.data_realizado && !ehMovimentacao(l),
      );
      const diasMedioRecebimento =
        recebidos.length > 0
          ? recebidos.reduce((s, l) => {
              const venc = new Date(`${l.data_vencimento}T12:00:00`).getTime();
              const real = new Date(`${l.data_realizado}T12:00:00`).getTime();
              return s + Math.max(0, (real - venc) / 86_400_000);
            }, 0) / recebidos.length
          : 0;

      // ----- Resultado: realizado, sem movimentação — a mesma régua do DRE -----
      const realizados = lancs.filter(ehRealizado);
      const resultado = realizados.filter((l) => !ehMovimentacao(l));
      const receitas = resultado.filter((l) => l.natureza === "receita");
      const despesas = resultado.filter((l) => l.natureza === "despesa");
      const noMes = (chave: string) => (l: Linha) => mesDe(l) === chave;

      const recMes = receitas.filter(noMes(mesAtualKey));
      const desMes = despesas.filter(noMes(mesAtualKey));
      const receitaMes = soma(recMes);
      const despesaMes = soma(desMes);
      const resultadoMes = receitaMes - despesaMes;
      const margemLiquidaMes = receitaMes > 0 ? (resultadoMes / receitaMes) * 100 : 0;
      const movimentacaoMes = soma(realizados.filter((l) => ehMovimentacao(l) && noMes(mesAtualKey)(l)));

      // ----- Comparativos MoM / YoY, com a MESMA régua do mês -----
      const receitaMesAnterior = soma(receitas.filter(noMes(mesAnteriorKey)));
      const receitaAnoAnterior = soma(receitas.filter(noMes(mesYoYKey)));
      const variacaoReceitaMoM =
        receitaMesAnterior > 0 ? ((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100 : null;
      const variacaoReceitaYoY =
        receitaAnoAnterior > 0 ? ((receitaMes - receitaAnoAnterior) / receitaAnoAnterior) * 100 : null;

      // ----- Ticket médio -----
      const ticketMedioReceita = recMes.length > 0 ? receitaMes / recMes.length : 0;
      const ticketMedioDespesa = desMes.length > 0 ? despesaMes / desMes.length : 0;
      const qtdReceitasMes = recMes.length;
      const qtdLancamentosMes = realizados.filter(noMes(mesAtualKey)).length;

      // ----- Top clientes / fornecedores (12m, realizado) -----
      const clientesMap = new Map<string, number>();
      const fornecedoresMap = new Map<string, number>();
      resultado.forEach((l) => {
        const nome = l.pessoa?.nome ?? "Sem cadastro";
        if (l.natureza === "receita") clientesMap.set(nome, (clientesMap.get(nome) ?? 0) + Number(l.valor ?? 0));
        else if (l.natureza === "despesa") fornecedoresMap.set(nome, (fornecedoresMap.get(nome) ?? 0) + Number(l.valor ?? 0));
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

      // ----- Série 12 meses (realizado, sem movimentação) -----
      const serieMap = new Map<string, { receita: number; despesa: number }>();
      for (let i = 11; i >= 0; i--) {
        serieMap.set(mesLocal(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)), { receita: 0, despesa: 0 });
      }
      resultado.forEach((l) => {
        const bucket = serieMap.get(mesDe(l));
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

      // ----- Aging de recebíveis (título sem vencimento fica fora — não há o que envelhecer) -----
      const faixas = [
        { label: "A vencer", min: -Infinity, max: 0 },
        { label: "1-30 dias", min: 1, max: 30 },
        { label: "31-60 dias", min: 31, max: 60 },
        { label: "61-90 dias", min: 61, max: 90 },
        { label: "+90 dias", min: 91, max: Infinity },
      ];
      const aging = faixas.map((f) => ({ faixa: f.label, valor: 0 }));
      const hojeMs = new Date(`${hojeStr}T12:00:00`).getTime();
      receberAbertos.forEach((l) => {
        if (!l.data_vencimento) return;
        const dias = Math.floor((hojeMs - new Date(`${l.data_vencimento}T12:00:00`).getTime()) / 86_400_000);
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
        titulosEmAbertoLiquido,
        inadimplenciaPerc,
        diasMedioRecebimento,
        receitaMes,
        despesaMes,
        resultadoMes,
        margemLiquidaMes,
        movimentacaoMes,
        receitaMesAnterior,
        variacaoReceitaMoM,
        receitaAnoAnterior,
        variacaoReceitaYoY,
        ticketMedioReceita,
        ticketMedioDespesa,
        qtdReceitasMes,
        qtdLancamentosMes,
        topClientes,
        topFornecedores,
        serieReceitaDespesa,
        aging,
      };
    },
  });
}
