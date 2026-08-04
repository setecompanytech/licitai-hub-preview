import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
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
} from "lucide-react";
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
  const [confirmDel, setConfirmDel] = useState<Lancamento | null>(null);
  const [sort, setSort] = useState<{ campo: "data_competencia" | "data_vencimento"; dir: "asc" | "desc" }>({
    campo: "data_competencia",
    dir: "desc",
  });

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
    <div className="space-y-4">
      {/* ── Cabeçalho + ação ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Lançamentos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie receitas, despesas e movimentações financeiras
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo lançamento
        </Button>
      </div>

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Linha principal */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição…"
                className="pl-8 h-9"
                value={filtro.busca ?? ""}
                onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
              />
            </div>

            <Select
              value={filtro.tipo ?? "todos"}
              onValueChange={(v) => setFiltro((f) => ({ ...f, tipo: v as LancamentoFiltro["tipo"] }))}
            >
              <SelectTrigger className="w-[150px] h-9">
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
              <SelectTrigger className="w-[140px] h-9">
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
              <SelectTrigger className="w-[160px] h-9">
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
              size="sm"
              className={`h-9 gap-1.5 ${mostrarFiltrosAvancados || temFiltroData ? "border-primary text-primary" : ""}`}
              onClick={() => setMostrarFiltrosAvancados((v) => !v)}
            >
              <Filter className="w-3.5 h-3.5" />
              Mais filtros
              {mostrarFiltrosAvancados ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {temFiltroData && !mostrarFiltrosAvancados && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </div>

          {/* Linha avançada */}
          {mostrarFiltrosAvancados && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Período:</span>
                <Input
                  type="date"
                  className="w-[150px] h-8 text-xs"
                  value={filtro.dataInicio ?? ""}
                  onChange={(e) => setFiltro((f) => ({ ...f, dataInicio: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  className="w-[150px] h-8 text-xs"
                  value={filtro.dataFim ?? ""}
                  onChange={(e) => setFiltro((f) => ({ ...f, dataFim: e.target.value }))}
                />
              </div>

              <Select
                value={filtro.origemTipo ?? "todos"}
                onValueChange={(v) => setFiltro((f) => ({ ...f, origemTipo: v as LancamentoFiltro["origemTipo"] }))}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Layers className="w-3 h-3 mr-1.5 text-muted-foreground" />
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

              {(temFiltroData || (filtro.origemTipo && filtro.origemTipo !== "todos")) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">
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
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th
                    className="text-left px-5 py-2.5 whitespace-nowrap w-[110px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() =>
                      setSort((s) =>
                        s.campo === "data_competencia"
                          ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" }
                          : { campo: "data_competencia", dir: "desc" }
                      )
                    }
                  >
                    <span className="inline-flex items-center gap-0.5">
                      Competência
                      {sort.campo === "data_competencia" ? (
                        sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap w-[110px]">Vencimento</th>
                  <th className="text-left px-3 py-2.5">Descrição</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap w-[140px]">Categoria</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap w-[140px]">Pessoa / Conta</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap w-[100px]">Tipo</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap w-[110px]">Status</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap w-[130px]">Valor</th>
                  <th className="px-4 py-2.5 w-[80px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-5 py-2">
                        <Skeleton className="h-8 w-full rounded" />
                      </td>
                    </tr>
                  ))
                ) : lancs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Scale className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-sm">Nenhum lançamento encontrado.</p>
                        <p className="text-xs">Ajuste os filtros ou clique em <strong>Novo lançamento</strong> para começar.</p>
                      </div>
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
                        className={`border-l-2 ${isReceita ? "border-l-success" : "border-l-destructive"} hover:bg-muted/20 transition-colors`}
                      >
                        {/* Competência */}
                        <td className="pl-4 pr-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(l.data_competencia)}
                        </td>

                        {/* Vencimento */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {vencDiferente ? (
                            <span className={isAtrasado ? "text-destructive font-medium" : "text-muted-foreground"}>
                              {formatDate(l.data_vencimento!)}
                              {isAtrasado && " ⚠"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="px-3 py-2.5 max-w-[260px]">
                          <span className="font-medium text-sm block truncate" title={l.descricao}>
                            {l.descricao}
                          </span>
                          {isIgnorado && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal text-muted-foreground border-muted-foreground/30 mt-0.5">
                              ignorado no somatório
                            </Badge>
                          )}
                          {isTransferencia && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal text-info border-info/30 mt-0.5">
                              transferência entre contas
                            </Badge>
                          )}
                          {(l as any).parcela_numero && (l as any).parcela_total && (
                            <span className="text-xs text-muted-foreground">
                              Parcela {(l as any).parcela_numero}/{(l as any).parcela_total}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px]">
                          <span className="truncate block" title={l.categoria?.nome ?? ""}>
                            {l.categoria?.nome ?? "—"}
                          </span>
                        </td>

                        {/* Pessoa / Conta */}
                        <td className="px-3 py-2.5 text-xs max-w-[140px]">
                          {l.pessoa?.nome ? (
                            <span className="text-foreground block truncate" title={l.pessoa.nome}>
                              {l.pessoa.nome}
                            </span>
                          ) : null}
                          <span className="text-muted-foreground block truncate" title={l.conta?.nome ?? ""}>
                            {l.conta?.nome ?? "—"}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 font-normal whitespace-nowrap">
                            {tipoLabel[l.tipo] ?? l.tipo}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 h-5 font-medium whitespace-nowrap ring-1 ${statusColor[l.status] ?? ""}`}
                          >
                            {statusLabel[l.status] ?? l.status}
                          </Badge>
                        </td>

                        {/* Valor */}
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums font-semibold text-sm whitespace-nowrap ${
                            isReceita
                              ? "text-success"
                              : "text-destructive"
                          }`}
                        >
                          {isReceita ? "+" : "−"} {formatBRL(Number(l.valor))}
                        </td>

                        {/* Ações */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Editar"
                            onClick={() => {
                              setEditing(l);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Excluir"
                            onClick={() => setConfirmDel(l)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
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

      {/* ── Dialogs ── */}
      <LancamentoDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5 text-sm">
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    default: { text: "text-foreground", bg: "bg-primary/10", icon: "text-primary" },
    success: { text: "text-success", bg: "bg-success/10", icon: "text-success" },
    danger: { text: "text-destructive", bg: "bg-destructive/10", icon: "text-destructive" },
  }[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">{label}</p>
            <p className={`text-xl font-semibold tabular-nums mt-1 ${cls.text}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg shrink-0 ${cls.bg}`}>
            <Icon className={`w-4 h-4 ${cls.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
