import { useEffect, useMemo, useRef, useState } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useDocumentoFiscal } from "@/hooks/useDocumentoFiscal";
import { parseNFeXML } from "@/lib/parseNFe";
import { conferirContraOLancamento, chaveValida, type Divergencia } from "@/lib/financeiro/nfe-para-lancamento";
import { ROTULO_DO_MODELO } from "@/lib/financeiro/danfe";
import { perfilDoAnexo } from "@/lib/financeiro/anexo-do-lancamento";
import { acharLinhaDigitavel, lerLinhaDigitavel } from "@/lib/financeiro/boleto";
import { chaveDeAcessoValida, dadosDaChave } from "@/lib/financeiro/danfe";
import { hojeLocal as hojeISO } from "@/lib/financeiro/data-local";
import { lerDanfeEmPdf, consolidar } from "@/lib/financeiro/ler-danfe";
import { abrirEspelho } from "@/lib/financeiro/espelho-da-nfe";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, TrendingUp, TrendingDown, ArrowLeftRight, AlertCircle, Link2 } from "lucide-react";
import type { LancamentoParaVincular } from "@/lib/contratos/pedido-do-lancamento";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useContas,
  useCategorias,
  usePessoas,
  useUpsertLancamento,
  useGerarParcelas,
  useMembrosEmpresa,
  useFinProjetos,
  calcularSerieParcelas,
  type Lancamento,
  type Periodicidade,
  type RegraFimSemana,
  type ModoParcelamento,
} from "@/hooks/useFinanceiro";
import type { Database } from "@/integrations/supabase/types";
import RateioCentroCustoEditor from "./RateioCentroCustoEditor";

type Tipo = Database["public"]["Enums"]["financeiro_tipo_lancamento"];
type Status = Database["public"]["Enums"]["financeiro_status_lancamento"];
type Natureza = Database["public"]["Enums"]["financeiro_natureza"];
type TipoDocumento = Database["public"]["Enums"]["financeiro_tipo_documento"];

const TIPO_DOC_OPTIONS: { value: TipoDocumento; label: string }[] = [
  { value: "nfe", label: "NF-e (Mercadoria)" },
  { value: "nfse", label: "NFS-e (Serviço)" },
  { value: "nfce", label: "NFC-e (Consumidor)" },
  { value: "cte", label: "CT-e (Transporte)" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "duplicata", label: "Duplicata" },
  { value: "fatura", label: "Fatura" },
  { value: "contrato", label: "Contrato" },
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
  { value: "darf", label: "DARF" },
  { value: "das", label: "DAS" },
  { value: "gps", label: "GPS (INSS)" },
  { value: "gnre", label: "GNRE" },
  { value: "outro", label: "Outros" },
];

const FORMAS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cheque", label: "Cheque" },
  { value: "debito_automatico", label: "Débito automático" },
  { value: "transferencia", label: "Transferência" },
];

const TIPO_OPTIONS = [
  { value: "a_pagar", label: "A Pagar", icon: TrendingDown },
  { value: "a_receber", label: "A Receber", icon: TrendingUp },
  { value: "movimento_bancario", label: "Mov. Bancário", icon: ArrowLeftRight },
  { value: "transferencia", label: "Transferência", icon: ArrowLeftRight },
] as const;

const STATUS_OPTIONS = [
  { value: "previsto", label: "Previsto", active: "bg-info text-info-foreground border-info" },
  { value: "realizado", label: "Realizado", active: "bg-success text-success-foreground border-success" },
  { value: "conciliado", label: "Conciliado", active: "bg-success text-success-foreground border-success" },
  { value: "em_atraso", label: "Em atraso", active: "bg-destructive text-destructive-foreground border-destructive" },
  { value: "cancelado", label: "Cancelado", active: "bg-muted-foreground text-background border-muted-foreground" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Lancamento> | null;
  defaultTipo?: Tipo;
  onSaved?: (lancamento: Lancamento) => void;
  /** Quando o pai sabe abrir o diálogo do elo, o toast pós-salvar ganha o
   *  botão "Vincular agora" — a ponte entre criar a receber com nota e o
   *  vínculo com contrato deixa de depender de a pessoa descobrir o ícone. */
  onVincularContrato?: (l: LancamentoParaVincular) => void;
};

const today = () => hojeLocal();

export default function LancamentoDialog({ open, onOpenChange, initial, defaultTipo, onSaved, onVincularContrato }: Props) {
  const { data: contas = [] } = useContas();
  const { data: categorias = [] } = useCategorias();
  const { data: pessoas = [] } = usePessoas();
  const { data: membros = [] } = useMembrosEmpresa();
  const { data: projetos = [] } = useFinProjetos();
  const upsert = useUpsertLancamento();
  const gerarParcelas = useGerarParcelas();

  const [tipo, setTipo] = useState<Tipo>("a_pagar");
  const [natureza, setNatureza] = useState<Natureza>("despesa");
  const [status, setStatus] = useState<Status>("previsto");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dataCompetencia, setDataCompetencia] = useState(today());
  const [dataVencimento, setDataVencimento] = useState<string>("");
  const [dataRealizado, setDataRealizado] = useState<string>("");
  const [contaId, setContaId] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [pessoaId, setPessoaId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  // Documento fiscal
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | "">("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [serieDocumento, setSerieDocumento] = useState("");
  const [chaveAcessoNfe, setChaveAcessoNfe] = useState("");
  const [dataEmissao, setDataEmissao] = useState<string>("");

  // Cobrança / acréscimos / descontos
  const [valorJuros, setValorJuros] = useState(0);
  const [valorMulta, setValorMulta] = useState(0);
  const [valorDesconto, setValorDesconto] = useState(0);
  const [valorTarifa, setValorTarifa] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<string>("");

  // Parcelamento / Repetições
  const [parcelar, setParcelar] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState<number>(2);
  const [modoParc, setModoParc] = useState<ModoParcelamento>("dividir");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("mensal");
  const [intervaloDias, setIntervaloDias] = useState<number>(30);
  const [regraFds, setRegraFds] = useState<RegraFimSemana>("manter");
  const [diaFixo, setDiaFixo] = useState<string>("");
  const [simulacaoEdits, setSimulacaoEdits] = useState<Record<number, { vencimento?: string; valor?: number }>>({});

  // Transferência entre contas
  const [contaDestinoId, setContaDestinoId] = useState<string>("");

  // Departamento e projeto
  const [departamento, setDepartamento] = useState<string>("");
  const [projetoId, setProjetoId] = useState<string>("");

  // Vendedor responsável
  const [vendedorId, setVendedorId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTipo((initial?.tipo as Tipo) ?? defaultTipo ?? "a_pagar");
    setNatureza((initial?.natureza as Natureza) ?? "despesa");
    setStatus((initial?.status as Status) ?? "previsto");
    setDescricao(initial?.descricao ?? "");
    setValor(Number(initial?.valor ?? 0));
    setDataCompetencia(initial?.data_competencia ?? today());
    setDataVencimento(initial?.data_vencimento ?? "");
    setDataRealizado(initial?.data_realizado ?? "");
    setContaId(initial?.conta_id ?? "");
    setCategoriaId(initial?.categoria_id ?? "");
    setPessoaId(initial?.pessoa_id ?? "");
    setObservacoes(initial?.observacoes ?? "");
    setTipoDocumento(((initial as any)?.tipo_documento as TipoDocumento) ?? "");
    setNumeroDocumento((initial as any)?.numero_documento ?? "");
    setSerieDocumento((initial as any)?.serie_documento ?? "");
    setChaveAcessoNfe((initial as any)?.chave_acesso_nfe ?? "");
    setDataEmissao((initial as any)?.data_emissao ?? "");
    setValorJuros(Number((initial as any)?.valor_juros ?? 0));
    setValorMulta(Number((initial as any)?.valor_multa ?? 0));
    setValorDesconto(Number((initial as any)?.valor_desconto ?? 0));
    setValorTarifa(Number((initial as any)?.valor_tarifa ?? 0));
    setFormaPagamento((initial as any)?.forma_pagamento ?? "");
    setDepartamento((initial as any)?.departamento ?? "");
    setProjetoId((initial as any)?.projeto_id ?? "");
    setVendedorId((initial as any)?.vendedor_responsavel_id ?? "");
    setContaDestinoId((initial as any)?.conta_destino_id ?? "");
    setParcelar(false);
    setQtdParcelas(2);
    setModoParc("dividir");
    setPeriodicidade("mensal");
    setIntervaloDias(30);
    setRegraFds("manter");
    setDiaFixo("");
    setSimulacaoEdits({});
  }, [open, initial, defaultTipo]);

  useEffect(() => {
    if (tipo === "a_receber") setNatureza("receita");
    else if (tipo === "a_pagar") setNatureza("despesa");
    else setNatureza("movimentacao");
  }, [tipo]);

  // A competência acompanha a data de pagamento QUANDO O USUÁRIO A DIGITA —
  // nunca por efeito de carga. O useEffect antigo disparava também quando o
  // diálogo abria um lançamento existente: editar a descrição de uma NF de
  // competência 15/08 paga em 05/09 regravava a competência como 05/09 e
  // mudava dois meses do DRE (C7 da auditoria). A sincronização vive agora no
  // onChange do campo de pagamento.

  const valorLiquido = useMemo(
    () => Math.max(0, Number(valor) + Number(valorJuros) + Number(valorMulta) + Number(valorTarifa) - Number(valorDesconto)),
    [valor, valorJuros, valorMulta, valorDesconto, valorTarifa],
  );

  const editando = !!initial?.id;
  const { empresaAtiva } = useEmpresa();
  const { guardarArquivo, abrirArquivo } = useDocumentoFiscal();
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  // Os arquivos esperam o Salvar. Anexar não é registrar — e um lançamento
  // novo ainda nem tem id ao qual o documento possa se prender.
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);
  const [arquivoXml, setArquivoXml] = useState<File | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  /** Onde a leitura do DANFE está — nulo quando não há leitura em curso. */
  const [lendoDanfe, setLendoDanfe] = useState<string | null>(null);
  /**
   * O bloco fala a língua do documento que está ali.
   *
   * "Anexar a NF-e" numa guia do INSS ou num comprovante de PIX ensina a
   * pessoa que aquela porta não é para ela — e o documento deixa de ser
   * guardado por uma frase.
   */
  const perfil = perfilDoAnexo(tipoDocumento);
  /**
   * O que foi lido da nota, guardado com o documento.
   *
   * É por aqui que os ITENS chegam ao vínculo com contrato: `ocr_data` já
   * existia em `financeiro_documentos_fiscais` para isso, e estava sempre
   * nulo.
   */
  const [nfeLida, setNfeLida] = useState<unknown>(null);
  /**
   * O documento que JÁ está guardado neste lançamento.
   *
   * Faltava buscar isto, e a falta enganava: depois de salvar, a aba voltava a
   * mostrar o convite para anexar, exatamente como antes do upload. Quem
   * reabria concluía que o arquivo não tinha sido guardado — e anexava de
   * novo, criando o segundo registro do mesmo papel.
   */
  const [docGuardado, setDocGuardado] = useState<{
    id: string; arquivo_nome: string; storage_path: string; arquivo_xml: string | null;
  } | null>(null);
  const [abrindoDoc, setAbrindoDoc] = useState(false);

  useEffect(() => {
    if (!open || !initial?.id) { setDocGuardado(null); return; }
    let vivo = true;
    supabase
      .from("financeiro_documentos_fiscais" as never)
      .select("id, arquivo_nome, storage_path, arquivo_xml")
      .eq("lancamento_id", initial.id)
      .limit(1)
      .then(({ data }) => {
        if (!vivo) return;
        setDocGuardado((data as unknown as Array<{
          id: string; arquivo_nome: string; storage_path: string; arquivo_xml: string | null;
        }> | null)?.[0] ?? null);
      });
    return () => { vivo = false; };
  }, [open, initial?.id]);

  const abrirDocGuardado = async () => {
    if (!docGuardado) return;
    setAbrindoDoc(true);
    const url = await abrirArquivo(docGuardado.storage_path);
    setAbrindoDoc(false);
    if (!url) { toast.error("Não foi possível abrir o documento."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /**
   * O último recurso: OCR genérico, para o que não tem código conferível.
   *
   * Recibo, RPA, cupom de papel e NFS-e municipal não têm chave nem linha
   * digitável. `ocr-document-financeiro` já existia no sistema — lê justamente
   * esta família — e estava alcançável só por duas telas separadas.
   *
   * ── O que a IA lê, a aritmética confere ─────────────────────────────────
   *
   * Ela devolve `chave_nfe` e `codigo_barras` junto do resto. Esses dois têm
   * dígito verificador: passando pelo DV, deixam de ser leitura e viram fato —
   * e o valor e o vencimento saem do código, não do que a IA achou que leu.
   *
   * O que sobra sem código é preenchido do mesmo jeito, mas ANUNCIADO como
   * leitura. Dado conferido e dado adivinhado não podem ter a mesma cara.
   */
  const lerPorOcr = async (arquivo: File): Promise<boolean> => {
    setLendoDanfe("Lendo o documento…");
    try {
      let dataUrl: string | null = null;
      if (/^image\//.test(arquivo.type)) {
        dataUrl = await new Promise<string | null>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(typeof r.result === "string" ? r.result : null);
          r.onerror = () => ok(null);
          r.readAsDataURL(arquivo);
        });
      } else {
        const { primeiraPaginaComoImagem } = await import("@/lib/pdf-text-extractor");
        dataUrl = await primeiraPaginaComoImagem(arquivo);
      }
      if (!dataUrl) return false;

      const { data, error } = await supabase.functions.invoke("ocr-document-financeiro", {
        body: { imageDataUrl: dataUrl },
      });
      const d = (data as { dados?: Record<string, unknown> } | null)?.dados;
      if (error || !d) return false;

      const preencheu: string[] = [];
      const conferidos: string[] = [];

      // Primeiro o que tem DV: se fecha, é fato, e manda sobre o resto.
      const chave = chaveDeAcessoValida(d.chave_nfe);
      if (chave && !chaveValida(chaveAcessoNfe)) {
        setChaveAcessoNfe(chave);
        const dc = dadosDaChave(chave)!;
        if (!numeroDocumento.trim()) setNumeroDocumento(dc.numero);
        if (!serieDocumento.trim()) setSerieDocumento(dc.serie);
        conferidos.push("chave de acesso");
      }
      const boleto = d.codigo_barras ? lerLinhaDigitavel(d.codigo_barras, hojeISO()) : null;
      if (boleto) {
        if (boleto.valor != null && !valor) setValor(boleto.valor);
        if (boleto.vencimento && !dataVencimento) setDataVencimento(boleto.vencimento);
        if (!numeroDocumento.trim()) setNumeroDocumento(boleto.linha);
        conferidos.push("linha digitável");
      }

      // Depois o que não tem como conferir.
      const num = (k: string) => { const n = Number(d[k]); return Number.isFinite(n) && n > 0 ? n : null; };
      const txt = (k: string) => (typeof d[k] === "string" && d[k] ? String(d[k]) : null);
      if (!boleto && num("valor_total") && !valor) { setValor(num("valor_total")!); preencheu.push("valor"); }
      if (!boleto && txt("data_vencimento") && !dataVencimento) { setDataVencimento(txt("data_vencimento")!); preencheu.push("vencimento"); }
      if (txt("data_emissao") && !dataEmissao) { setDataEmissao(txt("data_emissao")!); preencheu.push("emissão"); }
      if (!chave && !boleto && txt("numero_documento") && !numeroDocumento.trim()) {
        setNumeroDocumento(txt("numero_documento")!); preencheu.push("número");
      }
      if (txt("tipo_documento") && !tipoDocumento) {
        setTipoDocumento(txt("tipo_documento") as TipoDocumento);
      }

      if (conferidos.length === 0 && preencheu.length === 0) return false;
      toast.success(
        conferidos.length > 0
          ? `Documento lido. Conferido por ${conferidos.join(" e ")}.`
          : `Documento lido: ${preencheu.join(", ")}.`,
        {
          description: preencheu.length > 0
            // A frase existe para que o dado lido não passe por dado conferido.
            ? `${preencheu.join(", ")} — leitura por IA, sem dígito verificador. Confira antes de salvar.`
            : undefined,
        },
      );
      return true;
    } catch {
      return false;
    } finally {
      setLendoDanfe(null);
    }
  };

  /**
   * Lê o boleto ou a guia pela linha digitável.
   *
   * A linha é o equivalente da chave de acesso para o que se paga: tem dígito
   * verificador e carrega VALOR e VENCIMENTO. Não depende de layout nem de o
   * OCR acertar coluna — ou os dígitos fecham, ou não é linha digitável.
   *
   * Preencher e sobrescrever seguem a mesma regra do XML: campo vazio recebe;
   * campo preenchido que discorda apenas aparece. Vale sobretudo para o valor
   * de um lançamento já conciliado, que veio do extrato e não se corrige por
   * boleto — juros e multa fazem o pago diferir do impresso legitimamente.
   */
  const lerBoleto = async (arquivo: File): Promise<boolean> => {
    setLendoDanfe("Procurando a linha digitável…");
    try {
      const { extractTextFromFile } = await import("@/lib/pdf-text-extractor");
      const texto = await extractTextFromFile(arquivo, 3, false, 2);
      const b = acharLinhaDigitavel(texto, hojeISO());
      if (!b) return false;

      const preencheu: string[] = [];
      const divergentes: Divergencia[] = [];

      if (b.valor != null) {
        if (!valor) { setValor(b.valor); preencheu.push("valor"); }
        else if (Math.abs(Number(valor) - b.valor) > 0.005) {
          divergentes.push({
            campo: "Valor",
            noSistema: Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            naNota: b.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          });
        }
      }
      if (b.vencimento) {
        if (!dataVencimento) { setDataVencimento(b.vencimento); preencheu.push("vencimento"); }
        else if (dataVencimento !== b.vencimento) {
          divergentes.push({ campo: "Vencimento", noSistema: dataVencimento, naNota: b.vencimento });
        }
      }
      if (!numeroDocumento.trim()) { setNumeroDocumento(b.linha); preencheu.push("linha digitável"); }
      if (!tipoDocumento) {
        setTipoDocumento((b.formato === "arrecadacao" ? "darf" : "boleto") as TipoDocumento);
      }
      setDivergencias(divergentes);

      toast.success(
        preencheu.length > 0
          ? `${b.formato === "arrecadacao" ? "Guia" : "Boleto"} lido: ${preencheu.join(", ")} preenchido(s).`
          : "Linha digitável conferida — os campos já estavam preenchidos.",
        {
          description: divergentes.length > 0
            ? `${divergentes.length} divergência(s) apontada(s) — nada foi alterado nelas.`
            : (b.formato === "arrecadacao" ? "Guia de arrecadação não carrega vencimento." : undefined),
        },
      );
      return true;
    } catch {
      return false;
    } finally {
      setLendoDanfe(null);
    }
  };

  /**
   * Lê o DANFE em PDF, quando não veio XML.
   *
   * Dois passos, em `lib/financeiro/ler-danfe.ts`: a CHAVE (local, instantânea,
   * com dígito verificador) e depois `extrair-dados-nfe-pdf` — a leitura por IA
   * que já existia no sistema, usada em Gestão de Compras desde antes.
   *
   * A chave dá número, série e competência de graça e sem errar. A IA traz o
   * que a chave não codifica: o dia da emissão, o valor e os ITENS. Os itens
   * são a razão de valer a chamada — sem eles, vincular a nota a um contrato
   * exige calcular a quantidade de cabeça.
   */
  const lerDanfe = async (pdf: File): Promise<boolean> => {
    setLendoDanfe("Lendo…");
    try {
      const leitura = await lerDanfeEmPdf(pdf, (m) => setLendoDanfe(m));
      const nfe = consolidar(leitura);
      // Devolve `false` em vez de avisar: quem chamou tem mais uma carta na
      // manga — o OCR genérico —, e um aviso aqui anunciaria derrota antes da
      // última tentativa.
      if (!nfe) return false;
      setNfeLida(nfe);

      const { preencher, divergencias: achadas } = conferirContraOLancamento(nfe, {
        numero_documento: numeroDocumento,
        serie_documento: serieDocumento,
        chave_acesso_nfe: chaveAcessoNfe,
        data_emissao: dataEmissao,
        valor,
      });
      if (preencher.numero_documento) setNumeroDocumento(preencher.numero_documento);
      if (preencher.serie_documento) setSerieDocumento(preencher.serie_documento);
      if (preencher.chave_acesso_nfe) setChaveAcessoNfe(preencher.chave_acesso_nfe);
      if (preencher.data_emissao) setDataEmissao(preencher.data_emissao);
      if (preencher.valor != null) setValor(preencher.valor);
      if (!tipoDocumento && leitura.daChave && ROTULO_DO_MODELO[leitura.daChave.modelo]) {
        setTipoDocumento(ROTULO_DO_MODELO[leitura.daChave.modelo] as TipoDocumento);
      }
      setDivergencias(achadas);

      const n = Object.keys(preencher).length;
      const itens = nfe.itens?.length ?? 0;
      toast.success(
        n > 0 ? `DANFE lido: ${n} campo(s) preenchido(s).` : "DANFE lido — os campos já estavam preenchidos.",
        {
          description: [
            itens > 0 ? `${itens} item(ns) lido(s) — a quantidade vai junto para o vínculo com contrato.` : null,
            // A contradição não muda nada no formulário, mas é sinal de leitura
            // ruim do papel: quem confere merece saber.
            leitura.contradicoes.length > 0
              ? `A leitura do papel discordou da chave em: ${leitura.contradicoes.join(", ")} — a chave prevaleceu.`
              : null,
            achadas.length > 0 ? `${achadas.length} divergência(s) apontada(s) abaixo.` : null,
          ].filter(Boolean).join(" ") || undefined,
        },
      );
      return true;
    } catch {
      return false;
    } finally {
      setLendoDanfe(null);
    }
  };

  /**
   * Lê o XML e preenche o que está em branco.
   *
   * Preencher e sobrescrever são coisas diferentes, e a distinção mora em
   * `conferirContraOLancamento`: campo vazio recebe o que o documento diz;
   * campo preenchido que discorda apenas aparece. O caso que obriga a isso é o
   * valor de um lançamento conciliado — ele veio do extrato e não se corrige
   * por nota.
   */
  const receberArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const escolhidos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (escolhidos.length === 0) return;

    const xml = escolhidos.find((f) => /\.xml$/i.test(f.name));
    // Foto e PDF ocupam o mesmo lugar: é o arquivo que se abre depois. Recibo
    // se fotografa, e comprovante de PIX é print de celular.
    const principal = escolhidos.find((f) => !/\.xml$/i.test(f.name));
    if (principal) setArquivoPdf(principal);
    if (xml) setArquivoXml(xml);

    if (!xml) {
      if (!principal) { toast.error("Escolha um arquivo."); return; }
      // Só tenta ler onde há o que ler. Procurar chave de acesso num boleto
      // gasta OCR e uma chamada de IA para não achar nada — e o aviso de
      // "chave não encontrada" seria verdadeiro e inútil.
      // ── A cascata: exato primeiro, caro por último ─────────────────────
      //
      // Linha digitável e chave de acesso custam nada e não erram — ou os
      // dígitos fecham, ou não são. Só o que sobra vai para a IA, que custa
      // uma chamada e pode ler errado.
      const ehPdf = /\.pdf$/i.test(principal.name);
      if (perfil.leLinhaDigitavel && ehPdf && await lerBoleto(principal)) return;
      if (perfil.leChave && ehPdf && await lerDanfe(principal)) return;
      if (await lerPorOcr(principal)) return;
      toast.success("Arquivo anexado.", {
        description: "Nada foi lido dele — preencha os campos à mão. Será guardado ao salvar.",
      });
      return;
    }
    if (!perfil.leXml) {
      toast.success("Arquivo anexado.", { description: "Será guardado ao salvar o lançamento." });
      return;
    }

    try {
      const nfe = parseNFeXML(await xml.text());
      setNfeLida(nfe);
      const { preencher, divergencias: achadas } = conferirContraOLancamento(nfe, {
        numero_documento: numeroDocumento,
        serie_documento: serieDocumento,
        chave_acesso_nfe: chaveAcessoNfe,
        data_emissao: dataEmissao,
        valor,
      });
      if (preencher.numero_documento) setNumeroDocumento(preencher.numero_documento);
      if (preencher.serie_documento) setSerieDocumento(preencher.serie_documento);
      if (preencher.chave_acesso_nfe) setChaveAcessoNfe(preencher.chave_acesso_nfe);
      if (preencher.data_emissao) setDataEmissao(preencher.data_emissao);
      if (preencher.valor != null) setValor(preencher.valor);
      // A NF-e modelo 55 é de mercadoria. Só define quando o campo está vazio:
      // quem escolheu NFS-e à mão sabe de algo que o modelo não diz.
      if (!tipoDocumento) setTipoDocumento("nfe" as TipoDocumento);
      setDivergencias(achadas);

      const n = Object.keys(preencher).length;
      toast.success(
        n > 0 ? `XML lido: ${n} campo(s) preenchido(s).` : "XML lido — os campos já estavam preenchidos.",
        { description: achadas.length > 0 ? `${achadas.length} divergência(s) apontada(s) abaixo.` : undefined },
      );
    } catch {
      // Arquivo ilegível não impede o anexo: o XML continua sendo o documento
      // fiscal, e guardá-lo vale mesmo quando a leitura falha.
      toast.warning("O XML foi anexado, mas não pôde ser lido.", {
        description: "Preencha os campos à mão — o arquivo será guardado assim mesmo.",
      });
    }
  };
  const podeParcelar = !editando && (tipo === "a_pagar" || tipo === "a_receber");
  const temAcrescimos = valorJuros > 0 || valorMulta > 0 || valorDesconto > 0 || valorTarifa > 0;

  const simulacao = useMemo(() => {
    if (!parcelar || !podeParcelar || qtdParcelas < 2 || !dataVencimento) return [];
    const base = calcularSerieParcelas({
      parcelas: qtdParcelas,
      data_vencimento: dataVencimento,
      data_competencia: dataCompetencia || undefined,
      valor_total: valor,
      periodicidade,
      intervalo_dias: intervaloDias,
      modo: modoParc,
      regra_fim_semana: regraFds,
      dia_fixo: diaFixo ? Math.max(1, Math.min(31, parseInt(diaFixo, 10))) : null,
    });
    return base.map((d, i) => ({
      ...d,
      vencimento: simulacaoEdits[i]?.vencimento ?? d.vencimento,
      valor: simulacaoEdits[i]?.valor ?? d.valor,
    }));
  }, [parcelar, podeParcelar, qtdParcelas, dataVencimento, dataCompetencia, valor, periodicidade, intervaloDias, modoParc, regraFds, diaFixo, simulacaoEdits]);

  const totalSerie = useMemo(() => simulacao.reduce((s, d) => s + (Number(d.valor) || 0), 0), [simulacao]);


  const isTransferencia = tipo === "transferencia";

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast.error("Informe uma descrição para o lançamento.");
      return;
    }
    if (!valor || valor <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (isTransferencia && !contaDestinoId) {
      toast.error("Informe a conta de destino da transferência.");
      return;
    }

    // ── A nota já lançada ────────────────────────────────────────────────────
    //
    // O caminho que leva aqui por engano é curto e comum: a pessoa tem a NF-e
    // na mão, quer relacioná-la a um contrato, e "Novo recebimento" parece o
    // começo natural. Só que o lançamento pode já existir — vindo do extrato,
    // de uma importação, ou de meses atrás.
    //
    // O gêmeo não avisa. Ele DOBRA o valor no fluxo de caixa, no DRE e no
    // saldo da conta, e a divergência só aparece na conciliação seguinte, sem
    // nada que aponte a origem. Já vinculado a um contrato, dobraria também o
    // consumo do saldo contratual.
    //
    // Aviso, não bloqueio: nota desdobrada em parcelas legitimamente repete o
    // número, e quem tem o papel na mão sabe disso melhor que o sistema.
    const numeroLimpo = numeroDocumento.trim();
    if (!editando && numeroLimpo && empresaAtiva?.id) {
      const { data: gemeos } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, data_competencia, status")
        .eq("empresa_id", empresaAtiva.id)
        .eq("tipo", tipo)
        .eq("numero_documento", numeroLimpo)
        .limit(5);
      if (gemeos && gemeos.length > 0) {
        const lista = gemeos
          .map((g: { descricao: string; valor: number; data_competencia: string; status: string }) =>
            `• ${g.descricao} — ${Number(g.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${g.status})`)
          .join("\n");
        const seguir = confirm(
          `Já existe lançamento com o documento ${numeroLimpo}:\n\n${lista}\n\n` +
          "Criar outro DOBRA o valor no fluxo de caixa e no DRE.\n\n" +
          "Se o objetivo é ligar essa nota a um contrato, cancele aqui e use o ícone de elo " +
          "na linha do lançamento que já existe.\n\nCriar mesmo assim?",
        );
        if (!seguir) return;
      }
    }

    const baseBody: any = {
      tipo,
      natureza,
      status,
      descricao: descricao.trim(),
      valor,
      data_competencia: dataCompetencia,
      data_vencimento: dataVencimento || null,
      data_realizado: dataRealizado || null,
      conta_id: contaId || null,
      categoria_id: categoriaId || null,
      pessoa_id: pessoaId || null,
      observacoes: observacoes.trim() || null,
      tipo_documento: tipoDocumento || null,
      numero_documento: numeroDocumento.trim() || null,
      serie_documento: serieDocumento.trim() || null,
      chave_acesso_nfe: chaveAcessoNfe.replace(/\D/g, "").trim() || null,
      data_emissao: dataEmissao || null,
      valor_juros: valorJuros || 0,
      valor_multa: valorMulta || 0,
      valor_desconto: valorDesconto || 0,
      valor_tarifa: valorTarifa || 0,
      forma_pagamento: formaPagamento || null,
      departamento: departamento || null,
      projeto_id: projetoId || null,
      vendedor_responsavel_id: vendedorId || null,
      conta_destino_id: isTransferencia ? (contaDestinoId || null) : null,
    };

    // ── Transferência entre contas: cria dois lançamentos espelhados ──────────
    if (isTransferencia && !editando) {
      const loteId = crypto.randomUUID();
      const sharedBase = {
        ...baseBody,
        tipo: "transferencia" as const,
        origem_lote_id: loteId,
        // conta_destino_id e natureza serão sobrepostos abaixo por lançamento
      };

      // Lançamento A: saída da conta de origem
      const savedA = await upsert.mutateAsync({
        ...sharedBase,
        conta_id: contaId || null,
        natureza: "despesa" as const,
        conta_destino_id: contaDestinoId || null,
      } as any);

      // Lançamento B: entrada na conta de destino
      await upsert.mutateAsync({
        ...sharedBase,
        conta_id: contaDestinoId || null,
        natureza: "receita" as const,
        conta_destino_id: contaId || null,
      } as any);

      // O saldo das duas contas sai do gatilho, que agora entende a
      // transferência espelhada. Ajustar aqui somava o valor uma segunda vez.

      if (savedA && onSaved) onSaved(savedA as unknown as Lancamento);
      onOpenChange(false);
      return;
    }

    // ── Transferência EDITADA: a perna irmã acompanha ─────────────────────
    //
    // A criação sempre foi em par; a edição não era — mudar valor ou data de
    // uma perna deixava o espelho para trás EM SILÊNCIO: R$ 300.000 saindo do
    // Itaú e R$ 250.000 entrando no Banpará é dinheiro nascendo entre contas,
    // e nada avisava. O que é da OPERAÇÃO (valor, datas, descrição, status)
    // sincroniza; o que é de CADA PERNA (conta, natureza) fica — trocada a
    // conta de origem/destino, o espelho recebe a inversão.
    if (isTransferencia && editando && initial?.id) {
      const saved = await upsert.mutateAsync({ id: initial.id, ...baseBody });

      const { data: minha } = await supabase
        .from("financeiro_lancamentos")
        .select("origem_lote_id")
        .eq("id", initial.id)
        .maybeSingle();
      const lote = (minha as { origem_lote_id: string | null } | null)?.origem_lote_id;
      if (lote) {
        const { error: espErr } = await supabase
          .from("financeiro_lancamentos")
          .update({
            valor: baseBody.valor,
            descricao: baseBody.descricao,
            data_competencia: baseBody.data_competencia,
            data_vencimento: baseBody.data_vencimento ?? null,
            data_realizado: baseBody.data_realizado ?? null,
            status: baseBody.status,
            conta_id: contaDestinoId || null,
            conta_destino_id: contaId || null,
          } as never)
          .eq("origem_lote_id", lote)
          .neq("id", initial.id);
        if (espErr) {
          toast.warning("A perna espelhada não pôde ser sincronizada.", {
            description: "As duas pontas da transferência podem estar divergentes — confira na lista.",
          });
        } else {
          toast.success("Transferência atualizada nas duas pontas.");
        }
      }
      if (saved && onSaved) onSaved(saved as unknown as Lancamento);
      onOpenChange(false);
      return;
    }

    if (parcelar && podeParcelar && qtdParcelas >= 2 && dataVencimento) {
      await gerarParcelas.mutateAsync({
        ...baseBody,
        parcelas: qtdParcelas,
        valor_total: valor,
        data_vencimento: dataVencimento,
        periodicidade,
        intervalo_dias: intervaloDias,
        modo: modoParc,
        regra_fim_semana: regraFds,
        dia_fixo: diaFixo ? Math.max(1, Math.min(31, parseInt(diaFixo, 10))) : null,
        datas_customizadas: simulacao.length === qtdParcelas ? simulacao : undefined,
      });
      // O anexo não pode sumir por o lançamento ter sido parcelado: a nota é
      // uma só, e fica com o registro que a originou.
      if (initial?.id) await guardarDocumentos(initial.id);
    } else {
      // Antes de guardar: `guardarDocumentos` limpa os estados do anexo.
      const tinhaNota = !!(arquivoPdf || arquivoXml);
      const saved = await upsert.mutateAsync({ id: initial?.id, ...baseBody });
      if (saved && onSaved) onSaved(saved as unknown as Lancamento);

      // Transição de status não mexe no saldo daqui: o upsert acima já
      // disparou o gatilho, que recalcula a conta inteira — inclusive a antiga,
      // quando o lançamento troca de conta.

      await guardarDocumentos((saved as unknown as { id?: string })?.id ?? initial?.id ?? null);

      // ── A etapa que a tela nunca anunciava ────────────────────────────────
      //
      // A receber criado à mão com nota anexada nasce sem vínculo com
      // contrato — invisível para a Gestão (saldo, faturamento) até alguém
      // achar o ícone de elo por conta própria. O caminho da extração vincula
      // no ato; este aqui vincula na etapa seguinte. A etapa existe; o que
      // faltava era dizê-lo no momento em que ela se torna a próxima.
      if (!editando && tipo === "a_receber" && tinhaNota && saved) {
        const row = saved as unknown as LancamentoParaVincular;
        if (onVincularContrato) {
          toast.info("Nota guardada — falta o vínculo com o contrato.", {
            description:
              "Sem ele, o recebimento não consome saldo nem aparece no faturamento do contrato na Gestão.",
            duration: 12000,
            action: {
              label: "Vincular agora",
              onClick: () => onVincularContrato({
                ...row,
                pessoa_nome: pessoas.find((pp) => pp.id === pessoaId)?.nome ?? null,
              }),
            },
          });
        } else {
          toast.info("Nota guardada — falta o vínculo com o contrato.", {
            description:
              "Use o ícone de elo (🔗) na linha do lançamento, em Contas a Receber, para ligá-lo ao contrato/ATA.",
            duration: 12000,
          });
        }
      }
    }
    onOpenChange(false);
  };

  /**
   * PDF e XML no MESMO registro.
   *
   * `financeiro_documentos_fiscais` guarda o arquivo no storage e o XML como
   * texto na própria linha — o schema já foi desenhado para os dois juntos.
   * Criar duas linhas faria a coluna NF-e da Gestão mostrar a última que
   * entrou, e um dos dois documentos ficaria invisível.
   *
   * Só depois do save: um lançamento novo não tem id ao qual o documento possa
   * se prender, e anexar antes de existir deixaria arquivo órfão para quem
   * desistisse no meio.
   */
  const guardarDocumentos = async (lancamentoId: string | null) => {
    if (!lancamentoId || (!arquivoPdf && !arquivoXml)) return;
    const xmlTexto = arquivoXml ? await arquivoXml.text().catch(() => null) : null;
    // O PDF ou a foto é o que se abre; sem eles, o próprio XML ocupa o lugar.
    const paraGuardar = arquivoPdf ?? arquivoXml;
    const salvo = await guardarArquivo(paraGuardar!, {
      tipo: tipoDocumento || "outro",
      numero: numeroDocumento.trim() || null,
      serie: serieDocumento.trim() || null,
      chave_acesso: chaveAcessoNfe.replace(/\D/g, "") || null,
      data_emissao: dataEmissao || null,
      valor_total: valor ?? 0,
      lancamento_id: lancamentoId,
      arquivo_xml: xmlTexto,
      // Os itens lidos. Sem isto, um DANFE em PDF chegaria ao vínculo com
      // contrato sem quantidade, e a divisão voltaria a ser de quem cadastra.
      ocr_data: nfeLida,
    });
    if (!salvo) {
      // O lançamento foi salvo; só o anexo falhou. Dizer qual das duas coisas
      // deu errado evita que a pessoa refaça o lançamento inteiro.
      toast.error("O lançamento foi salvo, mas o documento não foi guardado.", {
        description: "Anexe pelo clipe na linha do lançamento.",
      });
      return;
    }
    // ── Trocar é trocar ──────────────────────────────────────────────────
    //
    // Sem isto, anexar de novo deixaria DOIS registros do mesmo papel: o mapa
    // da lista mostra um deles, e o outro vira arquivo que ninguém alcança e
    // ninguém sabe que existe. O botão promete "trocar"; a promessa vale.
    //
    // A ordem importa: o registro sai primeiro. Falhando o storage, sobra um
    // arquivo órfão no bucket — desperdício. Na ordem inversa, falhando o
    // registro, sobra uma LINHA apontando para arquivo que não existe mais, e
    // o "Ver documento" quebra.
    if (docGuardado) {
      const { error: errApagar } = await supabase
        .from("financeiro_documentos_fiscais" as never)
        .delete().eq("id", docGuardado.id);
      if (errApagar) {
        toast.warning("O novo documento foi guardado, mas o anterior continua no lançamento.", {
          description: errApagar.message,
        });
      } else {
        await supabase.storage.from("financeiro-documentos").remove([docGuardado.storage_path]);
      }
    }

    setArquivoPdf(null); setArquivoXml(null); setDivergencias([]); setNfeLida(null);
    setDocGuardado(null);
    toast.success(docGuardado ? "Documento trocado." : "Documento guardado e vinculado ao lançamento.");
  };

  const categoriasFiltradas = categorias.filter((c) => {
    if (tipo === "a_pagar") return c.natureza === "despesa" || c.natureza === "movimentacao";
    if (tipo === "a_receber") return c.natureza === "receita" || c.natureza === "movimentacao";
    return true;
  });

  const categoriasAgrupadas = categoriasFiltradas.reduce<Record<string, typeof categoriasFiltradas>>((acc, c) => {
    const key = c.natureza || "movimentacao";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const ordemGrupos: Array<{ key: string; label: string }> = [
    { key: "despesa", label: "Despesas" },
    { key: "receita", label: "Receitas" },
    { key: "movimentacao", label: "Movimentações" },
  ];

  const pessoasFiltradas = pessoas.filter((p) => {
    if (tipo === "a_pagar") return p.pessoa_tipo !== "cliente";
    if (tipo === "a_receber") return p.pessoa_tipo !== "fornecedor";
    return true;
  });

  const isSalvando = upsert.isPending || gerarParcelas.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        {/* Header colorido por tipo */}
        <div className={cn(
          "px-6 pt-5 pb-4 border-b",
          tipo === "a_pagar" ? "bg-destructive/5" :
          tipo === "a_receber" ? "bg-success/5" :
          "bg-muted/30"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {editando ? "Editar lançamento" : "Novo lançamento"}
            </DialogTitle>
          </DialogHeader>

          {/* Tipo como pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {TIPO_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value as Tipo)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                  tipo === t.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background/70 text-muted-foreground border-border hover:bg-accent"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status como pills coloridos */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value as Status)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                  status === s.value
                    ? s.active
                    : "bg-background/70 text-muted-foreground border-border hover:bg-accent"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pt-4 pb-2">
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="documento">Documento</TabsTrigger>
              <TabsTrigger value="rateio" disabled={!editando}>Rateio</TabsTrigger>
              <TabsTrigger value="parcelas" disabled={!podeParcelar}>Parcelamento</TabsTrigger>
            </TabsList>

            {/* ===================== GERAL ===================== */}
            <TabsContent value="geral" className="space-y-5 mt-0">

              {/* Descrição */}
              <div className="space-y-1.5">
                <Label>Descrição *</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Pagamento fornecedor X"
                  className="text-base"
                  autoFocus
                />
              </div>

              {/* Valor + Conta + Forma de pagamento */}
              <div className={cn("grid gap-3", isTransferencia ? "grid-cols-2" : "grid-cols-3")}>
                <div className="space-y-1.5">
                  <Label className={valor <= 0 ? "text-destructive" : ""}>Valor *</Label>
                  <MoneyInput value={valor} onValueChange={setValor} className={valor <= 0 ? "border-destructive focus-visible:ring-destructive" : ""} />
                </div>
                {!isTransferencia && (
                  <div className="space-y-1.5">
                    <Label>Conta</Label>
                    <Select value={contaId || "none"} onValueChange={(v) => setContaId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem conta —</SelectItem>
                        {contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <Select value={formaPagamento || "none"} onValueChange={(v) => setFormaPagamento(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Não informada —</SelectItem>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Datas */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datas</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Competência *</Label>
                    <Input type="date" value={dataCompetencia} onChange={(e) => setDataCompetencia(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Vencimento{parcelar && <span className="text-xs text-muted-foreground ml-1">(1ª parcela)</span>}
                    </Label>
                    <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pago / recebido em</Label>
                    <Input type="date" value={dataRealizado} onChange={(e) => { setDataRealizado(e.target.value); if (e.target.value) setDataCompetencia(e.target.value); }} />
                  </div>
                </div>
              </div>

              {/* Transferência entre contas */}
              <div className={cn(
                "rounded-lg border p-3 space-y-3 transition-colors",
                isTransferencia ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="chk-transferencia"
                    checked={isTransferencia}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setTipo("transferencia");
                        setNatureza("movimentacao");
                      } else {
                        setTipo("movimento_bancario");
                        setContaDestinoId("");
                      }
                    }}
                  />
                  <label htmlFor="chk-transferencia" className="text-sm font-medium cursor-pointer select-none flex items-center gap-1.5">
                    <ArrowLeftRight className={cn("w-3.5 h-3.5", isTransferencia ? "text-primary" : "text-muted-foreground")} />
                    Transferência entre contas
                  </label>
                  {isTransferencia && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Não soma nos totais de receita/despesa
                    </span>
                  )}
                </div>

                {isTransferencia && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conta de origem</Label>
                      <Select value={contaId || "none"} onValueChange={(v) => setContaId(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem conta —</SelectItem>
                          {contas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground font-medium">Conta de destino *</Label>
                      <Select
                        value={contaDestinoId || "none"}
                        onValueChange={(v) => setContaDestinoId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className={cn("h-8 text-xs", !contaDestinoId && "border-primary/50")}>
                          <SelectValue placeholder="Selecione a conta destino" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Selecione —</SelectItem>
                          {contas
                            .filter((c) => c.id !== contaId)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Classificação */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={categoriaId || "none"} onValueChange={(v) => setCategoriaId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <SelectItem value="none">— Sem categoria —</SelectItem>
                        {ordemGrupos.map(({ key, label }) => {
                          const itens = categoriasAgrupadas[key];
                          if (!itens || itens.length === 0) return null;
                          return (
                            <SelectGroup key={key}>
                              <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                                {label}
                              </SelectLabel>
                              {itens
                                .slice()
                                .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", "pt-BR", { numeric: true }))
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.codigo} · {c.nome}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{tipo === "a_pagar" ? "Fornecedor" : tipo === "a_receber" ? "Cliente" : "Pessoa"}</Label>
                    <Select value={pessoaId || "none"} onValueChange={(v) => setPessoaId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Não informado —</SelectItem>
                        {pessoasFiltradas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}{p.documento ? ` · ${p.documento}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Departamento</Label>
                    <Select value={departamento || "none"} onValueChange={(v) => setDepartamento(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Não informado —</SelectItem>
                        <SelectItem value="Administrativo">Administrativo</SelectItem>
                        <SelectItem value="Comercial">Comercial</SelectItem>
                        <SelectItem value="Financeiro">Financeiro</SelectItem>
                        <SelectItem value="Jurídico">Jurídico</SelectItem>
                        <SelectItem value="Operacional">Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Projeto</Label>
                    <Select value={projetoId || "none"} onValueChange={(v) => setProjetoId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem projeto —</SelectItem>
                        {projetos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} · {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Vendedor / responsável</Label>
                    <Select value={vendedorId || "none"} onValueChange={(v) => setVendedorId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Não atribuído —</SelectItem>
                        {membros.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.nome_completo || m.email || m.user_id.slice(0, 8)}
                            {m.papel ? ` · ${m.papel}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Acréscimos e Descontos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acréscimos e Descontos</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Juros (R$)</Label>
                    <MoneyInput value={valorJuros} onValueChange={setValorJuros} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Multa (R$)</Label>
                    <MoneyInput value={valorMulta} onValueChange={setValorMulta} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Desconto (R$)</Label>
                    <MoneyInput value={valorDesconto} onValueChange={setValorDesconto} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tarifa bancária (R$)</Label>
                    <MoneyInput value={valorTarifa} onValueChange={setValorTarifa} />
                  </div>
                </div>
                {temAcrescimos && (
                  <div className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Valor líquido a {tipo === "a_pagar" ? "pagar" : "receber"}:
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {valorLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Informações adicionais..."
                />
              </div>
            </TabsContent>

            {/* ===================== DOCUMENTO FISCAL ===================== */}
            <TabsContent value="documento" className="space-y-3 mt-0">
              {/* ── O que se anexa depende do que o lançamento é ─────────────
                  Nota fiscal traz XML e chave, e o sistema os lê. Boleto,
                  guia e comprovante não têm nada disso — e prometer leitura
                  onde não há é pior do que não prometer nada.

                  O armazenamento sempre foi genérico; era a redação que dizia
                  "NF-e" em toda linha. Ver lib/financeiro/anexo-do-lancamento. */}
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <input ref={entradaDeArquivo} type="file" className="hidden"
                  accept={perfil.aceita} multiple onChange={receberArquivos} />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{perfil.titulo}</p>
                    <p className="text-xs text-muted-foreground">{perfil.ajuda}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => entradaDeArquivo.current?.click()}>
                    {docGuardado ? "Trocar arquivos" : "Escolher arquivos"}
                  </Button>
                </div>
                {/* O que já está no dossiê. Sem isto a aba volta ao convite de
                    anexar, e quem reabre conclui que o arquivo não foi
                    guardado. */}
                {docGuardado && !arquivoPdf && !arquivoXml && (
                  <div className="flex items-center justify-between gap-2 flex-wrap rounded-md border bg-background px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{docGuardado.arquivo_nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        guardado neste lançamento
                        {docGuardado.arquivo_xml && " · com XML"}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {/* ── Ver a nota quando só existe o XML ─────────────────
                          XML aberto no navegador é marcação crua. O dado está
                          todo ali — `parseNFe` já o extrai por inteiro —, só
                          não havia como lê-lo com olhos humanos.

                          "Espelho" e não "DANFE": o documento auxiliar oficial
                          tem layout próprio do Manual de Orientação do
                          Contribuinte, e chamar uma leitura de DANFE
                          convidaria alguém a apresentá-la como se fosse. */}
                      {docGuardado.arquivo_xml && (
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => {
                            try {
                              if (!abrirEspelho(parseNFeXML(docGuardado.arquivo_xml!))) {
                                toast.error("O navegador bloqueou a aba.", {
                                  description: "Permita pop-ups para este site e tente de novo.",
                                });
                              }
                            } catch {
                              toast.error("O XML guardado não pôde ser lido.");
                            }
                          }}>
                          Ver a nota
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={abrirDocGuardado} disabled={abrindoDoc}>
                        {abrindoDoc ? "abrindo…" : "Ver arquivo"}
                      </Button>
                    </div>
                  </div>
                )}
                {(arquivoPdf || arquivoXml) && (
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                    {arquivoXml && <span>XML: {arquivoXml.name}</span>}
                    {arquivoPdf && <span>PDF: {arquivoPdf.name}</span>}
                    {lendoDanfe && <span className="text-primary">{lendoDanfe}</span>}
                    <span className="text-primary">guardado ao salvar o lançamento</span>
                  </div>
                )}
                {/* Divergência não se aplica sozinha. O valor de um lançamento
                    conciliado veio do extrato — é o dinheiro que entrou —, e
                    pode diferir da nota por retenção ou desconto. */}
                {divergencias.length > 0 && (
                  <div className="text-xs text-warning space-y-0.5">
                    <p className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> A nota diverge do que está gravado — nada foi alterado:
                    </p>
                    {divergencias.map(d => (
                      <p key={d.campo} className="ml-5">
                        {d.campo}: <b>{d.noSistema}</b> aqui, <b>{d.naNota}</b> na nota
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo de documento</Label>
                  <Select value={tipoDocumento || "none"} onValueChange={(v) => setTipoDocumento(v === "none" ? "" : (v as TipoDocumento))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Não informado —</SelectItem>
                      {TIPO_DOC_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de emissão</Label>
                  <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número do documento</Label>
                  <Input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="Ex.: 000123" />
                </div>
                <div className="space-y-1.5">
                  <Label>Série</Label>
                  <Input value={serieDocumento} onChange={(e) => setSerieDocumento(e.target.value)} placeholder="Ex.: 1" />
                </div>
                {(tipoDocumento === "nfe" || tipoDocumento === "nfce" || tipoDocumento === "nfse" || tipoDocumento === "cte") && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Chave de acesso (44 dígitos)</Label>
                    <Input
                      value={chaveAcessoNfe}
                      onChange={(e) => setChaveAcessoNfe(e.target.value.replace(/\D/g, "").slice(0, 44))}
                      placeholder="00000000000000000000000000000000000000000000"
                      maxLength={44}
                    />
                    {chaveAcessoNfe && chaveAcessoNfe.length !== 44 && (
                      <p className="text-xs text-destructive">A chave deve ter 44 dígitos numéricos.</p>
                    )}
                  </div>
                )}
              </div>

              {tipo === "a_receber" && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    O anexo não liga o recebimento a um contrato — essa é a etapa seguinte, pelo
                    ícone de elo na linha do lançamento. A quantidade lida desta nota vai junto
                    para o vínculo.
                  </span>
                </p>
              )}
            </TabsContent>

            {/* ===================== RATEIO ===================== */}
            <TabsContent value="rateio" className="space-y-3 mt-0">
              <RateioCentroCustoEditor lancamentoId={initial?.id ?? null} valorBase={Number(valor) || 0} />
            </TabsContent>

            {/* ===================== PARCELAMENTO ===================== */}
            <TabsContent value="parcelas" className="space-y-4 mt-0">
              <div className="rounded-md border p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">Incluir repetições / parcelamento</p>
                  <p className="text-xs text-muted-foreground">
                    Para despesas fixas (ex.: aluguel, telefonia, energia) use{" "}
                    <strong>Repetir o mesmo valor</strong>. Para parcelar uma compra,{" "}
                    <strong>Dividir o valor</strong>.
                  </p>
                </div>
                <Switch checked={parcelar} onCheckedChange={setParcelar} />
              </div>

              {parcelar && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setModoParc("dividir"); setSimulacaoEdits({}); }}
                      className={cn(
                        "text-left rounded-md border p-3 transition-colors",
                        modoParc === "dividir" ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {modoParc === "dividir" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        Dividir o valor em N parcelas
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ex.: R$ 1.200 em 12x = R$ 100,00 cada. Última parcela ajusta centavos.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setModoParc("repetir"); setSimulacaoEdits({}); }}
                      className={cn(
                        "text-left rounded-md border p-3 transition-colors",
                        modoParc === "repetir" ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {modoParc === "repetir" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        Repetir o mesmo valor (despesa fixa)
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cada repetição mantém o valor cheio (ex.: aluguel R$ 2.500 todo mês).
                      </p>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quanto a sábados e domingos</Label>
                      <Select value={regraFds} onValueChange={(v) => { setRegraFds(v as RegraFimSemana); setSimulacaoEdits({}); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manter">Manter a data de vencimento</SelectItem>
                          <SelectItem value="antecipar">Antecipar para dia útil</SelectItem>
                          <SelectItem value="postergar">Postergar para dia útil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Periodicidade</Label>
                      <Select value={periodicidade} onValueChange={(v) => { setPeriodicidade(v as Periodicidade); setSimulacaoEdits({}); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="bimestral">Bimestral</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                          <SelectItem value="dias">Período específico (dias)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {periodicidade === "dias" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">A cada (dias)</Label>
                        <Input
                          type="number" min={1} max={365}
                          value={intervaloDias}
                          onChange={(e) => { setIntervaloDias(Math.max(1, parseInt(e.target.value || "30", 10))); setSimulacaoEdits({}); }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Repetir todo dia</Label>
                        <Input
                          type="number" min={1} max={31}
                          placeholder="(usa o dia do venc.)"
                          value={diaFixo}
                          onChange={(e) => { setDiaFixo(e.target.value.replace(/\D/g, "").slice(0, 2)); setSimulacaoEdits({}); }}
                          disabled={periodicidade === "semanal" || periodicidade === "quinzenal"}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Por (qtd. de repetições)</Label>
                      <Input
                        type="number" min={2} max={120}
                        value={qtdParcelas}
                        onChange={(e) => { setQtdParcelas(Math.max(2, parseInt(e.target.value || "2", 10))); setSimulacaoEdits({}); }}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b gap-2 flex-wrap">
                      <div className="text-sm font-medium">
                        Simulação das repetições
                        <span className="text-xs text-muted-foreground ml-2">
                          (clique no vencimento ou valor para ajustar manualmente)
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total da série: <strong className="text-foreground">{totalSerie.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/20 text-xs text-muted-foreground sticky top-0">
                          <tr>
                            <th className="text-left font-medium px-3 py-2 w-28">Situação</th>
                            <th className="text-left font-medium px-3 py-2 w-24">Parcela</th>
                            <th className="text-left font-medium px-3 py-2">Vencimento</th>
                            <th className="text-right font-medium px-3 py-2 w-40">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulacao.map((d, i) => {
                            const dt = new Date(d.vencimento + "T12:00:00");
                            const dow = dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
                            const dataStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                            return (
                              <tr key={i} className="border-t hover:bg-accent/30">
                                <td className="px-3 py-1.5">
                                  <span className="inline-flex items-center gap-1 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-warning" />
                                    A vencer
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 tabular-nums text-xs text-muted-foreground">
                                  {String(i + 1).padStart(3, "0")}/{String(qtdParcelas).padStart(3, "0")}
                                </td>
                                <td className="px-3 py-1.5">
                                  <input
                                    type="date"
                                    value={d.vencimento}
                                    onChange={(e) => setSimulacaoEdits((prev) => ({ ...prev, [i]: { ...prev[i], vencimento: e.target.value } }))}
                                    className="bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5"
                                  />
                                  <span className="text-xs text-muted-foreground ml-2 capitalize">{dataStr} {dow}</span>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <input
                                    type="number" step="0.01" min="0"
                                    value={d.valor}
                                    onChange={(e) => setSimulacaoEdits((prev) => ({ ...prev, [i]: { ...prev[i], valor: parseFloat(e.target.value || "0") } }))}
                                    className="w-32 text-right bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 tabular-nums"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                          {simulacao.length === 0 && (
                            <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                              Informe valor e data de vencimento na aba <strong>Geral</strong> para visualizar a simulação.
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    {modoParc === "repetir"
                      ? <>Modo <strong>repetir</strong>: cada lançamento será criado com o valor cheio informado em <em>Geral</em>.</>
                      : <>Modo <strong>dividir</strong>: o valor é distribuído igualmente entre as parcelas; a última recebe o ajuste de centavos.</>}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSalvando || !descricao.trim() || valor <= 0}>
            {isSalvando
              ? "Salvando..."
              : parcelar && podeParcelar
                ? `Gerar ${qtdParcelas} ${modoParc === "repetir" ? "repetições" : "parcelas"}`
                : "Salvar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
