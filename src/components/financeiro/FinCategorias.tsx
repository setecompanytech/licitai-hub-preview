import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <RefreshCw className={sync.isPending ? "animate-spin" : undefined} aria-hidden="true" />
          {sync.isPending ? "Sincronizando..." : "Sincronizar com Plano de Contas"}
        </Button>
        {cats.length === 0 && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles aria-hidden="true" />
            {seed.isPending ? "Importando..." : "Importar plano de contas padrão"}
          </Button>
        )}
        <Button onClick={() => openDialog(null)}><Plus aria-hidden="true" /> Nova categoria</Button>
      </div>

      {/* Tabela nos primitivos de `ui/table`: cabeçalho em superfície rebaixada,
          rótulos 12/600 sem caixa alta, linhas de 48px (Design System v3). */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Grupo DRE</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Espera na forma das linhas — código, nome, selo —, não uma
                // barra única.
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <div role="status" aria-label="Carregando categorias" className="flex flex-col gap-px bg-border">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-5 w-20 rounded-sm" />
                          <Skeleton className="ml-auto h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ) : cats.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EstadoVazio
                      icone={<Tags aria-hidden="true" />}
                      titulo="Nenhuma categoria cadastrada"
                      descricao='Use "Importar plano de contas padrão" para começar, ou crie a primeira categoria.'
                      acao={
                        <Button onClick={() => openDialog(null)}>
                          <Plus aria-hidden="true" /> Nova categoria
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                cats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.codigo}</TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <Badge variant={c.natureza === "receita" ? "success" : c.natureza === "despesa" ? "danger" : "info"}>
                        {NATUREZAS.find((n) => n.value === c.natureza)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.grupo_dre ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar categoria ${c.nome}`} onClick={() => openDialog(c)}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button size="icon-sm" variant="ghost-destructive" aria-label={`Excluir categoria ${c.nome}`} onClick={() => setConfirmDel(c.id)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <p id="cat-codigo-erro" className="text-xs text-destructive-ink">Informe o código da categoria</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cat-nome">Nome *</Label>
              <Input
                id="cat-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-invalid={tentouSalvar && !nome.trim()}
                aria-describedby={tentouSalvar && !nome.trim() ? "cat-nome-erro" : undefined}
              />
              {tentouSalvar && !nome.trim() && (
                <p id="cat-nome-erro" className="text-xs text-destructive-ink">Informe o nome da categoria</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-3">
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
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={async () => { if (confirmDel) await del.mutateAsync(confirmDel); setConfirmDel(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
