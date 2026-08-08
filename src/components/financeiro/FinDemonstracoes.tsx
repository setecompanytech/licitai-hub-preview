import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileBarChart2, Scale, Activity, TrendingUp, Download, BookOpen } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfYear, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

type Lancamento = {
  id: string;
  tipo: string;
  natureza: string;
  status: string;
  valor: number;
  data_competencia: string;
  data_realizado: string | null;
  categoria_id: string | null;
};

type Categoria = { id: string; nome: string; tipo: string; codigo_dre: string | null };

export default function FinDemonstracoes() {
  const empresaId = useEmpresaId();
  const [dataInicio, setDataInicio] = useState<string>(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["fin-demo-lanc", empresaId, dataInicio, dataFim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("id, tipo, natureza, status, valor, data_competencia, data_realizado, categoria_id")
        .eq("empresa_id", empresaId!)
        .gte("data_competencia", dataInicio)
        .lte("data_competencia", dataFim)
        .in("status", ["realizado", "conciliado"])
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Lancamento[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["fin-demo-cats", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_categorias")
        .select("id, nome, codigo_dre, natureza")
        .eq("empresa_id", empresaId!);
      return ((data ?? []) as unknown as Array<{ id: string; nome: string; natureza: string; codigo_dre: string | null }>)
        .map((c) => ({ id: c.id, nome: c.nome, tipo: c.natureza, codigo_dre: c.codigo_dre })) as Categoria[];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["fin-demo-contas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_contas")
        .select("id, nome, tipo, saldo_inicial")
        .eq("empresa_id", empresaId!);
      return (data ?? []) as Array<{ id: string; nome: string; tipo: string; saldo_inicial: number | null }>;
    },
  });

  // ===== Cálculos consolidados =====
  const calc = useMemo(() => {
    const catMap = new Map(categorias.map((c) => [c.id, c]));

    let receitas = 0;
    let custos = 0;
    let despesas = 0;
    let impostos = 0;
    let financeiras_receita = 0;
    let financeiras_despesa = 0;

    for (const l of lancamentos) {
      const v = Number(l.valor) || 0;
      const cat = l.categoria_id ? catMap.get(l.categoria_id) : null;
      const codigo = cat?.codigo_dre?.toLowerCase() ?? "";

      if (l.natureza === "receita") {
        if (codigo.includes("financ")) financeiras_receita += v;
        else receitas += v;
      } else if (l.natureza === "despesa") {
        if (codigo.includes("imposto") || codigo.includes("tribut")) impostos += v;
        else if (codigo.includes("custo")) custos += v;
        else if (codigo.includes("financ")) financeiras_despesa += v;
        else despesas += v;
      }
    }

    const lucroBruto = receitas - custos - impostos;
    const ebitda = lucroBruto - despesas;
    const resultadoLiquido = ebitda + financeiras_receita - financeiras_despesa;

    // Saldo de caixa (ATIVO Circulante)
    const saldoCaixa = contas
      .filter((c) => ["corrente", "poupanca", "caixa"].includes(c.tipo))
      .reduce((acc, c) => acc + Number(c.saldo_inicial ?? 0), 0)
      + (receitas - custos - despesas - impostos + financeiras_receita - financeiras_despesa);

    // Estrutura básica BP (modelo simplificado)
    const ativoCirculante = saldoCaixa;
    const ativoNaoCirculante = 0; // imobilizado/intangível futuro
    const totalAtivo = ativoCirculante + ativoNaoCirculante;

    const passivoCirculante = 0; // a pagar futuro: fornecedores
    const passivoNaoCirculante = 0;
    const patrimonioLiquido = resultadoLiquido; // simplificado: apenas resultado do exercício
    const totalPassivo = passivoCirculante + passivoNaoCirculante + patrimonioLiquido;

    // DFC Indireta (NBC TG 03)
    const fco = resultadoLiquido + 0 /* depreciação futura */;
    const fci = 0; // investimentos
    const fcf = 0; // financiamentos
    const variacaoCaixa = fco + fci + fcf;

    // DMPL — Demonstração das Mutações do Patrimônio Líquido
    const dmpl = {
      saldoInicial: 0,
      aumentoCapital: 0,
      lucroExercicio: resultadoLiquido,
      dividendos: 0,
      saldoFinal: resultadoLiquido,
    };

    return {
      dre: {
        receitas, custos, impostos, despesas,
        financeiras_receita, financeiras_despesa,
        lucroBruto, ebitda, resultadoLiquido,
      },
      bp: {
        ativoCirculante, ativoNaoCirculante, totalAtivo,
        passivoCirculante, passivoNaoCirculante, patrimonioLiquido, totalPassivo,
        balanceado: Math.abs(totalAtivo - totalPassivo) < 0.01,
      },
      dfc: { fco, fci, fcf, variacaoCaixa, saldoFinalCaixa: saldoCaixa },
      dmpl,
    };
  }, [lancamentos, categorias, contas]);

  function exportarPDF(tipo: "balanco" | "dfc" | "dmpl" | "completo") {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const periodo = `${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}`;

    doc.setFontSize(14);
    doc.text("Demonstrações Contábeis", 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${periodo}`, 14, 22);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 27);

    let y = 34;

    if (tipo === "balanco" || tipo === "completo") {
      doc.setFontSize(12);
      doc.text("Balanço Patrimonial", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["ATIVO", "Valor (R$)"]],
        body: [
          ["Ativo Circulante", fmt(calc.bp.ativoCirculante)],
          ["  Caixa e Equivalentes", fmt(calc.bp.ativoCirculante)],
          ["Ativo Não Circulante", fmt(calc.bp.ativoNaoCirculante)],
          ["TOTAL DO ATIVO", fmt(calc.bp.totalAtivo)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      autoTable(doc, {
        startY: y,
        head: [["PASSIVO + PL", "Valor (R$)"]],
        body: [
          ["Passivo Circulante", fmt(calc.bp.passivoCirculante)],
          ["Passivo Não Circulante", fmt(calc.bp.passivoNaoCirculante)],
          ["Patrimônio Líquido", fmt(calc.bp.patrimonioLiquido)],
          ["  Resultado do Exercício", fmt(calc.dre.resultadoLiquido)],
          ["TOTAL DO PASSIVO + PL", fmt(calc.bp.totalPassivo)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (tipo === "dfc" || tipo === "completo") {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.text("DFC – Demonstração do Fluxo de Caixa (Método Indireto)", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Atividade", "Valor (R$)"]],
        body: [
          ["Fluxo das Atividades Operacionais (FCO)", fmt(calc.dfc.fco)],
          ["Fluxo das Atividades de Investimento (FCI)", fmt(calc.dfc.fci)],
          ["Fluxo das Atividades de Financiamento (FCF)", fmt(calc.dfc.fcf)],
          ["Variação Líquida de Caixa", fmt(calc.dfc.variacaoCaixa)],
          ["Saldo Final de Caixa", fmt(calc.dfc.saldoFinalCaixa)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (tipo === "dmpl" || tipo === "completo") {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.text("DMPL – Demonstração das Mutações do Patrimônio Líquido", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Movimentação", "Valor (R$)"]],
        body: [
          ["Saldo Inicial", fmt(calc.dmpl.saldoInicial)],
          ["(+) Aumento de Capital", fmt(calc.dmpl.aumentoCapital)],
          ["(+) Lucro do Exercício", fmt(calc.dmpl.lucroExercicio)],
          ["(–) Dividendos Distribuídos", fmt(calc.dmpl.dividendos)],
          ["Saldo Final", fmt(calc.dmpl.saldoFinal)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [245, 158, 11] },
      });
    }

    // Rodapé
    const totalPaginas = doc.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        "Documento gerado pelo PRAEFECTUS · NBC TG 26/03/07 · Lei 6.404/76 atualizada pela Lei 11.638/07",
        14,
        290
      );
      doc.text(`Página ${i}/${totalPaginas}`, 195, 290, { align: "right" });
    }

    doc.save(`demonstracoes-${tipo}-${dataInicio}-a-${dataFim}.pdf`);
    toast.success("PDF gerado com sucesso.");
  }

  async function salvarSnapshot(tipo: "balanco_patrimonial" | "dfc_indireta" | "dmpl") {
    if (!empresaId) return;
    const dadosMap = {
      balanco_patrimonial: calc.bp,
      dfc_indireta: calc.dfc,
      dmpl: calc.dmpl,
    };
    const { error } = await supabase.from("financeiro_demonstracoes" as any).insert({
      empresa_id: empresaId,
      tipo,
      competencia_inicio: dataInicio,
      competencia_fim: dataFim,
      dados: dadosMap[tipo],
      total_ativo: calc.bp.totalAtivo,
      total_passivo: calc.bp.totalPassivo,
      resultado_liquido: calc.dre.resultadoLiquido,
    });
    if (error) toast.error("Erro ao salvar snapshot.");
    else toast.success("Snapshot salvo no histórico.");
  }

  if (isLoading) {
    return <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[160px]" />
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => exportarPDF("completo")}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar PDF Completo
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="bp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bp"><Scale className="w-3.5 h-3.5 mr-1.5" />Balanço Patrimonial</TabsTrigger>
          <TabsTrigger value="dfc"><Activity className="w-3.5 h-3.5 mr-1.5" />DFC Indireta</TabsTrigger>
          <TabsTrigger value="dmpl"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />DMPL</TabsTrigger>
        </TabsList>

        <TabsContent value="bp" className="space-y-3 mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Scale className="w-5 h-5 text-muted-foreground" />Balanço Patrimonial</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className={calc.bp.balanceado ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                    {calc.bp.balanceado ? "✓ Balanceado" : "⚠ Desbalanceado"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => salvarSnapshot("balanco_patrimonial")}>
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportarPDF("balanco")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-4">
                  <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Ativo</h4>
                  <Linha label="Ativo Circulante" valor={calc.bp.ativoCirculante} />
                  <Linha label="  Caixa e Equivalentes" valor={calc.bp.ativoCirculante} indent />
                  <Linha label="Ativo Não Circulante" valor={calc.bp.ativoNaoCirculante} />
                  <div className="border-t pt-2 mt-2">
                    <Linha label="TOTAL DO ATIVO" valor={calc.bp.totalAtivo} bold />
                  </div>
                </div>
                <div className="border rounded-md p-4">
                  <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Passivo + Patrimônio Líquido</h4>
                  <Linha label="Passivo Circulante" valor={calc.bp.passivoCirculante} />
                  <Linha label="Passivo Não Circulante" valor={calc.bp.passivoNaoCirculante} />
                  <Linha label="Patrimônio Líquido" valor={calc.bp.patrimonioLiquido} />
                  <Linha label="  Resultado do Exercício" valor={calc.dre.resultadoLiquido} indent />
                  <div className="border-t pt-2 mt-2">
                    <Linha label="TOTAL DO PASSIVO + PL" valor={calc.bp.totalPassivo} bold />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Estrutura conforme Lei nº 6.404/76 atualizada pela Lei 11.638/07. Versão simplificada — para escrituração formal,
                cadastre Imobilizado, Estoques e Fornecedores nas próximas atualizações.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dfc" className="space-y-3 mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Activity className="w-5 h-5 text-success" />DFC – Método Indireto</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => salvarSnapshot("dfc_indireta")}>
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportarPDF("dfc")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Linha label="Fluxo das Atividades Operacionais (FCO)" valor={calc.dfc.fco} bold />
                <Linha label="Fluxo das Atividades de Investimento (FCI)" valor={calc.dfc.fci} bold />
                <Linha label="Fluxo das Atividades de Financiamento (FCF)" valor={calc.dfc.fcf} bold />
                <div className="border-t pt-2 mt-2">
                  <Linha label="Variação Líquida de Caixa" valor={calc.dfc.variacaoCaixa} bold />
                  <Linha label="Saldo Final de Caixa" valor={calc.dfc.saldoFinalCaixa} bold />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Conforme NBC TG 03 (R3) – Demonstração dos Fluxos de Caixa. Método indireto (a partir do lucro líquido).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dmpl" className="space-y-3 mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-warning" />DMPL – Mutações do PL</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => salvarSnapshot("dmpl")}>
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportarPDF("dmpl")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Linha label="Saldo Inicial" valor={calc.dmpl.saldoInicial} />
                <Linha label="(+) Aumento de Capital" valor={calc.dmpl.aumentoCapital} />
                <Linha label="(+) Lucro do Exercício" valor={calc.dmpl.lucroExercicio} />
                <Linha label="(–) Dividendos Distribuídos" valor={-calc.dmpl.dividendos} />
                <div className="border-t pt-2 mt-2">
                  <Linha label="Saldo Final" valor={calc.dmpl.saldoFinal} bold />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Conforme NBC TG 26 (R5) – Apresentação das Demonstrações Contábeis.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Linha({ label, valor, bold, indent }: { label: string; valor: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? "pl-4" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`tabular-nums text-sm ${bold ? "font-semibold" : ""} ${valor < 0 ? "text-destructive" : ""}`}>
        {fmt(valor)}
      </span>
    </div>
  );
}
