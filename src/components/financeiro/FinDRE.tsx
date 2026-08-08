import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatBRL, formatPercent } from "@/lib/financeiro/formatters";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Download,
  Minus,
  Scale,
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
        l.valor.variacaoAbs != null
          ? valorComSinal(l.chave, l.valor.variacaoAbs).toFixed(2)
          : "",
        l.valor.variacaoPct != null ? (l.valor.variacaoPct * 100).toFixed(2) : ""
      );
    }
    linhas.push(row);
  }
  // Margem líquida
  const margem = comparativa.atual.margemLiquida;
  linhas.push(["Margem Líquida (%)", (margem * 100).toFixed(2)]);
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
  const hoje = new Date().toISOString().slice(0, 7);
  const [competencia, setCompetencia] = useState(hoje);
  const [modo, setModo] = useState<ModoComparacao>("mes_anterior");

  const refresh = useRefreshFinanceiroViews();
  const comparativa = useDREComparativa(competencia, modo);
  const { atual, linhas, isLoading, competenciaComparada } = comparativa;

  return (
    <div className="space-y-4">
      <FinDREporCentroCusto />
      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              DRE — Demonstração do Resultado do Exercício
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Estrutura conforme Lei 6.404/76, art. 187. Inclui Análise Vertical
              (AV) e Análise Horizontal (AH).
            </p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Competência
              </label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Comparar com
              </label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoComparacao)}>
                <SelectTrigger className="w-44">
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
              size="sm"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${refresh.isPending ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(competencia, comparativa)}
              disabled={!atual}
            >
              <Download className="h-4 w-4 mr-1.5" />
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
                    <TableHead className="text-right w-[80px]">AV %</TableHead>
                    {modo !== "nenhum" && (
                      <>
                        <TableHead className="text-right whitespace-nowrap">
                          {competenciaComparada}
                        </TableHead>
                        <TableHead className="text-right w-[110px]">AH R$</TableHead>
                        <TableHead className="text-right w-[100px]">AH %</TableHead>
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

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Margem líquida (Lucro Líquido ÷ Receita Líquida)
                </span>
                <Badge
                  variant={atual.margemLiquida >= 0 ? "default" : "destructive"}
                  className="gap-1"
                >
                  {atual.margemLiquida >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatPercent(atual.margemLiquida)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {atual && atual.grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {atual.grupos.map((g) => (
                <div key={g.grupo}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm">{g.grupo}</span>
                    <span
                      className={`text-sm font-medium ${
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
                        className="flex items-center justify-between text-xs text-muted-foreground py-0.5"
                      >
                        <span>{it.categoria}</span>
                        <span>{formatBRL(it.total)}</span>
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
  const variacaoAbs =
    valor.variacaoAbs != null ? valorComSinal(chave, valor.variacaoAbs) : null;

  // AH "boa" = mais receita ou menos despesa.
  const isLinhaCusto = linhasNegativas.has(chave);
  const ahPositivaEhBoa = !isLinhaCusto;

  const corVariacao = (() => {
    if (variacaoAbs == null) return "text-muted-foreground";
    if (Math.abs(variacaoAbs) < 0.005) return "text-muted-foreground";
    const subiu = variacaoAbs > 0;
    const ehBom = ahPositivaEhBoa ? subiu : !subiu;
    return ehBom ? "text-success" : "text-destructive";
  })();

  return (
    <TableRow
      className={
        subtotal ? "bg-muted/40 font-semibold" : nivel === 1 ? "" : ""
      }
    >
      <TableCell
        className={`${nivel === 1 ? "pl-8" : ""} ${
          subtotal ? "text-foreground" : ""
        }`}
      >
        <span className="text-muted-foreground mr-1.5 font-mono text-xs">
          {sinal}
        </span>
        {label}
      </TableCell>
      <TableCell
        className={`text-right font-mono ${
          valorAtual < 0 ? "text-destructive" : ""
        }`}
      >
        {formatBRL(valorAtual)}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground font-mono">
        {valor.av != null && Math.abs(valor.av) > 0.0001
          ? `${(valor.av * 100).toFixed(1)}%`
          : "—"}
      </TableCell>
      {modo !== "nenhum" && (
        <>
          <TableCell
            className={`text-right font-mono text-muted-foreground ${
              valorComp != null && valorComp < 0 ? "text-destructive" : ""
            }`}
          >
            {valorComp != null ? formatBRL(valorComp) : "—"}
          </TableCell>
          <TableCell className={`text-right font-mono text-xs ${corVariacao}`}>
            <SetaVariacao valor={variacaoAbs} />
            {variacaoAbs != null ? formatBRL(variacaoAbs) : "—"}
          </TableCell>
          <TableCell className={`text-right font-mono text-xs ${corVariacao}`}>
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
    return <Minus className="inline h-3 w-3 mr-0.5 opacity-50" />;
  return valor > 0 ? (
    <TrendingUp className="inline h-3 w-3 mr-0.5" />
  ) : (
    <TrendingDown className="inline h-3 w-3 mr-0.5" />
  );
}
