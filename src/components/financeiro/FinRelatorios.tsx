import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileBarChart, FileSpreadsheet, FileText, Loader2, Download,
  TrendingUp, Wallet, Users, Receipt, Activity, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { downloadPDF } from "@/lib/download-utils";
import { writeExcelFile } from "@/lib/excel-utils";

type Formato = "pdf" | "xlsx";

type RelatorioKey =
  | "fluxo_realizado"
  | "contas_pagar"
  | "contas_receber"
  | "dre_simplificada"
  | "razao_categoria"
  | "posicao_pessoas";

interface RelatorioDef {
  key: RelatorioKey;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
}

const RELATORIOS: RelatorioDef[] = [
  {
    key: "fluxo_realizado",
    titulo: "Fluxo Realizado",
    descricao: "Entradas e saídas efetivamente liquidadas no período, com saldo acumulado.",
    icone: TrendingUp,
    cor: "text-emerald-600",
  },
  {
    key: "contas_pagar",
    titulo: "Contas a Pagar",
    descricao: "Títulos pendentes ou vencidos, agrupados por fornecedor e vencimento.",
    icone: Receipt,
    cor: "text-rose-600",
  },
  {
    key: "contas_receber",
    titulo: "Contas a Receber",
    descricao: "Títulos em aberto a vencer ou vencidos, agrupados por cliente.",
    icone: Wallet,
    cor: "text-blue-600",
  },
  {
    key: "dre_simplificada",
    titulo: "DRE Simplificada",
    descricao: "Demonstrativo do resultado por categoria (receitas, custos, despesas).",
    icone: FileBarChart,
    cor: "text-amber-600",
  },
  {
    key: "razao_categoria",
    titulo: "Razão por Categoria",
    descricao: "Detalhamento dos lançamentos por categoria contábil.",
    icone: BookOpen,
    cor: "text-violet-600",
  },
  {
    key: "posicao_pessoas",
    titulo: "Posição de Clientes/Fornecedores",
    descricao: "Saldos consolidados por pessoa (a pagar e a receber).",
    icone: Users,
    cor: "text-cyan-600",
  },
];

const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v?: string | null) =>
  v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function periodoDefault() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: hoje.toISOString().slice(0, 10),
  };
}

export default function FinRelatorios() {
  const { empresaAtiva } = useEmpresa();
  const [periodo, setPeriodo] = useState(periodoDefault());
  const [formato, setFormato] = useState<Formato>("pdf");
  const [agrupamento, setAgrupamento] = useState<"nenhum" | "categoria" | "pessoa" | "centro">("nenhum");
  const [gerando, setGerando] = useState<RelatorioKey | null>(null);

  const empresaLabel = empresaAtiva?.razao_social ?? empresaAtiva?.nome_fantasia ?? "—";
  const periodoLabel = `${fmtDate(periodo.inicio)} a ${fmtDate(periodo.fim)}`;

  async function handleGerar(rel: RelatorioDef) {
    if (!empresaAtiva) {
      toast.error("Selecione uma empresa ativa.");
      return;
    }
    setGerando(rel.key);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${rel.key}-${stamp}`;
      const titulo = `${rel.titulo} — ${empresaLabel} — ${periodoLabel}`;

      switch (rel.key) {
        case "fluxo_realizado":
          await gerarFluxoRealizado(filename, titulo);
          break;
        case "contas_pagar":
          await gerarTitulos(filename, titulo, "despesa");
          break;
        case "contas_receber":
          await gerarTitulos(filename, titulo, "receita");
          break;
        case "dre_simplificada":
          await gerarDRESimplificada(filename, titulo);
          break;
        case "razao_categoria":
          await gerarRazaoCategoria(filename, titulo);
          break;
        case "posicao_pessoas":
          await gerarPosicaoPessoas(filename, titulo);
          break;
      }
      toast.success(`${rel.titulo} gerado com sucesso.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao gerar relatório.");
    } finally {
      setGerando(null);
    }
  }

  // -------- Geradores --------

  async function gerarFluxoRealizado(filename: string, titulo: string) {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("data_realizado, descricao, tipo, valor, categoria:financeiro_categorias(nome), pessoa:financeiro_pessoas(nome)")
      .eq("empresa_id", empresaAtiva!.id)
      .eq("status", "liquidado")
      .gte("data_realizado", periodo.inicio)
      .lte("data_realizado", periodo.fim)
      .order("data_realizado", { ascending: true });
    if (error) throw error;

    const linhas = (data || []).map((l: any) => ({
      data: fmtDate(l.data_realizado),
      descricao: l.descricao || "—",
      categoria: l.categoria?.nome || "—",
      pessoa: l.pessoa?.nome || "—",
      tipo: l.tipo,
      valor: Number(l.valor) || 0,
    }));

    let saldo = 0;
    const rows = linhas.map((l) => {
      const v = l.tipo === "receita" ? l.valor : -l.valor;
      saldo += v;
      return [l.data, l.descricao, l.categoria, l.pessoa, l.tipo, fmtBRL(v), fmtBRL(saldo)];
    });

    const totalEntradas = linhas.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const totalSaidas = linhas.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);

    const headers = ["Data", "Descrição", "Categoria", "Pessoa", "Tipo", "Valor (líquido)", "Saldo Acum."];
    const totalsRow = ["TOTAL", `${linhas.length} lançamentos`, "", "", "", `Entradas: ${fmtBRL(totalEntradas)} | Saídas: ${fmtBRL(totalSaidas)}`, fmtBRL(saldo)];

    if (formato === "pdf") {
      downloadPDF(filename, titulo, headers, [...rows, totalsRow]);
    } else {
      await writeExcelFile(`${filename}.xlsx`, [{
        name: "Fluxo Realizado",
        data: [headers, ...rows, totalsRow],
        colWidths: [12, 40, 22, 22, 12, 16, 16],
      }]);
    }
  }

  async function gerarTitulos(filename: string, titulo: string, tipo: "receita" | "despesa") {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("data_vencimento, data_realizado, descricao, valor, status, pessoa:financeiro_pessoas(nome), categoria:financeiro_categorias(nome)")
      .eq("empresa_id", empresaAtiva!.id)
      .eq("tipo", tipo)
      .neq("status", "cancelado")
      .gte("data_vencimento", periodo.inicio)
      .lte("data_vencimento", periodo.fim)
      .order("data_vencimento", { ascending: true });
    if (error) throw error;

    const hoje = new Date().toISOString().slice(0, 10);
    const rows = (data || []).map((l: any) => {
      const venc = l.data_vencimento as string | null;
      const liquidado = l.status === "liquidado";
      const situacao = liquidado
        ? "Liquidado"
        : venc && venc < hoje
          ? "Vencido"
          : "A vencer";
      return [
        fmtDate(venc),
        l.pessoa?.nome || "—",
        l.descricao || "—",
        l.categoria?.nome || "—",
        situacao,
        fmtBRL(Number(l.valor) || 0),
      ];
    });

    const total = (data || []).reduce((s: number, l: any) => s + (Number(l.valor) || 0), 0);
    const totalsRow = ["TOTAL", "", "", "", `${(data || []).length} títulos`, fmtBRL(total)];

    const headers = ["Vencimento", tipo === "receita" ? "Cliente" : "Fornecedor", "Descrição", "Categoria", "Situação", "Valor"];

    if (formato === "pdf") {
      downloadPDF(filename, titulo, headers, [...rows, totalsRow]);
    } else {
      await writeExcelFile(`${filename}.xlsx`, [{
        name: tipo === "receita" ? "Receber" : "Pagar",
        data: [headers, ...rows, totalsRow],
        colWidths: [12, 28, 38, 22, 14, 16],
      }]);
    }
  }

  async function gerarDRESimplificada(filename: string, titulo: string) {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("valor, tipo, natureza, categoria:financeiro_categorias(nome, natureza)")
      .eq("empresa_id", empresaAtiva!.id)
      .eq("status", "liquidado")
      .gte("data_realizado", periodo.inicio)
      .lte("data_realizado", periodo.fim);
    if (error) throw error;

    const grupos: Record<string, Record<string, number>> = {
      Receitas: {},
      "Custos/Despesas": {},
      Outros: {},
    };

    for (const l of (data || []) as any[]) {
      const valor = Number(l.valor) || 0;
      const cat = l.categoria?.nome || "Sem categoria";
      const natureza = (l.categoria?.natureza || l.natureza || "").toLowerCase();
      const grupo = l.tipo === "receita"
        ? "Receitas"
        : natureza.includes("custo") || natureza.includes("despesa")
          ? "Custos/Despesas"
          : "Outros";
      grupos[grupo][cat] = (grupos[grupo][cat] || 0) + valor;
    }

    const rows: string[][] = [];
    let totalReceitas = 0, totalCustos = 0, totalOutros = 0;
    for (const grupo of Object.keys(grupos)) {
      const subtotal = Object.values(grupos[grupo]).reduce((s, v) => s + v, 0);
      if (grupo === "Receitas") totalReceitas = subtotal;
      if (grupo === "Custos/Despesas") totalCustos = subtotal;
      if (grupo === "Outros") totalOutros = subtotal;
      rows.push([grupo.toUpperCase(), "", fmtBRL(subtotal)]);
      for (const [cat, val] of Object.entries(grupos[grupo]).sort((a, b) => b[1] - a[1])) {
        rows.push(["", cat, fmtBRL(val)]);
      }
    }
    const resultado = totalReceitas - totalCustos + totalOutros;
    rows.push(["", "", ""]);
    rows.push(["RESULTADO LÍQUIDO", "", fmtBRL(resultado)]);

    const headers = ["Grupo", "Categoria", "Valor"];

    if (formato === "pdf") {
      downloadPDF(filename, titulo, headers, rows);
    } else {
      await writeExcelFile(`${filename}.xlsx`, [{
        name: "DRE",
        data: [headers, ...rows],
        colWidths: [24, 38, 16],
      }]);
    }
  }

  async function gerarRazaoCategoria(filename: string, titulo: string) {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("data_competencia, data_realizado, descricao, valor, tipo, status, categoria:financeiro_categorias(nome)")
      .eq("empresa_id", empresaAtiva!.id)
      .gte("data_competencia", periodo.inicio)
      .lte("data_competencia", periodo.fim)
      .order("data_competencia", { ascending: true });
    if (error) throw error;

    const porCategoria: Record<string, any[]> = {};
    for (const l of (data || []) as any[]) {
      const cat = l.categoria?.nome || "Sem categoria";
      (porCategoria[cat] ||= []).push(l);
    }

    const headers = ["Competência", "Descrição", "Tipo", "Status", "Valor"];
    const rows: string[][] = [];
    for (const cat of Object.keys(porCategoria).sort()) {
      const itens = porCategoria[cat];
      const subtotal = itens.reduce((s, l) => s + (Number(l.valor) || 0), 0);
      rows.push([`▸ ${cat.toUpperCase()}`, "", "", "", fmtBRL(subtotal)]);
      for (const l of itens) {
        rows.push([
          fmtDate(l.data_competencia),
          l.descricao || "—",
          l.tipo,
          l.status,
          fmtBRL(Number(l.valor) || 0),
        ]);
      }
    }

    if (formato === "pdf") {
      downloadPDF(filename, titulo, headers, rows);
    } else {
      await writeExcelFile(`${filename}.xlsx`, [{
        name: "Razão",
        data: [headers, ...rows],
        colWidths: [14, 42, 12, 14, 16],
      }]);
    }
  }

  async function gerarPosicaoPessoas(filename: string, titulo: string) {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("valor, tipo, status, pessoa:financeiro_pessoas(id, nome)")
      .eq("empresa_id", empresaAtiva!.id)
      .neq("status", "cancelado")
      .gte("data_competencia", periodo.inicio)
      .lte("data_competencia", periodo.fim);
    if (error) throw error;

    const mapa: Record<string, { nome: string; receberAberto: number; receberLiquidado: number; pagarAberto: number; pagarLiquidado: number }> = {};
    for (const l of (data || []) as any[]) {
      const id = l.pessoa?.id || "sem";
      const nome = l.pessoa?.nome || "Sem pessoa";
      const v = Number(l.valor) || 0;
      const m = (mapa[id] ||= { nome, receberAberto: 0, receberLiquidado: 0, pagarAberto: 0, pagarLiquidado: 0 });
      if (l.tipo === "receita") {
        if (l.status === "liquidado") m.receberLiquidado += v;
        else m.receberAberto += v;
      } else {
        if (l.status === "liquidado") m.pagarLiquidado += v;
        else m.pagarAberto += v;
      }
    }

    const linhas = Object.values(mapa).sort((a, b) =>
      (b.receberAberto + b.pagarAberto) - (a.receberAberto + a.pagarAberto),
    );

    const headers = ["Pessoa", "A Receber", "Recebido", "A Pagar", "Pago", "Saldo Líquido"];
    const rows = linhas.map((m) => [
      m.nome,
      fmtBRL(m.receberAberto),
      fmtBRL(m.receberLiquidado),
      fmtBRL(m.pagarAberto),
      fmtBRL(m.pagarLiquidado),
      fmtBRL((m.receberAberto + m.receberLiquidado) - (m.pagarAberto + m.pagarLiquidado)),
    ]);

    const totals = linhas.reduce(
      (acc, m) => ({
        ra: acc.ra + m.receberAberto,
        rl: acc.rl + m.receberLiquidado,
        pa: acc.pa + m.pagarAberto,
        pl: acc.pl + m.pagarLiquidado,
      }),
      { ra: 0, rl: 0, pa: 0, pl: 0 },
    );
    rows.push([
      "TOTAL",
      fmtBRL(totals.ra),
      fmtBRL(totals.rl),
      fmtBRL(totals.pa),
      fmtBRL(totals.pl),
      fmtBRL(totals.ra + totals.rl - totals.pa - totals.pl),
    ]);

    if (formato === "pdf") {
      downloadPDF(filename, titulo, headers, rows);
    } else {
      await writeExcelFile(`${filename}.xlsx`, [{
        name: "Pessoas",
        data: [headers, ...rows],
        colWidths: [32, 16, 16, 16, 16, 18],
      }]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Parâmetros globais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Parâmetros do Relatório
          </CardTitle>
          <CardDescription>
            Configure período, formato e agrupamento. Empresa ativa: <strong>{empresaLabel}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input
                type="date"
                value={periodo.inicio}
                onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input
                type="date"
                value={periodo.fim}
                onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as Formato)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">
                    <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> PDF</span>
                  </SelectItem>
                  <SelectItem value="xlsx">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agrupamento (Razão)</Label>
              <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as typeof agrupamento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem agrupamento</SelectItem>
                  <SelectItem value="categoria">Por categoria</SelectItem>
                  <SelectItem value="pessoa">Por pessoa</SelectItem>
                  <SelectItem value="centro">Por centro de custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{periodoLabel}</Badge>
            <Badge variant="outline" className="uppercase">{formato}</Badge>
            {agrupamento !== "nenhum" && (
              <Badge variant="outline">Agrup.: {agrupamento}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catálogo de relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {RELATORIOS.map((rel) => {
          const Icon = rel.icone;
          const isLoading = gerando === rel.key;
          return (
            <Card key={rel.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className={`w-4 h-4 ${rel.cor}`} />
                  {rel.titulo}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {rel.descricao}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleGerar(rel)}
                  disabled={isLoading || !empresaAtiva}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Gerar {formato.toUpperCase()}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
