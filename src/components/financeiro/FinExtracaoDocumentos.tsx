import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, Loader2, FileCheck2, FileX, ScanLine,
  FileText, ImageIcon, Pencil, CheckCircle2, AlertCircle, Info, Link2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useImportacaoNotas } from "@/hooks/useImportacaoNotas";
import { useUpsertLancamento, type Lancamento } from "@/hooks/useFinanceiro";
import LancamentoDialog from "./LancamentoDialog";
import VinculoContratoSelector, { type VinculoContratoValue } from "./VinculoContratoSelector";

type Tipo = "a_pagar" | "a_receber";

type DocStatus = "pendente" | "processando" | "ok" | "erro";

interface DocItem {
  id: string;
  file: File;
  kind: "xml" | "pdf" | "image" | "outro";
  status: DocStatus;
  motor?: string;
  erro?: string;
  // Resultado OCR
  dados?: any;
  // Lançamento já criado a partir deste doc
  lancamentoId?: string | null;
  // Vínculo com Gestão (Contrato/ATA/Item/Aditivo)
  vinculo?: VinculoContratoValue;
  vincularExpandido?: boolean;
}

const VINCULO_VAZIO: VinculoContratoValue = {
  contrato_id: null,
  contrato_item_id: null,
  origem_aditivo_id: null,
  quantidade: 0,
  valor_unitario: 0,
};

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function detectarTipo(file: File): DocItem["kind"] {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xml") || file.type.includes("xml")) return "xml";
  if (n.endsWith(".pdf") || file.type.includes("pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "outro";
}

async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function pdfPrimeiraPaginaParaImage(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdfjsLib: any = await import("pdfjs-dist");
  try {
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = (workerModule as any).default;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  }
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(1800, Math.floor(viewport.width));
  canvas.height = Math.floor((canvas.width / viewport.width) * viewport.height);
  const ctx = canvas.getContext("2d")!;
  const v = page.getViewport({ scale: canvas.width / viewport.width * 2 });
  await page.render({ canvasContext: ctx, viewport: v }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "a_pagar" ou "a_receber" — usado como hint para o tipo de lançamento gerado a partir de OCR */
  tipo: Tipo;
}

export default function FinExtracaoDocumentos({ open, onOpenChange, tipo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [processando, setProcessando] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; initial: Partial<Lancamento> | null }>({
    open: false,
    initial: null,
  });

  const { importar } = useImportacaoNotas();
  const upsert = useUpsertLancamento();

  const tipoLabel = tipo === "a_receber" ? "recebimento" : "pagamento";

  const totalSelecionado = docs.length;
  const totalOk = useMemo(() => docs.filter((d) => d.status === "ok").length, [docs]);
  const totalErro = useMemo(() => docs.filter((d) => d.status === "erro").length, [docs]);

  const adicionar = useCallback((files: File[]) => {
    const novos: DocItem[] = files
      .filter((f) => f.size <= 15 * 1024 * 1024)
      .map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        kind: detectarTipo(f),
        status: "pendente",
      }));
    if (novos.length < files.length) {
      toast.warning("Arquivos acima de 15 MB foram ignorados.");
    }
    setDocs((prev) => [...prev, ...novos]);
  }, []);

  const limparTudo = () => setDocs([]);

  const processarUm = async (item: DocItem): Promise<DocItem> => {
    try {
      // ---------- XML (NF-e / NFS-e) ----------
      if (item.kind === "xml") {
        const r = await importar([item.file]);
        const resultado = r?.resultados?.[0];
        if (!resultado || resultado.status === "erro") {
          return { ...item, status: "erro", erro: resultado?.erro ?? "Falha na importação" };
        }
        return {
          ...item,
          status: "ok",
          motor: "Parser XML",
          dados: {
            tipo_documento: resultado.tipo,
            valor_total: resultado.valor,
            data_emissao: resultado.competencia,
            chave_nfe: resultado.chave,
            descricao: `${(resultado.tipo ?? "nota").toUpperCase()} ${resultado.chave ?? ""}`.trim(),
            _direcao: resultado.direcao,
            _ja_lancada: true,
          },
          lancamentoId: null,
        };
      }

      // ---------- PDF / Imagem -> OCR ----------
      let dataUrl: string;
      if (item.kind === "pdf") {
        dataUrl = await pdfPrimeiraPaginaParaImage(item.file);
      } else if (item.kind === "image") {
        dataUrl = await fileToDataUrl(item.file);
      } else {
        return { ...item, status: "erro", erro: "Formato não suportado (use XML, PDF ou imagem)" };
      }

      const { data, error } = await supabase.functions.invoke("ocr-document-financeiro", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const dados = data?.dados;
      if (!dados) throw new Error("Sem dados extraídos");

      return { ...item, status: "ok", motor: data.motor, dados };
    } catch (e: any) {
      return { ...item, status: "erro", erro: e?.message ?? "Erro inesperado" };
    }
  };

  const processarTodos = async () => {
    if (docs.length === 0 || processando) return;
    setProcessando(true);
    // Marca todos como processando
    setDocs((prev) => prev.map((d) => (d.status === "pendente" ? { ...d, status: "processando" } : d)));

    for (const doc of docs.filter((d) => d.status === "pendente" || d.status === "processando")) {
      // Sequencial para não estourar limites de IA
      const atualizado = await processarUm(doc);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? atualizado : d)));
    }
    setProcessando(false);
  };

  const removerItem = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id));

  const abrirEditorComDados = (item: DocItem) => {
    const d = item.dados ?? {};
    const tipoDocBruto: string | undefined = d.tipo_documento;
    const tipoDocMap: Record<string, string> = {
      nfe: "nfe", nfse: "nfse", nfce: "nfce",
      boleto: "boleto", recibo: "recibo", contrato: "contrato",
    };
    const initial: any = {
      tipo,
      natureza: tipo === "a_receber" ? "receita" : "despesa",
      status: "previsto",
      descricao: d.descricao
        || `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim(),
      valor: Number(d.valor_total ?? 0),
      data_competencia: d.data_emissao ?? new Date().toISOString().slice(0, 10),
      data_vencimento: d.data_vencimento ?? null,
      data_emissao: d.data_emissao ?? null,
      tipo_documento: tipoDocBruto ? (tipoDocMap[tipoDocBruto] ?? "outro") : null,
      numero_documento: d.numero_documento ?? null,
      chave_acesso_nfe: d.chave_nfe ?? null,
      observacoes: [
        d.emitente_nome ? `Emitente: ${d.emitente_nome}` : null,
        d.emitente_cnpj ? `CNPJ emitente: ${d.emitente_cnpj}` : null,
        d.destinatario_nome ? `Destinatário: ${d.destinatario_nome}` : null,
        d.codigo_barras ? `Código de barras: ${d.codigo_barras}` : null,
        item.motor ? `Extraído via ${item.motor}` : null,
      ].filter(Boolean).join("\n") || null,
    };
    setEditor({ open: true, initial });
  };

  const setVinculo = (id: string, v: VinculoContratoValue) => {
    setDocs((prev) => prev.map((x) => (x.id === id ? { ...x, vinculo: v } : x)));
  };

  const toggleVincular = (id: string) => {
    setDocs((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, vincularExpandido: !x.vincularExpandido } : x,
      ),
    );
  };

  const lancarRapido = async (item: DocItem) => {
    const d = item.dados ?? {};
    if (!d.valor_total) {
      toast.warning("Valor não detectado. Use 'Revisar' para preencher manualmente.");
      return;
    }
    try {
      const v = item.vinculo;
      const temVinculo = !!v?.contrato_id;

      if (temVinculo) {
        // Caminho com vínculo: cria pedido + lançamento via RPC (recalcula saldo do contrato/ATA)
        const valorTotal = Number(d.valor_total);
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "vincular_lancamento_a_pedido" as any,
          {
            p_contrato_id: v!.contrato_id,
            p_contrato_item_id: v!.contrato_item_id,
            p_origem_aditivo_id: v!.origem_aditivo_id,
            p_numero_pedido:
              d.numero_documento ||
              `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
            p_descricao:
              d.descricao ||
              `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim() ||
              item.file.name,
            p_quantidade: v!.quantidade || 1,
            p_valor_unitario: v!.valor_unitario || valorTotal,
            p_valor_total: valorTotal,
            p_data_pedido: d.data_emissao ?? new Date().toISOString().slice(0, 10),
            p_tipo: tipo,
            p_natureza: tipo === "a_receber" ? "receita" : "despesa",
            p_status: "previsto",
            p_data_competencia: d.data_emissao ?? new Date().toISOString().slice(0, 10),
            p_data_vencimento: d.data_vencimento ?? null,
            p_data_emissao: d.data_emissao ?? null,
            p_tipo_documento: (d.tipo_documento as any) ?? "outro",
            p_numero_documento: d.numero_documento ?? null,
            p_chave_acesso_nfe: d.chave_nfe ? String(d.chave_nfe).replace(/\D/g, "") : null,
            p_pessoa_id: null,
            p_observacoes: [
              d.emitente_nome ? `Emitente: ${d.emitente_nome}` : null,
              d.destinatario_nome ? `Destinatário: ${d.destinatario_nome}` : null,
              item.motor ? `Extraído via ${item.motor}` : null,
              "Pedido criado automaticamente a partir de documento financeiro.",
            ].filter(Boolean).join("\n"),
          },
        );
        if (rpcErr) {
          toast.error(`Erro ao vincular: ${rpcErr.message}`);
          return;
        }
        const lancId = (rpcData as any)?.lancamento_id ?? "ok";
        setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId: lancId } : x)));
        toast.success("Lançamento criado e pedido vinculado ao contrato.");
        return;
      }

      // Caminho sem vínculo: lançamento simples
      const r = await upsert.mutateAsync({
        tipo,
        natureza: tipo === "a_receber" ? "receita" : "despesa",
        status: "previsto",
        descricao:
          d.descricao ||
          `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim() ||
          item.file.name,
        valor: Number(d.valor_total),
        data_competencia: d.data_emissao ?? new Date().toISOString().slice(0, 10),
        data_vencimento: d.data_vencimento ?? null,
        data_emissao: d.data_emissao ?? null,
        tipo_documento: (d.tipo_documento as any) ?? "outro",
        numero_documento: d.numero_documento ?? null,
        chave_acesso_nfe: d.chave_nfe ? String(d.chave_nfe).replace(/\D/g, "") : null,
      } as any);
      setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId: (r as any)?.id ?? "ok" } : x)));
    } catch {
      /* toast já exibido pelo hook */
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Extração automática de documentos — {tipo === "a_receber" ? "Contas a Receber" : "Contas a Pagar"}
            </DialogTitle>
            <DialogDescription>
              Envie XMLs de NF-e/NFS-e (lançados automaticamente), ou PDFs e imagens de cupom fiscal,
              boleto, recibo, fatura. A IA extrai os campos para revisão antes de gerar o {tipoLabel}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                adicionar(Array.from(e.dataTransfer.files));
              }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-2">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                XML (NF-e/NFS-e) • PDF • JPG/PNG (cupom fiscal, boleto, recibo, fatura) — até 15 MB cada
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xml,application/xml,text/xml,.pdf,application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) adicionar(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
            </div>

            {/* Aviso */}
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <b>XMLs de NF-e/NFS-e</b> são processados automaticamente (entrada/saída detectada pelo CNPJ da empresa).
                <br />
                <b>PDFs e imagens</b> passam por OCR multi-IA (Gemini Vision/Claude/GPT-5) e abrem para revisão antes de virar lançamento.
              </div>
            </div>

            {/* Lista de docs */}
            {docs.length > 0 && (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{totalSelecionado}</span> arquivo(s)
                      {totalOk > 0 && <Badge variant="default" className="ml-2">{totalOk} ok</Badge>}
                      {totalErro > 0 && <Badge variant="destructive" className="ml-1">{totalErro} erro(s)</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={limparTudo} disabled={processando}>
                        Limpar
                      </Button>
                      <Button size="sm" onClick={processarTodos} disabled={processando || docs.every((d) => d.status === "ok" || d.status === "erro")}>
                        {processando ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Processando…</>
                        ) : (
                          <><ScanLine className="w-3.5 h-3.5 mr-1" />Processar todos</>
                        )}
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="max-h-[360px]">
                    <div className="space-y-2">
                      {docs.map((d) => (
                        <div key={d.id} className="border rounded-md p-2.5 flex items-start gap-3">
                          <div className="mt-0.5">
                            {d.kind === "xml" && <FileText className="w-5 h-5 text-info" />}
                            {d.kind === "pdf" && <FileText className="w-5 h-5 text-destructive" />}
                            {d.kind === "image" && <ImageIcon className="w-5 h-5 text-warning" />}
                            {d.kind === "outro" && <FileX className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{d.file.name}</p>
                              <Badge variant="outline" className="text-[10px] uppercase">{d.kind}</Badge>
                              {d.status === "ok" && (
                                <Badge variant="default" className="text-[10px] gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {d.motor ?? "extraído"}
                                </Badge>
                              )}
                              {d.status === "erro" && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertCircle className="w-3 h-3" />erro
                                </Badge>
                              )}
                              {d.status === "processando" && (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />processando
                                </Badge>
                              )}
                              {d.lancamentoId && (
                                <Badge variant="default" className="text-[10px] gap-1">
                                  <FileCheck2 className="w-3 h-3" />lançado
                                </Badge>
                              )}
                            </div>

                            {d.status === "ok" && d.dados && (
                              <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5">
                                {d.dados.emitente_nome && <span className="truncate"><b>Emit:</b> {d.dados.emitente_nome}</span>}
                                {d.dados.numero_documento && <span><b>Nº:</b> {d.dados.numero_documento}</span>}
                                {d.dados.data_emissao && <span><b>Emissão:</b> {d.dados.data_emissao}</span>}
                                {d.dados.data_vencimento && <span><b>Venc:</b> {d.dados.data_vencimento}</span>}
                                <span className="font-semibold text-foreground"><b>Valor:</b> {fmt(d.dados.valor_total)}</span>
                              </div>
                            )}
                            {d.erro && <p className="text-xs text-destructive mt-1">{d.erro}</p>}
                            {d.dados?._ja_lancada && (
                              <p className="text-xs text-success mt-1">
                                Lançado automaticamente como {d.dados._direcao === "saida" ? "receita" : "despesa"}.
                              </p>
                            )}

                            {/* Bloco de vínculo com Gestão (Contrato/ATA) */}
                            {d.status === "ok" && !d.lancamentoId && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => toggleVincular(d.id)}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Link2 className="w-3 h-3" />
                                  {d.vinculo?.contrato_id
                                    ? "Vinculado a contrato"
                                    : "Vincular a contrato/ATA SRP"}
                                  {d.vincularExpandido ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                                {d.vincularExpandido && (
                                  <div className="mt-2">
                                    <VinculoContratoSelector
                                      tipo={tipo}
                                      hintNome={
                                        tipo === "a_receber"
                                          ? d.dados?.destinatario_nome
                                          : d.dados?.emitente_nome
                                      }
                                      hintCnpj={
                                        tipo === "a_receber"
                                          ? d.dados?.destinatario_cnpj_cpf
                                          : d.dados?.emitente_cnpj
                                      }
                                      valorTotal={d.dados?.valor_total ?? null}
                                      value={d.vinculo ?? VINCULO_VAZIO}
                                      onChange={(v) => setVinculo(d.id, v)}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 shrink-0">
                            {d.status === "ok" && !d.dados?._ja_lancada && !d.lancamentoId && (
                              <>
                                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => lancarRapido(d)} disabled={upsert.isPending}>
                                  {d.vinculo?.contrato_id ? "Lançar e vincular" : "Lançar"}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirEditorComDados(d)}>
                                  <Pencil className="w-3 h-3 mr-1" />Revisar
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => removerItem(d.id)} disabled={d.status === "processando"}>
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LancamentoDialog
        open={editor.open}
        onOpenChange={(v) => setEditor((s) => ({ ...s, open: v }))}
        initial={editor.initial}
        defaultTipo={tipo}
      />
    </>
  );
}
