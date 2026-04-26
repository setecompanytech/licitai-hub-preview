import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Tipo = "a_pagar" | "a_receber";

interface LinhaImport {
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_competencia: string;
  numero_documento?: string;
  observacoes?: string;
  _erro?: string;
}

const HEADER_TEMPLATE = "descricao;valor;data_vencimento;data_competencia;numero_documento;observacoes";

const EXEMPLO_CSV = `descricao;valor;data_vencimento;data_competencia;numero_documento;observacoes
Aluguel sede mar/2025;3500,00;2025-03-10;2025-03-01;NF-12345;Contrato 2024-01
Energia elétrica fev/2025;842,55;2025-03-15;2025-02-01;;Fatura CEMIG`;

function parseCSV(text: string): LinhaImport[] {
  const linhas = text.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(";") ? ";" : ",";
  const headers = linhas[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const iDesc = idx("descricao");
  const iValor = idx("valor");
  const iVenc = idx("data_vencimento");
  const iComp = idx("data_competencia");
  const iDoc = idx("numero_documento");
  const iObs = idx("observacoes");

  return linhas.slice(1).map((linha): LinhaImport => {
    const cols = linha.split(sep);
    const valorRaw = (cols[iValor] || "").trim().replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(valorRaw);
    const desc = (cols[iDesc] || "").trim();
    const venc = (cols[iVenc] || "").trim();
    const comp = (cols[iComp] || venc).trim();
    let erro: string | undefined;
    if (!desc) erro = "Descrição vazia";
    else if (isNaN(valor) || valor <= 0) erro = "Valor inválido";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) erro = "Data vencimento inválida (use AAAA-MM-DD)";
    return {
      descricao: desc,
      valor: isNaN(valor) ? 0 : valor,
      data_vencimento: venc,
      data_competencia: comp || venc,
      numero_documento: iDoc >= 0 ? (cols[iDoc] || "").trim() : undefined,
      observacoes: iObs >= 0 ? (cols[iObs] || "").trim() : undefined,
      _erro: erro,
    };
  });
}

export default function FinImportarPlanilha() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("a_pagar");
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validas = linhas.filter((l) => !l._erro);
  const invalidas = linhas.filter((l) => l._erro);
  const total = validas.reduce((acc, l) => acc + l.valor, 0);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCSV(text);
      setLinhas(parsed);
      if (parsed.length === 0) toast.error("Nenhuma linha válida encontrada na planilha.");
      else toast.success(`${parsed.length} linha(s) lida(s).`);
    };
    reader.readAsText(f, "utf-8");
  }

  function baixarModelo() {
    const blob = new Blob([EXEMPLO_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_${tipo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportar() {
    if (validas.length === 0 || !empresaId) return;
    setImporting(true);
    try {
      const payload = validas.map((l) => ({
        empresa_id: empresaId,
        tipo,
        natureza: tipo === "a_pagar" ? ("despesa" as const) : ("receita" as const),
        status: "previsto" as const,
        descricao: l.descricao,
        valor: l.valor,
        data_vencimento: l.data_vencimento,
        data_competencia: l.data_competencia,
        numero_documento: l.numero_documento || null,
        observacoes: l.observacoes || null,
        origem: "manual" as const,
      }));
      const { error } = await supabase.from("financeiro_lancamentos").insert(payload);
      if (error) throw error;
      toast.success(`${validas.length} lançamento(s) importado(s) com sucesso.`);
      setLinhas([]);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-baixa-lote-pendentes"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" /> Importar planilha (CSV)
            </CardTitle>
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <TabsList>
                <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
                <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
            <p className="font-medium">Formato esperado:</p>
            <code className="block bg-background rounded p-2 text-[11px] overflow-x-auto">
              {HEADER_TEMPLATE}
            </code>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Separador: ponto e vírgula (;) ou vírgula (,)</li>
              <li>Datas no formato <strong>AAAA-MM-DD</strong></li>
              <li>Valor com vírgula como decimal (ex: 1.234,56)</li>
              <li>Encoding UTF-8</li>
            </ul>
            <Button variant="outline" size="sm" onClick={baixarModelo}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar modelo
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Selecione o arquivo .csv</Label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
          </div>

          {linhas.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total linhas</p>
                  <p className="text-2xl font-semibold">{linhas.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Válidas</p>
                  <p className="text-2xl font-semibold text-success">{validas.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Com erro</p>
                  <p className="text-2xl font-semibold text-destructive">{invalidas.length}</p>
                </CardContent></Card>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center gap-2 p-3 border-b bg-muted/30 text-xs font-medium">
                  <span className="w-6"></span>
                  <span className="flex-1">Descrição</span>
                  <span className="w-24 text-right">Vencimento</span>
                  <span className="w-28 text-right">Valor</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {linhas.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 border-b text-sm">
                      <span className="w-6">
                        {l._erro ? <AlertCircle className="w-4 h-4 text-destructive" />
                          : <CheckCircle2 className="w-4 h-4 text-success" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{l.descricao || <em className="text-muted-foreground">vazia</em>}</p>
                        {l._erro && <Badge variant="destructive" className="text-[10px] mt-0.5">{l._erro}</Badge>}
                      </div>
                      <span className="w-24 text-right text-xs text-muted-foreground">{l.data_vencimento || "—"}</span>
                      <span className="w-28 text-right tabular-nums">
                        R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-md bg-muted/30">
                <div className="text-sm">
                  Total a importar: <span className="font-semibold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <Button onClick={handleImportar} disabled={validas.length === 0 || importing}>
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Importar {validas.length} lançamento(s)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
