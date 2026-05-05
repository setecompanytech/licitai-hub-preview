import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sparkles, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCategorias, useUpsertCategoria, useDeleteCategoria, useSeedPlanoContas,
  useSyncPlanoContasCategorias,
  type Categoria,
} from "@/hooks/useFinanceiro";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Natureza = Database["public"]["Enums"]["financeiro_natureza"];

const NATUREZAS: { value: Natureza; label: string }[] = [
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "movimentacao", label: "Movimentação" },
];

export default function FinCategorias() {
  const { data: cats = [], isLoading } = useCategorias();
  const upsert = useUpsertCategoria();
  const del = useDeleteCategoria();
  const seed = useSeedPlanoContas();
  const sync = useSyncPlanoContasCategorias();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [natureza, setNatureza] = useState<Natureza>("despesa");

  const openDialog = (c: Categoria | null) => {
    setEditing(c);
    setCodigo(c?.codigo ?? "");
    setNome(c?.nome ?? "");
    setNatureza((c?.natureza as Natureza) ?? "despesa");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!codigo.trim() || !nome.trim()) return;
    await upsert.mutateAsync({
      id: editing?.id,
      codigo: codigo.trim(),
      nome: nome.trim(),
      natureza,
    });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {cats.length === 0 && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles className="w-4 h-4 mr-1" />
            {seed.isPending ? "Importando..." : "Importar plano de contas padrão"}
          </Button>
        )}
        <Button onClick={() => openDialog(null)}><Plus className="w-4 h-4 mr-1" /> Nova categoria</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-32">Código</th>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Natureza</th>
                <th className="text-left px-3 py-2">Grupo DRE</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
              ) : cats.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                  Nenhuma categoria. Use "Importar plano de contas padrão" para começar.
                </td></tr>
              ) : (
                cats.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.codigo}</td>
                    <td className="px-3 py-2 font-medium">{c.nome}</td>
                    <td className="px-3 py-2">
                      <Badge variant={c.natureza === "receita" ? "default" : c.natureza === "despesa" ? "destructive" : "secondary"}>
                        {NATUREZAS.find((n) => n.value === c.natureza)?.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{c.grupo_dre ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openDialog(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="3.1.01" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label>Natureza</Label>
              <Select value={natureza} onValueChange={(v) => setNatureza(v as Natureza)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NATUREZAS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !codigo.trim() || !nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>Lançamentos vinculados ficarão sem categoria.</AlertDialogDescription>
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
