import { useState, useRef } from "react";
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ValorDeCartao from "./ValorDeCartao";
import { Upload, Download, Loader2, Info, FileText, CheckCircle2, AlertCircle } from "lucide-react";
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
    // interpretarValorColado decide o decimal pelo separador que aparece por
    // último: "3500.00" ficava 100× maior no replace cego de pontos.
    const valor = interpretarValorColado((cols[iValor] || "").trim()) ?? NaN;
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
      const { data: userData } = await supabase.auth.getUser();
      const usuarioId = userData.user?.id ?? null;
      const totalValor = validas.reduce((acc, l) => acc + l.valor, 0);

      // Cria lote de origem para rastreabilidade
      const { data: lote, error: loteErr } = await supabase
        .from("financeiro_origem_lotes")
        .insert({
          empresa_id: empresaId,
          origem_tipo: "importacao_csv",
          job: "FinImportarPlanilha",
          descricao: `Importação CSV (${tipo}) — ${validas.length} linha(s)`,
          usuario_id: usuarioId,
          total_registros: validas.length,
          total_valor: totalValor,
          metadata: { tipo, arquivo: fileRef.current?.files?.[0]?.name ?? null },
        })
        .select("id")
        .single();
      if (loteErr) throw loteErr;

      const nowIso = new Date().toISOString();
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
        origem_tipo: "importacao_csv" as const,
        origem_lote_id: lote.id,
        origem_job: "FinImportarPlanilha",
        origem_usuario_id: usuarioId,
        origem_timestamp: nowIso,
        origem_metadata: { arquivo: fileRef.current?.files?.[0]?.name ?? null },
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
        {/* Sem título no cartão, pelo mesmo motivo do FinImportarOFX: o h1 desta
            subtela já diz "Importar Planilha CSV" (catálogo de subtelas em
            Financeiro.tsx) e o cartão não acrescentava nada ao nome — só o
            repetia em outra grafia. Sobra o que é escolha de verdade: para qual
            lado o arquivo entra. */}
        <CardHeader>
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <TabsList>
              <TabsTrigger value="a_pagar">Contas a Pagar</TabsTrigger>
              <TabsTrigger value="a_receber">Contas a Receber</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            <Info className="w-4 h-4" aria-hidden="true" />
            <AlertDescription className="space-y-3">
              <p className="font-semibold">Formato esperado</p>
              <code className="block overflow-x-auto rounded-md border border-border bg-card p-3 text-xs">
                {HEADER_TEMPLATE}
              </code>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Separador: ponto e vírgula (;) ou vírgula (,)</li>
                <li>Datas no formato <strong>AAAA-MM-DD</strong></li>
                <li>Valor com vírgula como decimal (ex: 1.234,56)</li>
                <li>Encoding UTF-8</li>
              </ul>
              <Button variant="outline" size="sm" onClick={baixarModelo}>
                <Download aria-hidden="true" /> Baixar modelo
              </Button>
            </AlertDescription>
          </Alert>

          <label
            htmlFor="fin-planilha-csv"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input bg-card p-6 text-center transition-colors duration-150 hover:border-primary hover:bg-primary-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
              <Upload className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold text-foreground">Selecione o arquivo .csv</span>
            <span className="text-sm text-muted-foreground">Clique aqui para escolher a planilha no seu computador</span>
            <input
              id="fin-planilha-csv"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="sr-only"
            />
          </label>

          {linhas.length > 0 && (
            <>
              {/* Resumo da leitura no cartão KPI do Design System v3 (112px):
                  rótulo em cima, ícone num ladrilho tingido à direita, número
                  28/36 embaixo — o mesmo desenho do FinResumoCards. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Total de linhas</p>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <ValorDeCartao valor={String(linhas.length)} className="text-foreground" />
                </Card>
                <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Válidas</p>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-tint text-success-ink">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <ValorDeCartao valor={String(validas.length)} className="text-success-ink" />
                </Card>
                <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Com erro</p>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive-tint text-destructive-ink">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <ValorDeCartao valor={String(invalidas.length)} className="text-destructive-ink" />
                </Card>
              </div>

              {/* A altura máxima vai no scroller da própria Table (o div que
                  ui/table.tsx cria): dois contêineres de rolagem aninhados
                  deixariam o `sticky` do cabeçalho preso ao de dentro, que
                  nunca rola — e a linha de títulos sumiria numa planilha
                  longa, que é justamente quando ela faz falta. */}
              <div className="overflow-hidden rounded-lg border border-border [&>div]:max-h-[300px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Situação</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={l._erro ? "danger" : "success"}>{l._erro ? "Com erro" : "Válida"}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="truncate font-medium text-foreground">{l.descricao || <em className="text-muted-foreground">vazia</em>}</p>
                          {l._erro && <p className="mt-1 text-xs text-destructive-ink">{l._erro}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{l.data_vencimento || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-4">
                <div className="text-base text-foreground">
                  Total a importar: <span className="font-semibold tabular-nums">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <Button onClick={handleImportar} disabled={validas.length === 0 || importing}>
                  {importing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
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
