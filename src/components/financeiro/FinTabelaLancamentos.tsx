import { useMemo, useState } from "react";
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

  const { data = [], isLoading } = useLancamentos({ tipo });
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

  const marcarPago = async (l: LancamentoRow) => {
    await upsert.mutateAsync({
      id: l.id,
      status: "realizado",
      data_realizado: new Date().toISOString().slice(0, 10),
    } as any);
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
    const nome = `financeiro-${tipo}-${new Date().toISOString().slice(0, 10)}`;
    downloadCSV(nome, headers, rows);
  };

  const exportarPDF = () => {
    const { headers, rows } = buildExportRows();
    const titulo = `Financeiro · ${tipo === "a_pagar" ? "Contas a Pagar" : "Contas a Receber"}`;
    const subtitulo = `${filtrados.length} lançamento(s) · Total em aberto: ${totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Total pago: ${totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
    const nome = `financeiro-${tipo}-${new Date().toISOString().slice(0, 10)}`;
    downloadPDF(nome, `${titulo} — ${subtitulo}`, headers, rows);
  };
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
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Total em aberto</p>
              <p className="text-xl font-bold tabular-nums">
                {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="text-xl font-bold tabular-nums text-success">
                {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
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
            <Badge variant="outline">{filtrados.length} lançamentos</Badge>
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
                        <p className="font-medium line-clamp-1">{l.descricao}</p>
                        {l.categoria?.nome && (
                          <p className="text-[11px] text-muted-foreground">{l.categoria.nome}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
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
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Layers className="w-3 h-3" />{num}/{total}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate">
                        {vendedor ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${meta.cor}`}>
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
      />
    </div>
  );
}
