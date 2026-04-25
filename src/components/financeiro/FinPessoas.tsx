import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePessoas, useUpsertPessoa, useDeletePessoa, type Pessoa } from "@/hooks/useFinanceiro";
import { formatDocumento } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TIPOS = [
  { value: "fornecedor", label: "Fornecedor" },
  { value: "cliente", label: "Cliente" },
  { value: "colaborador", label: "Colaborador" },
  { value: "socio", label: "Sócio" },
  { value: "outro", label: "Outro" },
];

export default function FinPessoas() {
  const { data: pessoas = [], isLoading } = usePessoas();
  const upsert = useUpsertPessoa();
  const del = useDeletePessoa();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [tipo, setTipo] = useState("fornecedor");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const openDialog = (p: Pessoa | null) => {
    setEditing(p);
    setNome(p?.nome ?? "");
    setDocumento(p?.documento ?? "");
    setTipo(p?.pessoa_tipo ?? "fornecedor");
    setEmail(p?.email ?? "");
    setTelefone(p?.telefone ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      nome: nome.trim(),
      documento: documento.replace(/\D/g, ""),
      pessoa_tipo: tipo,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
    });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => openDialog(null)}>
          <Plus className="w-4 h-4 mr-1" /> Nova pessoa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Documento</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Contato</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
              ) : pessoas.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma pessoa cadastrada.</td></tr>
              ) : (
                pessoas.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{p.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{p.documento ? formatDocumento(p.documento) : "—"}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{TIPOS.find((t) => t.value === p.pessoa_tipo)?.label ?? p.pessoa_tipo}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{p.email ?? p.telefone ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openDialog(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar pessoa" : "Nova pessoa"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome / Razão social *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
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
            <AlertDialogTitle>Excluir pessoa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
