import { useState } from "react";
import { mensagemDeErro } from "@/lib/financeiro/erro-do-banco";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw, Landmark } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContas, useUpsertConta, useDeleteConta, useEmpresaId, type Conta } from "@/hooks/useFinanceiro";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UFS_BRASIL } from "@/constants/ufsBrasil";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import BancoSelectorLogos, { BancoLogo, findBanco, BANCOS_BRASIL } from "./BancoSelectorLogos";

/**
 * Validação (zod):
 * - Banco: opcional, mas, se preenchido, deve corresponder a um banco da lista
 *   (código COMPE de 3 dígitos válido). Sem banco, agência/conta também precisam ficar vazios.
 * - Agência: 1–5 dígitos, com dígito verificador opcional (ex.: "1234" ou "1234-5" / "1234-X").
 * - Conta:   1–12 dígitos, com dígito verificador obrigatório (ex.: "12345-6" ou "12345-X").
 */
const RE_AGENCIA = /^\d{1,5}(-[\dxX])?$/;
const RE_CONTA = /^\d{1,12}-[\dxX]$/;
const CODIGOS_VALIDOS = new Set(BANCOS_BRASIL.map((b) => b.codigo));

const contaSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe um nome com ao menos 2 caracteres.").max(80, "Máximo 80 caracteres."),
    tipo: z.string().min(1),
    banco: z.string().trim().max(120).optional().or(z.literal("")),
    agencia: z.string().trim().max(10).optional().or(z.literal("")),
    conta: z.string().trim().max(20).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    const banco = (v.banco ?? "").trim();
    const agencia = (v.agencia ?? "").trim();
    const conta = (v.conta ?? "").trim();

    if (banco) {
      // Aceita "XXX - Nome" ou apenas o nome listado
      const codigo = banco.split(/\s|-/)[0].padStart(3, "0");
      const reconhecido = CODIGOS_VALIDOS.has(codigo) || BANCOS_BRASIL.some((b) => b.nome.toLowerCase() === banco.toLowerCase());
      if (!reconhecido) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["banco"],
          message: "Código bancário não reconhecido. Selecione um banco da lista.",
        });
      }
    } else if (agencia || conta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["banco"],
        message: "Selecione o banco antes de informar agência/conta.",
      });
    }

    if (agencia && !RE_AGENCIA.test(agencia)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agencia"],
        message: "Agência inválida. Use 1 a 5 dígitos, com DV opcional (ex.: 1234 ou 1234-5).",
      });
    }

    if (conta && !RE_CONTA.test(conta)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conta"],
        message: "Conta inválida. Informe número e dígito verificador (ex.: 12345-6).",
      });
    }
  });

type Erros = Partial<Record<"nome" | "banco" | "agencia" | "conta" | "saldoInicial", string>>;

const TIPOS = [
  { value: "adiantamento", label: "Adiantamento" },
  { value: "administradora_cartoes", label: "Administradora de Cartões" },
  { value: "caixinha", label: "Caixinha" },
  { value: "cartao", label: "Cartão de Crédito" },
  { value: "carteira_virtual", label: "Carteira Virtual" },
  { value: "aplicacao", label: "Conta Aplicação" },
  { value: "corrente", label: "Conta Corrente" },
  { value: "pagamento", label: "Conta de Pagamento" },
  { value: "emprestimo", label: "Conta Empréstimo" },
  { value: "garantida", label: "Conta Garantida" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "crediario", label: "Crediário / Carnê" },
  { value: "mutuo", label: "Mútuo" },
  { value: "investimento", label: "Investimento" },
  { value: "caixa", label: "Caixa / Dinheiro" },
];

export default function FinContas() {
  const { data: contas = [], isLoading } = useContas();
  const upsert = useUpsertConta();
  const del = useDeleteConta();
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Conta | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [filtroBanco, setFiltroBanco] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);

  // Quantas contas estão dessincronizadas e elegíveis para o recálculo em lote
  // (saldo_atual ≠ saldo_inicial). A função do banco fará o filtro final
  // garantindo que apenas contas SEM lançamentos sejam ajustadas.
  const candidatasSync = contas.filter(
    (c) => Number(c.saldo_atual ?? 0) !== Number(c.saldo_inicial ?? 0),
  ).length;

  const sincronizarSaldos = async () => {
    if (!empresaId) {
      toast.error("Selecione uma empresa ativa.");
      return;
    }
    setSincronizando(true);
    try {
      const { data, error } = await supabase.rpc(
        "sincronizar_saldos_contas_sem_movimento",
        { p_empresa_id: empresaId },
      );
      if (error) throw error;
      const total = Number(data ?? 0);
      if (total === 0) {
        toast.info("Nenhuma conta precisava ser sincronizada.");
      } else {
        toast.success(
          total === 1
            ? "1 conta sincronizada com sucesso."
            : `${total} contas sincronizadas com sucesso.`,
        );
      }
      await qc.invalidateQueries({ queryKey: ["fin-contas"] });
    } catch (e) {
      // O erro do Supabase é um PostgrestError — um objeto simples, NÃO um
      // `Error`. O teste `e instanceof Error` dava falso e a causa exata era
      // descartada na última linha antes de virar texto na tela: a função
      // falhava desde 30/04 por consultar colunas que não existem, e tudo o
      // que chegava a quem clicava era "Falha ao sincronizar saldos".
      console.error("[sincronizar-saldos]", e);
      toast.error("Não foi possível sincronizar os saldos", {
        description: mensagemDeErro(e, "Erro desconhecido — veja o console para o texto do banco."),
        duration: 12000,
      });
    } finally {
      setSincronizando(false);
      setConfirmSync(false);
    }
  };

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("corrente");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [possuiSaldo, setPossuiSaldo] = useState(false);
  // Outras informações (estilo OMIE)
  const [dataSaldoInicial, setDataSaldoInicial] = useState<string>("");
  const [limiteCredito, setLimiteCredito] = useState(0);
  const [contaVinculadaId, setContaVinculadaId] = useState<string>("");
  const [naoConsiderar, setNaoConsiderar] = useState(false);
  const [observacao, setObservacao] = useState("");
  // Sobre a Agência
  const [gerenteNome, setGerenteNome] = useState("");
  const [gerenteEmail, setGerenteEmail] = useState("");
  const [gerenteDdd, setGerenteDdd] = useState("");
  const [gerenteTelefone, setGerenteTelefone] = useState("");
  const [endLogradouro, setEndLogradouro] = useState("");
  const [endNumero, setEndNumero] = useState("");
  const [endBairro, setEndBairro] = useState("");
  const [endComplemento, setEndComplemento] = useState("");
  const [endEstado, setEndEstado] = useState("");
  const [endCidade, setEndCidade] = useState("");
  const [endCep, setEndCep] = useState("");
  const [erros, setErros] = useState<Erros>({});

  // Reseta o formulário (usado ao fechar o diálogo, evitando resíduos
  // entre uma edição e a próxima abertura como "Nova conta").
  const resetForm = () => {
    setEditing(null);
    setNome(""); setTipo("corrente"); setBanco(""); setAgencia(""); setConta("");
    setSaldoInicial(0); setPossuiSaldo(false);
    setDataSaldoInicial(""); setLimiteCredito(0); setContaVinculadaId("");
    setNaoConsiderar(false); setObservacao("");
    setGerenteNome(""); setGerenteEmail(""); setGerenteDdd(""); setGerenteTelefone("");
    setEndLogradouro(""); setEndNumero(""); setEndBairro(""); setEndComplemento("");
    setEndEstado(""); setEndCidade(""); setEndCep("");
    setErros({});
  };

  const openDialog = (c: Conta | null) => {
    setEditing(c);
    setNome(c?.nome ?? "");
    setTipo(c?.tipo ?? "corrente");
    setBanco(c?.banco_nome ?? "");
    setAgencia(c?.agencia ?? "");
    setConta(c?.conta ?? "");
    const raw = c?.saldo_inicial;
    const si = raw === null || raw === undefined ? 0 : Number(raw);
    const siSeguro = Number.isFinite(si) ? si : 0;
    setSaldoInicial(siSeguro);
    setPossuiSaldo(siSeguro !== 0);
    // Campos novos (acessados de forma defensiva — podem não existir em rows antigos)
    const cAny = c as unknown as Record<string, unknown> | null;
    setDataSaldoInicial(((cAny?.data_saldo_inicial as string) ?? "") || "");
    setLimiteCredito(Number(cAny?.limite_credito ?? 0) || 0);
    setContaVinculadaId(((cAny?.conta_vinculada_id as string) ?? "") || "");
    setNaoConsiderar(cAny?.considerar_resumo === false);
    setObservacao(((cAny?.observacao as string) ?? "") || "");
    setGerenteNome(((cAny?.gerente_nome as string) ?? "") || "");
    setGerenteEmail(((cAny?.gerente_email as string) ?? "") || "");
    setGerenteDdd(((cAny?.gerente_ddd as string) ?? "") || "");
    setGerenteTelefone(((cAny?.gerente_telefone as string) ?? "") || "");
    setEndLogradouro(((cAny?.endereco_logradouro as string) ?? "") || "");
    setEndNumero(((cAny?.endereco_numero as string) ?? "") || "");
    setEndBairro(((cAny?.endereco_bairro as string) ?? "") || "");
    setEndComplemento(((cAny?.endereco_complemento as string) ?? "") || "");
    setEndEstado(((cAny?.endereco_estado as string) ?? "") || "");
    setEndCidade(((cAny?.endereco_cidade as string) ?? "") || "");
    setEndCep(((cAny?.endereco_cep as string) ?? "") || "");
    setErros({});
    setOpen(true);
  };

  const validar = (): Erros => {
    const r = contaSchema.safeParse({ nome, tipo, banco, agencia, conta });
    const e: Erros = {};
    if (!r.success) {
      for (const issue of r.error.issues) {
        const k = issue.path[0] as keyof Erros;
        if (k && !e[k]) e[k] = issue.message;
      }
    }
    if (possuiSaldo && !(Number.isFinite(saldoInicial) && saldoInicial !== 0)) {
      e.saldoInicial = "Informe um saldo inicial diferente de zero ou desmarque a opção 'Esta conta possui saldo disponível'.";
    }
    return e;
  };

  const handleSave = async () => {
    const e = validar();
    setErros(e);
    if (Object.keys(e).length > 0) {
      toast.error("Verifique os campos destacados antes de salvar.");
      return;
    }
    await upsert.mutateAsync({
      id: editing?.id,
      nome: nome.trim(),
      tipo,
      banco_nome: banco.trim() || null,
      banco_codigo: findBanco(banco)?.codigo ?? null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      saldo_inicial: possuiSaldo ? saldoInicial : 0,
      // Novos campos (cast para suportar tipagem ainda não regenerada)
      ...({
        data_saldo_inicial: dataSaldoInicial || null,
        limite_credito: limiteCredito || 0,
        conta_vinculada_id: contaVinculadaId || null,
        considerar_resumo: !naoConsiderar,
        observacao: observacao.trim() || null,
        gerente_nome: gerenteNome.trim() || null,
        gerente_email: gerenteEmail.trim() || null,
        gerente_ddd: gerenteDdd.trim() || null,
        gerente_telefone: gerenteTelefone.trim() || null,
        endereco_logradouro: endLogradouro.trim() || null,
        endereco_numero: endNumero.trim() || null,
        endereco_bairro: endBairro.trim() || null,
        endereco_complemento: endComplemento.trim() || null,
        endereco_estado: endEstado || null,
        endereco_cidade: endCidade.trim() || null,
        endereco_cep: endCep.trim() || null,
      } as Record<string, unknown>),
    });
    setOpen(false);
  };

  // Filtro: por banco selecionado e por busca livre (nome / agência / conta)
  const contasFiltradas = contas.filter((c) => {
    if (filtroBanco) {
      const fb = findBanco(filtroBanco);
      const cb = c.banco_nome ?? "";
      const matchBanco =
        cb.toLowerCase().includes((fb?.nome ?? filtroBanco).toLowerCase()) ||
        (fb && cb.includes(fb.codigo));
      if (!matchBanco) return false;
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const blob = `${c.nome} ${c.banco_nome ?? ""} ${c.agencia ?? ""} ${c.conta ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0 space-y-2">
          <Label htmlFor="contas-filtro-banco">Filtrar por banco</Label>
          <BancoSelectorLogos
            id="contas-filtro-banco"
            value={filtroBanco}
            onChange={setFiltroBanco}
            allowAll
            placeholder="Todos os bancos"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <Label htmlFor="contas-busca">Buscar</Label>
          <Input
            id="contas-busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, agência ou número da conta…"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmSync(true)}
            disabled={sincronizando || candidatasSync === 0}
            className="shrink-0"
            title={
              candidatasSync === 0
                ? "Todos os saldos já estão sincronizados"
                : `${candidatasSync} conta(s) com saldo dessincronizado`
            }
          >
            <RefreshCw className={cn("w-4 h-4", sincronizando && "animate-spin")} />
            {sincronizando ? "Sincronizando…" : "Sincronizar saldos"}
            {candidatasSync > 0 && !sincronizando && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground tabular-nums">
                {candidatasSync}
              </span>
            )}
          </Button>
          <Button onClick={() => openDialog(null)} className="shrink-0">
            <Plus className="w-4 h-4" /> Nova conta
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-sm font-semibold text-foreground">
              <tr>
                <th className="w-12 px-4 py-3 text-left"><span className="sr-only">Banco</span></th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Banco</th>
                <th className="px-4 py-3 text-left">Ag./Conta</th>
                <th className="px-4 py-3 text-right">Saldo atual</th>
                <th className="w-24 px-4 py-3 text-right"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ) : contasFiltradas.length === 0 ? (
                <tr><td colSpan={7}>
                  <EstadoVazio
                    icone={<Landmark />}
                    titulo={contas.length === 0 ? "Nenhuma conta cadastrada" : "Nenhuma conta corresponde aos filtros"}
                    descricao={
                      contas.length === 0
                        ? "Cadastre a primeira conta para acompanhar saldo, extrato e conciliação"
                        : "Ajuste o banco ou a busca para ver outras contas"
                    }
                    acao={
                      contas.length === 0 ? (
                        <Button onClick={() => openDialog(null)}>
                          <Plus className="w-4 h-4" /> Nova conta
                        </Button>
                      ) : undefined
                    }
                  />
                </td></tr>
              ) : (
                contasFiltradas.map((c) => {
                  const b = findBanco(c.banco_nome ?? "");
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted">
                      <td className="px-4 py-3">
                        <BancoLogo codigo={b?.codigo} nome={c.banco_nome} size={32} />
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{c.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{TIPOS.find((t) => t.value === c.tipo)?.label ?? c.tipo}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.banco_nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{c.agencia || c.conta ? `${c.agencia ?? "—"} / ${c.conta ?? "—"}` : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatBRL(Number(c.saldo_atual ?? 0))}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" aria-label={`Editar conta ${c.nome}`} onClick={() => openDialog(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Excluir conta ${c.nome}`} onClick={() => setConfirmDel(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
            <DialogTitle>{editing?.id ? "Editar conta" : "Nova conta corrente"}</DialogTitle>
          </DialogHeader>

          {/* Cabeçalho fixo: tipo, instituição, nome, agência, conta */}
          <div className="px-6 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="conta-tipo">Tipo de Conta Corrente *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="conta-tipo"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="conta-instituicao">Instituição</Label>
              <BancoSelectorLogos
                id="conta-instituicao"
                value={banco}
                onChange={(v) => { setBanco(v); if (erros.banco) setErros((p) => ({ ...p, banco: undefined })); }}
                placeholder="Selecione o banco…"
                aria-invalid={!!erros.banco}
                aria-describedby={erros.banco ? "conta-instituicao-erro" : undefined}
                className={cn(erros.banco && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.banco && (
                <p id="conta-instituicao-erro" role="alert" className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.banco}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta-nome">Nome da Conta *</Label>
              <Input
                id="conta-nome"
                value={nome}
                onChange={(e) => { setNome(e.target.value); if (erros.nome) setErros((p) => ({ ...p, nome: undefined })); }}
                placeholder="Ex.: Itaú PJ Principal"
                aria-invalid={!!erros.nome}
                aria-describedby={erros.nome ? "conta-nome-erro" : undefined}
                className={cn(erros.nome && "border-destructive focus-visible:ring-destructive")}
                maxLength={80}
              />
              {erros.nome && (
                <p id="conta-nome-erro" role="alert" className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.nome}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta-agencia">Agência</Label>
              <Input
                id="conta-agencia"
                value={agencia}
                onChange={(e) => { setAgencia(e.target.value.replace(/[^\dxX-]/g, "").slice(0, 7)); if (erros.agencia) setErros((p) => ({ ...p, agencia: undefined })); }}
                placeholder="1234 ou 1234-5"
                aria-invalid={!!erros.agencia}
                aria-describedby={erros.agencia ? "conta-agencia-erro" : undefined}
                inputMode="text"
                className={cn("tabular-nums", erros.agencia && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.agencia && (
                <p id="conta-agencia-erro" role="alert" className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.agencia}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta-numero">Conta Corrente (com dígito)</Label>
              <Input
                id="conta-numero"
                value={conta}
                onChange={(e) => { setConta(e.target.value.replace(/[^\dxX-]/g, "").slice(0, 14)); if (erros.conta) setErros((p) => ({ ...p, conta: undefined })); }}
                placeholder="12345-6"
                aria-invalid={!!erros.conta}
                aria-describedby={erros.conta ? "conta-numero-erro" : undefined}
                inputMode="text"
                className={cn("tabular-nums", erros.conta && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.conta && (
                <p id="conta-numero-erro" role="alert" className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.conta}</p>
              )}
            </div>
          </div>

          {/* Abas: Outras Informações | Sobre a Agência */}
          <Tabs defaultValue="outras" className="px-6 pt-4">
            <TabsList className="grid grid-cols-2 w-full md:w-auto">
              <TabsTrigger value="outras">Outras Informações</TabsTrigger>
              <TabsTrigger value="agencia">Sobre a Agência</TabsTrigger>
            </TabsList>

            <ScrollArea className="max-h-[42vh] mt-3 pr-3">
              <TabsContent value="outras" className="space-y-3 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="conta-saldo-inicial">Saldo Inicial</Label>
                    <MoneyInput
                      id="conta-saldo-inicial"
                      value={saldoInicial}
                      onValueChange={(v) => {
                        setSaldoInicial(v);
                        setPossuiSaldo(v !== 0);
                        if (erros.saldoInicial) setErros((p) => ({ ...p, saldoInicial: undefined }));
                      }}
                      allowNegative
                      aria-invalid={!!erros.saldoInicial}
                      aria-describedby={erros.saldoInicial ? "conta-saldo-inicial-erro" : undefined}
                      className={cn(erros.saldoInicial && "border-destructive focus-visible:ring-destructive")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-data-saldo">Data do Saldo Inicial</Label>
                    <Input
                      id="conta-data-saldo"
                      type="date"
                      value={dataSaldoInicial}
                      onChange={(e) => setDataSaldoInicial(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-limite-credito">Limite de Crédito</Label>
                    <MoneyInput
                      id="conta-limite-credito"
                      value={limiteCredito}
                      onValueChange={setLimiteCredito}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-vinculada">Conta Vinculada</Label>
                    <Select
                      value={contaVinculadaId || "__none__"}
                      onValueChange={(v) => setContaVinculadaId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger id="conta-vinculada"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {contas.filter((c) => c.id !== editing?.id).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md border border-border bg-muted p-4">
                  <Switch
                    id="conta-nao-considerar"
                    checked={naoConsiderar}
                    onCheckedChange={setNaoConsiderar}
                  />
                  <Label htmlFor="conta-nao-considerar" className="font-normal leading-5">
                    Não considerar esta conta no “Resumo”, “Fluxo de Caixa” e “Orçamento de Caixa”
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Use para contas auxiliares (caixinha, garantias, etc.) que não devem entrar nas projeções financeiras.
                    </span>
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conta-observacao">Observação</Label>
                  <Textarea
                    id="conta-observacao"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                    placeholder="Anotações internas sobre esta conta…"
                  />
                </div>

                {erros.saldoInicial && (
                  <p id="conta-saldo-inicial-erro" role="alert" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{erros.saldoInicial}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="agencia" className="space-y-3 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="conta-gerente-nome">Gerente da Conta</Label>
                    <Input id="conta-gerente-nome" value={gerenteNome} onChange={(e) => setGerenteNome(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="conta-gerente-email">E-mail</Label>
                    <Input id="conta-gerente-email" type="email" value={gerenteEmail} onChange={(e) => setGerenteEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-gerente-ddd">DDD</Label>
                    <Input
                      id="conta-gerente-ddd"
                      value={gerenteDdd}
                      onChange={(e) => setGerenteDdd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="conta-gerente-telefone">Telefone</Label>
                    <Input
                      id="conta-gerente-telefone"
                      value={gerenteTelefone}
                      onChange={(e) => setGerenteTelefone(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="conta-endereco">Endereço</Label>
                    <Input id="conta-endereco" value={endLogradouro} onChange={(e) => setEndLogradouro(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-endereco-numero">Número</Label>
                    <Input id="conta-endereco-numero" value={endNumero} onChange={(e) => setEndNumero(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="conta-endereco-bairro">Bairro</Label>
                    <Input id="conta-endereco-bairro" value={endBairro} onChange={(e) => setEndBairro(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="conta-endereco-complemento">Complemento</Label>
                    <Input id="conta-endereco-complemento" value={endComplemento} onChange={(e) => setEndComplemento(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-endereco-estado">Estado</Label>
                    <Select value={endEstado || "__none__"} onValueChange={(v) => setEndEstado(v === "__none__" ? "" : v)}>
                      <SelectTrigger id="conta-endereco-estado"><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">—</SelectItem>
                        {UFS_BRASIL.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="conta-endereco-cidade">Cidade</Label>
                    <Input id="conta-endereco-cidade" value={endCidade} onChange={(e) => setEndCidade(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta-endereco-cep">CEP</Label>
                    <Input
                      id="conta-endereco-cep"
                      value={endCep}
                      onChange={(e) => setEndCep(e.target.value.replace(/[^\d-]/g, "").slice(0, 9))}
                      placeholder="00000-000"
                      className="tabular-nums"
                    />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>Lançamentos vinculados podem ficar órfãos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (confirmDel) await del.mutateAsync(confirmDel); setConfirmDel(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSync} onOpenChange={(o) => !sincronizando && setConfirmSync(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar saldos das contas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação ajusta o saldo atual igualando-o ao saldo inicial cadastrado,
              <strong> apenas para contas que ainda não possuem nenhum lançamento</strong>.
              Contas com movimentações registradas não serão alteradas.
              {candidatasSync > 0 && (
                <span className="block mt-2 text-foreground">
                  {candidatasSync} conta(s) candidata(s) à sincronização.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sincronizando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); sincronizarSaldos(); }}
              disabled={sincronizando}
            >
              {sincronizando ? "Sincronizando…" : "Confirmar sincronização"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
