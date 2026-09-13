import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  Filter,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertTriangle,
} from "lucide-react";
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
        // Transferências: excluir dos totais globais (cancelam entre si),
        // mas incluir quando há filtro por conta específica (é fluxo real daquela conta)
        if (l.tipo === "transferencia" && !hasContaFiltro) return false;
        return true;
      }),
    [lancs, hasContaFiltro]
  );

  const sortedLancs = useMemo(() => {
    const lista = [...lancs];
    lista.sort((a, b) => {
      const av = (a[sort.campo] as string | null) ?? "";
      const bv = (b[sort.campo] as string | null) ?? "";
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return lista;
  }, [lancs, sort]);

  const totalEntradas = useMemo(
    () => lancsAtivos.filter((l) => l.natureza === "receita").reduce((s, l) => s + Number(l.valor), 0),
    [lancsAtivos]
  );
  const totalSaidas = useMemo(
    () => lancsAtivos.filter((l) => l.natureza !== "receita").reduce((s, l) => s + Number(l.valor), 0),
    [lancsAtivos]
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Buscar lançamento por descrição"
                placeholder="Buscar por descrição…"
                className="pl-9"
                value={filtro.busca ?? ""}
                onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
              />
            </div>

            <Select
              value={filtro.tipo ?? "todos"}
              onValueChange={(v) => setFiltro((f) => ({ ...f, tipo: v as LancamentoFiltro["tipo"] }))}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filtrar por tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
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
              <SelectTrigger className="w-[150px]" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
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
              <SelectTrigger className="w-[170px]" aria-label="Filtrar por conta">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as contas</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Entradas"
          value={formatBRL(totalEntradas)}
          sub={`${lancsAtivos.filter((l) => l.natureza === "receita").length} lançamentos`}
          icon={ArrowUpRight}
          tone="success"
        />
        <StatCard
          label="Saídas"
          value={formatBRL(totalSaidas)}
          sub={`${lancsAtivos.filter((l) => l.natureza !== "receita").length} lançamentos`}
          icon={ArrowDownRight}
          tone="danger"
        />
        <StatCard
          label="Resultado"
          value={formatBRL(resultado)}
          sub={resultado >= 0 ? "Positivo no período" : "Negativo no período"}
          icon={resultado >= 0 ? TrendingUp : TrendingDown}
          tone={resultado >= 0 ? "success" : "danger"}
        />
        <StatCard
          label={`Saldo · ${labelSaldo}`}
          value={formatBRL(saldoExibido)}
          sub="Saldo atual em conta"
          icon={Wallet}
          tone="default"
        />
      </div>

      {/* ── Tabela ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-6 py-4">
          <CardTitle className="text-lg font-semibold">
            {isLoading ? "Carregando…" : `${lancs.length} lançamento${lancs.length !== 1 ? "s" : ""}`}
          </CardTitle>
          {lancs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              mostrando até 500 registros
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-sm font-semibold text-foreground">
                  <th
                    className="w-[120px] whitespace-nowrap px-4 py-3 text-left"
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
                      Competência
                      {sort.campo === "data_competencia" ? (
                        sort.dir === "asc"
                          ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
                          : <ChevronDown className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-30" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  <th className="w-[120px] whitespace-nowrap px-3 py-3 text-left">Vencimento</th>
                  <th className="px-3 py-3 text-left">Descrição</th>
                  <th className="w-[150px] whitespace-nowrap px-3 py-3 text-left">Categoria</th>
                  <th className="w-[150px] whitespace-nowrap px-3 py-3 text-left">Pessoa / Conta</th>
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
                      <td colSpan={9} className="px-4 py-2">
                        <Skeleton className="h-8 w-full rounded-md" />
                      </td>
                    </tr>
                  ))
                ) : lancs.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
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
                  sortedLancs.map((l) => {
                    const isIgnorado = l.origem_tipo === "ignorado_conciliacao";
                    const isTransferencia = l.tipo === "transferencia";
                    const isReceita = l.natureza === "receita";
                    const vencDiferente =
                      l.data_vencimento && l.data_vencimento !== l.data_competencia;
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

                        {/* Descrição */}
                        <td className="max-w-[260px] px-3 py-3">
                          <span className="block truncate text-sm font-medium" title={l.descricao}>
                            {l.descricao}
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
                          {l.parcela_numero && l.parcela_total && (
                            <span className="block text-xs text-muted-foreground">
                              Parcela {l.parcela_numero}/{l.parcela_total}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="max-w-[150px] px-3 py-3 text-sm text-muted-foreground">
                          <span className="block truncate" title={l.categoria?.nome ?? ""}>
                            {l.categoria?.nome ?? "—"}
                          </span>
                        </td>

                        {/* Pessoa / Conta */}
                        <td className="max-w-[150px] px-3 py-3 text-sm">
                          {l.pessoa?.nome ? (
                            <span className="block truncate text-foreground" title={l.pessoa.nome}>
                              {l.pessoa.nome}
                            </span>
                          ) : null}
                          <span className="block truncate text-muted-foreground" title={l.conta?.nome ?? ""}>
                            {l.conta?.nome ?? "—"}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge variant="muted" className="font-normal">
                            {tipoLabel[l.tipo] ?? l.tipo}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge variant={STATUS_VARIANTE[l.status] ?? "muted"}>
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

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "default" | "success" | "danger";
}) {
  const cls = {
    default: { text: "text-foreground", bg: "bg-muted", icon: "text-muted-foreground" },
    success: { text: "text-success-ink", bg: "bg-success-tint", icon: "text-success-ink" },
    danger: { text: "text-destructive-ink", bg: "bg-destructive-tint", icon: "text-destructive-ink" },
  }[tone];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-[2rem] font-bold leading-10 tabular-nums ${cls.text}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className={`shrink-0 rounded-md p-2 ${cls.bg}`}>
            <Icon className={`w-5 h-5 ${cls.icon}`} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
