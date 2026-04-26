import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Download, Loader2, Filter, Sparkles } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { writeExcelFile } from "@/lib/excel-utils";

/* ---------------------------------------------------------------------------
 * EXPORTADOR OMIE — gera planilhas .xlsx no padrão OMIE para reimportação,
 * backup ou análise externa. Suporta Pessoas, Contas a Pagar e a Receber.
 * --------------------------------------------------------------------------*/

type Entidade = "pessoas" | "a_pagar" | "a_receber";
type Status = "todos" | "previsto" | "pago" | "atrasado" | "cancelado";

const HEADERS_PESSOAS = [
  "Tipo (cliente/fornecedor)", "CNPJ/CPF", "Razão Social / Nome", "Nome Fantasia",
  "Inscrição Estadual", "Inscrição Municipal", "Indicador IE",
  "Regime tributário", "CNAE principal",
  "E-mail", "Telefone", "Site",
  "Endereço", "Número", "Complemento", "Bairro", "CEP", "Município", "UF",
  "Banco (código)", "Agência", "Conta", "Chave PIX",
  "Limite de crédito", "Prazo médio (dias)",
  "Tags (separadas por ;)", "Observações",
];

const HEADERS_LANCAMENTO = [
  "Descrição", "Valor", "Vencimento", "Competência", "Nº documento",
  "CNPJ/CPF (cliente/fornecedor)", "Cliente / Fornecedor (nome)",
  "Categoria (código)", "Centro de custo", "Conta financeira",
  "Parcela (nº)", "Total de parcelas",
  "Juros", "Multa", "Desconto",
  "Status", "Data pagamento", "Valor pago",
  "Observações",
];

function fmtData(d: any): string {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function fmtMascaraDoc(v: any): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}

function fmtMoeda(v: any): string {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

const LABEL_TIPO_PESSOA: Record<string, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  ambos: "Cliente e Fornecedor",
  funcionario: "Funcionário",
};

const LABEL_STATUS: Record<string, string> = {
  previsto: "Previsto",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  parcial: "Pago parcial",
};

export default function FinExportarOMIE() {
  const empresaId = useEmpresaId();
  const [entidade, setEntidade] = useState<Entidade>("a_pagar");
  const [status, setStatus] = useState<Status>("todos");
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  const [exporting, setExporting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  async function contarRegistros() {
    if (!empresaId) return;
    try {
      if (entidade === "pessoas") {
        const { count } = await supabase
          .from("financeiro_pessoas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId);
        setPreviewCount(count ?? 0);
      } else {
        let q = supabase
          .from("financeiro_lancamentos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("tipo", entidade)
          .gte("data_vencimento", dataInicio)
          .lte("data_vencimento", dataFim);
        if (status !== "todos") q = q.eq("status", status);
        const { count } = await q;
        setPreviewCount(count ?? 0);
      }
    } catch {
      setPreviewCount(null);
    }
  }

  async function exportar() {
    if (!empresaId) { toast.error("Empresa não identificada."); return; }
    setExporting(true);
    try {
      if (entidade === "pessoas") await exportarPessoas();
      else await exportarLancamentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function exportarPessoas() {
    const { data, error } = await supabase
      .from("financeiro_pessoas")
      .select("*")
      .eq("empresa_id", empresaId!)
      .order("nome");
    if (error) throw error;
    if (!data?.length) { toast.warning("Nenhum registro para exportar."); return; }

    const rows: any[][] = [HEADERS_PESSOAS];
    for (const p of data as any[]) {
      const end = p.endereco || {};
      const ban = p.dados_bancarios || {};
      rows.push([
        LABEL_TIPO_PESSOA[p.tipo] || p.tipo || "",
        fmtMascaraDoc(p.documento),
        p.nome || "",
        p.nome_fantasia || "",
        p.ie || "",
        p.im || "",
        p.ind_ie_dest || "",
        p.regime_tributario || "",
        p.cnae_principal || "",
        p.email || "",
        p.telefone || "",
        p.site || "",
        end.logradouro || "",
        end.numero || "",
        end.complemento || "",
        end.bairro || "",
        end.cep || "",
        end.municipio || "",
        end.uf || "",
        ban.banco || "",
        ban.agencia || "",
        ban.conta || "",
        ban.pix || "",
        p.limite_credito ?? "",
        p.prazo_padrao_dias ?? "",
        Array.isArray(p.tags) ? p.tags.join("; ") : "",
        p.observacoes || "",
      ]);
    }
    const widths = [22, 20, 38, 30, 18, 18, 14, 20, 14, 28, 16, 22, 32, 8, 18, 22, 12, 22, 6, 14, 10, 14, 28, 16, 14, 30, 40];
    const stamp = new Date().toISOString().slice(0, 10);
    await writeExcelFile(`OMIE_Clientes_Fornecedores_${stamp}.xlsx`, [
      { name: "Pessoas", data: rows, colWidths: widths },
    ]);
    toast.success(`${data.length} pessoa(s) exportada(s).`);
  }

  async function exportarLancamentos() {
    let q = supabase
      .from("financeiro_lancamentos")
      .select("*, pessoa:financeiro_pessoas(nome, documento)")
      .eq("empresa_id", empresaId!)
      .eq("tipo", entidade)
      .gte("data_vencimento", dataInicio)
      .lte("data_vencimento", dataFim)
      .order("data_vencimento");
    if (status !== "todos") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) { toast.warning("Nenhum lançamento no período."); return; }

    const rows: any[][] = [HEADERS_LANCAMENTO];
    for (const l of data as any[]) {
      rows.push([
        l.descricao || "",
        fmtMoeda(l.valor),
        fmtData(l.data_vencimento),
        fmtData(l.data_competencia),
        l.numero_documento || "",
        fmtMascaraDoc(l.pessoa?.documento),
        l.pessoa?.nome || "",
        l.categoria_codigo || "",
        l.centro_custo_codigo || "",
        l.conta_codigo || "",
        l.parcela_numero ?? "",
        l.parcela_total ?? "",
        fmtMoeda(l.valor_juros),
        fmtMoeda(l.valor_multa),
        fmtMoeda(l.valor_desconto),
        LABEL_STATUS[l.status] || l.status || "",
        fmtData(l.data_pagamento),
        fmtMoeda(l.valor_pago),
        l.observacoes || "",
      ]);
    }
    const widths = [38, 14, 14, 14, 18, 20, 30, 16, 16, 18, 10, 12, 12, 12, 12, 14, 14, 14, 40];
    const stamp = new Date().toISOString().slice(0, 10);
    const nome = entidade === "a_pagar" ? "Contas_Pagar" : "Contas_Receber";
    await writeExcelFile(`OMIE_${nome}_${dataInicio}_${dataFim}.xlsx`, [
      { name: nome, data: rows, colWidths: widths },
    ]);
    toast.success(`${data.length} lançamento(s) exportado(s).`);
  }

  const isLanc = entidade !== "pessoas";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" /> Exportar para padrão OMIE (.xlsx)
            </CardTitle>
            <Tabs value={entidade} onValueChange={(v) => { setEntidade(v as Entidade); setPreviewCount(null); }}>
              <TabsList>
                <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
                <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
                <TabsTrigger value="pessoas">Clientes / Fornecedores</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
            <p className="font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Compatível com reimportação no OMIE — mesmas colunas e formatação aceitas pela plataforma.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>CNPJ/CPF formatados com máscara, datas em ISO, valores com vírgula decimal</li>
              <li>Pessoas exportadas com endereço, dados bancários, IE/IM, CNAE e tags</li>
              <li>Lançamentos incluem parcela, juros, multa, desconto e status</li>
            </ul>
          </div>

          {isLanc && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPreviewCount(null); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPreviewCount(null); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v as Status); setPreviewCount(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-md bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={contarRegistros} disabled={exporting}>
                <Filter className="w-3.5 h-3.5 mr-1.5" /> Contar registros
              </Button>
              {previewCount !== null && (
                <Badge variant="secondary">{previewCount} registro(s) encontrado(s)</Badge>
              )}
            </div>
            <Button onClick={exportar} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar para OMIE
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
