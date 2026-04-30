import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContas, useUpsertConta, useDeleteConta, type Conta } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import BancoSelectorLogos, { BancoLogo, findBanco } from "./BancoSelectorLogos";

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Conta | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [filtroBanco, setFiltroBanco] = useState<string>("");
  const [busca, setBusca] = useState("");

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("corrente");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState(0);

  const openDialog = (c: Conta | null) => {
    setEditing(c);
    setNome(c?.nome ?? "");
    setTipo(c?.tipo ?? "corrente");
    setBanco(c?.banco_nome ?? "");
    setAgencia(c?.agencia ?? "");
    setConta(c?.conta ?? "");
    setSaldoInicial(Number(c?.saldo_inicial ?? 0));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      nome: nome.trim(),
      tipo,
      banco_nome: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      saldo_inicial: saldoInicial,
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Itaú PJ Principal" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Input value={conta} onChange={(e) => setConta(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Saldo inicial</Label>
              <MoneyInput value={saldoInicial} onValueChange={setSaldoInicial} allowNegative />
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
    </div>
  );
}
