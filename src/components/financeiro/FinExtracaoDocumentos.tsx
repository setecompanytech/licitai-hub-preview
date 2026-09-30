import { useCallback, useMemo, useRef, useState } from "react";
import { lerLinhaDigitavel } from '@/lib/financeiro/boleto';
import { hojeLocal } from "@/lib/financeiro/data-local";
import { normalizarChaveNfe, chaveNfeSuspeita } from "@/lib/financeiro/chave-nfe";
import { danfeDaChave, lerDanfe, pastaDaDirecao, type DanfeLido } from "@/lib/financeiro/danfe-texto";
import { textoDasPaginas } from "@/lib/pdf-text-extractor";
import { arquivoDoXml, buscarXmlPorChave } from "@/lib/financeiro/xml-por-chave";
import { useNavigate } from "react-router-dom";
import { parseNFeXML } from "@/lib/parseNFe";
import { arquivoDanfe } from "@/lib/financeiro/danfe-pdf";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { mensagemDeErro } from "@/lib/financeiro/erro-do-banco";
import { buscarRecebimentoDaNota } from "@/lib/financeiro/buscar-recebimento-da-nota";
import { numeroDaNota } from "@/lib/financeiro/recebimento-da-nota";
import { vencimentoDoTitulo } from "@/lib/financeiro/vencimento-do-titulo";
import { diferencaParaANota, fatiasPorPartes, fatiasPorSaldo, linhasDaNfe, partesCompletas, type ItemDaNota } from "@/lib/financeiro/partes-do-vinculo";
import { useDocumentoFiscal } from "@/hooks/useDocumentoFiscal";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SeloPraefectusIA from "@/components/shared/SeloPraefectusIA";
import {
  Upload, Loader2, FileCheck2, FileX, ScanLine,
  FileText, ImageIcon, Pencil, CheckCircle2, AlertCircle, Info, Link2, ChevronDown, ChevronUp, FileCode2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useImportacaoNotas } from "@/hooks/useImportacaoNotas";
import { useUpsertLancamento, useEmpresaId, type Lancamento } from "@/hooks/useFinanceiro";
import { deDataLocal } from "@/lib/financeiro/data-local";
import LancamentoDialog from "./LancamentoDialog";
import VinculoContratoSelector, { type VinculoContratoValue } from "./VinculoContratoSelector";

type Tipo = "a_pagar" | "a_receber";

/** O tipo fiscal que a leitura devolve → o enum do lançamento (mesma tabela do lote). */
const TIPO_DOC_FISCAL: Record<string, string> = {
  nfe: "nfe", nfse: "nfse", nfce: "nfce",
  boleto: "boleto", recibo: "recibo", contrato: "contrato",
  duplicata: "duplicata", fatura: "fatura",
};

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
  /** O documento fiscal guardado — existe mesmo quando a leitura falha. */
  documentoId?: string | null;
  // Vínculo com Gestão (Contrato/ATA/Item/Aditivo)
  vinculo?: VinculoContratoValue;
  vincularExpandido?: boolean;
  /**
   * DANFE em PDF reconhecido pela chave (30/09) e ainda sem o XML: o cartão
   * pede o XML da nota em vez de mandar o PDF para a leitura por imagem.
   */
  danfe?: DanfeLido | null;
  aguardandoXml?: boolean;
  /** "Vincular ao contrato" em andamento — o botão fica travado até acabar. */
  vinculando?: boolean;
}

/** O selo do arquivo fala português — "IMAGE" era o valor cru do detector. */
const KIND_LABEL: Record<DocItem["kind"], string> = {
  xml: "XML",
  pdf: "PDF",
  image: "Imagem",
  outro: "Outro",
};

const VINCULO_VAZIO: VinculoContratoValue = {
  contrato_id: null,
  contrato_item_id: null,
  contrato_item_ids: [],
  origem_aditivo_id: null,
  quantidade: 0,
  valor_unitario: 0,
};

/**
 * Número que pode chegar como string pt-BR (09/09): "52.961" é cinquenta e
 * dois mil, não 52,961 — Number() cru dividiu quantidade e valor do pedido
 * 728 por mil. Vírgula presente = decimal BR; só pontos em grupos de 3 =
 * milhar; caso contrário, Number normal.
 */
const numeroBr = (v: unknown): number => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  if (!t) return 0;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, "")) || 0;
  return Number(t) || 0;
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
  const workerModule: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
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
  const empresaId = useEmpresaId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const { guardarArquivo, vincularLancamento } = useDocumentoFiscal();
  const { empresaAtiva } = useEmpresa();
  const cnpjDaEmpresa = empresaAtiva?.cnpj ?? null;
  const navigate = useNavigate();
  const xmlInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [processando, setProcessando] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; initial: Partial<Lancamento> | null; docId: string | null }>({
    open: false,
    initial: null,
    docId: null,
  });

  const qc = useQueryClient();
  const { importar } = useImportacaoNotas();
  const upsert = useUpsertLancamento();

  // Invalida todas as queries do financeiro impactadas por novos lançamentos
  // (lista, kanban, resumos, fluxo de caixa, contratos vinculados, etc.).
  const invalidarFinanceiro = useCallback(() => {
    [
      "fin-lancamentos",
      "fin-resumo",
      "fin-resumo-visor",
      "fin-fluxo-caixa",
      "fin-dre",
      "fin-movimentos",
      "fin-extratos",
      "contratos",
      "contrato-pedidos",
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }, [qc]);

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
    /**
     * O arquivo sobe ANTES da leitura, sempre.
     *
     * A leitura pode falhar — IA que não acha a chave, escaneado ruim, rede
     * que cai. Se o envio dependesse do sucesso dela, exatamente os documentos
     * difíceis seriam os que se perderiam, e são justamente esses que alguém
     * vai querer reabrir depois para conferir à mão. A chegada do documento é
     * um fato; o conteúdo é interpretação, e vem depois.
     */
    // XML não é arquivado aqui: a edge `importar-notas-fiscais` já o guarda,
    // ligado ao título — guardar antes deixava uma cópia órfã por envio (30/09).
    const documento = item.kind === "xml" ? null : await guardarArquivo(item.file);
    if (!documento && item.kind !== "xml") {
      toast.warning(`"${item.file.name}" foi processado, mas não pôde ser arquivado.`, {
        description: "O lançamento será criado; o documento original não ficará guardado.",
      });
    }

    try {
      // ---------- XML (NF-e / NFS-e) ----------
      if (item.kind === "xml") {
        const r = await importar([item.file]);
        const resultado = r?.resultados?.[0];
        if (!r?.ok || !resultado || resultado.status === "erro") {
          return { ...item, status: "erro", erro: resultado?.erro ?? r?.erro ?? "Falha na importação", documentoId: documento?.id ?? null };
        }
        // A QUANTIDADE que a nota declara (soma de q_com dos itens). Sem ela,
        // o vínculo sugeria valorTotal ÷ preço do contrato — 498,8914 caixas
        // para uma nota de 500. Quantidade é o que a nota atesta.
        // E as LINHAS de produto (30/09): sem elas, a nota de 18 produtos chegava
        // ao vínculo como "1.000 unidades a R$ 17,28" e nenhum item casava.
        const lido = await dadosDoXml(item.file, resultado);
        // O DANFE nasce com o XML (30/09): gerado da nota autorizada e guardado
        // no cofre, ligado ao título — sem ninguém precisar enviar PDF depois.
        const danfeId = await guardarDanfeDoXml(item.file, (resultado as { lancamento_id?: string | null }).lancamento_id ?? null);
        return { ...item, ...lido, documentoId: danfeId };
      }

      // ---------- PDF: é um DANFE? A chave diz, sem IA (30/09) ----------
      // O DANFE é a impressão do XML. Pela chave o sistema sabe emitente,
      // número, série e mês; acha a nota se já estiver lançada e anexa o PDF
      // a ela; senão pede o XML. A leitura por imagem fica para cupom, boleto,
      // recibo, fatura — ou para quem escolher "Ler por OCR mesmo assim".
      if (item.kind === "pdf") {
        const texto = await textoDasPaginas(item.file, 2).catch(() => "");
        const danfe = lerDanfe(texto, cnpjDaEmpresa);
        if (danfe) {
          const existente = await lancamentoDaChave(danfe.chave);
          if (existente) {
            if (documento?.id) await vincularLancamento(documento.id, existente.id);
            invalidarFinanceiro();
            return {
              ...item, status: "ok", motor: "Chave do DANFE", danfe,
              dados: dadosDoDanfe(danfe, { _ja_lancada: true, _danfe_anexado: true }),
              lancamentoId: existente.id, documentoId: documento?.id ?? null,
            };
          }
          return {
            ...item, status: "ok", motor: "Chave do DANFE", danfe, aguardandoXml: true,
            dados: dadosDoDanfe(danfe, { _precisa_xml: true }),
            documentoId: documento?.id ?? null,
          };
        }
      }
      return await lerPorImagem(item, documento?.id ?? null);
    } catch (e: any) {
      // O arquivo já está guardado — o erro é da leitura, não do documento.
      return { ...item, status: "erro", erro: e?.message ?? "Erro inesperado", documentoId: documento?.id ?? null };
    }
  };

  /** O que o XML diz, lido no navegador: valor, data, chave, número e as linhas — o mesmo para XML enviado ou anexado a um DANFE. */
  const dadosDoXml = async (xmlFile: File, resultado: { tipo?: string; valor?: number; competencia?: string; chave?: string; direcao?: string }): Promise<Partial<DocItem>> => {
    let quantidadeTotal: number | null = null;
    let linhasDaNota: ItemDaNota[] | null = null;
    let numero: string | null = null;
    let dataEmissao: string | null = null;
    let valor: number | null = null;
    let direcaoDoXml: "entrada" | "saida" | null = null;
    try {
      const nfe = parseNFeXML(await xmlFile.text());
      const soma = (nfe.itens ?? []).reduce(
        (acc: number, i: { q_com?: number | null }) => acc + (Number(i.q_com) || 0), 0);
      if (soma > 0) quantidadeTotal = soma;
      const linhas = linhasDaNfe(nfe.itens);
      if (linhas.length > 0) linhasDaNota = linhas;
      numero = nfe.numero_nf ? String(nfe.numero_nf) : null;
      dataEmissao = nfe.data_emissao ? String(nfe.data_emissao).slice(0, 10) : null;
      valor = Number(nfe.v_nf) || null;
      // A direção pelo XML: emitida pela empresa é saída (receita). A edge
      // não a devolve para nota duplicada, e o cartão dizia "despesa".
      const emit = String(nfe.cnpj_emitente ?? "").replace(/\D/g, "");
      const empresa = String(cnpjDaEmpresa ?? "").replace(/\D/g, "");
      if (emit.length === 14 && empresa.length === 14) direcaoDoXml = emit === empresa ? "saida" : "entrada";
    } catch { /* nota sem itens legíveis: segue sem quantidade */ }
    return {
      status: "ok",
      motor: "Parser XML",
      aguardandoXml: false,
      dados: {
        tipo_documento: resultado.tipo,
        numero_documento: numero,
        valor_total: valor ?? resultado.valor,
        data_emissao: dataEmissao ?? resultado.competencia,
        chave_nfe: resultado.chave,
        quantidade_total: quantidadeTotal,
        itens: linhasDaNota,
        descricao: `${(resultado.tipo ?? "nota").toUpperCase()} ${numero ?? resultado.chave ?? ""}`.trim(),
        _direcao: direcaoDoXml ?? resultado.direcao ?? null,
        _ja_lancada: true,
      },
      lancamentoId: null,
    };
  };

  /**
   * O XML já é título; o vínculo com o contrato é o que falta (30/09). O
   * cartão mostrava o seletor e nenhum botão o aplicava: o título existe
   * pela chave, e as partes nascem ligadas a ele, sem título novo.
   */
  const vincularXmlAoContrato = async (item: DocItem) => {
    // Dois cliques criaram dois lotes da 595 (30/09): o segundo espera o primeiro acabar.
    if (item.vinculando) return;
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, vinculando: true } : d)));
    try {
      await vincularXmlAoContratoDeFato(item);
    } finally {
      setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, vinculando: false } : d)));
    }
  };

  const vincularXmlAoContratoDeFato = async (item: DocItem) => {
    const chave = normalizarChaveNfe(item.dados?.chave_nfe);
    const existente = chave ? await lancamentoDaChave(chave) : null;
    if (!existente) {
      // O título do XML foi apagado depois (a 595 em 30/09): nasce de novo
      // aqui, junto do pedido/lote — o mesmo caminho do Lançar e vincular.
      toast.info("O título desta nota não existe mais no Financeiro: será criado agora, junto do pedido.", { duration: 8000 });
      await vincularAoContrato(item, null);
      return;
    }
    await vincularAoContrato(item, { id: existente.id, valor: item.dados?.valor_total != null ? Number(item.dados.valor_total) : null });
  };

  /**
   * Gera o DANFE do XML e o guarda junto do título (uma vez: título que já
   * tem PDF não ganha outro). Devolve o id do documento guardado, ou nulo.
   */
  const guardarDanfeDoXml = async (xmlFile: File, lancamentoIdDado: string | null): Promise<string | null> => {
    try {
      const nfe = parseNFeXML(await xmlFile.text());
      const chave = normalizarChaveNfe(nfe.chave_acesso);
      const lancamentoId = lancamentoIdDado ?? (chave ? (await lancamentoDaChave(chave))?.id ?? null : null);
      if (!lancamentoId) return null;
      const { data: jaTem } = await supabase
        .from("financeiro_documentos_fiscais" as never)
        .select("id, arquivo_nome")
        .eq("lancamento_id", lancamentoId)
        .ilike("arquivo_nome", "%.pdf")
        .limit(1)
        .maybeSingle();
      if (jaTem) return (jaTem as unknown as { id: string }).id;
      const doc = await guardarArquivo(arquivoDanfe(nfe), {
        tipo: "nfe", numero: nfe.numero_nf ? String(nfe.numero_nf) : null, serie: nfe.serie ? String(nfe.serie) : null,
        chave_acesso: chave, data_emissao: nfe.data_emissao ? String(nfe.data_emissao).slice(0, 10) : null,
        valor_total: Number(nfe.v_nf) || 0, lancamento_id: lancamentoId,
      });
      return doc?.id ?? null;
    } catch (e) {
      console.warn("DANFE não gerado:", e instanceof Error ? e.message : e);
      return null;
    }
  };

  /** Os campos que a chave e o texto do DANFE dão com certeza. */
  const dadosDoDanfe = (danfe: DanfeLido, extras: Record<string, unknown>) => ({
    tipo_documento: "nfe",
    numero_documento: String(danfe.numero),
    serie: String(danfe.serie),
    chave_nfe: danfe.chave,
    valor_total: danfe.valor_total,
    data_emissao: danfe.data_emissao ?? `${danfe.competencia}-01`,
    emitente_cnpj: danfe.cnpj_emitente,
    descricao: `NFE ${danfe.numero}`,
    _direcao: danfe.direcao,
    ...extras,
  });

  /** A nota desta chave já está lançada? Pelo documento fiscal (XML importado) ou pelo próprio título. */
  const lancamentoDaChave = async (chave: string): Promise<{ id: string } | null> => {
    if (!empresaId) return null;
    const { data: doc } = await supabase
      .from("financeiro_documentos_fiscais" as never)
      .select("lancamento_id")
      .eq("empresa_id", empresaId)
      .eq("chave_acesso", chave)
      .not("lancamento_id", "is", null)
      .limit(1)
      .maybeSingle();
    const viaDoc = (doc as unknown as { lancamento_id: string | null } | null)?.lancamento_id;
    if (viaDoc) return { id: viaDoc };
    const { data: lanc } = await supabase
      .from("financeiro_lancamentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("chave_acesso_nfe", chave)
      .limit(1)
      .maybeSingle();
    return lanc?.id ? { id: lanc.id } : null;
  };

  /**
   * A leitura por imagem (OCR multi-IA) — para o que não é DANFE, para o DANFE
   * escaneado (sem texto) e por escolha. Desde 30/09 o OCR devolve as LINHAS
   * de produto (`itens`) e a chave; chave válida num PDF sem texto ainda é um
   * DANFE: a nota já lançada recebe o PDF, senão o cartão pede o XML — mas
   * as linhas lidas ficam, para o vínculo não nascer vazio.
   */
  const lerPorImagem = async (item: DocItem, documentoId: string | null, forcarOcr = false): Promise<DocItem> => {
    try {

      // ---------- PDF / Imagem -> OCR ----------
      let dataUrl: string;
      if (item.kind === "pdf") {
        dataUrl = await pdfPrimeiraPaginaParaImage(item.file);
      } else if (item.kind === "image") {
        dataUrl = await fileToDataUrl(item.file);
      } else {
        return { ...item, status: "erro", erro: "Formato não suportado (use XML, PDF ou imagem)", documentoId };
      }

      const { data, error } = await supabase.functions.invoke("ocr-document-financeiro", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const dados = data?.dados;
      if (!dados) throw new Error("Sem dados extraídos");

      // A chave que o DANFE já tinha dado vale mais do que a lida na imagem.
      const chaveCerta = item.danfe?.chave;
      const lido = { ...item, status: "ok" as const, motor: data.motor, aguardandoXml: false, dados: chaveCerta ? { ...dados, chave_nfe: chaveCerta } : dados, documentoId };
      // PDF escaneado: o texto não tinha a chave, mas a imagem tinha.
      if (!forcarOcr && !item.danfe && item.kind === "pdf") {
        const danfe = danfeDaChave(dados?.chave_nfe, cnpjDaEmpresa, { valor_total: dados?.valor_total, data_emissao: dados?.data_emissao });
        if (danfe) {
          const existente = await lancamentoDaChave(danfe.chave);
          if (existente) {
            if (documentoId) await vincularLancamento(documentoId, existente.id);
            invalidarFinanceiro();
            return { ...lido, danfe, dados: { ...lido.dados, ...dadosDoDanfe(danfe, { _ja_lancada: true, _danfe_anexado: true }), itens: lido.dados?.itens ?? null }, lancamentoId: existente.id };
          }
          return { ...lido, danfe, aguardandoXml: true, dados: { ...lido.dados, ...dadosDoDanfe(danfe, { _precisa_xml: true }), valor_total: danfe.valor_total ?? lido.dados?.valor_total ?? null, itens: lido.dados?.itens ?? null } };
        }
      }
      return lido;
    } catch (e) {
      // O arquivo já está guardado — o erro é da leitura, não do documento.
      return { ...item, status: "erro", erro: e instanceof Error ? e.message : "Erro inesperado", documentoId };
    }
  };

  /** "Ler por OCR mesmo assim": o DANFE sem XML vai para a leitura por imagem, por escolha de quem opera. */
  const lerDanfePorOcr = async (item: DocItem) => {
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: "processando" } : d)));
    const lido = await lerPorImagem({ ...item, aguardandoXml: false }, item.documentoId ?? null, true);
    setDocs((prev) => prev.map((d) => (d.id === item.id ? lido : d)));
  };

  /**
   * O XML pela SEFAZ (30/09): a chave do DANFE vai à edge `nfe-xml-por-chave`,
   * que usa o certificado A1 da empresa; o XML que volta entra pelo mesmo
   * caminho do XML anexado à mão.
   */
  const buscarXmlNaSefaz = async (item: DocItem) => {
    const chave = item.danfe?.chave;
    if (!chave || !empresaId) return;
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: "processando" } : d)));
    const r = await buscarXmlPorChave(empresaId, chave);
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: "ok" } : d)));
    if (r.ok === true) {
      await anexarXmlAoDanfe({ ...item, status: "ok" }, arquivoDoXml(r.xml, chave));
      return;
    }
    const falha = r;
    toast.error("A SEFAZ não entregou o XML.", {
      description: falha.motivo,
      duration: 15000,
      action: falha.sem_certificado ? { label: "Enviar o certificado", onClick: () => navigate("/financeiro/integracoes_fiscais") } : undefined,
    });
  };

  /** A leitura por imagem já aconteceu (PDF escaneado): seguir com ela é só liberar o cartão. */
  const seguirComALeitura = (item: DocItem) => {
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, aguardandoXml: false, dados: { ...d.dados, _precisa_xml: false } } : d)));
  };

  /**
   * O XML da nota do DANFE: confere a chave, lança pelo XML (o mesmo caminho
   * do XML enviado direto) e anexa o PDF ao título que nasceu — ou ao que já
   * existia. XML de outra nota é recusado com as duas chaves na tela.
   */
  const anexarXmlAoDanfe = async (item: DocItem, xmlFile: File) => {
    const chaveDoPdf = item.danfe?.chave;
    if (!chaveDoPdf) return;
    let chaveDoXml: string | null = null;
    try { chaveDoXml = normalizarChaveNfe(parseNFeXML(await xmlFile.text()).chave_acesso); } catch { chaveDoXml = null; }
    if (!chaveDoXml) { toast.error(`"${xmlFile.name}" não é um XML de NF-e legível.`); return; }
    if (chaveDoXml !== chaveDoPdf) {
      toast.error("O XML é de outra nota.", { description: `XML: chave …${chaveDoXml.slice(-12)} · DANFE: chave …${chaveDoPdf.slice(-12)}. Anexe o XML da NF-e ${item.danfe?.numero}.`, duration: 10000 });
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: "processando" } : d)));
    try {
      const r = await importar([xmlFile]);
      const resultado = r?.resultados?.[0];
      if (!r?.ok || !resultado || resultado.status === "erro") throw new Error(resultado?.erro ?? r?.erro ?? "Falha na importação do XML");
      const existente = await lancamentoDaChave(chaveDoPdf);
      if (existente && item.documentoId) await vincularLancamento(item.documentoId, existente.id);
      invalidarFinanceiro();
      const lido = await dadosDoXml(xmlFile, { ...resultado, chave: resultado.chave ?? chaveDoPdf, direcao: resultado.direcao ?? item.danfe?.direcao ?? undefined });
      setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...lido, dados: { ...lido.dados, _danfe_anexado: !!existente } } : d)));
      toast.success(resultado.status === "duplicada" ? `NF-e ${item.danfe?.numero} já estava lançada: o DANFE foi anexado ao título.` : `NF-e ${item.danfe?.numero} lançada pelo XML; o DANFE ficou anexado ao título.`);
    } catch (e) {
      setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: "ok" } : d)));
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar pelo XML.");
    }
  };

  const processarTodos = async () => {
    if (docs.length === 0 || processando) return;
    setProcessando(true);
    // Marca todos como processando
    setDocs((prev) => prev.map((d) => (d.status === "pendente" ? { ...d, status: "processando" } : d)));

    // XML antes de PDF: o DANFE em PDF da mesma nota, lido depois, acha o
    // título que o XML acabou de criar e é anexado a ele, em vez de pedir XML.
    const ordem = (d: DocItem) => (d.kind === "xml" ? 0 : 1);
    const fila = docs.filter((d) => d.status === "pendente" || d.status === "processando").sort((a, b) => ordem(a) - ordem(b));
    for (const doc of fila) {
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
      duplicata: "duplicata", fatura: "fatura",
    };
    // O código de barras é o único campo com dígito verificador — no lote ele
    // ia para as observações enquanto valor e vencimento entravam da leitura
    // sem conferência. Mesma precedência do LancamentoDialog: o DV manda.
    const boleto = d.codigo_barras ? lerLinhaDigitavel(String(d.codigo_barras), hojeLocal()) : null;
    // Todo título nasce com vencimento (`vencimento-do-titulo.ts`): sem
    // duplicata nem boleto, a emissão entra no lugar e a nota diz que foi
    // assumido — a pessoa vê e corrige no diálogo.
    const vencimento = vencimentoDoTitulo({
      informado: boleto?.vencimento ?? d.data_vencimento ?? null,
      emissao: d.data_emissao ?? null,
      hoje: hojeLocal(),
    });
    const obsContrato = item.vinculo?.contrato_id
      ? `Vínculo: contrato ${item.vinculo.contrato_id}${
          item.vinculo.contrato_item_ids?.length
            ? ` · ${item.vinculo.contrato_item_ids.length} item(s)`
            : ""
        } — ao salvar, o pedido (ou o lote) nasce em Gestão de Contratos ligado a este título.`
      : null;
    const initial: any = {
      tipo,
      natureza: tipo === "a_receber" ? "receita" : "despesa",
      status: "previsto",
      descricao: d.descricao
        || `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim()
        || item.file.name,
      valor: boleto?.valor ?? Number(d.valor_total ?? 0),
      data_competencia: d.data_emissao ?? hojeLocal(),
      data_vencimento: vencimento.data,
      data_emissao: d.data_emissao ?? null,
      tipo_documento: tipoDocBruto ? (tipoDocMap[tipoDocBruto] ?? "outro") : "outro",
      numero_documento: d.numero_documento ?? null,
      chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
      observacoes: [
        d.emitente_nome ? `Emitente: ${d.emitente_nome}` : null,
        d.emitente_cnpj ? `CNPJ emitente: ${d.emitente_cnpj}` : null,
        d.destinatario_nome ? `Destinatário: ${d.destinatario_nome}` : null,
        d.destinatario_cnpj_cpf ? `CNPJ/CPF destinatário: ${d.destinatario_cnpj_cpf}` : null,
        d.codigo_barras ? `Código de barras: ${d.codigo_barras}` : null,
        item.motor ? `Extraído via ${item.motor}` : null,
        obsContrato,
        vencimento.nota,
      ].filter(Boolean).join("\n") || null,
    };
    setEditor({ open: true, initial, docId: item.id });
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

  /**
   * Anexa o arquivo guardado ao lançamento e completa o NÚMERO da nota no
   * documento. É pelo número que a aba Pedidos acha a DANFE de um pedido pago
   * por rateio (o recebimento não tem número próprio): sem ele, as seis notas
   * da TED de 27/05 ficaram no Financeiro e invisíveis na Gestão (22/09).
   */
  const anexarDocumento = async (item: DocItem, lancamentoId: string) => {
    if (!item.documentoId) return;
    const numero = item.dados?.numero_documento ? String(item.dados.numero_documento) : null;

    // A mesma nota já anexada a este lançamento? A TED de 27/05 acumulou
    // dezesseis cópias das seis DANFEs (22/09): cada reenvio virava um anexo
    // novo. A cópia é descartada — arquivo e registro — e o anexo que já
    // existia ganha o número, se lhe faltava.
    type Anexo = { id: string; numero: string | null; arquivo_nome: string | null; storage_path: string | null };
    const { data: jaAnexados } = await supabase
      .from("financeiro_documentos_fiscais" as never)
      .select("id, numero, arquivo_nome, storage_path")
      .eq("lancamento_id", lancamentoId)
      .neq("id", item.documentoId);
    const repetido = ((jaAnexados ?? []) as unknown as Anexo[]).find((d) =>
      (!!numero && !!d.numero && numeroDaNota(d.numero) === numeroDaNota(numero))
      || (!!d.arquivo_nome && d.arquivo_nome === item.file.name),
    );
    if (repetido) {
      const { data: novo } = await supabase
        .from("financeiro_documentos_fiscais" as never)
        .select("storage_path")
        .eq("id", item.documentoId)
        .maybeSingle();
      const caminho = (novo as { storage_path?: string | null } | null)?.storage_path ?? null;
      const { error: erroApagar } = await supabase
        .from("financeiro_documentos_fiscais" as never)
        .delete()
        .eq("id", item.documentoId);
      if (!erroApagar && caminho) await supabase.storage.from("financeiro-documentos").remove([caminho]);
      if (numero && !repetido.numero) {
        await supabase.from("financeiro_documentos_fiscais" as never).update({ numero } as never).eq("id", repetido.id);
      }
      toast.info(`${item.file.name}: esta nota já estava anexada a este lançamento. A cópia foi descartada.`, { duration: 8000 });
      return;
    }

    await vincularLancamento(item.documentoId, lancamentoId);
    if (numero) {
      await supabase
        .from("financeiro_documentos_fiscais" as never)
        .update({ numero } as never)
        .eq("id", item.documentoId)
        .is("numero", null);
    }
  };

  /**
   * A nota já é de um pedido do contrato? (22/09, decisão do dono)
   *
   * O fluxo da ETHOS é o Comercial registrar o pedido antes de a DANFE
   * chegar ao Financeiro. Se a Extração criasse outro pedido pela nota, o
   * contrato consumiria o saldo duas vezes — 725 a 730 já existem, quitados
   * pela TED de 27/05. Pedido com a mesma nota → o PDF vai para o recebimento
   * dele: o título próprio, ou o recebimento que o pagou por rateio (a nota
   * entra como PARTE dele). Sem recebimento nenhum, nasce só o título, ligado
   * ao pedido que já existe. Nunca um pedido novo.
   *
   * Devolve true quando resolveu; false quando não há pedido com a nota.
   */
  const anexarAoPedidoExistente = async (item: DocItem, contratoId: string): Promise<boolean> => {
    const d = item.dados ?? {};
    const numero = numeroDaNota(d.numero_documento);
    if (!numero) return false;
    const { data: pedidos } = await supabase
      .from("contrato_pedidos")
      .select("id, numero_pedido, nota_fiscal, contrato_item_id")
      .eq("contrato_id", contratoId)
      .neq("status", "cancelado")
      .not("nota_fiscal", "is", null)
      .limit(500);
    type PedidoComNota = { id: string; numero_pedido: string; nota_fiscal: string | null; contrato_item_id: string | null };
    const pedido = ((pedidos ?? []) as PedidoComNota[]).find((p) => numeroDaNota(p.nota_fiscal) === numero);
    if (!pedido) return false;
    const rotulo = `NF ${d.numero_documento ?? numero}`;
    const marcar = (lancamentoId: string) => {
      setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId } : x)));
      invalidarFinanceiro();
    };

    // 1. Título próprio do pedido: o PDF vai para ele, com o número e a chave.
    const { data: titulos } = await supabase
      .from("financeiro_lancamentos")
      .select("id, numero_documento, chave_acesso_nfe, status")
      .eq("contrato_pedido_id", pedido.id)
      .eq("tipo", "a_receber")
      .neq("status", "cancelado")
      .limit(5);
    const titulo = ((titulos ?? []) as Array<{ id: string; numero_documento: string | null; chave_acesso_nfe: string | null; status: string }>)[0];
    if (titulo) {
      await supabase
        .from("financeiro_lancamentos")
        .update({
          numero_documento: titulo.numero_documento ?? d.numero_documento ?? null,
          chave_acesso_nfe: titulo.chave_acesso_nfe ?? normalizarChaveNfe(d.chave_nfe) ?? null,
        } as never)
        .eq("id", titulo.id);
      await anexarDocumento(item, titulo.id);
      marcar(titulo.id);
      toast.success(`${rotulo}: já é o pedido ${pedido.numero_pedido} deste contrato. O PDF foi anexado ao recebimento dele; nenhum pedido ou título novo.`, { duration: 10000 });
      return true;
    }

    // 2. Pago por rateio: o PDF vai como parte do recebimento que pagou o pedido.
    const { data: rateios } = await supabase
      .from("financeiro_lancamento_rateios" as never)
      .select("lancamento_id, valor")
      .eq("contrato_pedido_id", pedido.id)
      .limit(5);
    const rateio = ((rateios ?? []) as unknown as Array<{ lancamento_id: string; valor: number }>)[0];
    if (rateio) {
      await anexarDocumento(item, rateio.lancamento_id);
      marcar(rateio.lancamento_id);
      toast.success(`${rotulo}: o pedido ${pedido.numero_pedido} foi pago por rateio. O PDF foi anexado como parte do recebimento que o pagou (${fmt(Number(rateio.valor))}); nenhum pedido ou título novo.`, { duration: 10000 });
      return true;
    }

    // 3. Pedido sem recebimento: nasce só o título, ligado ao pedido que já existe.
    const r = await upsert.mutateAsync({
      tipo: "a_receber",
      natureza: "receita",
      status: "previsto",
      descricao: d.descricao || `NF-e ${d.numero_documento ?? numero} · pedido ${pedido.numero_pedido}`,
      valor: numeroBr(d.valor_total),
      data_competencia: d.data_emissao ?? hojeLocal(),
      data_vencimento: d.data_vencimento ?? d.data_emissao ?? null,
      data_emissao: d.data_emissao ?? null,
      tipo_documento: (d.tipo_documento ?? "outro") as never,
      numero_documento: d.numero_documento ?? null,
      chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
      contrato_id: contratoId,
      contrato_pedido_id: pedido.id,
      contrato_item_id: pedido.contrato_item_id ?? null,
    } as never);
    const novoId = (r as { id?: string } | null)?.id ?? null;
    if (novoId) await anexarDocumento(item, novoId);
    marcar(novoId ?? "ok");
    toast.success(`${rotulo}: o pedido ${pedido.numero_pedido} já existia sem recebimento. O título nasceu ligado a ele; nenhum pedido novo.`, { duration: 10000 });
    return true;
  };

  /**
   * O vínculo com o contrato: pedido (ou lote de pedidos) + título. Serve ao
   * "Lançar" e, desde 30/09, ao "Revisar": o diálogo salvava o título com uma
   * nota "Vínculo: contrato …" no texto e nenhum pedido nascia — a NF-e 595 e
   * a 651 entraram no Contas a Receber e não apareceram em Gestão de
   * Contratos. Com `lancamentoSalvo`, o título já existe e é ele que se liga.
   */
  const vincularAoContrato = async (item: DocItem, lancamentoSalvo: { id: string; valor?: number | null } | null) => {
    const d = item.dados ?? {};
    const v = item.vinculo;
    if (!v?.contrato_id) return;
    try {
        // A nota que já é de um pedido do contrato não vira pedido novo (22/09).
        // Pelo Revisar o título já foi salvo pela pessoa: essa conferência não cabe.
        if (!lancamentoSalvo && tipo === "a_receber" && d.numero_documento) {
          try {
            if (await anexarAoPedidoExistente(item, v!.contrato_id)) return;
          } catch (e) {
            toast.error("Não foi possível conferir se a nota já é de um pedido do contrato — nada foi criado.", { description: mensagemDeErro(e) });
            return;
          }
        }
        // Caminho com vínculo: cria pedido + lançamento via RPC (recalcula saldo do contrato/ATA)
        const valorTotal = lancamentoSalvo?.valor != null ? Number(lancamentoSalvo.valor) : numeroBr(d.valor_total);

        // Lista de itens marcados (1 ou mais — cota principal + reservada)
        const itemIds =
          v!.contrato_item_ids && v!.contrato_item_ids.length > 0
            ? v!.contrato_item_ids
            : v!.contrato_item_id
              ? [v!.contrato_item_id]
              : [null];

        // Rateio proporcional ao saldo financeiro de cada item.
        // Quando não houver saldo conhecido, divide-se igualmente.
        let pesos: number[] = [];
        if (itemIds.length > 1 && itemIds.every(Boolean)) {
          const { data: itensData } = await supabase
            .from("contrato_itens")
            .select("id, saldo_financeiro")
            .in("id", itemIds as string[]);
          const map = new Map(
            (itensData ?? []).map((r: any) => [r.id, Number(r.saldo_financeiro) || 0]),
          );
          pesos = itemIds.map((id) => Math.max(map.get(id as string) ?? 0, 0));
          const soma = pesos.reduce((a, b) => a + b, 0);
          if (soma <= 0) pesos = itemIds.map(() => 1);
        } else {
          pesos = itemIds.map(() => 1);
        }
        const somaPesos = pesos.reduce((a, b) => a + b, 0);

        // ── O recebimento que já existe (regra do dono, 21/09) ──────────
        // O extrato entrou antes da DANFE e cada anexo virava um segundo
        // título. Identidade pelo NÚMERO da nota ou pela chave; valor só
        // confirma. Um recebimento certo e um item só → a função casa em vez
        // de criar. Indício (número sem valor, só valor, nota rateada em
        // vários itens) → o pedido nasce sem título e quem opera casa na aba
        // Pedidos. Nada parecido → cria, como antes.
        // Título salvo no Revisar: é ELE o título — o pedido (ou o lote) nasce
        // ligado a ele, nenhum título novo.
        let lancamentoExistente: string | null = lancamentoSalvo?.id ?? null;
        let criarTitulo = !lancamentoSalvo;
        if (!lancamentoSalvo && tipo === "a_receber" && (d.numero_documento || d.chave_nfe)) {
          const { data: ctr } = await supabase
            .from("contratos")
            .select("empresa_id")
            .eq("id", v!.contrato_id)
            .single();
          const empresaDoContrato = (ctr as { empresa_id?: string | null } | null)?.empresa_id ?? null;
          if (empresaDoContrato) {
            try {
              const busca = await buscarRecebimentoDaNota(empresaDoContrato, {
                numero: d.numero_documento ?? null,
                chave: d.chave_nfe ?? null,
                valor: valorTotal,
                dataEmissao: d.data_emissao ?? null,
              });
              if (busca.veredito === "certo" && itemIds.length === 1) {
                lancamentoExistente = busca.recebimento.id;
                toast.success(`NF ${d.numero_documento ?? ""}: já recebida — o pedido será casado ao recebimento, sem título novo.`, {
                  description: busca.motivos.join(", "),
                  duration: 10000,
                });
              } else if (busca.veredito !== "nenhum") {
                criarTitulo = false;
                const s = busca.veredito === "certo" ? null : busca.sugestoes[0];
                toast.info(`NF ${d.numero_documento ?? ""}: há recebimento parecido no Financeiro — o pedido será criado sem título.`, {
                  description: `${s ? `${s.recebimento.descricao ?? "sem descrição"} · ${fmt(Number(s.recebimento.valor))} — ${s.motivos.join(", ")}. ` : "Nota rateada em vários itens. "}${
                    s?.relacao === "parcial" ? "Case em Gestão de Contratos → Pedidos → Vincular lançamento e lance o restante como parcela." :
                    s?.relacao === "parte" ? "Recebimento maior que a nota: use Ratear em Gestão de Contratos → Pedidos → Vincular lançamento." :
                    "Case em Gestão de Contratos → Pedidos."}`,
                  duration: 15000,
                });
              }
            } catch (e) {
              // A busca falhar não pode impedir o lançamento: segue criando,
              // como sempre fez, e diz que não conseguiu conferir.
              toast.warning("Não foi possível conferir se a nota já foi recebida.", { description: mensagemDeErro(e) });
            }
          }
        }

        let lancId: string | null = null;
        // Todo título nasce com vencimento (`vencimento-do-titulo.ts`). A RPC
        // gravava nulo quando a NF-e não trazia duplicata, e o título sumia do
        // fluxo de caixa e do "Em atraso" (NF 736 da ETHOS, 21/09). O que foi
        // assumido vai dito nas observações; a RPC repete a escada para quem
        // a chamar sem passar por aqui.
        const vencimento = vencimentoDoTitulo({
          informado: d.data_vencimento ?? null,
          emissao: d.data_emissao ?? null,
          hoje: hojeLocal(),
        });
        const tipoLabels: Record<string, string> = { nfe: "NF-e", nfse: "NFS-e", nfce: "NF-Ce" };
        const tipoFormatado = tipoLabels[(d.tipo_documento as string)?.toLowerCase()] ?? (d.tipo_documento ?? "Doc").toString().toUpperCase();
        // Quando numero_documento está presente (PDF/OCR), compõe "NF-e 718 · PRODUTO" para diferenciar visualmente
        // pedidos do mesmo produto mas de notas distintas. Quando ausente (XML path, onde descricao já
        // carrega a chave da NF-e), mantém o comportamento original.
        const descricaoBase = d.numero_documento && d.descricao
          ? `${tipoFormatado} ${d.numero_documento} · ${d.descricao}`
          : (d.descricao || `${tipoFormatado} ${d.numero_documento ?? ""}`.trim() || item.file.name);
        // ── Nota com VÁRIOS itens do contrato (29/09) ──────────────────────
        // As partes nascem com o mesmo lote_id e SEM título próprio; o título
        // é um só, com o valor da nota, ligado ao lote — o órgão paga a nota
        // uma vez. Cada parte recebe por rateio (gatilho da migration
        // 20260929000002). Com quantidade e unitário por item informados no
        // vínculo, cada parte nasce com o produto certo; sem eles, cai no
        // rateio por saldo (cota principal + reservada) — e avisa.
        const loteId = itemIds.length > 1 ? crypto.randomUUID() : null;
        const pedidosDoLote: string[] = [];
        const qtdInformada = numeroBr(v!.quantidade) || 0;
        const vuRef = numeroBr(v!.valor_unitario) || valorTotal;
        const usaPartes = itemIds.length > 1 && itemIds.every(Boolean) && partesCompletas(itemIds as string[], v!.partes);
        const fatias = usaPartes
          ? fatiasPorPartes(itemIds as string[], v!.partes!)
          : fatiasPorSaldo(itemIds.map((id) => String(id ?? "")), pesos, valorTotal, qtdInformada, vuRef);
        if (usaPartes) {
          const conf = diferencaParaANota(fatias, valorTotal);
          if (!conf.fecha) {
            toast.error("A soma das partes não fecha com a nota — nada foi lançado.", { description: `Partes ${conf.soma.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} × nota ${valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Ajuste quantidade e unitário no vínculo.` });
            return;
          }
        } else if (itemIds.length > 2) {
          toast.warning(`${itemIds.length} itens sem quantidade e unitário por item: o valor foi rateado pelo saldo, com a descrição da nota em todas as partes. Prefira informar cada item no vínculo.`, { duration: 12000 });
        }
        const descricaoDaParte = (idx: number) => {
          if (!usaPartes || itemIds.length === 1) return descricaoBase + (itemIds.length > 1 ? ` (parte ${idx + 1}/${itemIds.length})` : "");
          // Com partes informadas, a descrição da parte é a do ITEM do contrato (resolvido no laço).
          return `${tipoFormatado} ${d.numero_documento ?? ""} · item ${idx + 1}/${itemIds.length}`.trim();
        };
        let nomesDosItens = new Map<string, string>();
        if (usaPartes) {
          const { data: itensNomes } = await supabase.from("contrato_itens").select("id, descricao").in("id", itemIds as string[]);
          nomesDosItens = new Map(((itensNomes ?? []) as Array<{ id: string; descricao: string }>).map((i) => [i.id, i.descricao]));
        }
        for (let idx = 0; idx < itemIds.length; idx++) {
          const fatia = fatias[idx];
          const descricaoParte = usaPartes && nomesDosItens.get(String(itemIds[idx]))
            ? `${tipoFormatado} ${d.numero_documento ?? ""} · ${nomesDosItens.get(String(itemIds[idx]))!.slice(0, 80)} (item ${idx + 1}/${itemIds.length})`.trim()
            : descricaoDaParte(idx);

          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            "vincular_lancamento_a_pedido" as any,
            {
              p_contrato_id: v!.contrato_id,
              p_contrato_item_id: itemIds[idx],
              p_origem_aditivo_id: v!.origem_aditivo_id,
              p_numero_pedido:
                (d.numero_documento ||
                  `DOC-${hojeLocal().replace(/-/g, "")}`) +
                (itemIds.length > 1 ? `-${idx + 1}` : ""),
              p_descricao: descricaoParte,
              p_quantidade: fatia.quantidade || 1,
              p_valor_unitario: fatia.valor_unitario,
              p_valor_total: fatia.valor_total,
              p_data_pedido: d.data_emissao ?? hojeLocal(),
              p_tipo: tipo,
              p_natureza: tipo === "a_receber" ? "receita" : "despesa",
              p_status: "previsto",
              p_data_competencia: d.data_emissao ?? hojeLocal(),
              p_data_vencimento: vencimento.data,
              p_data_emissao: d.data_emissao ?? null,
              p_tipo_documento: (d.tipo_documento as any) ?? "outro",
              p_numero_documento: d.numero_documento ?? null,
              p_chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
              // De qual empenho o pedido sai — sem isto o saldo do empenho não
              // baixa pelo caminho da Extração (modelo de 30/08).
              p_empenho_id: v!.empenho_id ?? null,
              p_cota: v!.cota ?? null,
              // Lote: nenhuma parte ganha título; o título único vem depois.
              // Item só: casa com o recebimento que já existe, ou cria o
              // pedido sem título quando só há indício (migration 20260921000003).
              p_lancamento_existente: loteId ? null : (idx === 0 ? lancamentoExistente : null),
              p_criar_titulo: loteId ? false : criarTitulo,
              p_pessoa_id: null,
              p_observacoes: [
                d.emitente_nome ? `Emitente: ${d.emitente_nome}` : null,
                d.destinatario_nome ? `Destinatário: ${d.destinatario_nome}` : null,
                item.motor ? `Extraído via ${item.motor}` : null,
                itemIds.length > 1
                  ? (usaPartes
                    ? `Parte de uma nota com ${itemIds.length} itens do contrato; título único do lote no Financeiro.`
                    : `Vinculado a ${itemIds.length} itens do contrato por rateio de saldo (cota principal + reservada — Lei 14.133/21).`)
                  : null,
                "Pedido criado automaticamente a partir de documento financeiro.",
                vencimento.nota,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          );
          if (rpcErr) {
            // O banco recusa estado impossível; a recusa tem de chegar em
            // português. `violates check constraint "chk_fl_chave_nfe_44"` não
            // diz nada a quem lança.
            toast.error(
              `Não foi possível vincular${itemIds.length > 1 ? ` o item ${idx + 1}/${itemIds.length}` : ""}`,
              { description: mensagemDeErro(rpcErr) },
            );
            return;
          }
          if (!lancId) lancId = (rpcData as any)?.lancamento_id ?? "ok";
          const pedidoCriado = (rpcData as { pedido_id?: string | null } | null)?.pedido_id;
          if (loteId && pedidoCriado) pedidosDoLote.push(String(pedidoCriado));
        }
        if (loteId && pedidosDoLote.length > 1) {
          // A cesta (30/09): nome e quantidade em todas as partes do lote, para
          // Gestão de Contratos medir preço, custo e margem por cesta.
          const cesta = v!.unidades_compostas && v!.unidades_compostas > 0
            ? { unidade_composta: v!.unidade_composta?.trim() || "cesta básica", unidades_compostas: v!.unidades_compostas }
            : {};
          const { error: erroLote } = await supabase.from("contrato_pedidos").update({ lote_id: loteId, ...cesta } as never).in("id", pedidosDoLote);
          if (erroLote) console.warn("lote_id não gravado nas partes:", erroLote.message);

          // O título ÚNICO do lote: o recebimento que já existe, ou um novo.
          if (lancamentoExistente) {
            const { error: erroLig } = await supabase.from("financeiro_lancamentos").update({ lote_id: loteId, contrato_id: v!.contrato_id } as never).eq("id", lancamentoExistente);
            if (erroLig) toast.warning("As partes nasceram, mas o recebimento existente não pôde ser ligado ao lote.", { description: mensagemDeErro(erroLig) });
            lancId = lancamentoExistente;
          } else if (criarTitulo) {
            const { data: sessao } = await supabase.auth.getUser();
            const { data: novo, error: erroTitulo } = await supabase.from("financeiro_lancamentos").insert({
              empresa_id: empresaId,
              tipo,
              natureza: tipo === "a_receber" ? "receita" : "despesa",
              status: "previsto",
              descricao: `${tipoFormatado} ${d.numero_documento ?? ""} · lote de ${itemIds.length} itens do contrato`.trim(),
              valor: valorTotal,
              data_competencia: d.data_emissao ?? hojeLocal(),
              data_vencimento: vencimento.data,
              data_emissao: d.data_emissao ?? null,
              tipo_documento: (d.tipo_documento as never) ?? "outro",
              numero_documento: d.numero_documento ?? null,
              chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
              contrato_id: v!.contrato_id,
              contrato_pedido_id: null,
              lote_id: loteId,
              origem: "manual",
              created_by: sessao?.user?.id ?? null,
              observacoes: [
                `Título único da nota, rateado entre ${itemIds.length} pedidos do contrato (lote).`,
                d.emitente_nome ? `Emitente: ${d.emitente_nome}` : null,
                d.destinatario_nome ? `Destinatário: ${d.destinatario_nome}` : null,
                vencimento.nota,
              ].filter(Boolean).join("\n"),
            } as never).select("id").single();
            if (erroTitulo) {
              toast.error("As partes nasceram no contrato, mas o título único não pôde ser criado.", { description: mensagemDeErro(erroTitulo) });
            } else {
              lancId = (novo as { id: string } | null)?.id ?? lancId;
            }
          } else {
            lancId = "ok";
          }
        }

        // O documento já está guardado; agora ele aponta para o lançamento
        // que nasceu dele. Sem esse elo, o arquivo fica no bucket sem que
        // ninguém saiba a que ele se refere.
        if (lancId && lancId !== "ok") {
          await anexarDocumento(item, lancId);
        }
        setDocs((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, lancamentoId: lancId ?? "ok" } : x)),
        );
        invalidarFinanceiro();
        toast.success(
          itemIds.length > 1
            ? `Nota lançada como lote de ${itemIds.length} itens do contrato, com um título único no Financeiro.`
            : "Lançamento criado e pedido vinculado ao contrato.",
        );
    } catch (e) {
      toast.error("Não foi possível vincular ao contrato", { description: mensagemDeErro(e) });
    }
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
        await vincularAoContrato(item, null);
        return;
      }

      // ── Nota já paga ou recebida? (regra do dono, 21/09) ────────────────
      // A mesma régua do lado a receber, agora para nota de fornecedor:
      // identidade pelo número da nota ou pela chave, com o CNPJ da outra
      // parte como desempate; valor só confirma. Um lançamento certo → o PDF
      // é anexado a ele e nenhum título nasce. Indício → nada é criado e
      // quem opera decide (o Revisar continua lançando, se for o caso).
      if (empresaId && (d.numero_documento || d.chave_nfe)) {
        try {
          const busca = await buscarRecebimentoDaNota(
            empresaId,
            {
              numero: d.numero_documento ?? null,
              chave: d.chave_nfe ?? null,
              valor: numeroBr(d.valor_total),
              cnpj: tipo === "a_pagar" ? (d.emitente_cnpj ?? null) : (d.destinatario_cnpj_cpf ?? null),
              dataEmissao: d.data_emissao ?? null,
            },
            tipo,
          );
          const verbo = tipo === "a_receber" ? "recebida" : "paga";
          if (busca.veredito === "certo") {
            const existente = busca.recebimento;
            const { error: erroCompletar } = await supabase
              .from("financeiro_lancamentos")
              .update({
                numero_documento: existente.numero_documento ?? d.numero_documento ?? null,
                chave_acesso_nfe: existente.chave_acesso_nfe ?? normalizarChaveNfe(d.chave_nfe) ?? null,
                tipo_documento: (TIPO_DOC_FISCAL[(d.tipo_documento ?? "").toString().toLowerCase()] ?? "outro") as never,
              } as never)
              .eq("id", existente.id);
            if (erroCompletar) throw new Error(erroCompletar.message);
            await anexarDocumento(item, existente.id);
            setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId: existente.id } : x)));
            invalidarFinanceiro();
            const quando = existente.data_realizado ?? existente.data_competencia;
            toast.success(
              `NF ${d.numero_documento ?? ""}: já ${verbo}${quando ? ` em ${deDataLocal(String(quando).slice(0, 10)).toLocaleDateString("pt-BR")}` : ""}. O PDF foi anexado ao lançamento existente; nenhum título novo foi criado.`,
              { description: busca.motivos.join(", "), duration: 10000 },
            );
            return;
          }
          if (busca.veredito === "ambiguo") {
            const s = busca.sugestoes[0];
            const existente = s.recebimento;
            const quandoPg = existente.data_realizado ?? existente.data_competencia;
            const quandoBr = quandoPg ? deDataLocal(String(quandoPg).slice(0, 10)).toLocaleDateString("pt-BR") : "";
            const anexarA = async (lancamentoId: string) => {
              if (!item.documentoId) return;
              await anexarDocumento(item, lancamentoId);
              setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId } : x)));
              invalidarFinanceiro();
            };
            // ── Fracionado (22/09): a nota é PARTE de um pagamento maior ────
            // (R$ 400 mil que quita duas notas de R$ 200 mil): o PDF anexa-se
            // ao pagamento e nenhum título nasce.
            if (s.relacao === "parte" && item.documentoId) {
              toast.info(`NF ${d.numero_documento ?? ""}: o pagamento de ${fmt(Number(existente.valor))}${quandoBr ? ` (${quandoBr})` : ""} pode cobrir esta nota como PARTE.`, {
                description: `${existente.descricao ?? "sem descrição"} — ${s.motivos.join(", ")}. Depois desta nota, ${fmt(s.restante)} do pagamento seguem sem nota.`,
                action: {
                  label: "Anexar como parte",
                  onClick: () => {
                    void anexarA(existente.id).then(() =>
                      toast.success(`NF ${d.numero_documento ?? ""} anexada ao pagamento de ${fmt(Number(existente.valor))} como parte. Nenhum título novo.`),
                    );
                  },
                },
                duration: 30000,
              });
              return;
            }
            // ── Fracionado: o pagamento é MENOR que a nota (nota paga em duas
            // vezes): anexa-se ao que já foi pago e o restante vira parcela
            // em aberto, apontando a mesma nota.
            if (s.relacao === "parcial" && item.documentoId) {
              toast.info(`NF ${d.numero_documento ?? ""}: o pagamento de ${fmt(Number(existente.valor))}${quandoBr ? ` (${quandoBr})` : ""} é MENOR que a nota (${fmt(numeroBr(d.valor_total))}).`, {
                description: `${existente.descricao ?? "sem descrição"} — ${s.motivos.join(", ")}. ${fmt(s.restante)} ficam em aberto.`,
                action: {
                  label: "Anexar e lançar o restante",
                  onClick: () => {
                    void (async () => {
                      await anexarA(existente.id);
                      const r = await upsert.mutateAsync({
                        tipo,
                        natureza: tipo === "a_receber" ? "receita" : "despesa",
                        status: "previsto",
                        descricao: `${d.descricao || `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim()} (restante)`,
                        valor: s.restante,
                        data_competencia: d.data_emissao ?? hojeLocal(),
                        data_vencimento: d.data_vencimento ?? d.data_emissao ?? null,
                        data_emissao: d.data_emissao ?? null,
                        tipo_documento: (d.tipo_documento ?? "outro") as never,
                        numero_documento: d.numero_documento ?? null,
                        chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
                        documento_fiscal_id: item.documentoId,
                        parcela_pai_id: existente.id,
                      } as never);
                      const novoId = (r as { id?: string } | null)?.id ?? null;
                      invalidarFinanceiro();
                      toast.success(`NF ${d.numero_documento ?? ""}: PDF anexado ao pagamento de ${fmt(Number(existente.valor))}; restante de ${fmt(s.restante)} lançado em aberto${novoId ? "" : " (confira em Contas a Pagar)"}.`);
                    })();
                  },
                },
                duration: 30000,
              });
              return;
            }
            toast.info(`NF ${d.numero_documento ?? ""}: há lançamento parecido em Contas a ${tipo === "a_receber" ? "Receber" : "Pagar"} — nada foi criado.`, {
              description: `${existente.descricao ?? "sem descrição"} · ${fmt(Number(existente.valor))} — ${s.motivos.join(", ")}. Anexe o PDF ao lançamento certo, ou use Revisar para lançar mesmo assim.`,
              duration: 15000,
            });
            return;
          }
        } catch (e) {
          toast.warning(`Não foi possível conferir se a nota já foi ${tipo === "a_receber" ? "recebida" : "paga"}.`, { description: mensagemDeErro(e) });
        }
      }

      // Caminho sem vínculo: lançamento simples — com vencimento sempre, pela
      // mesma escada da RPC (`vencimento-do-titulo.ts`), e a nota do que foi assumido.
      const vencimento = vencimentoDoTitulo({
        informado: d.data_vencimento ?? null,
        emissao: d.data_emissao ?? null,
        hoje: hojeLocal(),
      });
      const r = await upsert.mutateAsync({
        tipo,
        natureza: tipo === "a_receber" ? "receita" : "despesa",
        status: "previsto",
        descricao:
          d.descricao ||
          `${(d.tipo_documento ?? "Documento").toString().toUpperCase()} ${d.numero_documento ?? ""}`.trim() ||
          item.file.name,
        valor: Number(d.valor_total),
        data_competencia: d.data_emissao ?? hojeLocal(),
        data_vencimento: vencimento.data,
        data_emissao: d.data_emissao ?? null,
        tipo_documento: (d.tipo_documento as any) ?? "outro",
        numero_documento: d.numero_documento ?? null,
        chave_acesso_nfe: normalizarChaveNfe(d.chave_nfe),
        observacoes: vencimento.nota,
      } as any);
      const novoId = (r as any)?.id ?? null;
      if (novoId) await anexarDocumento(item, novoId);
      setDocs((prev) => prev.map((x) => (x.id === item.id ? { ...x, lancamentoId: novoId ?? "ok" } : x)));
      invalidarFinanceiro();
    } catch {
      /* toast já exibido pelo hook */
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Largura de trabalho (30/09): o vínculo com 18 itens, a tabela por item e a cesta
            não cabem em 56rem — a janela ocupa a tela, e as instruções recolhem quando há arquivo. */}
        <DialogContent className="w-[min(98vw,96rem)] max-w-[min(98vw,96rem)] max-h-[calc(100vh-1.5rem)] grid-rows-[auto,minmax(0,1fr)] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <ScanLine className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Extração automática de documentos — {tipo === "a_receber" ? "Contas a Receber" : "Contas a Pagar"}
              <SeloPraefectusIA />
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Para NF-e, envie o <strong>XML</strong>: é o documento oficial e entra sem leitura por imagem.
                  DANFE em PDF é reconhecido pela chave e pede o XML. PDFs e imagens de cupom fiscal,
                  boleto, recibo e fatura passam pela leitura por IA.
                </p>
                {/* O caminho, dito antes de começar. Quem envia um documento
                    precisa saber que ele fica guardado, que a leitura é só uma
                    proposta, e que o lançamento exige um clique — três coisas
                    que a tela fazia e não contava. */}
                {/* Passos como lista sóbria (Design System v3): o número num
                    ladrilho neutro, o texto ao lado. `role="list"` porque
                    `list-none` faz alguns leitores de tela esquecerem que é
                    lista. */}
                {docs.length === 0 && <ol role="list" className="list-none space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">1</span>
                    <span>O arquivo é <strong>arquivado</strong> assim que chega — mesmo se a leitura falhar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">2</span>
                    <span>XML entra pelos dados oficiais; DANFE em PDF pede o XML da nota; o resto a IA lê e mostra para <strong>você conferir</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">3</span>
                    <span>Só ao clicar em <strong>Lançar</strong> nasce o {tipoLabel} em{' '}
                      <strong>{tipo === "a_receber" ? "Contas a Receber" : "Contas a Pagar"}</strong>.</span>
                  </li>
                </ol>}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto overscroll-contain px-6 pb-6 pr-4 min-h-0">
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Arraste arquivos aqui ou clique para selecionar"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                adicionar(Array.from(e.dataTransfer.files));
              }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={`cursor-pointer rounded-md border border-dashed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                docs.length > 0 ? "flex items-center gap-3 px-4 py-2 text-left" : "p-6 text-center"
              } ${dragOver ? "border-primary bg-primary-tint" : "border-input hover:border-primary hover:bg-primary-tint"}`}
            >
              {docs.length > 0 ? (
                <>
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-foreground"><span className="font-semibold">Enviar mais arquivos</span> <span className="text-muted-foreground">— arraste aqui ou clique. XML, PDF, JPG/PNG, até 15 MB cada.</span></p>
                </>
              ) : (
                <>
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                    <Upload className="h-5 w-5" />
                  </span>
                  <p className="text-base font-semibold text-foreground mt-2">
                    Arraste arquivos aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    XML (NF-e/NFS-e, o caminho certo para nota fiscal) • PDF (DANFE pela chave; cupom, boleto, recibo, fatura por OCR) • JPG/PNG — até 15 MB cada
                  </p>
                </>
              )}
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

            {/* Aviso — só enquanto não há arquivo: com arquivo, o espaço é do trabalho. */}
            {docs.length === 0 && <Alert variant="info">
              <Info className="w-4 h-4" aria-hidden="true" />
              <AlertDescription>
                <b>XMLs de NF-e/NFS-e</b> são lançados automaticamente, item a item (entrada/saída pelo CNPJ da empresa).
                <br />
                <b>DANFE em PDF</b> é reconhecido pela chave de acesso: se a nota já está lançada, o PDF é anexado a ela; senão, o sistema pede o XML.
                A leitura por imagem fica como escolha ("Ler por OCR mesmo assim").
                <br />
                <b>Cupom, boleto, recibo, fatura</b> (PDF ou imagem) passam por OCR multi-IA e abrem para revisão antes de virar lançamento.
              </AlertDescription>
            </Alert>}

            {/* Lista de docs */}
            {docs.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span><span className="font-semibold">{totalSelecionado}</span> arquivo(s)</span>
                      {totalOk > 0 && <Badge variant="success">{totalOk} lido(s)</Badge>}
                      {totalErro > 0 && <Badge variant="danger">{totalErro} erro(s)</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={limparTudo} disabled={processando}>
                        Limpar
                      </Button>
                      <Button size="sm" onClick={processarTodos} disabled={processando || docs.every((d) => d.status === "ok" || d.status === "erro")}>
                        {processando ? (
                          <><Loader2 className="animate-spin" aria-hidden="true" />Processando…</>
                        ) : (
                          <><ScanLine aria-hidden="true" />Processar todos</>
                        )}
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[calc(100vh-16rem)] min-h-[22rem] pr-3">
                    <div className="space-y-2">
                      {docs.map((d) => (
                        <div key={d.id} className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-card p-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                            {d.kind === "xml" && <FileText className="h-4 w-4" />}
                            {d.kind === "pdf" && <FileText className="h-4 w-4" />}
                            {d.kind === "image" && <ImageIcon className="h-4 w-4" />}
                            {d.kind === "outro" && <FileX className="h-4 w-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="min-w-0 truncate text-sm font-medium text-foreground">{d.file.name}</p>
                              <Badge variant="muted">{KIND_LABEL[d.kind]}</Badge>
                              {d.status === "ok" && (
                                // O nome do motor ("gemini_2.5_pro") é dado de
                                // engenharia, não de operação — na tela vira
                                // ruído. Fica no hover para diagnóstico.
                                <Badge variant="success" className="gap-1"
                                  title={d.motor ? `Lido por ${d.motor}` : undefined}>
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                  Lido
                                </Badge>
                              )}
                              {d.status === "erro" && (
                                <Badge variant="danger" className="gap-1">
                                  <AlertCircle className="w-3 h-3" aria-hidden="true" />Erro
                                </Badge>
                              )}
                              {d.status === "processando" && (
                                <Badge variant="muted" className="gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />Processando
                                </Badge>
                              )}
                              {d.lancamentoId && (
                                <Badge variant="success" className="gap-1">
                                  <FileCheck2 className="w-3 h-3" aria-hidden="true" />Lançado
                                </Badge>
                              )}
                              {/* O selo que faltava: o arquivo ficou. Aparece mesmo
                                  quando a leitura falhou — é esse o ponto. */}
                              {d.documentoId && (
                                <Badge variant="info" className="gap-1">
                                  <FileCheck2 className="w-3 h-3" aria-hidden="true" />Arquivado
                                </Badge>
                              )}
                            </div>

                            {d.status === "ok" && d.dados && (
                              <div className="text-xs text-muted-foreground mt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1">
                                {d.dados.emitente_nome && <span className="truncate" title={d.dados.emitente_nome}><b>Emit:</b> {d.dados.emitente_nome}</span>}
                                {d.dados.numero_documento && <span><b>Nº:</b> {d.dados.numero_documento}</span>}
                                {d.dados.data_emissao && <span><b>Emissão:</b> {d.dados.data_emissao}</span>}
                                {d.dados.data_vencimento && <span><b>Venc:</b> {d.dados.data_vencimento}</span>}
                                <span className="font-semibold text-foreground tabular-nums"><b>Valor:</b> {fmt(d.dados.valor_total)}</span>
                              </div>
                            )}
                            {/* Chave descartada não pode ser descarte silencioso: quem
                                revisa precisa saber que o campo ficou vazio de propósito,
                                e que a leitura da IA errou ali. */}
                            {d.status === "ok" && chaveNfeSuspeita(d.dados?.chave_nfe) && (
                              <p className="text-xs text-warning-ink mt-1">
                                A leitura devolveu {String(d.dados?.chave_nfe).replace(/\D/g, "").length} dígitos
                                onde a chave da NF-e tem 44 — provavelmente pegou o número da nota.
                                O campo será gravado vazio; cole a chave completa se precisar dela.
                              </p>
                            )}
                            {/* Avisos do saneamento do servidor (ex.: milhar
                                engolido no valor, corrigido por qtd×unitário).
                                Correção silenciosa é tão proibida quanto erro
                                silencioso. */}
                            {d.status === "ok" && Array.isArray((d.dados as any)?.avisos) &&
                              ((d.dados as any).avisos as string[]).map((a, i) => (
                                <p key={i} className="text-xs text-warning-ink mt-1">{a}</p>
                              ))}
                            {/* Erro de leitura com a mensagem real, no Alert
                                destrutivo — o texto é o mesmo de antes. */}
                            {d.erro && (
                              <Alert variant="destructive" className="mt-2">
                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                <AlertDescription>{d.erro}</AlertDescription>
                              </Alert>
                            )}
                            {/* Onde o arquivo foi parar.
                                Antes, o documento processado ficava num limbo: o
                                cartão mostrava os campos lidos e três botões, e
                                nada dizia que ainda faltava um clique nem para
                                onde o lançamento iria. Quem enviava a nota saía
                                da tela achando que tinha lançado. */}
                            {d.aguardandoXml && d.danfe && (() => {
                              const pastaCerta = pastaDaDirecao(d.danfe.direcao);
                              const pastaErrada = pastaCerta != null && pastaCerta !== tipo;
                              return (
                                <div className="mt-2 space-y-2 rounded-md border border-info-line bg-info-tint px-3 py-2" data-testid="danfe-aguardando-xml">
                                  <p className="text-sm font-semibold text-info-ink">
                                    DANFE da NF-e nº {d.danfe.numero}{d.danfe.serie ? ` · série ${d.danfe.serie}` : ""} — anexe o XML desta nota
                                  </p>
                                  <p className="text-xs text-info-ink tabular-nums">
                                    Chave {d.danfe.chave.replace(/(\d{4})(?=\d)/g, "$1 ")} · emitente CNPJ {d.danfe.cnpj_emitente.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")} · {d.danfe.competencia.split("-").reverse().join("/")}
                                    {d.danfe.valor_total ? ` · ${fmt(d.danfe.valor_total)}` : ""}
                                  </p>
                                  <p className="text-xs text-info-ink">
                                    O DANFE é a impressão do XML; a leitura por imagem erra número, valor e itens. Com o XML a nota entra
                                    com os dados oficiais, item a item, e este PDF fica anexado ao título.
                                  </p>
                                  {pastaErrada && (
                                    <p className="text-xs font-medium text-warning-ink">
                                      {d.danfe.direcao === "entrada"
                                        ? "Esta NF-e foi emitida por outro CNPJ: é nota de ENTRADA e pertence a Contas a Pagar."
                                        : "Esta NF-e foi emitida pela própria empresa: é nota de SAÍDA e pertence a Contas a Receber."}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      ref={(el) => { xmlInputs.current[d.id] = el; }}
                                      type="file"
                                      accept=".xml,text/xml,application/xml"
                                      className="hidden"
                                      aria-label={`XML da NF-e ${d.danfe.numero}`}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        e.target.value = "";
                                        if (f) void anexarXmlAoDanfe(d, f);
                                      }}
                                    />
                                    <Button size="sm" onClick={() => xmlInputs.current[d.id]?.click()}>
                                      <FileCode2 aria-hidden="true" />Anexar o XML desta nota
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => void buscarXmlNaSefaz(d)} title="Busca o XML na SEFAZ com o certificado A1 da empresa (NFeDistribuicaoDFe)">
                                      <Link2 aria-hidden="true" />Buscar o XML na SEFAZ
                                    </Button>
                                    {Array.isArray(d.dados?.itens) && d.dados.itens.length > 0 ? (
                                      <Button size="sm" variant="outline" onClick={() => seguirComALeitura(d)} title="A leitura por imagem já foi feita: usa o que ela leu, sem o XML">
                                        <ScanLine aria-hidden="true" />Seguir com a leitura por imagem ({d.dados.itens.length} linhas)
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline" onClick={() => void lerDanfePorOcr(d)}>
                                        <ScanLine aria-hidden="true" />Ler por OCR mesmo assim
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            {d.status === "ok" && !d.lancamentoId && !d.dados?._ja_lancada && !d.aguardandoXml && (
                              <div className="mt-2 rounded-md border border-dashed border-warning-line bg-warning-tint px-3 py-2">
                                <p className="text-sm font-semibold text-warning-ink">
                                  Ainda não lançado
                                </p>
                                <p className="text-xs text-warning-ink">
                                  O documento já está arquivado. Clique em <strong>Lançar e vincular</strong> para
                                  criar o {tipoLabel} em {tipo === "a_receber" ? "Contas a Receber" : "Contas a Pagar"},
                                  ou em <strong>Revisar</strong> para conferir os campos antes.
                                </p>
                              </div>
                            )}
                            {d.lancamentoId && (
                              <div className="mt-2 rounded-md border border-success-line bg-success-tint px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-success-ink">
                                    Lançado em {tipo === "a_receber" ? "Contas a Receber" : "Contas a Pagar"}
                                  </p>
                                  <p className="text-xs text-success-ink tabular-nums">
                                    {d.dados?.valor_total ? fmt(Number(d.dados.valor_total)) : "Valor a conferir"}
                                    {d.documentoId ? " · documento arquivado junto" : " · documento NÃO arquivado"}
                                  </p>
                                  {d.dados?._danfe_anexado && (
                                    <p className="text-xs text-success-ink">
                                      A NF-e {d.dados?.numero_documento ?? ""} já estava lançada: este DANFE foi anexado ao título existente, sem criar outro.
                                    </p>
                                  )}
                                </div>
                                {/* Fechar É a ação: o modal cobre a própria
                                    lista de Contas a Receber/Pagar, e o
                                    lançamento novo está nela. "Ver na lista"
                                    prometia navegação que não existia. */}
                                <Button size="sm" variant="outline" className="shrink-0"
                                  title="Fecha esta janela — o lançamento está na lista logo atrás"
                                  onClick={() => onOpenChange(false)}>
                                  Fechar e ver a lista
                                </Button>
                              </div>
                            )}
                            {d.dados?._ja_lancada && !d.lancamentoId && (
                              <p className="text-xs text-success-ink mt-1">
                                {d.dados?._danfe_anexado
                                  ? `NF-e ${d.dados?.numero_documento ?? ""} já estava lançada: o DANFE foi anexado ao título existente.`
                                  : `Lançado pelo XML como ${d.dados._direcao === "saida" ? "receita" : d.dados._direcao === "entrada" ? "despesa" : "título"}${d.kind === "pdf" ? "; o DANFE ficou anexado ao título" : ""}.`}
                                {" "}Para o pedido nascer em Gestão de Contratos, abra <b>Vinculado a contrato</b>, marque os itens e clique em <b>Vincular ao contrato</b>.
                              </p>
                            )}

                            {/* Bloco de vínculo com Gestão (Contrato/ATA) */}
                            {d.status === "ok" && !d.lancamentoId && !d.aguardandoXml && (
                              <div className="mt-2">
                                <Button
                                  type="button"
                                  variant="link"
                                  aria-expanded={!!d.vincularExpandido}
                                  onClick={() => toggleVincular(d.id)}
                                  /* whitespace-normal/text-left desfazem o whitespace-nowrap
                                     da base do buttonVariants: o rótulo longo ("Vincular a
                                     contrato/ATA SRP" + dois ícones) envolve no mobile em vez
                                     de empurrar a largura do cartão dentro do ScrollArea. */
                                  className="h-auto gap-1 px-0 py-0 font-medium whitespace-normal text-left"
                                >
                                  <Link2 className="w-4 h-4" aria-hidden="true" />
                                  {d.vinculo?.contrato_id
                                    ? "Vinculado a contrato"
                                    : "Vincular a contrato/ATA SRP"}
                                  {d.vincularExpandido ? (
                                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                  )}
                                </Button>
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
                                      quantidadeDaNota={d.dados?.quantidade_total ?? null}
                                      itensDaNota={Array.isArray(d.dados?.itens) ? d.dados.itens : null}
                                      dataDoDocumento={d.dados?.data_emissao ?? null}
                                      value={d.vinculo ?? VINCULO_VAZIO}
                                      onChange={(v) => setVinculo(d.id, v)}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* flex-wrap no card + linha no mobile: quando a coluna de botões
                              não cabe ao lado, ela DESCE inteira em vez de ser cortada pela
                              borda do modal — "Lançar e vinc…" truncado era isso. */}
                          <div className="flex flex-row sm:flex-col flex-wrap gap-2 shrink-0 ml-auto">
                            {d.status === "ok" && d.dados?._ja_lancada && !d.lancamentoId && d.vinculo?.contrato_id && (
                              <Button size="sm" variant="default" onClick={() => void vincularXmlAoContrato(d)} disabled={upsert.isPending || !!d.vinculando}>
                                {d.vinculando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}{d.vinculando ? "Vinculando…" : "Vincular ao contrato"}
                              </Button>
                            )}
                            {d.status === "ok" && !d.dados?._ja_lancada && !d.lancamentoId && !d.aguardandoXml && (
                              <>
                                <Button size="sm" variant="default" onClick={() => lancarRapido(d)} disabled={upsert.isPending}>
                                  {d.vinculo?.contrato_id ? "Lançar e vincular" : "Lançar"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => abrirEditorComDados(d)}>
                                  <Pencil aria-hidden="true" />Revisar
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => removerItem(d.id)} disabled={d.status === "processando"}>
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
        onOpenChange={(v) =>
          setEditor((s) => (v ? { ...s, open: true } : { open: false, initial: null, docId: null }))
        }
        initial={editor.initial}
        defaultTipo={tipo}
        onSaved={(saved) => {
          const doc = editor.docId ? docs.find((x) => x.id === editor.docId) ?? null : null;
          if (editor.docId) {
            setDocs((prev) =>
              prev.map((x) =>
                x.id === editor.docId ? { ...x, lancamentoId: saved?.id ?? "ok" } : x,
              ),
            );
          }
          invalidarFinanceiro();
          // O título salvo pelo Revisar ganha o pedido/lote do contrato (30/09).
          if (doc?.vinculo?.contrato_id && saved?.id) {
            void vincularAoContrato(doc, { id: saved.id, valor: saved.valor != null ? Number(saved.valor) : null });
          }
        }}
      />
    </>
  );
}
