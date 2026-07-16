import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  useLancamentos,
  useContas,
  useDeleteLancamento,
  type LancamentoFiltro,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import { formatBRL, formatDate, statusColor, statusLabel, tipoLabel } from "@/lib/financeiro/formatters";
import LancamentoDialog from "./LancamentoDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinLancamentos() {
  const [searchParams] = useSearchParams();
  const loteParam = searchParams.get("lote") || undefined;
  const [filtro, setFiltro] = useState<LancamentoFiltro>({ tipo: "todos", status: "todos", origemTipo: "todos", origemLoteId: loteParam });
  useEffect(() => {
    setFiltro((f) => ({ ...f, origemLoteId: loteParam }));
  }, [loteParam]);
  const { data: lancs = [], isLoading } = useLancamentos(filtro);
  const { data: contas = [] } = useContas();
  const del = useDeleteLancamento();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              className="pl-8"
              value={filtro.busca ?? ""}
              onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
            />
          </div>
          <Select
            value={filtro.tipo ?? "todos"}
            onValueChange={(v) => setFiltro((f) => ({ ...f, tipo: v as LancamentoFiltro["tipo"] }))}
          >
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="a_pagar">A pagar</SelectItem>
              <SelectItem value="a_receber">A receber</SelectItem>
              <SelectItem value="movimento_bancario">Movimento</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filtro.status ?? "todos"}
            onValueChange={(v) => setFiltro((f) => ({ ...f, status: v as LancamentoFiltro["status"] }))}
          >
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="previsto">Previsto</SelectItem>
              <SelectItem value="realizado">Realizado</SelectItem>
              <SelectItem value="conciliado">Conciliado</SelectItem>
              <SelectItem value="em_atraso">Em atraso</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filtro.contaId ?? "todos"}
            onValueChange={(v) => setFiltro((f) => ({ ...f, contaId: v }))}
          >
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as contas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtro.origemTipo ?? "todos"}
            onValueChange={(v) => setFiltro((f) => ({ ...f, origemTipo: v as LancamentoFiltro["origemTipo"] }))}
          >
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="importacao_csv">Importação CSV</SelectItem>
              <SelectItem value="importacao_ofx">Importação OFX</SelectItem>
              <SelectItem value="importacao_xml">Importação XML</SelectItem>
              <SelectItem value="sefaz_nfe">SEFAZ NF-e</SelectItem>
              <SelectItem value="pluggy">Open Finance</SelectItem>
              <SelectItem value="cnab">CNAB</SelectItem>
              <SelectItem value="dda">DDA</SelectItem>
              <SelectItem value="ocr">OCR</SelectItem>
              <SelectItem value="recorrencia">Recorrência</SelectItem>
              <SelectItem value="folha_pagamento">Folha</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="seed">Seed</SelectItem>
              <SelectItem value="demo">Demo</SelectItem>
              <SelectItem value="migracao">Migração</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-[160px]"
            value={filtro.dataInicio ?? ""}
            onChange={(e) => setFiltro((f) => ({ ...f, dataInicio: e.target.value }))}
          />
          <Input
            type="date"
            className="w-[160px]"
            value={filtro.dataFim ?? ""}
            onChange={(e) => setFiltro((f) => ({ ...f, dataFim: e.target.value }))}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo lançamento
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Competência</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Categoria</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Pessoa</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Conta</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Tipo</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Status</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Valor</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="p-2"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : lancs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      Nenhum lançamento. Clique em "Novo lançamento" para começar.
                    </td>
                  </tr>
                ) : (
                  lancs.map((l) => {
                    const isReceita = l.natureza === "receita";
                    return (
                      <tr key={l.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.data_competencia)}</td>
                        <td className="px-3 py-2 max-w-[280px] truncate" title={l.descricao}>{l.descricao}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate whitespace-nowrap" title={l.categoria?.nome ?? ""}>{l.categoria?.nome ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate whitespace-nowrap" title={l.pessoa?.nome ?? ""}>{l.pessoa?.nome ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate whitespace-nowrap" title={l.conta?.nome ?? ""}>{l.conta?.nome ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{tipoLabel[l.tipo] ?? l.tipo}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge className={`text-xs ring-1 whitespace-nowrap ${statusColor[l.status] ?? ""}`} variant="outline">
                            {statusLabel[l.status] ?? l.status}
                          </Badge>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {isReceita ? "+" : "−"} {formatBRL(Number(l.valor))}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDel(l.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LancamentoDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDel) await del.mutateAsync(confirmDel);
                setConfirmDel(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
