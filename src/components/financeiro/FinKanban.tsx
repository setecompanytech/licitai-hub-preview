import { useMemo, useRef, useState } from "react";
import { DataDaBaixaDialog } from "./DataDaBaixaDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
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
import { format, parseISO, isToday, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { estaEmAtraso, situacaoDoTitulo } from "@/lib/financeiro/atraso";
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
  // As três primeiras são DERIVADAS da data de vencimento — o lançamento se
  // move sozinho conforme o calendário anda. Só "Concluído" é um estado que se
  // escolhe (arrastar para cá marca pago/recebido; tirar daqui reabre).
  // Design System v3: toda coluna de kanban é a superfície rebaixada
  // (`bg-secondary`); a semântica mora no ícone do cabeçalho, na tinta
  // `*-ink` — cor financeira com moderação, não quatro colunas pintadas.
  { id: "aberto",   nome: "Em aberto",        cor: "text-muted-foreground",  icone: FileText },
  { id: "vence_7d", nome: "Vence em 7 dias",  cor: "text-warning-ink",       icone: Clock },
  { id: "vencido",  nome: "Vencido",          cor: "text-destructive-ink",   icone: AlertCircle },
  { id: "pago",     nome: "Concluído",        cor: "text-success-ink",       icone: CheckCircle2 },
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
  // Período explícito, em cima dos atalhos. "Este mês" resolve o caso comum;
  // conferir contra extrato de abril, fechar trimestre ou achar o lançamento
  // de uma data específica pedem intervalo — e sem ele a pessoa ia ao SQL.
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
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

  // A data de referência para PERÍODO e atalhos (hoje/semana/mês): sem
  // vencimento, a competência posiciona o cartão no calendário. Ela NÃO
  // decide atraso — isso é da régua única abaixo.
  const dataReferenciaVenc = (l: LancamentoCard): string =>
    l.data_vencimento ?? l.data_competencia;

  // A coluna sai da régua única do atraso (`atraso.ts`), a mesma do cartão
  // "Em atraso" e das listas. Título sem vencimento fica "Em aberto" com o
  // selo "Sem vencimento" — antes caía em "Vencido" pela competência, e o
  // painel o ignorava: as duas telas discordavam sobre o mesmo título (21/09).
  const classificar = (l: LancamentoCard): ColunaKanban => {
    switch (situacaoDoTitulo(l)) {
      case "pago": return "pago";
      case "em_atraso": return "vencido";
      case "vence_em_7_dias": return "vence_7d";
      default: return "aberto";
    }
  };

  /**
   * O mês escolhido vira o intervalo do primeiro ao último dia.
   *
   * Guardar mês E intervalo como filtros separados criaria dois donos da mesma
   * pergunta — e quando os dois discordassem, ninguém saberia qual valia. Aqui
   * o mês é um atalho que ESCREVE no intervalo, e o intervalo é a única
   * autoridade.
   */
  const aplicarMes = (mes: string) => {
    if (!mes) { setDataDe(""); setDataAte(""); return; }
    const [ano, m] = mes.split("-").map(Number);
    // Dia 0 do mês seguinte é o último dia deste — evita a tabela de quantos
    // dias tem cada mês, e acerta fevereiro bissexto de graça.
    const ultimo = new Date(ano, m, 0).getDate();
    setDataDe(`${mes}-01`);
    setDataAte(`${mes}-${String(ultimo).padStart(2, "0")}`);
  };

  /** O mês a exibir no seletor, quando o intervalo for exatamente um mês. */
  const mesSelecionado = (() => {
    if (!dataDe || !dataAte) return "";
    const mes = dataDe.slice(0, 7);
    if (dataAte.slice(0, 7) !== mes || !dataDe.endsWith("-01")) return "";
    const [ano, m] = mes.split("-").map(Number);
    const ultimo = new Date(ano, m, 0).getDate();
    return dataAte === `${mes}-${String(ultimo).padStart(2, "0")}` ? mes : "";
  })();

  const matchVencimento = (l: LancamentoCard): boolean => {
    if (filtroVenc === "todos") return true;
    const ref = parseISO(dataReferenciaVenc(l));
    if (filtroVenc === "hoje") return isToday(ref);
    if (filtroVenc === "semana") return isThisWeek(ref, { weekStartsOn: 1 });
    if (filtroVenc === "mes") return isThisMonth(ref);
    if (filtroVenc === "atrasados") return estaEmAtraso(l);
    return true;
  };

  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const vMin = valorMin ? Number(valorMin) : null;
    const vMax = valorMax ? Number(valorMax) : null;
    return lancamentos.filter((l) => {
      // Cancelado não é trabalho pendente nem dinheiro em aberto: fora do
      // quadro — ele somava no "em aberto" e podia até ser baixado em lote.
      if (l.status === "cancelado") return false;
      if (pendingDeleteIds.has(l.id)) return false;
      if (filtroVendedor !== "todos" && (l as any).vendedor_responsavel_id !== filtroVendedor) return false;
      if (filtroCategoria !== "todos" && l.categoria_id !== filtroCategoria) return false;
      if (filtroPessoa !== "todos" && l.pessoa_id !== filtroPessoa) return false;
      if (filtroConta !== "todos" && l.conta_id !== filtroConta) return false;
      if (!matchVencimento(l)) return false;
      // O período usa a MESMA data que as colunas e os atalhos —
      // `dataReferenciaVenc`. Filtrar por uma data e pintar por outra faria o
      // cartão sumir do intervalo em que a tela diz que ele está.
      if (dataDe || dataAte) {
        const ref = dataReferenciaVenc(l);
        if (dataDe && ref < dataDe) return false;
        if (dataAte && ref > dataAte) return false;
      }
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
  }, [lancamentos, busca, filtroVendedor, filtroCategoria, filtroPessoa, filtroConta, filtroVenc, valorMin, valorMax, dataDe, dataAte, pendingDeleteIds]);

  const filtrosAtivos =
    (filtroVendedor !== "todos" ? 1 : 0) +
    (filtroCategoria !== "todos" ? 1 : 0) +
    (filtroPessoa !== "todos" ? 1 : 0) +
    (filtroConta !== "todos" ? 1 : 0) +
    (filtroVenc !== "todos" ? 1 : 0) +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0) +
    // O intervalo conta como UM filtro mesmo com as duas pontas preenchidas:
    // é uma decisão só, e dizer "2 filtros" para um período confunde.
    (dataDe || dataAte ? 1 : 0);

  const limparFiltros = () => {
    setFiltroVendedor("todos");
    setFiltroCategoria("todos");
    setFiltroPessoa("todos");
    setFiltroConta("todos");
    setFiltroVenc("todos");
    setValorMin("");
    setValorMax("");
    setDataDe("");
    setDataAte("");
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
  /**
   * A baixa não carimba data sozinha: pergunta. O ✓ gravava hojeLocal() em
   * silêncio, e quem baixava retroativamente ganhava um pagamento datado do
   * dia do clique — foi assim que a curva mensal descolou do extrato.
   */
  const [baixaPendente, setBaixaPendente] = useState<string[] | null>(null);
  const pedirBaixa = (ids: string[]) => {
    if (ids.length > 0) setBaixaPendente(ids);
  };
  const confirmarBaixa = async (data: string) => {
    const ids = baixaPendente ?? [];
    try {
      await Promise.all(
        ids.map((id) =>
          upsert.mutateAsync({ id, status: "realizado", data_realizado: data } as any),
        ),
      );
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      toast.success(
        ids.length > 1
          ? `${ids.length} lançamento(s) marcados como ${tipo === "a_pagar" ? "pagos" : "recebidos"}.`
          : `Lançamento marcado como ${tipo === "a_pagar" ? "pago" : "recebido"}.`,
      );
      if (ids.length > 1) limparSelecao();
    } catch {
      toast.error("Falha ao atualizar alguns lançamentos.");
    } finally {
      setBaixaPendente(null);
    }
  };
  const marcarSelecionadosPagos = () => pedirBaixa(Array.from(selecionados));
  const marcarPago = (l: LancamentoCard) => pedirBaixa([l.id]);

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

  /**
   * O padrão do Kanban de licitações, herdado: card recolhido em DUAS linhas
   * com as pontas direitas trabalhando (valor na L1, vencimento e baixa na
   * L2), clique abre o detalhe, e um controle global dilata/recolhe tudo —
   * o irmão de "Recolher colunas vazias", agora para as linhas.
   */
  const [cardsAbertos, setCardsAbertos] = useState<Set<string>>(new Set());
  const alternarCard = (id: string) => setCardsAbertos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
        pedirBaixa([id]);
      } else if (lanc.status !== "realizado") {
        // ── As colunas de vencimento são AUTOMÁTICAS ─────────────────────
        // A posição vem da data: "Em aberto", "Vence em 7 dias" e "Vencido"
        // são leituras do vencimento, não estados que se escolhem. Arrastar
        // um previsto entre elas não tem efeito possível — e o silêncio
        // deixava parecer que o quadro "não funcionou". Agora ele explica.
        toast.info("Esta coluna é automática pela data de vencimento.", {
          description: "Para mover o lançamento, edite a data de vencimento (duplo clique abre).",
        });
        return;
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
    // Espera na forma do quadro — a faixa de cima e as quatro colunas —, não
    // um spinner no centro (Design System v3).
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Carregando lançamentos</span>
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
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
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3">
            <div className="min-w-0">
              {/* A contagem vive AO LADO do total que ela qualifica — no meio da
                  barra de ações ela era informação espremida entre botões,
                  quebrando o fluxo de quem procura um comando. */}
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium leading-5 text-muted-foreground">
                Total {tipo === "a_pagar" ? "a pagar" : "a receber"} em aberto
                <Badge variant="muted">
                  {lancamentosFiltrados.length} lançamento{lancamentosFiltrados.length === 1 ? "" : "s"}
                </Badge>
              </p>
              {/* KPI 28/36 em peso 600, a escala de indicador do sistema. */}
              <p className="whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="hidden w-px bg-border sm:block" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-muted-foreground">
                Saldo atual {filtroConta !== "todos" ? `· ${contas.find((c) => c.id === filtroConta)?.nome ?? ""}` : "· todas as contas"}
              </p>
              <p className={cn("whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums", saldoContaAtual >= 0 ? "text-success-ink" : "text-destructive-ink")}>
                {saldoContaAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <div className="relative min-w-[220px] flex-1 basis-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar descrição, doc, pessoa ou categoria…"
                aria-label="Buscar lançamento por descrição, documento, pessoa ou categoria"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            {/* Tonal quando aberto/aplicado: o verde sólido é só da ação
                principal, à direita. */}
            <Button
              variant={mostrarFiltros || filtrosAtivos > 0 ? "secondary" : "outline"}
              onClick={() => setMostrarFiltros((v) => !v)}
              aria-expanded={mostrarFiltros}
            >
              <Filter aria-hidden="true" />
              Filtros
              {filtrosAtivos > 0 && (
                <Badge variant="muted">
                  {filtrosAtivos}
                </Badge>
              )}
            </Button>
            <Button variant="outline" onClick={() => setExtracaoOpen(true)}>
              <ScanLine aria-hidden="true" />
              Extrair de documento
            </Button>
            <Button onClick={abrirNovo}>
              <Plus aria-hidden="true" />
              Novo {tipo === "a_pagar" ? "pagamento" : "recebimento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chips de vencimento (sempre visíveis para acesso rápido) */}
      <div className="flex flex-wrap items-center gap-2">
        {VENC_CHIPS.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={filtroVenc === c.id ? "default" : "secondary"}
            aria-pressed={filtroVenc === c.id}
            onClick={() => setFiltroVenc(c.id)}
          >
            {c.label}
          </Button>
        ))}
        {filtrosAtivos > 0 && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={limparFiltros}>
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Painel expansível de filtros avançados */}
      {mostrarFiltros && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="fin-kanban-categoria" className="block text-sm font-medium text-foreground">Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger id="fin-kanban-categoria"><SelectValue /></SelectTrigger>
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
            <div className="space-y-2">
              <label htmlFor="fin-kanban-pessoa" className="block text-sm font-medium text-foreground">
                {tipo === "a_pagar" ? "Fornecedor" : "Cliente"}
              </label>
              <Select value={filtroPessoa} onValueChange={setFiltroPessoa}>
                <SelectTrigger id="fin-kanban-pessoa"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {pessoas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-conta" className="block text-sm font-medium text-foreground">Conta</label>
              <Select value={filtroConta} onValueChange={setFiltroConta}>
                <SelectTrigger id="fin-kanban-conta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-responsavel" className="block text-sm font-medium text-foreground">Responsável</label>
              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger id="fin-kanban-responsavel"><SelectValue /></SelectTrigger>
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
            {/* Ocupa duas colunas para que Mês/De/Até fechem a linha e os
                campos de valor fiquem juntos na seguinte. */}
            <div className="space-y-2 lg:col-span-2">
              <label htmlFor="fin-kanban-mes" className="block text-sm font-medium text-foreground">Mês</label>
              <Input
                id="fin-kanban-mes"
                type="month"
                value={mesSelecionado}
                onChange={(e) => aplicarMes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-de" className="block text-sm font-medium text-foreground">De</label>
              <Input
                id="fin-kanban-de"
                type="date"
                value={dataDe}
                max={dataAte || undefined}
                onChange={(e) => setDataDe(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-ate" className="block text-sm font-medium text-foreground">Até</label>
              <Input
                id="fin-kanban-ate"
                type="date"
                value={dataAte}
                min={dataDe || undefined}
                onChange={(e) => setDataAte(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-valor-min" className="block text-sm font-medium text-foreground">Valor mínimo (R$)</label>
              <Input
                id="fin-kanban-valor-min"
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fin-kanban-valor-max" className="block text-sm font-medium text-foreground">Valor máximo (R$)</label>
              <Input
                id="fin-kanban-valor-max"
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

      {/* Barra de seleção em lote — na tinta verde, como toda seleção do sistema. */}
      {selecionados.size > 0 && (
        <Card className="border-primary-line bg-primary-tint">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CheckSquare className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                <strong>{selecionados.size}</strong> selecionado(s) ·{" "}
                <span className="tabular-nums font-semibold">
                  {totalSelecionado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </span>
              {idsSelecionaveis.length > selecionados.size && (
                <Button size="sm" variant="ghost" onClick={selecionarTodosVisiveis}>
                  Selecionar todos visíveis ({idsSelecionaveis.length})
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={limparSelecao}>Cancelar</Button>
              <Button size="sm" onClick={marcarSelecionadosPagos} disabled={upsert.isPending}>
                <CheckCircle2 aria-hidden="true" />
                Marcar como {tipo === "a_pagar" ? "pago" : "recebido"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quadro Kanban.
          `items-start` é o que falta para a coluna vazia realmente encolher:
          num grid os itens esticam até a altura do mais alto da fileira, então
          encolher só a caixa interna deixava o cartão em volta do mesmo
          tamanho. Consertar o miolo e esquecer a moldura não muda nada na
          tela. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUNAS.map((col) => {
          const items = lancamentosFiltrados.filter((l) => classificar(l) === col.id);
          const subtotal = items.reduce((s, l) => s + Number(l.valor), 0);
          const Icone = col.icone;
          return (
            <Card
              key={col.id}
              className={cn(
                // Coluna na superfície rebaixada, sem sombra: o cartão dentro
                // dela é que é branco e em relevo (anatomia de kanban do DS v3).
                "kanban-col bg-secondary shadow-none transition-shadow",
                dragOverCol === col.id && "ring-2 ring-ring shadow-md",
              )}
              onDragOver={handleColDragOver(col.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol((cur) => (cur === col.id ? null : cur));
                }
              }}
              onDrop={handleColDrop(col.id)}
            >
              <CardHeader className="space-y-1 p-3 pb-2">
                <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold">
                  <Icone className={cn("h-4 w-4 shrink-0", col.cor)} aria-hidden="true" />
                  <span className="truncate">{col.nome}</span>
                  {/* A contagem como selo, não como parte da mesma frase do
                      valor: eram dois números de naturezas diferentes colados
                      por um ponto, e a leitura tropeçava nos dois. */}
                  <span className="ml-auto shrink-0 rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </CardTitle>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
                  {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardHeader>
              <CardContent className="kanban-col p-2">
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
                        "rounded-md border border-dashed py-6 text-center transition-colors",
                        dragOverCol === col.id
                          ? "border-primary bg-primary-tint"
                          : "border-input",
                      )}>
                        <p className="text-sm text-muted-foreground">
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
                              "kanban-card cursor-grab rounded-md border border-border bg-card shadow-sm transition-[opacity,box-shadow,border-color] duration-150 active:cursor-grabbing",
                              isDragging && "opacity-40",
                            )}
                            draggable
                            onDragStart={handleDragStart(l.id)}
                            onDragEnd={handleDragEnd}
                            // Duplo clique abre — o lápis continua para quem o
                            // procura, mas o gesto natural sobre um card é
                            // clicar nele, não achar o ícone de 24px.
                            onDoubleClick={() => abrirEditar(l)}
                            title="Duplo clique para abrir"
                          >
                            <CardContent className="p-3 space-y-1 kanban-card-body">
                              {(() => {
                                const aberto = cardsAbertos.has(l.id);
                                const partes = [l.pessoa?.nome, l.numero_documento ? `Doc ${l.numero_documento}` : null]
                                  .filter(Boolean).join(" · ");
                                return (
                                  <>
                                    {/* L1 — identidade à esquerda, VALOR à direita. */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      {col.id !== "pago" && (
                                        <Checkbox
                                          checked={selecionados.has(l.id)}
                                          onCheckedChange={() => toggleSelecionado(l.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="shrink-0"
                                          aria-label="Selecionar lançamento"
                                        />
                                      )}
                                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                      <p
                                        className={cn(
                                          "text-sm font-medium min-w-0 flex-1 cursor-pointer",
                                          aberto ? "break-words" : "truncate",
                                        )}
                                        title={aberto ? "Clique para recolher" : l.descricao}
                                        onClick={(e) => { e.stopPropagation(); alternarCard(l.id); }}
                                      >
                                        {l.descricao}
                                      </p>
                                      <span className={cn(
                                        "shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums",
                                        col.id === "vencido" && "text-destructive-ink",
                                        col.id === "pago" && "text-success-ink",
                                      )}>
                                        {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                      </span>
                                    </div>

                                    {/* L2 — partes à esquerda, vencimento e a
                                        BAIXA à direita. A ação de dar baixa é
                                        o core do quadro: fica visível também
                                        no recolhido. */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p
                                        className="text-xs text-muted-foreground truncate min-w-0 flex-1 cursor-pointer"
                                        title={partes || undefined}
                                        onClick={(e) => { e.stopPropagation(); alternarCard(l.id); }}
                                      >
                                        {partes || "—"}
                                      </p>
                                      {l.data_vencimento ? (
                                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                                          Venc {format(parseISO(venc), "dd/MM/yy", { locale: ptBR })}
                                        </span>
                                      ) : (
                                        <Badge variant="warning" className="shrink-0" title="Título sem data de vencimento — informe-a para o atraso ser medido">
                                          Sem vencimento
                                        </Badge>
                                      )}
                                      {col.id !== "pago" && (
                                        <Button
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 shrink-0 text-success-ink hover:text-success-ink hover:bg-success-tint"
                                          onClick={(e) => { e.stopPropagation(); marcarPago(l); }}
                                          disabled={upsert.isPending}
                                          aria-label={tipo === "a_pagar" ? `Marcar "${l.descricao}" como pago` : `Marcar "${l.descricao}" como recebido`}
                                          title={tipo === "a_pagar" ? "Marcar pago" : "Marcar recebido"}
                                        >
                                          <CheckCircle2 aria-hidden="true" />
                                        </Button>
                                      )}
                                    </div>

                                    {aberto && (
                                      <div className="pt-2 mt-1 border-t border-border flex items-center gap-2 flex-wrap">
                                        {isParcelado && (
                                          <Badge variant="muted" className="gap-1">
                                            <Layers className="w-3 h-3" aria-hidden="true" />
                                            Parcela {num}/{total}
                                          </Badge>
                                        )}
                                        {vendedor && (
                                          <Badge variant="info" className="min-w-0 max-w-full gap-1" title={vendedor}>
                                            <User2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                                            <span className="truncate">{vendedor}</span>
                                          </Badge>
                                        )}
                                        <div className="ml-auto flex items-center gap-1">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={(e) => { e.stopPropagation(); abrirEditar(l); }}
                                            aria-label={`Editar "${l.descricao}"`}
                                            title="Editar"
                                          >
                                            <Pencil aria-hidden="true" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive-ink hover:text-destructive-ink hover:bg-destructive-tint"
                                            onClick={(e) => { e.stopPropagation(); setConfirmDel(l); }}
                                            aria-label={`Excluir "${l.descricao}"`}
                                            title="Excluir"
                                          >
                                            <Trash2 aria-hidden="true" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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

      <DataDaBaixaDialog
        aberto={!!baixaPendente}
        tipo={tipo}
        quantidade={baixaPendente?.length ?? 1}
        onConfirmar={confirmarBaixa}
        onFechar={() => setBaixaPendente(null)}
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
              className={buttonVariants({ variant: "destructive" })}
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
