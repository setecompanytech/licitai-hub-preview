import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDRE, useRefreshFinanceiroViews } from "@/hooks/useFinanceiro";
import { formatBRL, formatPercent } from "@/lib/financeiro/formatters";
import { RefreshCw, TrendingUp, TrendingDown, Download } from "lucide-react";

const grupoLabel: Record<string, string> = {
  receita_bruta: "Receita Bruta",
  deducoes: "(–) Deduções",
  custos: "(–) Custos",
  despesas_operacionais: "(–) Despesas Operacionais",
  outros_resultados: "(±) Outros Resultados",
  receita: "Receitas",
  despesa: "Despesas",
  outros: "Outros",
};

function exportCSV(competencia: string, dados: ReturnType<typeof useDRE>["data"]) {
  if (!dados) return;
  const linhas = [
    ["Conta", "Valor (R$)"],
    ["Receita Bruta", dados.receitaBruta.toFixed(2)],
    ["(–) Deduções", dados.deducoes.toFixed(2)],
    ["= Receita Líquida", dados.receitaLiquida.toFixed(2)],
    ["(–) Custos", dados.custos.toFixed(2)],
    ["= Lucro Bruto", dados.lucroBruto.toFixed(2)],
    ["(–) Despesas Operacionais", dados.despesasOperacionais.toFixed(2)],
    ["= Resultado Operacional", dados.resultadoOperacional.toFixed(2)],
    ["(±) Outros Resultados", dados.outrosResultados.toFixed(2)],
    ["= Resultado Líquido", dados.resultadoLiquido.toFixed(2)],
    ["Margem Líquida (%)", (dados.margemLiquida * 100).toFixed(2)],
  ];
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dre-${competencia}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinDRE() {
  const hoje = new Date().toISOString().slice(0, 7);
  const [competencia, setCompetencia] = useState(hoje);
  const { data, isLoading } = useDRE(competencia);
  const refresh = useRefreshFinanceiroViews();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Demonstração do Resultado (DRE)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Apuração mensal por competência. Use os botões para atualizar ou exportar.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Competência</label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refresh.isPending ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(competencia, data)} disabled={!data}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="w-full h-64" />
          ) : (
            <div className="space-y-1 text-sm">
              <Linha label="Receita Bruta" valor={data.receitaBruta} />
              <Linha label="(–) Deduções" valor={-data.deducoes} indent />
              <Linha label="= Receita Líquida" valor={data.receitaLiquida} bold />
              <Linha label="(–) Custos" valor={-data.custos} indent />
              <Linha label="= Lucro Bruto" valor={data.lucroBruto} bold />
              <Linha label="(–) Despesas Operacionais" valor={-data.despesasOperacionais} indent />
              <Linha label="= Resultado Operacional" valor={data.resultadoOperacional} bold />
              <Linha label="(±) Outros Resultados" valor={data.outrosResultados} indent />
              <div className="h-px bg-border my-2" />
              <Linha label="= Resultado Líquido do Período" valor={data.resultadoLiquido} highlight />
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Margem líquida</span>
                <Badge variant={data.margemLiquida >= 0 ? "default" : "destructive"} className="gap-1">
                  {data.margemLiquida >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPercent(data.margemLiquida)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.grupos.map((g) => (
                <div key={g.grupo}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm">{grupoLabel[g.grupo] ?? g.grupo}</span>
                    <span className={`text-sm font-medium ${g.natureza === "receita" ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatBRL(g.total)}
                    </span>
                  </div>
                  <div className="space-y-0.5 pl-3 border-l-2 border-border">
                    {g.itens.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
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

function Linha({ label, valor, bold, indent, highlight }: { label: string; valor: number; bold?: boolean; indent?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${indent ? "pl-4" : ""} ${
        highlight ? "bg-muted/40 -mx-2 px-2 rounded font-semibold text-base" : ""
      } ${bold ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className={valor < 0 ? "text-rose-600" : valor > 0 && highlight ? "text-emerald-600" : ""}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}
