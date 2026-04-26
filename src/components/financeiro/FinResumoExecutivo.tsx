import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Sparkles, Loader2 } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FinResumoExecutivo() {
  const empresaId = useEmpresaId();
  const { empresaAtiva } = useEmpresa();

  const { data, isLoading } = useQuery({
    queryKey: ["resumo-executivo", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const ano = new Date().getFullYear();
      const mes = new Date().getMonth() + 1;
      const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const [{ data: contas }, { data: lancs }] = await Promise.all([
        supabase.from("financeiro_contas").select("saldo_atual").eq("empresa_id", empresaId!).eq("ativa", true),
        supabase.from("financeiro_lancamentos")
          .select("tipo, status, valor, data_competencia, data_vencimento")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", `${ano}-01-01`),
      ]);
      const saldoTotal = (contas ?? []).reduce((a, c) => a + Number(c.saldo_atual), 0);
      const noMes = (lancs ?? []).filter((l) => (l.data_competencia ?? "") >= inicioMes);
      const receitaMes = noMes.filter((l) => l.tipo === "a_receber" && ["realizado","conciliado"].includes(l.status as string)).reduce((a,b)=>a+Number(b.valor),0);
      const despesaMes = noMes.filter((l) => l.tipo === "a_pagar" && ["realizado","conciliado"].includes(l.status as string)).reduce((a,b)=>a+Number(b.valor),0);
      const aReceber = (lancs ?? []).filter((l) => l.tipo === "a_receber" && ["previsto","em_atraso"].includes(l.status as string)).reduce((a,b)=>a+Number(b.valor),0);
      const aPagar = (lancs ?? []).filter((l) => l.tipo === "a_pagar" && ["previsto","em_atraso"].includes(l.status as string)).reduce((a,b)=>a+Number(b.valor),0);
      const inadimplencia = (lancs ?? []).filter((l) => l.tipo === "a_receber" && l.status === "em_atraso").reduce((a,b)=>a+Number(b.valor),0);
      return { saldoTotal, receitaMes, despesaMes, resultadoMes: receitaMes - despesaMes, aReceber, aPagar, inadimplencia };
    },
  });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (isLoading || !data) {
    return <div className="h-64 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0 print:shadow-none space-y-6 max-w-4xl mx-auto">
        <header className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Resumo Executivo Financeiro</h1>
              <p className="text-sm text-muted-foreground">{empresaAtiva?.razao_social}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Emitido em</p>
              <p className="font-medium">{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
          </div>
        </header>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Posição financeira atual</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Saldo em contas</p>
              <p className="text-xl font-bold tabular-nums">{fmt(data.saldoTotal)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">A receber</p>
              <p className="text-xl font-bold tabular-nums text-success">{fmt(data.aReceber)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">A pagar</p>
              <p className="text-xl font-bold tabular-nums text-destructive">{fmt(data.aPagar)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Posição líquida</p>
              <p className="text-xl font-bold tabular-nums">{fmt(data.saldoTotal + data.aReceber - data.aPagar)}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Resultado do mês</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2">(+) Receitas realizadas</td><td className="text-right tabular-nums text-success">{fmt(data.receitaMes)}</td></tr>
              <tr className="border-b"><td className="py-2">(−) Despesas realizadas</td><td className="text-right tabular-nums text-destructive">({fmt(data.despesaMes)})</td></tr>
              <tr className="border-b-2 border-foreground font-semibold"><td className="py-2">(=) Resultado líquido</td><td className={`text-right tabular-nums ${data.resultadoMes >= 0 ? "text-success" : "text-destructive"}`}>{fmt(data.resultadoMes)}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indicadores de saúde</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Inadimplência (em atraso)</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(data.inadimplencia)}</p>
              <p className="text-[11px] text-muted-foreground">{data.aReceber > 0 ? ((data.inadimplencia/data.aReceber)*100).toFixed(1) : 0}% do total a receber</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Margem do mês</p>
              <p className="text-lg font-semibold tabular-nums">{data.receitaMes > 0 ? ((data.resultadoMes/data.receitaMes)*100).toFixed(1) : 0}%</p>
              <p className="text-[11px] text-muted-foreground">Resultado / Receita realizada</p>
            </div>
          </div>
        </section>

        <footer className="border-t pt-4 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Documento gerado automaticamente pelo PRAEFECTUS · Confidencial · Uso restrito à diretoria
        </footer>
      </div>
    </div>
  );
}
