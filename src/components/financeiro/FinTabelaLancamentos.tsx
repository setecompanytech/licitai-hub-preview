import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import DocumentoDoLancamento, { useDocumentosPorLancamento } from "./DocumentoDoLancamento";
import VincularContratoDialog from "./VincularContratoDialog";
import type { LancamentoParaVincular } from "@/lib/contratos/pedido-do-lancamento";
import { exigeDocumento } from "@/lib/financeiro/anexo-do-lancamento";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { DataDaBaixaDialog } from "./DataDaBaixaDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EstadoVazio from "@/components/shared/EstadoVazio";
import {
  Loader2,
  Plus,
  Search,
  Pencil,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Layers,
  Download,
  FileSpreadsheet,
  Link2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadCSV, downloadPDF } from "@/lib/download-utils";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useLancamentos,
  useUpsertLancamento,
  useMembrosEmpresa,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import LancamentoDialog from "./LancamentoDialog";

interface Props {
  tipo: "a_pagar" | "a_receber";
}

type LancamentoRow = Lancamento & {
  conta?: { id: string; nome: string } | null;
  categoria?: { id: string; nome: string; natureza: string } | null;
  pessoa?: { id: string; nome: string } | null;
};

/**
 * A coluna de ações fica presa à direita quando a tabela rola na horizontal.
 * Em 14/09/2026 ela saía cortada na borda do cartão — "Receber" à vista, os
 * botões de vincular e editar escondidos, e nada indicando que havia rolagem.
 * No celular não prende: 200 px fixos numa tela de 360 px não deixariam espaço
 * para o resto da linha.
 *
 * O divisor é sombra interna, não `border-l`: a tabela usa `border-collapse`, e
 * nesse modo a borda pertence à grade — ela fica parada no lugar original
 * enquanto a célula presa desliza por cima dela.
 */
const COLUNA_DE_ACOES = "md:sticky md:right-0 md:bg-card md:shadow-[inset_1px_0_0_0_hsl(var(--border))]";

type SortKey = "data_vencimento" | "descricao" | "pessoa" | "valor" | "status";

type VarianteBadge = "success" | "warning" | "danger" | "info" | "muted";

/**
 * Situação em tinta (identidade 12/09): a cor sai das variantes semânticas do
 * Badge (`*-tint` / `*-ink` / `*-line`), não de alfa composto na mão — e o
 * texto continua sendo a pista principal.
 */
const STATUS_LABEL: Record<string, { label: string; variante: VarianteBadge; icone: typeof Clock }> = {
  previsto:   { label: "Em aberto",  variante: "info",    icone: FileText },
  vence_7d:   { label: "Vence 7d",   variante: "warning", icone: Clock },
  em_atraso:  { label: "Vencido",    variante: "danger",  icone: AlertCircle },
  realizado:  { label: "Pago",       variante: "success", icone: CheckCircle2 },
  conciliado: { label: "Conciliado", variante: "success", icone: CheckCircle2 },
  cancelado:  { label: "Cancelado",  variante: "muted",   icone: FileText },
};

/**
 * Indicador de ordenação: a coluna ATIVA mostra a direção; as demais, a seta
 * neutra esmaecida. Todas mostravam o mesmo ícone, e nem a coluna ordenada nem
 * o sentido apareciam na tela.
 */
function IconeOrdem({ ativa, dir }: { ativa: boolean; dir: "asc" | "desc" }) {
  if (!ativa) return <ArrowUpDown className="w-3 h-3 opacity-30" aria-hidden="true" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3" aria-hidden="true" />
    : <ChevronDown className="w-3 h-3" aria-hidden="true" />;
}

export default function FinTabelaLancamentos({ tipo }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("data_vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);
  /** O lançamento cujo vínculo com a Gestão está sendo feito. */
  const [vinculando, setVinculando] = useState<LancamentoParaVincular | null>(null);
  const qc = useQueryClient();

  const { data = [], isLoading } = useLancamentos({ tipo });
  // Mesmo mapa batched do clipe — nenhuma consulta nova por linha.
  const { data: docsPorLancamento } = useDocumentosPorLancamento();
  const { data: membros = [] } = useMembrosEmpresa();
  const upsert = useUpsertLancamento();

  const lancamentos = data as LancamentoRow[];

  const dataRefVenc = (l: LancamentoRow): string =>
    l.data_vencimento ?? l.data_competencia;

  const statusEfetivo = (l: LancamentoRow): string => {
    if (l.status === "realizado" || l.status === "conciliado" || l.status === "cancelado") {
      return l.status;
    }
    const dias = differenceInDays(parseISO(dataRefVenc(l)), new Date());
    if (dias < 0) return "em_atraso";
    if (dias <= 7) return "vence_7d";
    return "previsto";
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let arr = lancamentos.filter((l) => {
      if (filtroVendedor !== "todos" && (l as any).vendedor_responsavel_id !== filtroVendedor) return false;
      if (filtroStatus !== "todos" && statusEfetivo(l) !== filtroStatus) return false;
      if (!termo) return true;
      return (
        l.descricao.toLowerCase().includes(termo) ||
        (l.numero_documento ?? "").toLowerCase().includes(termo) ||
        (l.pessoa?.nome ?? "").toLowerCase().includes(termo)
      );
    });

    arr = [...arr].sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "valor":
          va = Number(a.valor); vb = Number(b.valor); break;
        case "descricao":
          va = a.descricao.toLowerCase(); vb = b.descricao.toLowerCase(); break;
        case "pessoa":
          va = (a.pessoa?.nome ?? "").toLowerCase(); vb = (b.pessoa?.nome ?? "").toLowerCase(); break;
        case "status":
          va = statusEfetivo(a); vb = statusEfetivo(b); break;
        default:
          va = dataRefVenc(a); vb = dataRefVenc(b);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [lancamentos, busca, filtroStatus, filtroVendedor, sortKey, sortDir]);

  const totalAberto = filtrados.reduce(
    (s, l) => (["realizado", "conciliado", "cancelado"].includes(l.status) ? s : s + Number(l.valor)),
    0,
  );
  const totalPago = filtrados.reduce(
    (s, l) => (["realizado", "conciliado"].includes(l.status) ? s + Number(l.valor) : s),
    0,
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  /** aria-sort da coluna: só a ativa anuncia a direção ao leitor de tela. */
  const ariaOrdem = (k: SortKey): "ascending" | "descending" | "none" =>
    sortKey !== k ? "none" : sortDir === "asc" ? "ascending" : "descending";

  /** A baixa pergunta a data do pagamento — a do extrato, não a do clique. */
  const [baixaPendente, setBaixaPendente] = useState<string | null>(null);
  const marcarPago = (l: LancamentoRow) => setBaixaPendente(l.id);
  const confirmarBaixa = async (data: string) => {
    if (!baixaPendente) return;
    try {
      await upsert.mutateAsync({
        id: baixaPendente,
        status: "realizado",
        data_realizado: data,
      } as any);
    } finally {
      setBaixaPendente(null);
    }
  };

  const abrirNovo = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (l: LancamentoRow) => { setEditing(l); setDialogOpen(true); };

  const nomeVendedor = (id: string | null | undefined) => {
    if (!id) return null;
    const m = membros.find((x) => x.user_id === id);
    return m?.nome_completo || m?.email || null;
  };

  const buildExportRows = () => {
    const headers = [
      "Vencimento",
      "Descrição",
      "Categoria",
      tipo === "a_pagar" ? "Fornecedor" : "Cliente",
      "Documento",
      "Parcela",
      "Responsável",
      "Status",
      "Valor (R$)",
    ];
    const rows = filtrados.map((l) => {
      const st = statusEfetivo(l);
      const meta = STATUS_LABEL[st] ?? STATUS_LABEL.previsto;
      const total = Number(l.parcela_total ?? 1);
      const num = Number(l.parcela_numero ?? 1);
      const venc = dataRefVenc(l);
      return [
        format(parseISO(venc), "dd/MM/yyyy", { locale: ptBR }),
        l.descricao ?? "",
        l.categoria?.nome ?? "",
        l.pessoa?.nome ?? "",
        l.numero_documento
          ? `${l.numero_documento}${l.serie_documento ? ` / ${l.serie_documento}` : ""}`
          : "",
        total > 1 ? `${num}/${total}` : "",
        nomeVendedor((l as any).vendedor_responsavel_id) ?? "",
        meta.label,
        Number(l.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ];
    });
    return { headers, rows };
  };

  const exportarCSV = () => {
    const { headers, rows } = buildExportRows();
    const nome = `financeiro-${tipo}-${hojeLocal()}`;
    downloadCSV(nome, headers, rows);
  };

  const exportarPDF = () => {
    const { headers, rows } = buildExportRows();
    const titulo = `Financeiro · ${tipo === "a_pagar" ? "Contas a Pagar" : "Contas a Receber"}`;
    const subtitulo = `${filtrados.length} lançamento(s) · Total em aberto: ${totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Total pago: ${totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
    const nome = `financeiro-${tipo}-${hojeLocal()}`;
    downloadPDF(nome, `${titulo} — ${subtitulo}`, headers, rows);
  };

  if (isLoading) {
    return (
      <div role="status" className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando lançamentos</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Totais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Total em aberto</p>
            <p className="mt-1 text-[2rem] font-bold leading-10 tabular-nums text-foreground">
              {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Total pago</p>
            <p className="mt-1 text-[2rem] font-bold leading-10 tabular-nums text-success-ink">
              {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Lançamentos</p>
            <p className="mt-1 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{filtrados.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Buscar por descrição, documento ou pessoa"
            placeholder="Buscar descrição, doc ou pessoa…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="previsto">Em aberto</SelectItem>
            <SelectItem value="vence_7d">Vence em 7 dias</SelectItem>
            <SelectItem value="em_atraso">Vencido</SelectItem>
            <SelectItem value="realizado">Pago</SelectItem>
            <SelectItem value="conciliado">Conciliado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
          <SelectTrigger className="w-[220px]" aria-label="Filtrar por responsável"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {membros.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.nome_completo || m.email || m.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={filtrados.length === 0}>
              <Download className="w-4 h-4" aria-hidden="true" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportarCSV}>
              <FileSpreadsheet className="mr-2 w-4 h-4" aria-hidden="true" />
              Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportarPDF}>
              <FileText className="mr-2 w-4 h-4" aria-hidden="true" />
              Exportar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={abrirNovo}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo {tipo === "a_pagar" ? "pagamento" : "recebimento"}
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {/* 12 px de respiro lateral em vez de 16: são oito colunas, e os 64 px
              devolvidos são parte do que faz a tabela caber a 1.280 px sem rolar. */}
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap" aria-sort={ariaOrdem("data_vencimento")}>
                  <button type="button" onClick={() => toggleSort("data_vencimento")} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    Vencimento <IconeOrdem ativa={sortKey === "data_vencimento"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap" aria-sort={ariaOrdem("descricao")}>
                  <button type="button" onClick={() => toggleSort("descricao")} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    Descrição <IconeOrdem ativa={sortKey === "descricao"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap" aria-sort={ariaOrdem("pessoa")}>
                  <button type="button" onClick={() => toggleSort("pessoa")} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    {tipo === "a_pagar" ? "Fornecedor" : "Cliente"} <IconeOrdem ativa={sortKey === "pessoa"} dir={sortDir} />
                  </button>
                </TableHead>
                {/* Parcela mora embaixo do documento, não numa coluna própria: a
                    coluna de ~90 px para um "2/3" empurrava Ações para fora do
                    cartão e, espremida, quebrava o título letra por letra (14/09). */}
                <TableHead className="whitespace-nowrap">Documento</TableHead>
                {/* Responsável só a partir de 1.400 px. Abaixo disso a tabela
                    não cabia, e a coluna que sobrava era Valor, escondida sob as
                    ações. O responsável continua no filtro acima e na edição. */}
                <TableHead className="hidden whitespace-nowrap min-[1400px]:table-cell">Responsável</TableHead>
                <TableHead className="whitespace-nowrap" aria-sort={ariaOrdem("status")}>
                  <button type="button" onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    Status <IconeOrdem ativa={sortKey === "status"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap text-right" aria-sort={ariaOrdem("valor")}>
                  <button type="button" onClick={() => toggleSort("valor")} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-primary">
                    Valor <IconeOrdem ativa={sortKey === "valor"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className={cn("whitespace-nowrap text-right", COLUNA_DE_ACOES)}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    <EstadoVazio
                      icone={<FileText />}
                      titulo="Nenhum lançamento encontrado"
                      descricao="Ajuste a busca e os filtros acima, ou registre um novo lançamento."
                      acao={
                        <Button onClick={abrirNovo}>
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          Novo {tipo === "a_pagar" ? "pagamento" : "recebimento"}
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((l) => {
                  const st = statusEfetivo(l);
                  const meta = STATUS_LABEL[st] ?? STATUS_LABEL.previsto;
                  const Icone = meta.icone;
                  const total = Number(l.parcela_total ?? 1);
                  const num = Number(l.parcela_numero ?? 1);
                  const venc = dataRefVenc(l);
                  const vendedor = nomeVendedor((l as any).vendedor_responsavel_id);
                  const podePagar = !["realizado", "conciliado", "cancelado"].includes(l.status);
                  const rotuloVinculo = tipo === "a_pagar"
                    ? (l.contrato_id
                        ? "Despesa atribuída a um contrato — clique para trocar"
                        : "Atribuir esta despesa a um contrato")
                    : (l.contrato_pedido_id
                        ? "Vinculado a um pedido — clique para trocar"
                        : "Vincular a um contrato/pedido em Gestão");
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {format(parseISO(venc), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="font-medium line-clamp-1" title={l.descricao}>{l.descricao}</p>
                          {/* O documento que originou o lançamento, ao lado dele.
                              Pasta de arquivos que não aponta para os lançamentos
                              é arquivo morto: existe, e ninguém abre. */}
                          <DocumentoDoLancamento
                            lancamentoId={l.id}
                            tipoDocumento={l.tipo_documento}
                            numeroDocumento={l.numero_documento}
                            dataEmissao={l.data_emissao}
                            valorTotal={Number(l.valor) || 0}
                            // A regra de exigência mora em um lugar só, junto do
                            // perfil do anexo: lista aqui e diálogo lá divergem
                            // no dia em que alguém acrescentar um tipo e lembrar
                            // de uma das duas cópias.
                            exigeDocumento={exigeDocumento(l.tipo_documento)}
                          />
                          {/* Nota guardada e nenhum pedido: é a população que
                              nasce do preenchimento manual e fica invisível
                              para a Gestão. A pendência aparece — e leva
                              direto ao elo. O selo É o botão: o estilo vem de
                              `badgeVariants`, e não de um Badge aninhado —
                              Badge renderiza uma div, e button só aceita
                              conteúdo de frase. */}
                          {tipo === "a_receber" && !l.contrato_pedido_id && !!docsPorLancamento?.[l.id] && (
                            <button
                              type="button"
                              className={cn(
                                badgeVariants({ variant: "warning" }),
                                "shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              )}
                              title="Tem nota guardada, mas não está ligado a nenhum contrato — não consome saldo nem aparece no faturamento da Gestão. Clique para vincular."
                              onClick={() => setVinculando({ ...(l as unknown as LancamentoParaVincular), pessoa_nome: (l as { pessoa?: { nome?: string } }).pessoa?.nome ?? null })}
                            >
                              sem vínculo
                            </button>
                          )}
                        </div>
                        {l.categoria?.nome && (
                          <p className="text-xs text-muted-foreground">{l.categoria.nome}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={l.pessoa?.nome ?? undefined}>
                        {l.pessoa?.nome ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col items-start gap-1">
                          <span className="whitespace-nowrap tabular-nums">
                            {l.numero_documento ? (
                              <>
                                {l.numero_documento}
                                {l.serie_documento ? ` / ${l.serie_documento}` : ""}
                              </>
                            ) : <span className="text-muted-foreground">—</span>}
                          </span>
                          {total > 1 && (
                            <Badge variant="muted" className="gap-1 whitespace-nowrap" title={`Parcela ${num} de ${total}`}>
                              <Layers className="w-3 h-3" aria-hidden="true" />Parcela {num}/{total}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[120px] truncate text-sm min-[1400px]:table-cell" title={vendedor ?? undefined}>
                        {vendedor ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variante} className="gap-1">
                          <Icone className="w-3 h-3" aria-hidden="true" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
                        {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className={cn("text-right", COLUNA_DE_ACOES)}>
                        <div className="flex items-center justify-end gap-1">
                          {podePagar && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => marcarPago(l)}
                              disabled={upsert.isPending}
                            >
                              {tipo === "a_pagar" ? "Pagar" : "Receber"}
                            </Button>
                          )}
                          {/* A porta de volta para a Gestão. O vínculo
                              `contrato_pedido_id` sempre existiu, mas so era
                              alcancavel a partir do PEDIDO — o que pressupoe
                              que o pedido veio primeiro. Contrato que entra na
                              gestao depois de meses de faturamento tem dezenas
                              de lancamentos e nenhum pedido. */}
                          {/* A receber liga a uma ENTREGA; a pagar liga ao
                              CONTRATO. Comprar não é entregar: um pagamento a
                              fornecedor não representa entrega ao órgão, e
                              criar pedido a partir dele consumiria saldo de
                              contrato por causa de uma compra. */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn("h-9 w-9",
                              (tipo === "a_pagar" ? l.contrato_id : l.contrato_pedido_id) && "text-primary")}
                            onClick={() => setVinculando({ ...(l as unknown as LancamentoParaVincular), pessoa_nome: (l as { pessoa?: { nome?: string } }).pessoa?.nome ?? null })}
                            title={rotuloVinculo}
                            aria-label={rotuloVinculo}
                          >
                            <Link2 />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9"
                            onClick={() => abrirEditar(l)}
                            title="Editar"
                            aria-label={`Editar ${l.descricao}`}
                          >
                            <Pencil />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        defaultTipo={tipo}
        // Só nesta página o diálogo do elo abre em modo receita; a receber
        // salvo a partir da página de A Pagar cai no toast sem botão.
        onVincularContrato={tipo === "a_receber" ? setVinculando : undefined}
      />

      <DataDaBaixaDialog
        aberto={!!baixaPendente}
        tipo={tipo}
        quantidade={1}
        onConfirmar={confirmarBaixa}
        onFechar={() => setBaixaPendente(null)}
      />

      <VincularContratoDialog
        lancamento={vinculando}
        modo={tipo === "a_pagar" ? "despesa" : "receita"}
        onFechar={() => setVinculando(null)}
        onVinculado={() => {
          qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
          qc.invalidateQueries({ queryKey: ["fin-vinculos-de-contrato"] });
        }}
      />
    </div>
  );
}
