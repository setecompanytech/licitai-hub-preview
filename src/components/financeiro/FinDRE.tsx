import { useState } from "react";
import { mesLocal } from '@/lib/financeiro/data-local';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRefreshFinanceiroViews } from "@/hooks/useFinanceiro";
import {
  useDREComparativa,
  type ModoComparacao,
  type DRECellComparada,
} from "@/hooks/useDREComparativa";
import { formatBRL, formatFracao } from "@/lib/financeiro/formatters";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Download,
  Minus,
  Scale,
  AlertTriangle,
} from "lucide-react";
import FinDREporCentroCusto from "./FinDREporCentroCusto";

// ----------------------------------------------------------------------------
// Apresentação de sinais (despesas e deduções aparecem como "(–)")
// ----------------------------------------------------------------------------
const linhasNegativas = new Set([
  "deducoes",
  "custos",
  "despesas_operacionais",
]);

function valorComSinal(chave: string, valor: number): number {
  // No modelo Lei 6.404/76, deduções/custos/despesas são apresentados
  // subtraindo do bloco anterior, então exibimos como negativo.
  if (linhasNegativas.has(chave)) return -Math.abs(valor);
  return valor;
}

function exportCSV(
  competencia: string,
  comparativa: ReturnType<typeof useDREComparativa>
) {
  if (!comparativa.atual) return;
  const cabecalho = ["Conta", `Atual (${competencia}) R$`, "AV %"];
  if (comparativa.modo !== "nenhum" && comparativa.competenciaComparada) {
    cabecalho.push(
      `Comparado (${comparativa.competenciaComparada}) R$`,
      "Variação R$",
      "Variação %"
    );
  }
  const linhas: string[][] = [cabecalho];
  for (const l of comparativa.linhas) {
    const v = valorComSinal(l.chave, l.valor.atual);
    const row = [
      l.label,
      v.toFixed(2),
      l.valor.av != null ? (l.valor.av * 100).toFixed(2) : "",
    ];
    if (comparativa.modo !== "nenhum") {
      const c =
        l.valor.comparado != null
          ? valorComSinal(l.chave, l.valor.comparado).toFixed(2)
          : "";
      row.push(
        c,
        l.valor.comparado != null
          ? (valorComSinal(l.chave, l.valor.atual) - valorComSinal(l.chave, l.valor.comparado)).toFixed(2)
          : "",
        l.valor.variacaoPct != null ? (l.valor.variacaoPct * 100).toFixed(2) : ""
      );
    }
    linhas.push(row);
  }
  // Margem líquida
  const margem = comparativa.atual.margemLiquida;
  linhas.push(["Margem Líquida (%)", margem === null ? "—" : (margem * 100).toFixed(2)]);
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dre-${competencia}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------------------
export default function FinDRE() {
  const hoje = mesLocal();
  const [competencia, setCompetencia] = useState(hoje);
  const [modo, setModo] = useState<ModoComparacao>("mes_anterior");

  const refresh = useRefreshFinanceiroViews();
  const comparativa = useDREComparativa(competencia, modo);
  const { atual, linhas, isLoading, competenciaComparada } = comparativa;

  return (
    <div className="space-y-6">
      <FinDREporCentroCusto />
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              DRE — Demonstração do Resultado do Exercício
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Estrutura conforme Lei 6.404/76, art. 187. Inclui Análise Vertical
              (AV) e Análise Horizontal (AH).
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="dre-competencia" className="block mb-2">
                Competência
              </Label>
              <Input
                id="dre-competencia"
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <Label htmlFor="dre-modo" className="block mb-2">
                Comparar com
              </Label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoComparacao)}>
                <SelectTrigger id="dre-modo" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem comparação</SelectItem>
                  <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                  <SelectItem value="ano_anterior">Mesmo mês — ano anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Atualizar
            </Button>
            <Button
              variant="outline"
              onClick={() => exportCSV(competencia, comparativa)}
              disabled={!atual}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !atual ? (
            <Skeleton className="w-full h-64" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">Conta</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      {competencia}
                    </TableHead>
                    <TableHead className="text-right w-[90px] whitespace-nowrap">AV %</TableHead>
                    {modo !== "nenhum" && (
                      <>
                        <TableHead className="text-right whitespace-nowrap">
                          {competenciaComparada}
                        </TableHead>
                        {/* Sem largura fixa: "R$ 1.000,00" quebrava em "R$ 1.000,0 / 0"
                            dentro de 110px (19/09). A coluna cresce com o número. */}
                        <TableHead className="text-right whitespace-nowrap">AH R$</TableHead>
                        <TableHead className="text-right w-[90px] whitespace-nowrap">AH %</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <LinhaDRE
                      key={l.chave}
                      chave={l.chave}
                      label={l.label}
                      sinal={l.sinal}
                      nivel={l.nivel}
                      subtotal={l.subtotal}
                      valor={l.valor}
                      modo={modo}
                    />
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Margem líquida (Lucro Líquido ÷ Receita Líquida)
                </span>
                {atual.margemLiquida === null ? (
                  <Badge variant="muted" className="tabular-nums" title="Sem receita líquida na competência não há margem a calcular">
                    — sem receita líquida
                  </Badge>
                ) : (
                  <Badge
                    variant={atual.margemLiquida >= 0 ? "success" : "danger"}
                    className="gap-1 tabular-nums"
                  >
                    {atual.margemLiquida >= 0 ? (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    )}
                    {formatFracao(atual.margemLiquida)}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* O que o resultado NÃO absorveu, dito antes do detalhamento.
          Antes, o que não tinha grupo de DRE era varrido para Receita Bruta ou
          Despesas Operacionais por um atalho no cálculo — e o relatório
          parecia completo justamente onde estava mais incompleto. */}
      {atual &&
        (atual.semClassificacao.linhas > 0 || atual.movimentacaoExcluida.linhas > 0) && (
          <Card className="border-warning-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" aria-hidden="true" />
                Fora do resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {atual.semClassificacao.linhas > 0 && (
                <div>
                  <p className="text-sm font-medium">
                    {atual.semClassificacao.linhas} lançamento(s) sem grupo de DRE
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatBRL(atual.semClassificacao.receita)} em receita ·{" "}
                    {formatBRL(atual.semClassificacao.despesa)} em despesa
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A categoria existe, mas não está ligada a um grupo do DRE — então
                    não há onde somá-la. Financeiro → Categorias, coluna Grupo DRE.
                  </p>
                </div>
              )}
              {atual.movimentacaoExcluida.linhas > 0 && (
                <div>
                  <p className="text-sm font-medium">
                    {atual.movimentacaoExcluida.linhas} lançamento(s) de movimentação
                    patrimonial
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatBRL(atual.movimentacaoExcluida.total)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transferência, aporte, empréstimo e distribuição de lucro mudam o
                    caixa sem mudar o resultado. Excluídos por definição, não por erro.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {atual && atual.grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {atual.grupos.map((g) => (
                <div key={g.chave}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-sm">{g.rotulo}</span>
                    <span
                      className={`text-sm font-medium text-right tabular-nums ${
                        g.natureza === "receita" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatBRL(g.total)}
                    </span>
                  </div>
                  <div className="space-y-0.5 pl-3 border-l-2 border-border">
                    {g.itens.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs text-muted-foreground py-0.5"
                      >
                        <span>{it.categoria}</span>
                        <span className="text-right tabular-nums">{formatBRL(it.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Linha da DRE com AV e AH
// ----------------------------------------------------------------------------
function LinhaDRE({
  chave,
  label,
  sinal,
  nivel,
  subtotal,
  valor,
  modo,
}: {
  chave: string;
  label: string;
  sinal: "+" | "-" | "=" | "±";
  nivel: 0 | 1 | 2;
  subtotal: boolean;
  valor: DRECellComparada;
  modo: ModoComparacao;
}) {
  const valorAtual = valorComSinal(chave, valor.atual);
  const valorComp =
    valor.comparado != null ? valorComSinal(chave, valor.comparado) : null;
  // A variação se calcula ENTRE OS VALORES ASSINADOS — aplicar −abs() sobre a
  // diferença destruía o sinal: custo que caía imprimia −R$ 20.000 na AH R$
  // (contradizendo o +16,7% da AH %) e custo que explodia ficava verde.
  // Na convenção assinada, variação positiva é SEMPRE melhora: receita
  // subindo (+) e custo encolhendo (−120 → −100 = +20) apontam igual.
  const variacaoAbs =
    valorComp != null ? valorAtual - valorComp : null;

  const isLinhaCusto = linhasNegativas.has(chave);

  const corVariacao = (() => {
    if (variacaoAbs == null) return "text-muted-foreground";
    if (Math.abs(variacaoAbs) < 0.005) return "text-muted-foreground";
    return variacaoAbs > 0 ? "text-success" : "text-destructive";
  })();

  return (
    <TableRow
      className={subtotal ? "bg-muted font-semibold" : ""}
    >
      <TableCell
        className={`${nivel === 1 ? "pl-8" : ""} ${
          subtotal ? "text-foreground" : ""
        }`}
      >
        <span className="text-muted-foreground mr-2 tabular-nums text-xs">
          {sinal}
        </span>
        {label}
      </TableCell>
      {/* Toda célula numérica em UMA linha: número partido ("R$ 1.000,0 / 0",
          "100.0 / %") parece outro número. */}
      <TableCell
        className={`text-right tabular-nums whitespace-nowrap ${
          valorAtual < 0 ? "text-destructive" : ""
        }`}
      >
        {formatBRL(valorAtual)}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {valor.av != null && Math.abs(valor.av) > 0.0001
          ? `${(valor.av * 100).toFixed(1)}%`
          : "—"}
      </TableCell>
      {modo !== "nenhum" && (
        <>
          <TableCell
            className={`text-right tabular-nums whitespace-nowrap text-muted-foreground ${
              valorComp != null && valorComp < 0 ? "text-destructive" : ""
            }`}
          >
            {valorComp != null ? formatBRL(valorComp) : "—"}
          </TableCell>
          <TableCell className={`text-right tabular-nums text-xs whitespace-nowrap ${corVariacao}`}>
            <SetaVariacao valor={variacaoAbs} />
            {variacaoAbs != null ? formatBRL(variacaoAbs) : "—"}
          </TableCell>
          <TableCell className={`text-right tabular-nums text-xs whitespace-nowrap ${corVariacao}`}>
            {valor.variacaoPct != null
              ? `${(valor.variacaoPct * (isLinhaCusto ? -1 : 1) * 100).toFixed(1)}%`
              : "—"}
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

function SetaVariacao({ valor }: { valor: number | null }) {
  if (valor == null || Math.abs(valor) < 0.005)
    return <Minus className="inline h-3 w-3 mr-0.5 opacity-50" aria-hidden="true" />;
  return valor > 0 ? (
    <TrendingUp className="inline h-3 w-3 mr-0.5" aria-hidden="true" />
  ) : (
    <TrendingDown className="inline h-3 w-3 mr-0.5" aria-hidden="true" />
  );
}
