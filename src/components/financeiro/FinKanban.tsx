import { useMemo, useRef, useState } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
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
import { useQueryClient } from "@tanstack/react-query";

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

  const qc = useQueryClient();
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

  const saldoContaAtual = useMemo(() => {
    if (filtroConta === "todos") {
      return contas.reduce((s, c) => s + Number((c as any).saldo_atual ?? 0), 0);
    }
    const c = contas.find((ct) => ct.id === filtroConta);
    return Number((c as any)?.saldo_atual ?? 0);
  }, [contas, filtroConta]);

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
    const hoje = hojeLocal();
    const ids = Array.from(selecionados);
    try {
      await Promise.all(
        ids.map(async (id) => {
          await upsert.mutateAsync({ id, status: "realizado", data_realizado: hoje } as any);
        }),
      );
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
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
      data_realizado: hojeLocal(),
    } as any);
    if (l.conta_id) {
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
    }
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
        await del.mutateAsync({ id, contaId: l.conta_id, valor: Number(l.valor), natureza: l.natureza, status: l.status });
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
          data_realizado: hojeLocal(),
        } as any);
        qc.invalidateQueries({ queryKey: ["fin-contas"] });
        qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
        qc.invalidateQueries({ queryKey: ["fin-resumo"] });
        toast.success("Lançamento marcado como concluído.");
      } else {
        // Tirar de "pago" → volta para previsto; reverte saldo
        await upsert.mutateAsync({
          id,
          status: "previsto",
          data_realizado: null,
        } as any);
        qc.invalidateQueries({ queryKey: ["fin-contas"] });
        qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
        qc.invalidateQueries({ queryKey: ["fin-resumo"] });
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

  const VENC_CHIPS: { id: VencFiltro; label: string }[] = [
    { id: "todos", label: "Todos vencimentos" },
    { id: "atrasados", label: "Atrasados" },
    { id: "hoje", label: "Hoje" },
    { id: "semana", label: "Esta semana" },
    { id: "mes", label: "Este mês" },
  ];

  return (
    <div className="space-y-4">
      {/* Cabeçalho com totalizador, busca e ações */}
      <Card>
        {/* Dois indicadores empilhados à esquerda deixavam um vazio morto no
            centro, e a ação principal caía sozinha numa segunda linha. Agora os
            indicadores correm LADO A LADO no topo, e a barra de ações ocupa a
            largura toda embaixo — com a busca esticando para preencher o vão. */}
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3">
            <div>
              {/* A contagem vive AO LADO do total que ela qualifica — no meio da
                  barra de ações ela era informação espremida entre botões,
                  quebrando o fluxo de quem procura um comando. */}
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Total {tipo === "a_pagar" ? "a pagar" : "a receber"} em aberto
                <Badge variant="outline" className="font-normal">
                  {lancamentosFiltrados.length} lançamento{lancamentosFiltrados.length === 1 ? "" : "s"}
                </Badge>
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="w-px bg-border hidden sm:block" />
            <div>
              <p className="text-sm text-muted-foreground">
                Saldo atual {filtroConta !== "todos" ? `· ${contas.find((c) => c.id === filtroConta)?.nome ?? ""}` : "· todas as contas"}
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", saldoContaAtual >= 0 ? "text-success" : "text-destructive")}>
                {saldoContaAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição, doc, pessoa ou categoria…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-9 w-full"
              />
            </div>
            <Button
              size="sm"
              variant={mostrarFiltros || filtrosAtivos > 0 ? "default" : "outline"}
              onClick={() => setMostrarFiltros((v) => !v)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filtros
              {filtrosAtivos > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {filtrosAtivos}
                </Badge>
              )}
            </Button>
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

      {/* Chips de vencimento (sempre visíveis para acesso rápido) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VENC_CHIPS.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={filtroVenc === c.id ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            onClick={() => setFiltroVenc(c.id)}
          >
            {c.label}
          </Button>
        ))}
        {filtrosAtivos > 0 && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={limparFiltros}>
            <X className="w-3.5 h-3.5 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Painel expansível de filtros avançados */}
      {mostrarFiltros && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as categorias</SelectItem>
                  {categorias
                    .filter((c) => tipo === "a_pagar" ? c.natureza !== "receita" : c.natureza !== "despesa")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {tipo === "a_pagar" ? "Fornecedor" : "Cliente"}
              </label>
              <Select value={filtroPessoa} onValueChange={setFiltroPessoa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {pessoas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Conta</label>
              <Select value={filtroConta} onValueChange={setFiltroConta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Responsável</label>
              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os responsáveis</SelectItem>
                  {membros.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.nome_completo || m.email || m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor mínimo (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor máximo (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={valorMax}
                onChange={(e) => setValorMax(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de seleção em lote */}
      {selecionados.size > 0 && (
        <Card className="border-border/60 bg-muted/40">
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
              <span>
                <strong>{selecionados.size}</strong> selecionado(s) ·{" "}
                <span className="tabular-nums font-semibold">
                  {totalSelecionado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </span>
              {idsSelecionaveis.length > selecionados.size && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selecionarTodosVisiveis}>
                  Selecionar todos visíveis ({idsSelecionaveis.length})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={limparSelecao}>Cancelar</Button>
              <Button size="sm" onClick={marcarSelecionadosPagos} disabled={upsert.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Marcar como {tipo === "a_pagar" ? "pago" : "recebido"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              <CardHeader className="pb-2 space-y-1">
                <CardTitle className="text-sm flex items-center gap-2 min-w-0">
                  <Icone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{col.nome}</span>
                  {/* A contagem como selo, não como parte da mesma frase do
                      valor: eram dois números de naturezas diferentes colados
                      por um ponto, e a leitura tropeçava nos dois. */}
                  <span className="ml-auto shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                    {items.length}
                  </span>
                </CardTitle>
                <p className="text-sm font-semibold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                  {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardHeader>
              <CardContent className="p-2 kanban-col">
                {/* Coluna vazia não ocupa meia tela.
                    As quatro tinham altura fixa de 520px, e num quadro com duas
                    vazias isso somava mais de mil pixels de moldura tracejada —
                    empurrando para fora da tela justamente as colunas que têm
                    conteúdo. Vazia agora ocupa o tamanho do próprio recado. */}
                <div className={cn(
                  "overflow-y-auto overflow-x-hidden pr-1 kanban-col-scroll",
                  items.length === 0 ? "h-auto" : "h-[min(65vh,520px)]",
                )}>
                  <div className="kanban-col-body">
                    {items.length === 0 ? (
                      <div className={cn(
                        "border-2 border-dashed rounded-md py-5 text-center transition-colors",
                        dragOverCol === col.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/40",
                      )}>
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
                                {col.id !== "pago" && (
                                  <Checkbox
                                    checked={selecionados.has(l.id)}
                                    onCheckedChange={() => toggleSelecionado(l.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 shrink-0"
                                    aria-label="Selecionar lançamento"
                                  />
                                )}
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
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Layers className="w-3 h-3" />
                                    {num}/{total}
                                  </Badge>
                                )}
                                {vendedor && (
                                  <Badge variant="outline" className="text-xs gap-1 max-w-full truncate">
                                    <User2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{vendedor}</span>
                                  </Badge>
                                )}
                              </div>

                              {/* Valor e vencimento disputavam a mesma linha, e
                                  numa coluna estreita o valor era o que cedia —
                                  justamente o número que a pessoa está
                                  procurando. Agora o valor tem a linha inteira
                                  e a data fica acima, discreta. */}
                              <div className="pt-1 border-t border-border/40 mt-1.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    Venc {format(parseISO(venc), "dd/MM/yy", { locale: ptBR })}
                                  </span>
                                  <span className={cn(
                                    "text-sm font-bold tabular-nums whitespace-nowrap",
                                    col.id === "vencido" && "text-destructive",
                                    col.id === "pago" && "text-success",
                                  )}>
                                    {Number(l.valor).toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    })}
                                  </span>
                                </div>
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
