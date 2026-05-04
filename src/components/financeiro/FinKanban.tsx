import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
  Plus,
  Search,
  Pencil,
  Trash2,
  User2,
  Layers,
  ScanLine,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useLancamentos,
  useUpsertLancamento,
  useDeleteLancamento,
  useMembrosEmpresa,
  type Lancamento,
} from "@/hooks/useFinanceiro";
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
import FinExtracaoDocumentos from "./FinExtracaoDocumentos";
import { toast } from "sonner";

type ColunaKanban = "aberto" | "vence_7d" | "vencido" | "pago";

const COLUNAS: { id: ColunaKanban; nome: string; cor: string; icone: typeof Clock }[] = [
  { id: "aberto",   nome: "Em aberto",        cor: "bg-info/10 border-info/30",               icone: FileText },
  { id: "vence_7d", nome: "Vence em 7 dias",  cor: "bg-warning/10 border-warning/30",         icone: Clock },
  { id: "vencido",  nome: "Vencido",          cor: "bg-destructive/10 border-destructive/30", icone: AlertCircle },
  { id: "pago",     nome: "Concluído",        cor: "bg-success/10 border-success/30",         icone: CheckCircle2 },
];

interface Props {
  tipo: "a_pagar" | "a_receber";
}

type LancamentoCard = Lancamento & {
  conta?: { id: string; nome: string } | null;
  categoria?: { id: string; nome: string; natureza: string } | null;
  pessoa?: { id: string; nome: string } | null;
};

export default function FinKanban({ tipo }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extracaoOpen, setExtracaoOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);
  const [confirmDel, setConfirmDel] = useState<LancamentoCard | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set());
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data = [], isLoading } = useLancamentos({ tipo });
  const { data: membros = [] } = useMembrosEmpresa();
  const upsert = useUpsertLancamento();
  const del = useDeleteLancamento();

  const lancamentos = data as LancamentoCard[];

  const dataReferenciaVenc = (l: LancamentoCard): string =>
    l.data_vencimento ?? l.data_competencia;

  const classificar = (l: LancamentoCard): ColunaKanban => {
    if (l.status === "realizado" || l.status === "conciliado") return "pago";
    const ref = dataReferenciaVenc(l);
    const dias = differenceInDays(parseISO(ref), new Date());
    if (dias < 0) return "vencido";
    if (dias <= 7) return "vence_7d";
    return "aberto";
  };

  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (pendingDeleteIds.has(l.id)) return false;
      if (filtroVendedor !== "todos" && (l as any).vendedor_responsavel_id !== filtroVendedor) {
        return false;
      }
      if (!termo) return true;
      return (
        l.descricao.toLowerCase().includes(termo) ||
        (l.numero_documento ?? "").toLowerCase().includes(termo) ||
        (l.pessoa?.nome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [lancamentos, busca, filtroVendedor, pendingDeleteIds]);

  const total = lancamentosFiltrados.reduce(
    (s, l) => (classificar(l) !== "pago" ? s + Number(l.valor) : s),
    0,
  );

  const marcarPago = async (l: LancamentoCard) => {
    await upsert.mutateAsync({
      id: l.id,
      status: "realizado",
      data_realizado: new Date().toISOString().slice(0, 10),
    } as any);
  };

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const abrirEditar = (l: LancamentoCard) => {
    setEditing(l);
    setDialogOpen(true);
  };

  const nomeVendedor = (id: string | null | undefined) => {
    if (!id) return null;
    const m = membros.find((x) => x.user_id === id);
    return m?.nome_completo || m?.email || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com totalizador, filtros e ação */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Total {tipo === "a_pagar" ? "a pagar" : "a receber"} em aberto
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição, doc ou pessoa…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {membros.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nome_completo || m.email || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{lancamentosFiltrados.length} lançamentos</Badge>
            <Button size="sm" variant="outline" onClick={() => setExtracaoOpen(true)}>
              <ScanLine className="w-4 h-4 mr-1" />
              Extrair de documento
            </Button>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-1" />
              Novo {tipo === "a_pagar" ? "pagamento" : "recebimento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quadro Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUNAS.map((col) => {
          const items = lancamentosFiltrados.filter((l) => classificar(l) === col.id);
          const subtotal = items.reduce((s, l) => s + Number(l.valor), 0);
          const Icone = col.icone;
          return (
            <Card key={col.id} className={`${col.cor} border-2`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icone className="w-4 h-4" />
                  {col.nome}
                </CardTitle>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {items.length} ·{" "}
                  {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[460px]">
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Nenhum item</p>
                    ) : (
                      items.map((l) => {
                        const venc = dataReferenciaVenc(l);
                        const vendedor = nomeVendedor((l as any).vendedor_responsavel_id);
                        const total = Number(l.parcela_total ?? 1);
                        const num = Number(l.parcela_numero ?? 1);
                        const isParcelado = total > 1;
                        return (
                          <Card key={l.id} className="bg-card border shadow-sm">
                            <CardContent className="p-3 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium line-clamp-2 flex-1">
                                  {l.descricao}
                                </p>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => abrirEditar(l)}
                                    title="Editar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setConfirmDel(l)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {l.pessoa?.nome && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {tipo === "a_pagar" ? "Fornecedor" : "Cliente"}: {l.pessoa.nome}
                                </p>
                              )}
                              {l.numero_documento && (
                                <p className="text-[11px] text-muted-foreground">
                                  Doc: {l.numero_documento}
                                  {l.serie_documento ? ` / ${l.serie_documento}` : ""}
                                </p>
                              )}

                              <div className="flex items-center gap-2 flex-wrap">
                                {isParcelado && (
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    <Layers className="w-3 h-3" />
                                    {num}/{total}
                                  </Badge>
                                )}
                                {vendedor && (
                                  <Badge variant="outline" className="text-[10px] gap-1">
                                    <User2 className="w-3 h-3" />
                                    {vendedor}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-muted-foreground">
                                  Venc: {format(parseISO(venc), "dd/MM/yy", { locale: ptBR })}
                                </span>
                                <span className="text-sm font-semibold tabular-nums">
                                  {Number(l.valor).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </span>
                              </div>

                              {col.id !== "pago" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs"
                                  onClick={() => marcarPago(l)}
                                  disabled={upsert.isPending}
                                >
                                  {tipo === "a_pagar" ? "Marcar pago" : "Marcar recebido"}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        defaultTipo={tipo}
      />

      <FinExtracaoDocumentos
        open={extracaoOpen}
        onOpenChange={setExtracaoOpen}
        tipo={tipo}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel ? (
                <>
                  Esta ação removerá permanentemente o lançamento
                  {confirmDel.descricao ? ` "${confirmDel.descricao}"` : ""}. Não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDel) await del.mutateAsync(confirmDel.id);
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
