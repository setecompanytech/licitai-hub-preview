import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
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
  GripVertical,
  X,
  Filter,
  CheckSquare,
} from "lucide-react";
import { format, differenceInDays, parseISO, isToday, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useLancamentos,
  useUpsertLancamento,
  useDeleteLancamento,
  useMembrosEmpresa,
  useCategorias,
  usePessoas,
  useContas,
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

type VencFiltro = "todos" | "hoje" | "semana" | "mes" | "atrasados";

export default function FinKanban({ tipo }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [filtroPessoa, setFiltroPessoa] = useState<string>("todos");
  const [filtroConta, setFiltroConta] = useState<string>("todos");
  const [filtroVenc, setFiltroVenc] = useState<VencFiltro>("todos");
  const [valorMin, setValorMin] = useState<string>("");
  const [valorMax, setValorMax] = useState<string>("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extracaoOpen, setExtracaoOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);
  const [confirmDel, setConfirmDel] = useState<LancamentoCard | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set());
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColunaKanban | null>(null);
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data = [], isLoading } = useLancamentos({ tipo });
  const { data: membros = [] } = useMembrosEmpresa();
  const { data: categorias = [] } = useCategorias();
  const { data: pessoas = [] } = usePessoas();
  const { data: contas = [] } = useContas();
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

  const matchVencimento = (l: LancamentoCard): boolean => {
    if (filtroVenc === "todos") return true;
    const ref = parseISO(dataReferenciaVenc(l));
    if (filtroVenc === "hoje") return isToday(ref);
    if (filtroVenc === "semana") return isThisWeek(ref, { weekStartsOn: 1 });
    if (filtroVenc === "mes") return isThisMonth(ref);
    if (filtroVenc === "atrasados") {
      return l.status !== "realizado" && l.status !== "conciliado" && differenceInDays(ref, new Date()) < 0;
    }
    return true;
  };

  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const vMin = valorMin ? Number(valorMin) : null;
    const vMax = valorMax ? Number(valorMax) : null;
    return lancamentos.filter((l) => {
      if (pendingDeleteIds.has(l.id)) return false;
      if (filtroVendedor !== "todos" && (l as any).vendedor_responsavel_id !== filtroVendedor) return false;
      if (filtroCategoria !== "todos" && l.categoria_id !== filtroCategoria) return false;
      if (filtroPessoa !== "todos" && l.pessoa_id !== filtroPessoa) return false;
      if (filtroConta !== "todos" && l.conta_id !== filtroConta) return false;
      if (!matchVencimento(l)) return false;
      const valor = Number(l.valor);
      if (vMin !== null && valor < vMin) return false;
      if (vMax !== null && valor > vMax) return false;
      if (!termo) return true;
      return (
        l.descricao.toLowerCase().includes(termo) ||
        (l.numero_documento ?? "").toLowerCase().includes(termo) ||
        (l.pessoa?.nome ?? "").toLowerCase().includes(termo) ||
        (l.categoria?.nome ?? "").toLowerCase().includes(termo)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentos, busca, filtroVendedor, filtroCategoria, filtroPessoa, filtroConta, filtroVenc, valorMin, valorMax, pendingDeleteIds]);

  const filtrosAtivos =
    (filtroVendedor !== "todos" ? 1 : 0) +
    (filtroCategoria !== "todos" ? 1 : 0) +
    (filtroPessoa !== "todos" ? 1 : 0) +
    (filtroConta !== "todos" ? 1 : 0) +
    (filtroVenc !== "todos" ? 1 : 0) +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0);

  const limparFiltros = () => {
    setFiltroVendedor("todos");
    setFiltroCategoria("todos");
    setFiltroPessoa("todos");
    setFiltroConta("todos");
    setFiltroVenc("todos");
    setValorMin("");
    setValorMax("");
    setBusca("");
  };

  const total = lancamentosFiltrados.reduce(
    (s, l) => (classificar(l) !== "pago" ? s + Number(l.valor) : s),
    0,
  );

  // ===== Seleção em lote =====
  const idsSelecionaveis = lancamentosFiltrados.filter((l) => classificar(l) !== "pago").map((l) => l.id);
  const totalSelecionado = lancamentosFiltrados
    .filter((l) => selecionados.has(l.id))
    .reduce((s, l) => s + Number(l.valor), 0);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selecionarTodosVisiveis = () => setSelecionados(new Set(idsSelecionaveis));
  const limparSelecao = () => setSelecionados(new Set());
  const marcarSelecionadosPagos = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const ids = Array.from(selecionados);
    try {
      await Promise.all(
        ids.map((id) => upsert.mutateAsync({ id, status: "realizado", data_realizado: hoje } as any)),
      );
      toast.success(`${ids.length} lançamento(s) marcados como ${tipo === "a_pagar" ? "pagos" : "recebidos"}.`);
      limparSelecao();
    } catch {
      toast.error("Falha ao atualizar alguns lançamentos.");
    }
  };

  const marcarPago = async (l: LancamentoCard) => {
    await upsert.mutateAsync({
      id: l.id,
      status: "realizado",
      data_realizado: new Date().toISOString().slice(0, 10),
    } as any);
  };

  const agendarExclusao = (l: LancamentoCard) => {
    const id = l.id;
    // Esconde imediatamente
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    let cancelado = false;
    const timer = setTimeout(async () => {
      pendingTimersRef.current.delete(id);
      if (cancelado) return;
      try {
        await del.mutateAsync(id);
      } catch (e) {
        // Em caso de falha, restaura na lista
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error("Não foi possível excluir o lançamento.");
      }
    }, 6000);
    pendingTimersRef.current.set(id, timer);

    toast(`Lançamento "${l.descricao}" excluído`, {
      description: "Você pode desfazer nos próximos 6 segundos.",
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          cancelado = true;
          const t = pendingTimersRef.current.get(id);
          if (t) clearTimeout(t);
          pendingTimersRef.current.delete(id);
          setPendingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.success("Exclusão desfeita.");
        },
      },
    });
  };

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const abrirEditar = (l: LancamentoCard) => {
    setEditing(l);
    setDialogOpen(true);
  };

  // ===== Drag & Drop entre colunas =====
  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDragItemId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch {}
  };
  const handleDragEnd = () => {
    setDragItemId(null);
    setDragOverCol(null);
  };
  const handleColDragOver = (colId: ColunaKanban) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };
  const handleColDrop = (colId: ColunaKanban) => async (e: React.DragEvent) => {
    e.preventDefault();
    const id = dragItemId;
    setDragOverCol(null);
    setDragItemId(null);
    if (!id) return;
    const lanc = lancamentos.find((x) => x.id === id);
    if (!lanc) return;
    const colAtual = classificar(lanc);
    if (colAtual === colId) return;

    try {
      if (colId === "pago") {
        await upsert.mutateAsync({
          id,
          status: "realizado",
          data_realizado: new Date().toISOString().slice(0, 10),
        } as any);
        toast.success("Lançamento marcado como concluído.");
      } else {
        // Tirar de "pago" → volta para previsto; recalcula coluna pelo vencimento
        await upsert.mutateAsync({
          id,
          status: "previsto",
          data_realizado: null,
        } as any);
        toast.success("Lançamento reaberto.");
      }
    } catch {
      toast.error("Não foi possível mover o lançamento.");
    }
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
            <Card
              key={col.id}
              className={cn(
                col.cor,
                "border-2 kanban-col transition-shadow",
                dragOverCol === col.id && "ring-2 ring-primary/40 shadow-lg",
              )}
              onDragOver={handleColDragOver(col.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol((cur) => (cur === col.id ? null : cur));
                }
              }}
              onDrop={handleColDrop(col.id)}
            >
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
              <CardContent className="p-2 kanban-col">
                <div className="h-[min(65vh,520px)] overflow-y-auto overflow-x-hidden pr-1 kanban-col-scroll">
                  <div className="kanban-col-body">
                    {items.length === 0 ? (
                      <div className="border-2 border-dashed border-border/40 rounded-md py-8 text-center">
                        <p className="text-xs text-muted-foreground">
                          {dragOverCol === col.id ? "Solte aqui" : "Nenhum item"}
                        </p>
                      </div>
                    ) : (
                      items.map((l) => {
                        const venc = dataReferenciaVenc(l);
                        const vendedor = nomeVendedor((l as any).vendedor_responsavel_id);
                        const total = Number(l.parcela_total ?? 1);
                        const num = Number(l.parcela_numero ?? 1);
                        const isParcelado = total > 1;
                        const isDragging = dragItemId === l.id;
                        return (
                          <Card
                            key={l.id}
                            className={cn(
                              "bg-card border shadow-sm kanban-card cursor-grab active:cursor-grabbing transition-all",
                              isDragging && "opacity-40 scale-[0.98]",
                            )}
                            draggable
                            onDragStart={handleDragStart(l.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <CardContent className="p-3 space-y-1.5 kanban-card-body">
                              <div className="flex items-start gap-1.5 min-w-0 max-w-full">
                                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                                <p className="kanban-card-title flex-1" title={l.descricao}>
                                  {l.descricao}
                                </p>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => { e.stopPropagation(); abrirEditar(l); }}
                                    title="Editar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => { e.stopPropagation(); setConfirmDel(l); }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {l.pessoa?.nome && (
                                <p
                                  className="kanban-card-meta"
                                  title={`${tipo === "a_pagar" ? "Fornecedor" : "Cliente"}: ${l.pessoa.nome}`}
                                >
                                  {tipo === "a_pagar" ? "Fornecedor" : "Cliente"}: {l.pessoa.nome}
                                </p>
                              )}
                              {l.numero_documento && (
                                <p className="kanban-card-meta">
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
                                  <Badge variant="outline" className="text-[10px] gap-1 max-w-full truncate">
                                    <User2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{vendedor}</span>
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  Venc: {format(parseISO(venc), "dd/MM/yy", { locale: ptBR })}
                                </span>
                                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
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
                                  onClick={(e) => { e.stopPropagation(); marcarPago(l); }}
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
                </div>
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
              onClick={() => {
                if (confirmDel) agendarExclusao(confirmDel);
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
