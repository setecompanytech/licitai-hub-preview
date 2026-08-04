import { useEffect, useMemo, useState } from "react";
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
import { Info, CheckCircle2, TrendingUp, TrendingDown, ArrowLeftRight, AlertCircle } from "lucide-react";
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
  ajustarSaldoConta,
  isStatusPago,
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
};

const today = () => new Date().toISOString().slice(0, 10);

export default function LancamentoDialog({ open, onOpenChange, initial, defaultTipo, onSaved }: Props) {
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

  const valorLiquido = useMemo(
    () => Math.max(0, Number(valor) + Number(valorJuros) + Number(valorMulta) + Number(valorTarifa) - Number(valorDesconto)),
    [valor, valorJuros, valorMulta, valorDesconto, valorTarifa],
  );

  const editando = !!initial?.id;
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

  const calcDelta = (nat: string, v: number) => (nat === "receita" ? v : -v);

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

      // Ajusta saldos das duas contas (a transferência já ocorreu no extrato)
      if (contaId) await ajustarSaldoConta(contaId, -valor);
      if (contaDestinoId) await ajustarSaldoConta(contaDestinoId, valor);

      if (savedA && onSaved) onSaved(savedA as unknown as Lancamento);
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
      // Parcelamento: se status já for pago, ajusta o saldo para cada parcela
      if (isStatusPago(status) && contaId) {
        for (const p of simulacao) {
          await ajustarSaldoConta(contaId, calcDelta(natureza, Number(p.valor)));
        }
      }
    } else {
      const saved = await upsert.mutateAsync({ id: initial?.id, ...baseBody });
      if (saved && onSaved) onSaved(saved as unknown as Lancamento);

      // Ajusta saldo da conta conforme transição de status
      const oldStatus = initial?.status ?? null;
      const oldContaId = initial?.conta_id ?? null;
      const oldNatureza = initial?.natureza ?? natureza;
      const oldValor = Number(initial?.valor ?? valor);
      const newPago = isStatusPago(status);
      const oldPago = isStatusPago(oldStatus);

      if (newPago && !oldPago && contaId) {
        // Entrou em pago
        await ajustarSaldoConta(contaId, calcDelta(natureza, valor));
      } else if (!newPago && oldPago && oldContaId) {
        // Saiu de pago (reabertura)
        await ajustarSaldoConta(oldContaId, -calcDelta(oldNatureza, oldValor));
      } else if (newPago && oldPago && oldContaId !== contaId) {
        // Mudou de conta enquanto pago: reverte da antiga, aplica na nova
        if (oldContaId) await ajustarSaldoConta(oldContaId, -calcDelta(oldNatureza, oldValor));
        if (contaId) await ajustarSaldoConta(contaId, calcDelta(natureza, valor));
      }
    }
    onOpenChange(false);
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
                    <Input type="date" value={dataRealizado} onChange={(e) => setDataRealizado(e.target.value)} />
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
                        setTipo("movimentacao");
                        setContaDestinoId("");
                      }
                    }}
                  />
                  <label htmlFor="chk-transferencia" className="text-sm font-medium cursor-pointer select-none flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
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
                      <Label className="text-xs text-primary font-medium">Conta de destino *</Label>
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
                  <div className="flex items-center justify-end gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Valor líquido a {tipo === "a_pagar" ? "pagar" : "receber"}:
                    </span>
                    <span className="font-semibold tabular-nums">
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
