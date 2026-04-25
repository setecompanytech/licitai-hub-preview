// Hook utilitário que combina o useDRE existente para comparações temporais (AH).
// Não cria dependência de backend nova: reaproveita a materialized view via useDRE.
import { useDRE, type DREResumo } from "@/hooks/useFinanceiro";

function shiftCompetencia(competencia: string, deltaMeses: number): string {
  // competencia formato "YYYY-MM"
  const [ano, mes] = competencia.split("-").map((n) => parseInt(n, 10));
  if (!ano || !mes) return competencia;
  const d = new Date(ano, mes - 1 + deltaMeses, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export type ModoComparacao = "nenhum" | "mes_anterior" | "ano_anterior";

export type DRECellComparada = {
  atual: number;
  comparado: number | null;
  variacaoAbs: number | null;
  variacaoPct: number | null;
  /** Análise vertical: % sobre receita líquida do período atual */
  av: number | null;
};

export type DREComparativa = {
  competencia: string;
  modo: ModoComparacao;
  competenciaComparada: string | null;
  atual: DREResumo | undefined;
  comparado: DREResumo | undefined;
  isLoading: boolean;
  /** linhas oficiais Lei 6.404/76 art. 187 */
  linhas: {
    chave: string;
    label: string;
    sinal: "+" | "-" | "=" | "±";
    nivel: 0 | 1 | 2;
    /** se true, é subtotal (negrito + linha superior) */
    subtotal: boolean;
    /** valor positivo absoluto (apresentação respeita o sinal) */
    valor: DRECellComparada;
  }[];
};

function calcCell(
  atual: number,
  comparado: number | null,
  receitaLiquidaAtual: number
): DRECellComparada {
  const variacaoAbs = comparado !== null ? atual - comparado : null;
  const variacaoPct =
    comparado !== null && Math.abs(comparado) > 0.005 ? (atual - comparado) / Math.abs(comparado) : null;
  const av = receitaLiquidaAtual !== 0 ? atual / receitaLiquidaAtual : null;
  return { atual, comparado, variacaoAbs, variacaoPct, av };
}

export function useDREComparativa(competencia: string, modo: ModoComparacao): DREComparativa {
  const competenciaComparada =
    modo === "mes_anterior"
      ? shiftCompetencia(competencia, -1)
      : modo === "ano_anterior"
      ? shiftCompetencia(competencia, -12)
      : null;

  const atualQuery = useDRE(competencia);
  const comparadoQuery = useDRE(competenciaComparada ?? "");

  const atual = atualQuery.data;
  const comparado = modo === "nenhum" ? undefined : comparadoQuery.data;
  const isLoading = atualQuery.isLoading || (modo !== "nenhum" && comparadoQuery.isLoading);

  const RL = atual?.receitaLiquida ?? 0;

  const get = (campo: keyof DREResumo): number =>
    typeof atual?.[campo] === "number" ? (atual[campo] as number) : 0;
  const getC = (campo: keyof DREResumo): number | null =>
    comparado && typeof comparado[campo] === "number" ? (comparado[campo] as number) : null;

  const linhas: DREComparativa["linhas"] = atual
    ? [
        {
          chave: "receita_bruta",
          label: "Receita Bruta de Vendas e Serviços",
          sinal: "+",
          nivel: 0,
          subtotal: false,
          valor: calcCell(get("receitaBruta"), getC("receitaBruta"), RL),
        },
        {
          chave: "deducoes",
          label: "Deduções da Receita Bruta",
          sinal: "-",
          nivel: 1,
          subtotal: false,
          valor: calcCell(get("deducoes"), getC("deducoes"), RL),
        },
        {
          chave: "receita_liquida",
          label: "Receita Líquida",
          sinal: "=",
          nivel: 0,
          subtotal: true,
          valor: calcCell(get("receitaLiquida"), getC("receitaLiquida"), RL),
        },
        {
          chave: "custos",
          label: "Custo dos Produtos / Serviços Vendidos (CMV / CSV)",
          sinal: "-",
          nivel: 1,
          subtotal: false,
          valor: calcCell(get("custos"), getC("custos"), RL),
        },
        {
          chave: "lucro_bruto",
          label: "Lucro Bruto",
          sinal: "=",
          nivel: 0,
          subtotal: true,
          valor: calcCell(get("lucroBruto"), getC("lucroBruto"), RL),
        },
        {
          chave: "despesas_operacionais",
          label: "Despesas Operacionais",
          sinal: "-",
          nivel: 1,
          subtotal: false,
          valor: calcCell(
            get("despesasOperacionais"),
            getC("despesasOperacionais"),
            RL
          ),
        },
        {
          chave: "resultado_operacional",
          label: "Resultado Operacional (EBIT)",
          sinal: "=",
          nivel: 0,
          subtotal: true,
          valor: calcCell(
            get("resultadoOperacional"),
            getC("resultadoOperacional"),
            RL
          ),
        },
        {
          chave: "outros_resultados",
          label: "Outras Receitas / Despesas (Resultado Financeiro)",
          sinal: "±",
          nivel: 1,
          subtotal: false,
          valor: calcCell(
            get("outrosResultados"),
            getC("outrosResultados"),
            RL
          ),
        },
        {
          chave: "resultado_liquido",
          label: "Resultado Líquido do Exercício",
          sinal: "=",
          nivel: 0,
          subtotal: true,
          valor: calcCell(
            get("resultadoLiquido"),
            getC("resultadoLiquido"),
            RL
          ),
        },
      ]
    : [];

  return {
    competencia,
    modo,
    competenciaComparada,
    atual,
    comparado,
    isLoading,
    linhas,
  };
}
