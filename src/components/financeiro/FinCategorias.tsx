import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sparkles, RefreshCw, Tags } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
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
  // Só depois da primeira tentativa de salvar o erro aparece junto ao campo —
  // avisar antes de o usuário digitar é ruído, não ajuda.
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const openDialog = (c: Categoria | null) => {
    setEditing(c);
    setCodigo(c?.codigo ?? "");
    setNome(c?.nome ?? "");
    setNatureza((c?.natureza as Natureza) ?? "despesa");
    setTentouSalvar(false);
    setOpen(true);
  };

  const handleSave = async () => {
    setTentouSalvar(true);
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
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          title="Importa todas as contas do Plano de Contas Padrão (Configurável) para a lista de Categorias"
        >
          <RefreshCw className={`w-4 h-4 ${sync.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
          {sync.isPending ? "Sincronizando..." : "Sincronizar com Plano de Contas"}
        </Button>
        {cats.length === 0 && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {seed.isPending ? "Importando..." : "Importar plano de contas padrão"}
          </Button>
        )}
        <Button onClick={() => openDialog(null)}><Plus className="w-4 h-4" aria-hidden="true" /> Nova categoria</Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-sm font-semibold text-foreground">
              <tr>
                <th className="w-32 px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Natureza</th>
                <th className="px-4 py-3 text-left">Grupo DRE</th>
                <th className="w-24 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ) : cats.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EstadoVazio
                      icone={<Tags aria-hidden="true" />}
                      titulo="Nenhuma categoria cadastrada"
                      descricao='Use "Importar plano de contas padrão" para começar, ou crie a primeira categoria.'
                      acao={
                        <Button onClick={() => openDialog(null)}>
                          <Plus className="w-4 h-4" aria-hidden="true" /> Nova categoria
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                cats.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.codigo}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.natureza === "receita" ? "success" : c.natureza === "despesa" ? "danger" : "info"}>
                        {NATUREZAS.find((n) => n.value === c.natureza)?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.grupo_dre ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" aria-label={`Editar categoria ${c.nome}`} onClick={() => openDialog(c)}>
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Excluir categoria ${c.nome}`} onClick={() => setConfirmDel(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                      </Button>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cat-codigo">Código *</Label>
              <Input
                id="cat-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="3.1.01"
                aria-invalid={tentouSalvar && !codigo.trim()}
                aria-describedby={tentouSalvar && !codigo.trim() ? "cat-codigo-erro" : undefined}
              />
              {tentouSalvar && !codigo.trim() && (
                <p id="cat-codigo-erro" className="text-xs text-destructive">Informe o código da categoria</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cat-nome">Nome *</Label>
              <Input
                id="cat-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-invalid={tentouSalvar && !nome.trim()}
                aria-describedby={tentouSalvar && !nome.trim() ? "cat-nome-erro" : undefined}
              />
              {tentouSalvar && !nome.trim() && (
                <p id="cat-nome-erro" className="text-xs text-destructive">Informe o nome da categoria</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="cat-natureza">Natureza</Label>
              <Select value={natureza} onValueChange={(v) => setNatureza(v as Natureza)}>
                <SelectTrigger id="cat-natureza"><SelectValue /></SelectTrigger>
                <SelectContent>{NATUREZAS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
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
