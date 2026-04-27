import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useContas } from "@/hooks/useFinanceiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL, formatDate } from "@/lib/financeiro/formatters";
import { toast } from "sonner";

interface MovimentoRel {
  id: string;
  data_movimento: string;
  descricao: string;
  valor: number;
  conciliado: boolean;
  conta_id: string;
  conta?: { id: string; nome: string } | null;
}

export default function FinRelatorioConciliacao() {
  const { empresaAtiva } = useEmpresa();
  const empresaId = empresaAtiva?.id;
  const { data: contas } = useContas();

  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [contaId, setContaId] = useState<string>("todas");

  const filtros = { empresaId, dataInicio, dataFim, contaId };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["fin-relatorio-conciliacao", filtros],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("financeiro_extrato_movimentos")
        .select("id, data_movimento, descricao, valor, conciliado, conta_id, conta:financeiro_contas(id,nome)")
        .eq("empresa_id", empresaId!)
        .gte("data_movimento", dataInicio)
        .lte("data_movimento", dataFim)
        .order("data_movimento", { ascending: false })
        .limit(5000);
      if (contaId && contaId !== "todas") q = q.eq("conta_id", contaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MovimentoRel[];
    },
  });

  const movimentos = data ?? [];
  const resumo = useMemo(() => {
    const total = movimentos.length;
    const conciliados = movimentos.filter((m) => m.conciliado).length;
    const pendentes = total - conciliados;
    const valorTotal = movimentos.reduce((s, m) => s + Number(m.valor), 0);
    const valorConciliado = movimentos.filter((m) => m.conciliado).reduce((s, m) => s + Number(m.valor), 0);
    const valorPendente = valorTotal - valorConciliado;
    const taxa = total > 0 ? (conciliados / total) * 100 : 0;

    // Por conta
    const porConta = new Map<string, { nome: string; total: number; conciliados: number; pendentes: number; valor: number }>();
    movimentos.forEach((m) => {
      const key = m.conta?.id ?? m.conta_id;
      const nome = m.conta?.nome ?? "Sem conta";
      const cur = porConta.get(key) ?? { nome, total: 0, conciliados: 0, pendentes: 0, valor: 0 };
      cur.total++;
      if (m.conciliado) cur.conciliados++; else cur.pendentes++;
      cur.valor += Number(m.valor);
      porConta.set(key, cur);
    });

    return {
      total,
      conciliados,
      pendentes,
      valorTotal,
      valorConciliado,
      valorPendente,
      taxa,
      porConta: Array.from(porConta.values()).sort((a, b) => b.total - a.total),
    };
  }, [movimentos]);

  const periodoLabel = `${format(parseISO(dataInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(parseISO(dataFim), "dd/MM/yyyy", { locale: ptBR })}`;

  function exportarCSV() {
    const linhas: string[] = [];
    linhas.push("RELATÓRIO DE CONCILIAÇÃO BANCÁRIA");
    linhas.push(`Período;${periodoLabel}`);
    linhas.push(`Empresa;${empresaAtiva?.razao_social ?? ""}`);
    linhas.push("");
    linhas.push("RESUMO");
    linhas.push("Indicador;Quantidade;Valor (R$)");
    linhas.push(`Importados;${resumo.total};${resumo.valorTotal.toFixed(2).replace(".", ",")}`);
    linhas.push(`Conciliados;${resumo.conciliados};${resumo.valorConciliado.toFixed(2).replace(".", ",")}`);
    linhas.push(`Pendentes;${resumo.pendentes};${resumo.valorPendente.toFixed(2).replace(".", ",")}`);
    linhas.push(`Taxa de conciliação;${resumo.taxa.toFixed(1)}%;`);
    linhas.push("");
    linhas.push("POR CONTA");
    linhas.push("Conta;Importados;Conciliados;Pendentes;Valor (R$)");
    resumo.porConta.forEach((c) => {
      linhas.push(`${c.nome};${c.total};${c.conciliados};${c.pendentes};${c.valor.toFixed(2).replace(".", ",")}`);
    });
    linhas.push("");
    linhas.push("DETALHE DOS MOVIMENTOS");
    linhas.push("Data;Conta;Descrição;Valor (R$);Status");
    movimentos.forEach((m) => {
      const desc = (m.descricao ?? "").replace(/[\n\r;]/g, " ");
      linhas.push(
        `${format(parseISO(m.data_movimento), "dd/MM/yyyy")};${m.conta?.nome ?? "—"};${desc};${Number(m.valor).toFixed(2).replace(".", ",")};${m.conciliado ? "Conciliado" : "Pendente"}`,
      );
    });

    const csv = "\uFEFF" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  }

  async function exportarPDF() {
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margemX = 14;
      let y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Conciliação Bancária", margemX, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Empresa: ${empresaAtiva?.razao_social ?? "—"}`, margemX, y);
      y += 4;
      doc.text(`Período: ${periodoLabel}`, margemX, y);
      y += 4;
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margemX, y);
      y += 6;

      // Resumo
      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Quantidade", "Valor (R$)"]],
        body: [
          ["Importados", String(resumo.total), formatBRL(resumo.valorTotal)],
          ["Conciliados", String(resumo.conciliados), formatBRL(resumo.valorConciliado)],
          ["Pendentes", String(resumo.pendentes), formatBRL(resumo.valorPendente)],
          ["Taxa de conciliação", `${resumo.taxa.toFixed(1)}%`, "—"],
        ],
        theme: "grid",
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 9 },
        styles: { fontSize: 9 },
        margin: { left: margemX, right: margemX },
      });
      // @ts-expect-error jspdf-autotable adiciona lastAutoTable
      y = doc.lastAutoTable.finalY + 6;

      if (resumo.porConta.length > 1) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Por conta bancária", margemX, y);
        y += 2;
        autoTable(doc, {
          startY: y + 2,
          head: [["Conta", "Importados", "Conciliados", "Pendentes", "Valor (R$)"]],
          body: resumo.porConta.map((c) => [c.nome, c.total, c.conciliados, c.pendentes, formatBRL(c.valor)]),
          theme: "striped",
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 9 },
          styles: { fontSize: 9 },
          margin: { left: margemX, right: margemX },
        });
        // @ts-expect-error jspdf-autotable
        y = doc.lastAutoTable.finalY + 6;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Detalhe dos movimentos (${movimentos.length})`, margemX, y);
      autoTable(doc, {
        startY: y + 2,
        head: [["Data", "Conta", "Descrição", "Valor", "Status"]],
        body: movimentos.slice(0, 1000).map((m) => [
          format(parseISO(m.data_movimento), "dd/MM/yy"),
          m.conta?.nome ?? "—",
          (m.descricao ?? "").substring(0, 60),
          formatBRL(Number(m.valor)),
          m.conciliado ? "Conciliado" : "Pendente",
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.2 },
        columnStyles: { 3: { halign: "right" } },
        margin: { left: margemX, right: margemX },
      });

      doc.save(`conciliacao_${dataInicio}_${dataFim}.pdf`);
      toast.success("PDF exportado com sucesso.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 mt-1 w-[160px]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data final</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 mt-1 w-[160px]" />
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Conta</label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                {(contas ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-1.5" />}
            Atualizar
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={movimentos.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />Exportar CSV
          </Button>
          <Button size="sm" onClick={exportarPDF} disabled={movimentos.length === 0}>
            <FileText className="w-4 h-4 mr-1.5" />Exportar PDF
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Importados"
          valor={resumo.total}
          sublabel={formatBRL(resumo.valorTotal)}
          tone="default"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Conciliados"
          valor={resumo.conciliados}
          sublabel={formatBRL(resumo.valorConciliado)}
          tone="success"
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="Pendentes"
          valor={resumo.pendentes}
          sublabel={formatBRL(resumo.valorPendente)}
          tone="warning"
        />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Taxa conciliação"
          valor={`${resumo.taxa.toFixed(1)}%`}
          sublabel={resumo.total > 0 ? `${resumo.conciliados}/${resumo.total}` : "Sem dados"}
          tone={resumo.taxa >= 80 ? "success" : resumo.taxa >= 50 ? "warning" : "destructive"}
        />
      </div>

      {/* Resumo por conta */}
      {resumo.porConta.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por conta</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Importados</TableHead>
                  <TableHead className="text-right">Conciliados</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.porConta.map((c) => (
                  <TableRow key={c.nome}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.total}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{c.conciliados}</TableCell>
                    <TableCell className="text-right tabular-nums text-warning">{c.pendentes}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(c.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detalhe */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimentos do período ({movimentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : movimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum movimento no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentos.slice(0, 500).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(m.data_movimento)}</TableCell>
                      <TableCell className="text-xs">{m.conta?.nome ?? "—"}</TableCell>
                      <TableCell className="text-sm max-w-[420px] truncate">{m.descricao}</TableCell>
                      <TableCell className={`text-right tabular-nums font-mono ${Number(m.valor) >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatBRL(Number(m.valor))}
                      </TableCell>
                      <TableCell>
                        {m.conciliado ? (
                          <Badge variant="default">conciliado</Badge>
                        ) : (
                          <Badge variant="secondary">pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {movimentos.length > 500 && (
                <p className="text-xs text-muted-foreground text-center py-2 italic">
                  Exibindo 500 de {movimentos.length} movimentos. Exporte para ver tudo.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  valor,
  sublabel,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number | string;
  sublabel: string;
  tone: "default" | "success" | "warning" | "destructive";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}<span>{label}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${toneClasses[tone]}`}>{valor}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{sublabel}</p>
      </CardContent>
    </Card>
  );
}
