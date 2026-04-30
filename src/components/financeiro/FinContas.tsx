import { useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContas, useUpsertConta, useDeleteConta, useEmpresaId, type Conta } from "@/hooks/useFinanceiro";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
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
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "caixa", label: "Caixa / dinheiro" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "investimento", label: "Investimento" },
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
      const msg = e instanceof Error ? e.message : "Falha ao sincronizar saldos.";
      toast.error(msg);
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
  const [erros, setErros] = useState<Erros>({});

  // Reseta o formulário (usado ao fechar o diálogo, evitando resíduos
  // entre uma edição e a próxima abertura como "Nova conta").
  const resetForm = () => {
    setEditing(null);
    setNome("");
    setTipo("corrente");
    setBanco("");
    setAgencia("");
    setConta("");
    setSaldoInicial(0);
    setPossuiSaldo(false);
    setErros({});
  };

  const openDialog = (c: Conta | null) => {
    setEditing(c);
    setNome(c?.nome ?? "");
    setTipo(c?.tipo ?? "corrente");
    setBanco(c?.banco_nome ?? "");
    setAgencia(c?.agencia ?? "");
    setConta(c?.conta ?? "");
    // saldo_inicial pode vir como número, string numérica ou null no Postgres.
    // Normaliza com segurança e considera negativo como "possui saldo".
    const raw = c?.saldo_inicial;
    const si = raw === null || raw === undefined ? 0 : Number(raw);
    const siSeguro = Number.isFinite(si) ? si : 0;
    setSaldoInicial(siSeguro);
    setPossuiSaldo(siSeguro !== 0);
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
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      saldo_inicial: possuiSaldo ? saldoInicial : 0,
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
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Filtrar por banco</Label>
          <BancoSelectorLogos
            value={filtroBanco}
            onChange={setFiltroBanco}
            allowAll
            placeholder="Todos os bancos"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, agência ou número da conta…"
          />
        </div>
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
          <RefreshCw className={cn("w-4 h-4 mr-1", sincronizando && "animate-spin")} />
          {sincronizando ? "Sincronizando…" : "Sincronizar saldos"}
          {candidatasSync > 0 && !sincronizando && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px] tabular-nums">
              {candidatasSync}
            </span>
          )}
        </Button>
        <Button onClick={() => openDialog(null)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nova conta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Banco</th>
                <th className="text-left px-3 py-2">Ag./Conta</th>
                <th className="text-right px-3 py-2">Saldo atual</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
              ) : contasFiltradas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  {contas.length === 0 ? "Nenhuma conta cadastrada." : "Nenhuma conta corresponde aos filtros."}
                </td></tr>
              ) : (
                contasFiltradas.map((c) => {
                  const b = findBanco(c.banco_nome ?? "");
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <BancoLogo codigo={b?.codigo} nome={c.banco_nome} size={32} />
                      </td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{c.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{TIPOS.find((t) => t.value === c.tipo)?.label ?? c.tipo}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.banco_nome ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">{c.agencia || c.conta ? `${c.agencia ?? "—"} / ${c.conta ?? "—"}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(Number(c.saldo_atual ?? 0))}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => { setNome(e.target.value); if (erros.nome) setErros((p) => ({ ...p, nome: undefined })); }}
                placeholder="Ex.: Itaú PJ Principal"
                aria-invalid={!!erros.nome}
                className={cn(erros.nome && "border-destructive focus-visible:ring-destructive")}
                maxLength={80}
              />
              {erros.nome && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.nome}</p>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Banco</Label>
              <BancoSelectorLogos
                value={banco}
                onChange={(v) => { setBanco(v); if (erros.banco) setErros((p) => ({ ...p, banco: undefined })); }}
                placeholder="Selecione o banco…"
                className={cn(erros.banco && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.banco && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.banco}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Input
                value={agencia}
                onChange={(e) => { setAgencia(e.target.value.replace(/[^\dxX-]/g, "").slice(0, 7)); if (erros.agencia) setErros((p) => ({ ...p, agencia: undefined })); }}
                placeholder="1234 ou 1234-5"
                aria-invalid={!!erros.agencia}
                inputMode="text"
                className={cn("tabular-nums", erros.agencia && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.agencia && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.agencia}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Input
                value={conta}
                onChange={(e) => { setConta(e.target.value.replace(/[^\dxX-]/g, "").slice(0, 14)); if (erros.conta) setErros((p) => ({ ...p, conta: undefined })); }}
                placeholder="12345-6"
                aria-invalid={!!erros.conta}
                inputMode="text"
                className={cn("tabular-nums", erros.conta && "border-destructive focus-visible:ring-destructive")}
              />
              {erros.conta && (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.conta}</p>
              )}
            </div>
            <div className="col-span-2 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={possuiSaldo}
                  onCheckedChange={(v) => {
                    const marcado = v === true;
                    setPossuiSaldo(marcado);
                    if (!marcado) {
                      setSaldoInicial(0);
                      if (erros.saldoInicial) setErros((p) => ({ ...p, saldoInicial: undefined }));
                    }
                  }}
                  className="mt-0.5"
                />
                <span className="text-sm leading-tight">
                  Esta conta possui saldo disponível
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Marque para informar o saldo inicial. Caso contrário, a conta começa com R$ 0,00.
                  </span>
                </span>
              </label>
              {possuiSaldo && (
                <div className="space-y-1.5 pl-6">
                  <Label className="text-xs text-muted-foreground">Saldo inicial *</Label>
                  <MoneyInput
                    value={saldoInicial}
                    onValueChange={(v) => {
                      setSaldoInicial(v);
                      if (erros.saldoInicial) setErros((p) => ({ ...p, saldoInicial: undefined }));
                    }}
                    allowNegative
                    className={cn(erros.saldoInicial && "border-destructive focus-visible:ring-destructive")}
                  />
                  {erros.saldoInicial && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{erros.saldoInicial}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
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
