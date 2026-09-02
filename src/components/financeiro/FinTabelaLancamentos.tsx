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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Search,
  Pencil,
  ArrowUpDown,
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

type SortKey = "data_vencimento" | "descricao" | "pessoa" | "valor" | "status";

const STATUS_LABEL: Record<string, { label: string; cor: string; icone: typeof Clock }> = {
  previsto:   { label: "Em aberto", cor: "bg-info/10 text-info border-info/30",                 icone: FileText },
  vence_7d:   { label: "Vence 7d",  cor: "bg-warning/10 text-warning border-warning/30",        icone: Clock },
  em_atraso:  { label: "Vencido",   cor: "bg-destructive/10 text-destructive border-destructive/30", icone: AlertCircle },
  realizado:  { label: "Pago",      cor: "bg-success/10 text-success border-success/30",        icone: CheckCircle2 },
  conciliado: { label: "Conciliado",cor: "bg-success/10 text-success border-success/30",        icone: CheckCircle2 },
  cancelado:  { label: "Cancelado", cor: "bg-muted text-muted-foreground border-border",        icone: FileText },
};

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex gap-6 shrink-0">
            <div>
              <p className="text-xs text-muted-foreground">Total em aberto</p>
              <p className="text-xl font-bold tabular-nums whitespace-nowrap">
                {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="text-xl font-bold tabular-nums text-success whitespace-nowrap">
                {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lançamentos</p>
              <p className="text-xl font-bold tabular-nums">{filtrados.length}</p>
            </div>
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
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
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
                <Button size="sm" variant="outline" disabled={filtrados.length === 0}>
                  <Download className="w-4 h-4 mr-1" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportarCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportarPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-1" />
              Novo {tipo === "a_pagar" ? "pagamento" : "recebimento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button onClick={() => toggleSort("data_vencimento")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Vencimento <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("descricao")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Descrição <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("pessoa")} className="inline-flex items-center gap-1 hover:text-foreground">
                    {tipo === "a_pagar" ? "Fornecedor" : "Cliente"} <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Status <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => toggleSort("valor")} className="inline-flex items-center gap-1 hover:text-foreground ml-auto">
                    Valor <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhum lançamento encontrado
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
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {format(parseISO(venc), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
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
                              direto ao elo. */}
                          {tipo === "a_receber" && !l.contrato_pedido_id && !!docsPorLancamento?.[l.id] && (
                            <Badge
                              variant="outline"
                              className="bg-warning/10 text-warning border-warning/30 cursor-pointer shrink-0 text-[10px] px-1.5"
                              title="Tem nota guardada, mas não está ligado a nenhum contrato — não consome saldo nem aparece no faturamento da Gestão. Clique para vincular."
                              onClick={() => setVinculando({ ...(l as unknown as LancamentoParaVincular), pessoa_nome: (l as { pessoa?: { nome?: string } }).pessoa?.nome ?? null })}
                            >
                              sem vínculo
                            </Badge>
                          )}
                        </div>
                        {l.categoria?.nome && (
                          <p className="text-xs text-muted-foreground">{l.categoria.nome}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={l.pessoa?.nome ?? undefined}>
                        {l.pessoa?.nome ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.numero_documento ? (
                          <>
                            {l.numero_documento}
                            {l.serie_documento ? ` / ${l.serie_documento}` : ""}
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {total > 1 ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Layers className="w-3 h-3" />{num}/{total}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate" title={vendedor ?? undefined}>
                        {vendedor ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs gap-1 ${meta.cor}`}>
                          <Icone className="w-3 h-3" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {podePagar && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
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
                            className={cn("h-7 w-7",
                              (tipo === "a_pagar" ? l.contrato_id : l.contrato_pedido_id) && "text-primary")}
                            onClick={() => setVinculando({ ...(l as unknown as LancamentoParaVincular), pessoa_nome: (l as { pessoa?: { nome?: string } }).pessoa?.nome ?? null })}
                            title={tipo === "a_pagar"
                              ? (l.contrato_id
                                  ? "Despesa atribuída a um contrato — clique para trocar"
                                  : "Atribuir esta despesa a um contrato")
                              : (l.contrato_pedido_id
                                  ? "Vinculado a um pedido — clique para trocar"
                                  : "Vincular a um contrato/pedido em Gestão")}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => abrirEditar(l)}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
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
