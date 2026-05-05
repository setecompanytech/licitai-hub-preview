import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2 } from "lucide-react";
import {
  useContas,
  useCategorias,
  usePessoas,
  useUpsertLancamento,
  useGerarParcelas,
  useMembrosEmpresa,
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Lancamento> | null;
  /** Pré-define o tipo (a_pagar / a_receber) ao abrir um novo */
  defaultTipo?: Tipo;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function LancamentoDialog({ open, onOpenChange, initial, defaultTipo }: Props) {
  const { data: contas = [] } = useContas();
  const { data: categorias = [] } = useCategorias();
  const { data: pessoas = [] } = usePessoas();
  const { data: membros = [] } = useMembrosEmpresa();
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

  // Cobrança / acréscimos / descontos (estilo OMIE)
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
  // Edições manuais da tabela de simulação (override por índice da parcela)
  const [simulacaoEdits, setSimulacaoEdits] = useState<Record<number, { vencimento?: string; valor?: number }>>({});

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
    setVendedorId((initial as any)?.vendedor_responsavel_id ?? "");
    setParcelar(false);
    setQtdParcelas(2);
    setModoParc("dividir");
    setPeriodicidade("mensal");
    setIntervaloDias(30);
    setRegraFds("manter");
    setDiaFixo("");
    setSimulacaoEdits({});
  }, [open, initial, defaultTipo]);

  // Sincroniza natureza padrão por tipo
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

  // Simulação das parcelas/repetições (preview ao vivo, com possíveis edições manuais)
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

  const handleSubmit = async () => {
    if (!descricao.trim()) return;
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
      vendedor_responsavel_id: vendedorId || null,
    };

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
    } else {
      await upsert.mutateAsync({ id: initial?.id, ...baseBody });
    }
    onOpenChange(false);
  };

  const categoriasFiltradas = categorias.filter((c) =>
    natureza === "movimentacao" ? true : c.natureza === natureza,
  );

  const pessoasFiltradas = pessoas.filter((p) => {
    if (tipo === "a_pagar") return p.pessoa_tipo !== "cliente";
    if (tipo === "a_receber") return p.pessoa_tipo !== "fornecedor";
    return true;
  });

  const isSalvando = upsert.isPending || gerarParcelas.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editando ? "Editar lançamento" : "Novo lançamento"}
            <Badge variant="outline" className="text-xs">
              {tipo === "a_pagar" ? "Conta a pagar" : tipo === "a_receber" ? "Conta a receber" : tipo}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            <TabsTrigger value="documento">Documento fiscal</TabsTrigger>
            <TabsTrigger value="rateio" disabled={!editando}>Rateio</TabsTrigger>
            <TabsTrigger value="parcelas" disabled={!podeParcelar}>Parcelamento</TabsTrigger>
          </TabsList>

          {/* ---------------- GERAL ---------------- */}
          <TabsContent value="geral" className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_pagar">A pagar</SelectItem>
                    <SelectItem value="a_receber">A receber</SelectItem>
                    <SelectItem value="movimento_bancario">Movimento bancário</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="conciliado">Conciliado</SelectItem>
                    <SelectItem value="em_atraso">Em atraso</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Descrição *</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pagamento fornecedor X" />
              </div>

              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <MoneyInput value={valor} onValueChange={setValor} />
              </div>
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

              <div className="space-y-1.5">
                <Label>Competência *</Label>
                <Input type="date" value={dataCompetencia} onChange={(e) => setDataCompetencia(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento {parcelar && <span className="text-xs text-muted-foreground">(1ª parcela)</span>}</Label>
                <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Pago / recebido em</Label>
                <Input type="date" value={dataRealizado} onChange={(e) => setDataRealizado(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoriaId || "none"} onValueChange={(v) => setCategoriaId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem categoria —</SelectItem>
                    {categoriasFiltradas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo} · {c.nome}</SelectItem>
                    ))}
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
                        {p.nome}
                        {p.documento ? ` · ${p.documento}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
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

              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
              </div>
            </div>
          </TabsContent>

          {/* ---------------- COBRANÇA ---------------- */}
          <TabsContent value="cobranca" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-1.5">
                <Label>Valor base</Label>
                <MoneyInput value={valor} onValueChange={setValor} />
              </div>

              <div className="space-y-1.5">
                <Label>Juros (R$)</Label>
                <MoneyInput value={valorJuros} onValueChange={setValorJuros} />
              </div>
              <div className="space-y-1.5">
                <Label>Multa (R$)</Label>
                <MoneyInput value={valorMulta} onValueChange={setValorMulta} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto (R$)</Label>
                <MoneyInput value={valorDesconto} onValueChange={setValorDesconto} />
              </div>
              <div className="space-y-1.5">
                <Label>Tarifa bancária (R$)</Label>
                <MoneyInput value={valorTarifa} onValueChange={setValorTarifa} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                Valor líquido a {tipo === "a_pagar" ? "pagar" : "receber"}
              </div>
              <div className="text-lg font-semibold tabular-nums">
                {valorLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </TabsContent>

          {/* ---------------- DOCUMENTO ---------------- */}
          <TabsContent value="documento" className="space-y-3">
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

          {/* ---------------- PARCELAMENTO ---------------- */}
          {/* ---------------- RATEIO ---------------- */}
          <TabsContent value="rateio" className="space-y-3">
            <RateioCentroCustoEditor lancamentoId={initial?.id ?? null} valorBase={Number(valor) || 0} />
          </TabsContent>

          {/* ---------------- PARCELAMENTO / REPETIÇÕES ---------------- */}
          <TabsContent value="parcelas" className="space-y-4">
            <div className="rounded-md border p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">Incluir repetições / parcelamento</p>
                <p className="text-xs text-muted-foreground">
                  Para despesas fixas (ex.: aluguel, telefonia, energia) use{" "}
                  <strong>Repetir o mesmo valor</strong>. Para parcelar uma compra,{" "}
                  <strong>Dividir o valor</strong>. As repetições são geradas a partir do vencimento informado em <em>Geral</em>.
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
                    className={`text-left rounded-md border p-3 transition-colors ${modoParc === "dividir" ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-accent/40"}`}
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
                    className={`text-left rounded-md border p-3 transition-colors ${modoParc === "repetir" ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-accent/40"}`}
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
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
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

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSalvando || !descricao.trim()}>
            {isSalvando ? "Salvando..." : parcelar && podeParcelar ? `Gerar ${qtdParcelas} parcelas` : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
