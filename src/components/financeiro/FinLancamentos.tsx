import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import ValorDeCartao from "./ValorDeCartao";
import { ehMovimentacao } from "@/lib/financeiro/movimentacao";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";
import {
  Plus,
  Pencil,
  Link2,
  Trash2,
  Search,
  Wallet,
  Scale,
  Filter,
  CalendarRange,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLancamentos,
  useContas,
  useDeleteLancamento,
  type LancamentoFiltro,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import { formatBRL, formatDate, statusLabel, tipoLabel } from "@/lib/financeiro/formatters";
import LancamentoDialog from "./LancamentoDialog";
import VincularContratoDialog from "./VincularContratoDialog";
import type { LancamentoParaVincular } from "@/lib/contratos/pedido-do-lancamento";
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

/**
 * Status em tinta (identidade 12/09). O mapa de cor que vinha dos formatters
 * era paleta crua (amber/emerald/rose); aqui o status vira variante de Badge —
 * sempre com TEXTO, a cor é reforço.
 */
const STATUS_VARIANTE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  previsto: "warning",
  realizado: "success",
  conciliado: "success",
  cancelado: "muted",
  em_atraso: "danger",
};

export default function FinLancamentos() {
  const [searchParams] = useSearchParams();
  const loteParam = searchParams.get("lote") || undefined;

  const [filtro, setFiltro] = useState<LancamentoFiltro>({
    tipo: "todos",
    status: "todos",
    origemTipo: "todos",
    origemLoteId: loteParam,
  });
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  useEffect(() => {
    setFiltro((f) => ({ ...f, origemLoteId: loteParam }));
  }, [loteParam]);

  const { data: lancs = [], isLoading } = useLancamentos(filtro);
  const { data: contas = [] } = useContas();
  const del = useDeleteLancamento();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  /** O lançamento cujo vínculo com a Gestão está sendo feito. */
  const [vinculando, setVinculando] = useState<LancamentoParaVincular | null>(null);
  const [modoDoVinculo, setModoDoVinculo] = useState<"receita" | "despesa">("receita");
  const [confirmDel, setConfirmDel] = useState<Lancamento | null>(null);
  const [sort, setSort] = useState<{ campo: "data_competencia" | "data_vencimento"; dir: "asc" | "desc" }>({
    campo: "data_competencia",
    dir: "desc",
  });
  const [pagina, setPagina] = useState(1);
  const TAMANHO_PAGINA = 20;

  const abrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const contaSelecionada = useMemo(
    () => (filtro.contaId && filtro.contaId !== "todos" ? contas.find((c) => c.id === filtro.contaId) : null),
    [filtro.contaId, contas]
  );

  const hasContaFiltro = !!(filtro.contaId && filtro.contaId !== "todos");

  const lancsAtivos = useMemo(
    () =>
      lancs.filter((l) => {
        if (l.origem_tipo === "ignorado_conciliacao") return false;
        // Cancelado não é entrada nem saída: entrava nos totais com o mesmo
        // peso de um realizado (19/09).
        if (l.status === "cancelado") return false;
        // Transferências: excluir dos totais globais (cancelam entre si),
        // mas incluir quando há filtro por conta específica (é fluxo real daquela conta)
        if (l.tipo === "transferencia" && !hasContaFiltro) return false;
        return true;
      }),
    [lancs, hasContaFiltro]
  );
  // Movimentação patrimonial (aporte, aplicação, transferência com filtro de
  // conta) mexe no caixa mas não é entrada nem saída de resultado: sai dos
  // dois cartões e é declarada à parte — o "Aporte dos Sócios" de R$ 2.000
  // entrava como Entrada e o DRE dizia outra receita (19/09, O S).
  const lancsResultado = useMemo(() => lancsAtivos.filter((l) => !ehMovimentacao(l)), [lancsAtivos]);
  const totalMovimentacao = useMemo(
    () => lancsAtivos.filter((l) => ehMovimentacao(l)).reduce((s, l) => s + Number(l.valor), 0),
    [lancsAtivos]
  );
  const regime = filtro.status && filtro.status !== "todos" ? filtro.status : "previsto e realizado";
  const limiteAtingido = lancs.length >= 500;

  const sortedLancs = useMemo(() => {
    const lista = [...lancs];
    lista.sort((a, b) => {
      const av = (a[sort.campo] as string | null) ?? "";
      const bv = (b[sort.campo] as string | null) ?? "";
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return lista;
  }, [lancs, sort]);

  // A página reseta sempre que o recorte muda — senão a pessoa filtra e cai
  // numa página 3 que já não existe para o novo resultado.
  useEffect(() => {
    setPagina(1);
  }, [filtro, sort]);

  const totalPaginas = Math.max(1, Math.ceil(sortedLancs.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const lancsDaPagina = sortedLancs.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA,
  );

  const totalEntradas = useMemo(
    () => lancsResultado.filter((l) => l.natureza === "receita").reduce((s, l) => s + Number(l.valor), 0),
    [lancsResultado]
  );
  const totalSaidas = useMemo(
    () => lancsResultado.filter((l) => l.natureza === "despesa").reduce((s, l) => s + Number(l.valor), 0),
    [lancsResultado]
  );
  const resultado = totalEntradas - totalSaidas;

  // Saldo: conta selecionada → saldo dela; sem filtro → soma de todas ativas
  const saldoExibido = useMemo(
    () =>
      contaSelecionada
        ? Number(contaSelecionada.saldo_atual ?? 0)
        : contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0),
    [contaSelecionada, contas]
  );
  const labelSaldo = contaSelecionada
    ? contaSelecionada.nome
    : `${contas.filter((c) => c.ativa).length} conta(s)`;

  const temFiltroData = !!(filtro.dataInicio || filtro.dataFim);
  const temAlgumFiltro = !!(
    filtro.busca ||
    (filtro.tipo && filtro.tipo !== "todos") ||
    (filtro.status && filtro.status !== "todos") ||
    (filtro.contaId && filtro.contaId !== "todos") ||
    temFiltroData ||
    (filtro.origemTipo && filtro.origemTipo !== "todos")
  );
  const limparTodosFiltros = () =>
    setFiltro({ tipo: "todos", status: "todos", origemTipo: "todos", origemLoteId: loteParam });

  return (
    <div className="space-y-6">
      {/* ── Ação principal ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={abrirNovo}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo lançamento
        </Button>
      </div>

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Linha principal */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="fin-lanc-busca" className="text-sm text-muted-foreground">Buscar lançamento</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="fin-lanc-busca"
                  placeholder="Descrição, categoria ou favorecido"
                  className="pl-9"
                  value={filtro.busca ?? ""}
                  onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label id="fin-lanc-tipo-label" className="text-sm text-muted-foreground">Tipo</label>
              <Select
                value={filtro.tipo ?? "todos"}
                onValueChange={(v) => setFiltro((f) => ({ ...f, tipo: v as LancamentoFiltro["tipo"] }))}
              >
                <SelectTrigger className="w-[160px]" aria-labelledby="fin-lanc-tipo-label">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="a_pagar">A pagar</SelectItem>
                  <SelectItem value="a_receber">A receber</SelectItem>
                  <SelectItem value="movimento_bancario">Movimento</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label id="fin-lanc-status-label" className="text-sm text-muted-foreground">Status</label>
              <Select
                value={filtro.status ?? "todos"}
                onValueChange={(v) => setFiltro((f) => ({ ...f, status: v as LancamentoFiltro["status"] }))}
              >
                <SelectTrigger className="w-[150px]" aria-labelledby="fin-lanc-status-label">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="em_atraso">Em atraso</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label id="fin-lanc-conta-label" className="text-sm text-muted-foreground">Conta</label>
              <Select
                value={filtro.contaId ?? "todos"}
                onValueChange={(v) => setFiltro((f) => ({ ...f, contaId: v }))}
              >
                <SelectTrigger className="w-[170px]" aria-labelledby="fin-lanc-conta-label">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className={mostrarFiltrosAvancados || temFiltroData ? "border-primary text-primary" : undefined}
              aria-expanded={mostrarFiltrosAvancados}
              onClick={() => setMostrarFiltrosAvancados((v) => !v)}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              Mais filtros
              {mostrarFiltrosAvancados
                ? <ChevronUp className="w-4 h-4" aria-hidden="true" />
                : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              {temFiltroData && !mostrarFiltrosAvancados && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Button>
          </div>

          {/* Linha avançada */}
          {mostrarFiltrosAvancados && (
            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="fin-lanc-data-inicio" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarRange className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Período de
                  </label>
                  <Input
                    id="fin-lanc-data-inicio"
                    type="date"
                    className="w-[170px]"
                    value={filtro.dataInicio ?? ""}
                    onChange={(e) => setFiltro((f) => ({ ...f, dataInicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="fin-lanc-data-fim" className="text-sm text-muted-foreground">até</label>
                  <Input
                    id="fin-lanc-data-fim"
                    type="date"
                    className="w-[170px]"
                    value={filtro.dataFim ?? ""}
                    onChange={(e) => setFiltro((f) => ({ ...f, dataFim: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label id="fin-lanc-origem-label" className="text-sm text-muted-foreground">Origem</label>
                <Select
                  value={filtro.origemTipo ?? "todos"}
                  onValueChange={(v) => setFiltro((f) => ({ ...f, origemTipo: v as LancamentoFiltro["origemTipo"] }))}
                >
                  <SelectTrigger className="w-[190px]" aria-labelledby="fin-lanc-origem-label">
                    <Layers className="mr-2 w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
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
              </div>

              {(temFiltroData || (filtro.origemTipo && filtro.origemTipo !== "todos")) && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() =>
                    setFiltro((f) => ({ ...f, dataInicio: undefined, dataFim: undefined, origemTipo: "todos" }))
                  }
                >
                  Limpar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Faixa de KPIs ──
          Os números somam os lançamentos CARREGADOS (até 500, os mais recentes
          por competência), sem cancelados e sem movimentação — e dizem isso,
          em vez de "no período" (19/09). */}
      <Card>
        <CardContent className="grid grid-cols-1 divide-y divide-border p-0 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          <StatCell
            label="Entradas"
            value={formatBRL(totalEntradas)}
            sub={`${lancsResultado.filter((l) => l.natureza === "receita").length} lançamentos · ${regime}`}
            tone="success"
          />
          <StatCell
            label="Saídas"
            value={formatBRL(totalSaidas)}
            sub={`${lancsResultado.filter((l) => l.natureza === "despesa").length} lançamentos · ${regime}`}
            tone="default"
          />
          <StatCell
            label="Entradas − Saídas"
            value={formatBRL(resultado)}
            sub={totalMovimentacao > 0
              ? `Fora: ${formatBRL(totalMovimentacao)} de movimentação (aporte, aplicação, transferência)`
              : limiteAtingido ? "Sobre os 500 lançamentos carregados" : "Sobre os lançamentos carregados"}
            tone={resultado >= 0 ? "success" : "danger"}
          />
          <StatCell
            label={`Saldo em contas`}
            value={formatBRL(saldoExibido)}
            sub={contaSelecionada ? labelSaldo : `${labelSaldo} · saldo atual`}
            tone="default"
            icon={Wallet}
          />
        </CardContent>
      </Card>

      {/* ── Resumo do recorte + limpar filtros ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Carregando…"
            : limiteAtingido
              ? "500 lançamentos carregados — há mais; refine os filtros para ver e somar o restante"
              : `${lancs.length} lançamento${lancs.length !== 1 ? "s" : ""} encontrado${lancs.length !== 1 ? "s" : ""}`}
        </p>
        {temAlgumFiltro && (
          <Button variant="outline" size="sm" onClick={limparTodosFiltros}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* ── Tabela ── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-sm font-semibold text-foreground">
                  <th
                    className="w-[110px] whitespace-nowrap px-4 py-3 text-left"
                    aria-sort={
                      sort.campo === "data_competencia"
                        ? (sort.dir === "asc" ? "ascending" : "descending")
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                      onClick={() =>
                        setSort((s) =>
                          s.campo === "data_competencia"
                            ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" }
                            : { campo: "data_competencia", dir: "desc" }
                        )
                      }
                    >
                      Data
                      {sort.campo === "data_competencia" ? (
                        sort.dir === "asc"
                          ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                          : <ChevronDown className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-30" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  <th className="w-[100px] whitespace-nowrap px-3 py-3 text-left">2ª data</th>
                  <th className="px-3 py-3 text-left">Descrição / categoria</th>
                  <th className="w-[170px] whitespace-nowrap px-3 py-3 text-left">Favorecido / conta</th>
                  <th className="w-[110px] whitespace-nowrap px-3 py-3 text-left">Tipo</th>
                  <th className="w-[120px] whitespace-nowrap px-3 py-3 text-left">Status</th>
                  <th className="w-[140px] whitespace-nowrap px-3 py-3 text-right">Valor</th>
                  <th className="w-[130px] px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-2">
                        <Skeleton className="h-8 w-full rounded-md" />
                      </td>
                    </tr>
                  ))
                ) : lancs.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EstadoVazio
                        icone={<Scale />}
                        titulo="Nenhum lançamento encontrado"
                        descricao="Ajuste os filtros ou crie um lançamento para começar."
                        acao={
                          <Button onClick={abrirNovo}>
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            Novo lançamento
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  lancsDaPagina.map((l) => {
                    const isIgnorado = l.origem_tipo === "ignorado_conciliacao";
                    const isTransferencia = l.tipo === "transferencia";
                    const isReceita = l.natureza === "receita";
                    // Vencimento igual à competência é vencimento do mesmo jeito:
                    // o travessão fazia parcela prevista parecer sem prazo (19/09).
                    const vencDiferente = !!l.data_vencimento;
                    const isAtrasado = l.status === "em_atraso";
                    return (
                      <tr
                        key={l.id}
                        className={`border-l-2 ${isReceita ? "border-l-success-line" : "border-l-destructive-line"} transition-colors hover:bg-muted`}
                      >
                        {/* Competência */}
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm text-muted-foreground">
                          {formatDate(l.data_competencia)}
                        </td>

                        {/* Vencimento */}
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          {vencDiferente ? (
                            <span
                              className={
                                isAtrasado
                                  ? "inline-flex items-center gap-1 font-medium text-destructive-ink"
                                  : "text-muted-foreground"
                              }
                            >
                              {formatDate(l.data_vencimento!)}
                              {isAtrasado && (
                                <>
                                  <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span className="sr-only">vencimento em atraso</span>
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Descrição / categoria */}
                        <td className="max-w-[280px] px-3 py-3">
                          <span className="block truncate text-sm font-medium" title={l.descricao}>
                            {l.descricao}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {l.categoria?.nome ?? "Sem categoria"}
                            {l.parcela_numero && l.parcela_total && ` · Parcela ${l.parcela_numero}/${l.parcela_total}`}
                          </span>
                          {isIgnorado && (
                            <Badge variant="muted" className="mt-1 font-normal">
                              ignorado no somatório
                            </Badge>
                          )}
                          {isTransferencia && (
                            <Badge variant="info" className="mt-1 font-normal">
                              transferência entre contas
                            </Badge>
                          )}
                        </td>

                        {/* Favorecido / conta */}
                        <td className="max-w-[170px] px-3 py-3 text-sm">
                          {l.pessoa?.nome ? (
                            <span className="block truncate text-foreground" title={l.pessoa.nome}>
                              {l.pessoa.nome}
                            </span>
                          ) : (
                            <span className="block truncate text-muted-foreground">—</span>
                          )}
                          <span className="block truncate text-xs text-muted-foreground" title={l.conta?.nome ?? ""}>
                            {l.conta?.nome ?? "—"}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                            {(l.tipo === "a_pagar" || l.tipo === "a_receber") && (
                              <span
                                className={cn(
                                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded",
                                  l.tipo === "a_receber" ? "bg-success-tint text-success-ink" : "bg-destructive-tint text-destructive-ink",
                                )}
                                aria-hidden="true"
                              >
                                {l.tipo === "a_receber" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                              </span>
                            )}
                            {tipoLabel[l.tipo] ?? l.tipo}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge variant={STATUS_VARIANTE[l.status] ?? "muted"} className="gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                            {statusLabel[l.status] ?? l.status}
                          </Badge>
                        </td>

                        {/* Valor */}
                        <td
                          className={`whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums ${
                            isReceita ? "text-success-ink" : "text-destructive-ink"
                          }`}
                        >
                          {isReceita ? "+" : "−"} {formatBRL(Number(l.valor))}
                        </td>

                        {/* Ações */}
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* O mesmo elo de Contas a Receber. Ele nascera só
                                lá, e esta é a tela em que se procura um
                                lançamento antigo pelo nome — justamente o gesto
                                de quem vai ligar faturamento retroativo a um
                                contrato que entrou na gestão depois. */}
                            {(l.tipo === "a_receber" || l.tipo === "a_pagar") && (() => {
                              const rotuloVinculo = l.tipo === "a_pagar"
                                ? ((l as { contrato_id?: string | null }).contrato_id
                                    ? "Despesa atribuída a um contrato — clique para trocar"
                                    : "Atribuir esta despesa a um contrato")
                                : ((l as { contrato_pedido_id?: string | null }).contrato_pedido_id
                                    ? "Vinculado a um pedido — clique para trocar"
                                    : "Vincular a um contrato/pedido em Gestão");
                              const jaVinculado = l.tipo === "a_pagar"
                                ? !!(l as { contrato_id?: string | null }).contrato_id
                                : !!(l as { contrato_pedido_id?: string | null }).contrato_pedido_id;
                              return (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-9 w-9"
                                  title={rotuloVinculo}
                                  aria-label={rotuloVinculo}
                                  onClick={() => {
                                    setModoDoVinculo(l.tipo === "a_pagar" ? "despesa" : "receita");
                                    setVinculando({ ...(l as unknown as LancamentoParaVincular), pessoa_nome: (l as { pessoa?: { nome?: string } }).pessoa?.nome ?? null });
                                  }}
                                >
                                  <Link2 className={jaVinculado ? "text-primary" : undefined} />
                                </Button>
                              );
                            })()}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              title="Editar"
                              aria-label={`Editar ${l.descricao}`}
                              onClick={() => {
                                setEditing(l);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-destructive-ink"
                              title="Excluir"
                              aria-label={`Excluir ${l.descricao}`}
                              onClick={() => setConfirmDel(l)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {sortedLancs.length > TAMANHO_PAGINA && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Página {paginaAtual} de {totalPaginas}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}
      <LancamentoDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />

      {/* A tela Lançamentos mistura os dois tipos, então o modo sai da LINHA
          e não de um filtro da tela. */}
      <VincularContratoDialog
        lancamento={vinculando}
        modo={modoDoVinculo}
        onFechar={() => setVinculando(null)}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {confirmDel?.descricao && (
                  <p className="font-medium text-foreground">"{confirmDel.descricao}"</p>
                )}
                {confirmDel?.tipo === "transferencia" ? (
                  <p>
                    Este é um lançamento de <strong>transferência entre contas</strong>. Ambos os lançamentos do par
                    (saída e entrada) serão excluídos e os saldos revertidos. Os movimentos do extrato voltarão para a
                    fila de conciliação.
                  </p>
                ) : (
                  <p>
                    O lançamento será removido permanentemente. Se estava conciliado, o movimento do extrato voltará
                    para a fila de conciliação.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={async () => {
                if (confirmDel) {
                  await del.mutateAsync({
                    id: confirmDel.id,
                    contaId: confirmDel.conta_id,
                    valor: Number(confirmDel.valor),
                    natureza: confirmDel.natureza,
                    status: confirmDel.status,
                  });
                  setConfirmDel(null);
                }
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

// ─── StatCell ─────────────────────────────────────────────────────────────────
// Uma célula da faixa única de KPIs — não um cartão próprio: o modelo aprovado
// é uma faixa contínua dividida por linhas finas, não quatro cartões soltos.

function StatCell({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "default" | "success" | "danger";
  /** Só "Saldo em contas" traz ícone no modelo; os demais não. */
  icon?: React.ElementType;
}) {
  const cor = {
    default: "text-foreground",
    success: "text-success-ink",
    danger: "text-destructive-ink",
  }[tone];

  return (
    <div className="min-w-0 p-4">
      <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </p>
      {/* Encolhe com o comprimento em vez de estourar a célula: "R$ 11.136.165,18"
          num quarto da faixa não cabe em text-2xl. */}
      <ValorDeCartao valor={value} compacto className={cor} />
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
