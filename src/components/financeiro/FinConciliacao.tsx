import { useMemo, useRef, useState } from "react";
import {
  useContas,
  useExtratosImportados,
  useMovimentosExtrato,
  useImportarOFX,
  useConciliarAutomatico,
  useConciliarManual,
  useDesfazerConciliacao,
  useLancamentos,
  useUpsertLancamento,
  ajustarSaldoConta,
} from "@/hooks/useFinanceiro";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Sparkles,
  Link2,
  Unlink,
  Loader2,
  FileCheck2,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  ArrowLeftRight,
  Ban,
  ChevronDown,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Clock,
  XCircle,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, statusLabel } from "@/lib/financeiro/formatters";
import { parseCsvExtrato, csvParaOfx } from "@/lib/financeiro/csvToOfx";
import { toast } from "sonner";
import FinRelatorioConciliacao from "./FinRelatorioConciliacao";
import LancamentoDialog from "./LancamentoDialog";

type MatchSugestao = {
  movimento_id: string;
  lancamento_id: string;
  score: number;
  motivos: Record<string, unknown>;
  metodo?: string;
  justificativa_ia?: string;
};

export default function FinConciliacao() {
  // ─── Refs ─────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const reprocFileRef = useRef<HTMLInputElement>(null);
  const reprocAlvo = useRef<{ extrato_id: string; conta_id: string; arquivo_nome: string } | null>(null);

  // ─── State ────────────────────────────────────────────────────────────────
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [confirmReproc, setConfirmReproc] = useState<{
    extrato_id: string;
    conta_id: string;
    arquivo_nome: string;
    total_movimentos: number;
  } | null>(null);
  const qc = useQueryClient();
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [filtroConciliado, setFiltroConciliado] = useState<
    "todos" | "pendente" | "conciliado" | "ignorado"
  >("pendente");
  const [scoreMinimo, setScoreMinimo] = useState<number>(75);
  const [sugestoes, setSugestoes] = useState<MatchSugestao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [dialogManual, setDialogManual] = useState<{
    movimento_id: string;
    valor: number;
    natureza: "receita" | "despesa";
  } | null>(null);
  const [novoLanc, setNovoLanc] = useState<{
    movimento_id: string;
    initial: Record<string, unknown>;
    defaultTipo: "a_pagar" | "a_receber" | "movimentacao";
  } | null>(null);
  const [movsSelecionados, setMovsSelecionados] = useState<Set<string>>(new Set());

  // ─── Data ─────────────────────────────────────────────────────────────────
  const { data: contas } = useContas();
  const { data: extratos } = useExtratosImportados();
  const { data: movimentos, isLoading: loadingMov } = useMovimentosExtrato({
    conta_id: contaSelecionada || undefined,
    conciliado:
      filtroConciliado === "todos" || filtroConciliado === "ignorado"
        ? undefined
        : filtroConciliado === "conciliado",
  });
  const { data: lancamentosTodos } = useLancamentos({});

  // ─── Mutations ────────────────────────────────────────────────────────────
  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const desfazer = useDesfazerConciliacao();
  const upsertLancamento = useUpsertLancamento();

  const ignorarMov = useMutation({
    mutationFn: async (params: { id: string; ignorar: boolean; motivo?: string }) => {
      const patch: Record<string, unknown> = params.ignorar
        ? { ignorado: true, ignorado_em: new Date().toISOString(), ignorado_motivo: params.motivo ?? null }
        : { ignorado: false, ignorado_em: null, ignorado_motivo: null };
      const { error } = await supabase
        .from("financeiro_extrato_movimentos")
        .update(patch as never)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fin-movimentos-extrato"] });
      toast.success(vars.ignorar ? "Movimento ignorado." : "Movimento restaurado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Derived ──────────────────────────────────────────────────────────────
  const movimentosFiltrados = useMemo(() => {
    const lista = movimentos ?? [];
    if (filtroConciliado === "ignorado") return lista.filter((m: any) => m.ignorado === true);
    if (filtroConciliado === "pendente") return lista.filter((m: any) => !m.ignorado);
    return lista;
  }, [movimentos, filtroConciliado]);

  const resumoMovimentos = useMemo(() => {
    const entradas = movimentosFiltrados
      .filter((m: any) => Number(m.valor) > 0)
      .reduce((acc: number, m: any) => acc + Number(m.valor), 0);
    const saidas = movimentosFiltrados
      .filter((m: any) => Number(m.valor) < 0)
      .reduce((acc: number, m: any) => acc + Math.abs(Number(m.valor)), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [movimentosFiltrados]);

  const resumoGeral = useMemo(() => {
    const all = movimentos ?? [];
    return {
      total: all.length,
      pendentes: all.filter((m: any) => !m.conciliado && !m.ignorado).length,
      conciliados: all.filter((m: any) => m.conciliado).length,
      ignorados: all.filter((m: any) => m.ignorado).length,
    };
  }, [movimentos]);

  const movMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof movimentos>[number]>();
    (movimentos ?? []).forEach((mov) => m.set(mov.id, mov));
    return m;
  }, [movimentos]);

  const lancMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof lancamentosTodos>[number]>();
    (lancamentosTodos ?? []).forEach((l) => m.set(l.id, l));
    return m;
  }, [lancamentosTodos]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      toast.error("Selecione uma conta antes de importar.");
      e.target.value = "";
      return;
    }
    const conteudo = await file.text();
    importar.mutate(
      { conta_id: contaSelecionada, arquivo_nome: file.name, conteudo_ofx: conteudo },
      { onSettled: () => (e.target.value = "") }
    );
  }

  async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!contaSelecionada) {
      toast.error("Selecione uma conta antes de importar.");
      e.target.value = "";
      return;
    }
    try {
      const texto = await file.text();
      const linhas = parseCsvExtrato(texto);
      if (linhas.length === 0) {
        toast.error("Nenhuma linha válida encontrada no CSV. Verifique cabeçalhos: data, descricao, valor.");
        e.target.value = "";
        return;
      }
      const ofxEquivalente = csvParaOfx(linhas);
      const nome = file.name.replace(/\.csv$/i, ".csv.ofx");
      importar.mutate(
        { conta_id: contaSelecionada, arquivo_nome: nome, conteudo_ofx: ofxEquivalente },
        {
          onSuccess: () => toast.success(`${linhas.length} linha(s) do CSV convertidas e importadas.`),
          onSettled: () => (e.target.value = ""),
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar CSV.");
      e.target.value = "";
    }
  }

  function iniciarReprocesso(extrato_id: string, conta_id: string, arquivo_nome: string) {
    const ex = (extratos ?? []).find((e) => e.id === extrato_id);
    setConfirmReproc({
      extrato_id,
      conta_id,
      arquivo_nome,
      total_movimentos: ex?.total_movimentos ?? 0,
    });
  }

  function confirmarReprocesso() {
    if (!confirmReproc) return;
    reprocAlvo.current = {
      extrato_id: confirmReproc.extrato_id,
      conta_id: confirmReproc.conta_id,
      arquivo_nome: confirmReproc.arquivo_nome,
    };
    setConfirmReproc(null);
    reprocFileRef.current?.click();
  }

  async function onReprocessarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const alvo = reprocAlvo.current;
    e.target.value = "";
    if (!file || !alvo) return;
    setReprocessando(alvo.extrato_id);
    try {
      const { error: errMov } = await supabase
        .from("financeiro_extrato_movimentos")
        .delete()
        .eq("extrato_id", alvo.extrato_id);
      if (errMov) throw errMov;
      const { error: errExt } = await supabase
        .from("financeiro_extratos_importados")
        .delete()
        .eq("id", alvo.extrato_id);
      if (errExt) throw errExt;
      const conteudo = await file.text();
      importar.mutate(
        { conta_id: alvo.conta_id, arquivo_nome: file.name, conteudo_ofx: conteudo },
        {
          onSuccess: () => {
            toast.success("Extrato reprocessado com sucesso.");
            qc.invalidateQueries({ queryKey: ["fin-extratos-importados"] });
            qc.invalidateQueries({ queryKey: ["fin-movimentos-extrato"] });
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Falha no reprocesso."),
          onSettled: () => setReprocessando(null),
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover extrato antigo.");
      setReprocessando(null);
    } finally {
      reprocAlvo.current = null;
    }
  }

  function buscarSugestoes(usar_ia = false) {
    conciliarAuto.mutate(
      {
        conta_id: contaSelecionada || undefined,
        auto_aplicar: false,
        score_minimo: scoreMinimo,
        usar_ia,
      },
      {
        onSuccess: (data) => {
          setSugestoes(data.matches ?? []);
          setSelecionadas(new Set((data.matches ?? []).map((m) => m.movimento_id)));
          const iaSug = (data as { ia_sugeridos?: number }).ia_sugeridos;
          if (usar_ia && iaSug) toast.success(`IA sugeriu ${iaSug} novos matches.`);
        },
      }
    );
  }

  function aplicarSelecionadas() {
    const aAplicar = sugestoes.filter((s) => selecionadas.has(s.movimento_id));
    if (aAplicar.length === 0) { toast.info("Nenhuma sugestão selecionada."); return; }
    let aplicados = 0, erros = 0;
    Promise.all(
      aAplicar.map(
        (s) =>
          new Promise<void>((resolve) => {
            conciliarManual.mutate(
              { movimento_id: s.movimento_id, lancamento_id: s.lancamento_id },
              {
                onSuccess: () => { aplicados++; resolve(); },
                onError: () => { erros++; resolve(); },
              }
            );
          })
      )
    ).then(() => {
      if (aplicados > 0) toast.success(`${aplicados} conciliações aplicadas.`);
      if (erros > 0) toast.error(`${erros} falha(s) ao conciliar.`);
      setSugestoes((curr) => curr.filter((s) => !selecionadas.has(s.movimento_id)));
      setSelecionadas(new Set());
    });
  }

  function aplicarTodasAlta() {
    const auto = sugestoes.filter((s) => s.score >= 90);
    if (auto.length === 0) { toast.info("Nenhuma sugestão com score ≥ 90 disponível."); return; }
    setSelecionadas(new Set(auto.map((s) => s.movimento_id)));
    setTimeout(() => aplicarSelecionadas(), 50);
  }

  function toggleTodas(check: boolean) {
    if (check) setSelecionadas(new Set(sugestoes.map((s) => s.movimento_id)));
    else setSelecionadas(new Set());
  }

  async function efetivarSelecionados() {
    const movsSel = movimentosFiltrados.filter(
      (m: any) => movsSelecionados.has(m.id) && !m.conciliado && !m.ignorado
    );
    if (movsSel.length === 0) return;
    let ok = 0, erros = 0;
    for (const m of movsSel) {
      const isCredito = Number(m.valor) >= 0;
      try {
        const lanc = await upsertLancamento.mutateAsync({
          descricao: m.descricao || "Movimento bancário",
          valor: Math.abs(Number(m.valor)),
          data_competencia: m.data_movimento,
          conta_id: m.conta_id,
          natureza: isCredito ? "receita" : "despesa",
          tipo: isCredito ? "a_receber" : "a_pagar",
          status: "conciliado",
          data_realizado: m.data_movimento,
        });
        await conciliarManual.mutateAsync({
          movimento_id: m.id,
          lancamento_id: (lanc as any).id,
        });
        if (m.conta_id) {
          const delta = isCredito ? Math.abs(Number(m.valor)) : -Math.abs(Number(m.valor));
          await ajustarSaldoConta(m.conta_id, delta);
        }
        ok++;
      } catch {
        erros++;
      }
    }
    if (ok > 0) toast.success(`${ok} lançamento(s) efetivados e conciliados.`);
    if (erros > 0) toast.error(`${erros} falha(s) ao efetivar.`);
    setMovsSelecionados(new Set());
    qc.invalidateQueries({ queryKey: ["fin-movimentos-extrato"] });
    qc.invalidateQueries({ queryKey: ["fin-contas"] });
    qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
    qc.invalidateQueries({ queryKey: ["fin-resumo"] });
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <Tabs defaultValue="conciliar" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="conciliar" className="text-xs px-3">
          <Link2 className="w-3.5 h-3.5 mr-1.5" />Conciliação
        </TabsTrigger>
        <TabsTrigger value="relatorio" className="text-xs px-3">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Relatório por período
        </TabsTrigger>
      </TabsList>

      {/* ════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="conciliar" className="space-y-4 mt-0">

        {/* ── Controles ── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Conta bancária</label>
                <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contas ?? [])
                      .filter((c) => ["corrente", "poupanca", "caixa"].includes(c.tipo ?? ""))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Exibindo</label>
                <Select
                  value={filtroConciliado}
                  onValueChange={(v) => setFiltroConciliado(v as typeof filtroConciliado)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="conciliado">Conciliados</SelectItem>
                    <SelectItem value="ignorado">Ignorados</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={onFile} />
                <input ref={csvRef} type="file" accept=".csv,.CSV,text/csv" className="hidden" onChange={onCsvFile} />

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => fileRef.current?.click()}
                  disabled={importar.isPending || !contaSelecionada}
                >
                  {importar.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Importar OFX
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => csvRef.current?.click()}
                  disabled={importar.isPending || !contaSelecionada}
                  title="CSV com colunas: data, descricao, valor (opcional documento)"
                >
                  {importar.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Importar CSV
                </Button>

                <Button
                  size="sm"
                  className="h-9"
                  onClick={() =>
                    conciliarAuto.mutate({
                      conta_id: contaSelecionada || undefined,
                      auto_aplicar: true,
                      score_minimo: 90,
                    })
                  }
                  disabled={conciliarAuto.isPending}
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Auto-conciliar (≥ 90)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats strip ── */}
        {(movimentos ?? []).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatCard label="Total" value={String(resumoGeral.total)} icon={Wallet} tone="default" />
            <StatCard label="Pendentes" value={String(resumoGeral.pendentes)} icon={Clock} tone="warning" />
            <StatCard label="Conciliados" value={String(resumoGeral.conciliados)} icon={CheckCircle2} tone="success" />
            <StatCard label="Ignorados" value={String(resumoGeral.ignorados)} icon={XCircle} tone="muted" />
            <StatCard label="Entradas" value={formatBRL(resumoMovimentos.entradas)} icon={ArrowUp} tone="success" />
            <StatCard label="Saídas" value={formatBRL(resumoMovimentos.saidas)} icon={ArrowDown} tone="danger" />
            <StatCard
              label="Saldo"
              value={formatBRL(resumoMovimentos.saldo)}
              icon={resumoMovimentos.saldo >= 0 ? TrendingUp : TrendingDown}
              tone={resumoMovimentos.saldo >= 0 ? "success" : "danger"}
            />
          </div>
        )}

        {/* ── Sugestões ── */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Sugestões de conciliação</CardTitle>
                {sugestoes.length > 0 && (
                  <Badge variant="secondary" className="tabular-nums text-xs px-2">
                    {sugestoes.length}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <div className="flex items-center gap-2 min-w-[210px]">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Score mín.</span>
                  <Slider
                    value={[scoreMinimo]}
                    onValueChange={([v]) => setScoreMinimo(v)}
                    min={50} max={100} step={5}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-semibold w-6 text-right">{scoreMinimo}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarSugestoes(false)}
                  disabled={conciliarAuto.isPending}
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Search className="w-3.5 h-3.5 mr-1" />}
                  Buscar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarSugestoes(true)}
                  disabled={conciliarAuto.isPending}
                  title="Usa IA para encontrar matches em casos ambíguos"
                >
                  {conciliarAuto.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />}
                  Sugerir com IA
                </Button>

                {sugestoes.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      onClick={aplicarSelecionadas}
                      disabled={selecionadas.size === 0}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aplicar ({selecionadas.size})
                    </Button>
                    <Button variant="secondary" size="sm" onClick={aplicarTodasAlta}>
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Aprovar ≥ 90
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sugestoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-6 gap-2">
                <Search className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Clique em <strong>Buscar</strong> para encontrar correspondências entre movimentos do extrato e lançamentos, sem aplicar alterações.
                </p>
                <p className="text-xs text-muted-foreground">
                  Use <strong>Auto-conciliar</strong> para aplicar automaticamente todos os matches com score ≥ 90.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="w-[44px] pl-5">
                        <Checkbox
                          checked={selecionadas.size === sugestoes.length && sugestoes.length > 0}
                          onCheckedChange={(v) => toggleTodas(!!v)}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
                      <TableHead className="w-[88px]">Score</TableHead>
                      <TableHead>Movimento (extrato)</TableHead>
                      <TableHead>Lançamento previsto</TableHead>
                      <TableHead className="w-[160px]">Compatibilidade</TableHead>
                      <TableHead className="text-right w-[100px] pr-5">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoes.map((s) => {
                      const mov = movMap.get(s.movimento_id);
                      const lanc = lancMap.get(s.lancamento_id);
                      const checked = selecionadas.has(s.movimento_id);
                      return (
                        <TableRow key={s.movimento_id + s.lancamento_id} className="text-sm hover:bg-muted/30">
                          <TableCell className="pl-5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelecionadas((curr) => {
                                  const next = new Set(curr);
                                  if (v) next.add(s.movimento_id);
                                  else next.delete(s.movimento_id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <ScoreBadge score={s.score} metodo={s.metodo} />
                          </TableCell>
                          <TableCell>
                            {mov ? (
                              <div>
                                <div className="font-medium truncate max-w-[220px]">{mov.descricao}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(mov.data_movimento)} ·{" "}
                                  <span className={Number(mov.valor) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                                    {formatBRL(Number(mov.valor))}
                                  </span>
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {lanc ? (
                              <div>
                                <div className="font-medium truncate max-w-[220px]">{lanc.descricao}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {lanc.data_vencimento ? `Venc.: ${formatDate(lanc.data_vencimento)}` : "—"} · {formatBRL(Number(lanc.valor))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">Lançamento fora da página atual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <MotivosBadges motivos={s.motivos} />
                              {s.justificativa_ia && (
                                <p className="text-[11px] italic text-muted-foreground max-w-[240px] leading-snug">
                                  "{s.justificativa_ia}"
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                conciliarManual.mutate(
                                  { movimento_id: s.movimento_id, lancamento_id: s.lancamento_id },
                                  {
                                    onSuccess: () =>
                                      setSugestoes((curr) =>
                                        curr.filter((x) => x.movimento_id !== s.movimento_id)
                                      ),
                                  }
                                )
                              }
                            >
                              <Link2 className="w-3 h-3 mr-1" />
                              Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Extratos importados ── */}
        {(extratos?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Extratos importados
                <Badge variant="outline" className="text-xs">{extratos!.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {(extratos ?? []).slice(0, 6).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{ex.arquivo_nome}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ex.conta?.nome ?? "—"} · {ex.total_movimentos ?? 0} movimentos
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ex.data_inicio ? formatDate(ex.data_inicio) : "?"} → {ex.data_fim ? formatDate(ex.data_fim) : "?"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge
                        variant={ex.status === "concluido" ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {ex.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => iniciarReprocesso(ex.id, ex.conta_id, ex.arquivo_nome)}
                        disabled={reprocessando === ex.id}
                        title="Reprocessar extrato com parser atualizado"
                      >
                        {reprocessando === ex.id
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : <RotateCcw className="w-3 h-3 mr-1" />}
                        Reprocessar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <input
                ref={reprocFileRef}
                type="file"
                accept=".ofx,.OFX"
                className="hidden"
                onChange={onReprocessarFile}
              />
            </CardContent>
          </Card>
        )}

        {/* ── AlertDialog: confirmar reprocesso ── */}
        <AlertDialog open={!!confirmReproc} onOpenChange={(o) => !o && setConfirmReproc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprocessar extrato?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Esta ação irá <strong>apagar permanentemente</strong> o extrato{" "}
                    <span className="font-mono text-foreground">{confirmReproc?.arquivo_nome}</span> e os{" "}
                    <strong>{confirmReproc?.total_movimentos ?? 0} movimentos</strong> associados, incluindo
                    conciliações pendentes vinculadas.
                  </p>
                  <p>
                    Em seguida, será solicitado o arquivo OFX para reimportar. Conciliações já efetivadas
                    em lançamentos não serão revertidas, mas perderão o vínculo com o movimento.
                  </p>
                  <p className="text-muted-foreground">Tem certeza que deseja continuar?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarReprocesso}>Apagar e reprocessar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Movimentos do extrato ── */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold">Movimentos do extrato</CardTitle>
              {movsSelecionados.size > 0 && (
                <Button
                  size="sm"
                  className="h-8"
                  onClick={efetivarSelecionados}
                  disabled={upsertLancamento.isPending || conciliarManual.isPending}
                >
                  {(upsertLancamento.isPending || conciliarManual.isPending)
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  Efetivar e conciliar ({movsSelecionados.size})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/30">
                    <TableHead className="w-[44px] pl-5">
                      <Checkbox
                        checked={
                          movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado).length > 0 &&
                          movimentosFiltrados
                            .filter((m: any) => !m.conciliado && !m.ignorado)
                            .every((m: any) => movsSelecionados.has(m.id))
                        }
                        onCheckedChange={(v) => {
                          const pendentes = movimentosFiltrados.filter(
                            (m: any) => !m.conciliado && !m.ignorado
                          );
                          setMovsSelecionados(v ? new Set(pendentes.map((m: any) => m.id)) : new Set());
                        }}
                        aria-label="Selecionar todos"
                        disabled={movimentosFiltrados.filter((m: any) => !m.conciliado && !m.ignorado).length === 0}
                      />
                    </TableHead>
                    <TableHead className="w-[90px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden md:table-cell w-[140px]">Conta</TableHead>
                    <TableHead className="text-right w-[130px]">Valor</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right pr-5">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMov && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-14 text-muted-foreground">
                        <Loader2 className="w-4 h-4 inline animate-spin mr-2" />Carregando movimentos…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingMov && movimentosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-14 text-muted-foreground">
                        {contaSelecionada
                          ? "Nenhum movimento. Importe um arquivo OFX ou CSV para começar."
                          : "Selecione uma conta bancária para visualizar os movimentos."}
                      </TableCell>
                    </TableRow>
                  )}
                  {movimentosFiltrados.map((m: any) => {
                    const valorAbs = Math.abs(Number(m.valor));
                    const isCredito = Number(m.valor) >= 0;
                    const naturezaSugerida: "receita" | "despesa" = isCredito ? "receita" : "despesa";
                    const baseInitial = {
                      descricao: m.descricao || "Movimento bancário",
                      valor: valorAbs,
                      data_competencia: m.data_movimento,
                      data_vencimento: m.data_movimento,
                      data_realizado: m.data_movimento,
                      conta_id: m.conta_id,
                      status: "realizado" as const,
                    };
                    return (
                      <TableRow
                        key={m.id}
                        className={`border-l-2 ${isCredito ? "border-l-emerald-400" : "border-l-rose-400"} ${m.ignorado ? "opacity-50" : ""} hover:bg-muted/20`}
                      >
                        <TableCell className="pl-4">
                          {!m.conciliado && !m.ignorado && (
                            <Checkbox
                              checked={movsSelecionados.has(m.id)}
                              onCheckedChange={(v) => {
                                setMovsSelecionados((curr) => {
                                  const next = new Set(curr);
                                  if (v) next.add(m.id);
                                  else next.delete(m.id);
                                  return next;
                                });
                              }}
                              aria-label="Selecionar movimento"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(m.data_movimento)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm truncate max-w-[280px]">{m.descricao}</div>
                          {m.descricao_extra && (
                            <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                              {m.descricao_extra}
                            </div>
                          )}
                          {m.lancamento && (
                            <div className="text-xs text-primary flex items-center gap-1 mt-0.5">
                              <Link2 className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[240px]">{m.lancamento.descricao}</span>
                            </div>
                          )}
                          {m.ignorado && m.ignorado_motivo && (
                            <div className="text-xs text-muted-foreground italic mt-0.5">
                              Ignorado: {m.ignorado_motivo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {m.conta?.nome ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-semibold text-sm whitespace-nowrap tabular-nums ${
                            isCredito
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isCredito ? "+" : ""}{formatBRL(Number(m.valor))}
                        </TableCell>
                        <TableCell>
                          {m.ignorado ? (
                            <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                              ignorado
                            </Badge>
                          ) : m.conciliado ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />conciliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />pendente
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4 whitespace-nowrap">
                          {m.conciliado && m.lancamento_id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() =>
                                desfazer.mutate({ movimento_id: m.id, lancamento_id: m.lancamento_id! })
                              }
                            >
                              <Unlink className="w-3 h-3 mr-1" />Desfazer
                            </Button>
                          ) : m.ignorado ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => ignorarMov.mutate({ id: m.id, ignorar: false })}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />Restaurar
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Tratar
                                  <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  {isCredito ? "+" : ""}{formatBRL(Number(m.valor))} · {formatDate(m.data_movimento)}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setDialogManual({ movimento_id: m.id, valor: valorAbs, natureza: naturezaSugerida })
                                  }
                                >
                                  <Link2 className="w-3.5 h-3.5 mr-2" />
                                  Vincular a lançamento existente
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNovoLanc({
                                      movimento_id: m.id,
                                      initial: { ...baseInitial, tipo: "a_pagar", natureza: "despesa" },
                                      defaultTipo: "a_pagar",
                                    })
                                  }
                                >
                                  <Plus className="w-3.5 h-3.5 mr-2" />Criar conta a pagar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNovoLanc({
                                      movimento_id: m.id,
                                      initial: { ...baseInitial, tipo: "a_receber", natureza: "receita" },
                                      defaultTipo: "a_receber",
                                    })
                                  }
                                >
                                  <Plus className="w-3.5 h-3.5 mr-2" />Criar conta a receber
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNovoLanc({
                                      movimento_id: m.id,
                                      initial: { ...baseInitial, tipo: "movimentacao", natureza: "movimentacao" },
                                      defaultTipo: "movimentacao",
                                    })
                                  }
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5 mr-2" />Transferência / Movimentação
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-muted-foreground"
                                  onClick={() => {
                                    const motivo = window.prompt("Motivo (opcional) para ignorar este movimento:", "");
                                    if (motivo === null) return;
                                    ignorarMov.mutate({ id: m.id, ignorar: true, motivo: motivo || undefined });
                                  }}
                                >
                                  <Ban className="w-3.5 h-3.5 mr-2" />Ignorar / desconsiderar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Dialogs ── */}
        <DialogVincularManual
          info={dialogManual}
          onClose={() => setDialogManual(null)}
          onConfirm={(lancamento_id) => {
            if (!dialogManual) return;
            conciliarManual.mutate(
              { movimento_id: dialogManual.movimento_id, lancamento_id },
              { onSuccess: () => setDialogManual(null) }
            );
          }}
        />

        {novoLanc && (
          <LancamentoDialog
            open={!!novoLanc}
            onOpenChange={(v) => !v && setNovoLanc(null)}
            initial={novoLanc.initial as never}
            defaultTipo={novoLanc.defaultTipo as never}
            onSaved={(lanc) => {
              const movId = novoLanc.movimento_id;
              setNovoLanc(null);
              conciliarManual.mutate(
                { movimento_id: movId, lancamento_id: (lanc as { id: string }).id },
                { onSuccess: () => toast.success("Lançamento criado e movimento conciliado.") }
              );
            }}
          />
        )}
      </TabsContent>

      {/* ════════════════════════════════════════════════════════════════════ */}
      <TabsContent value="relatorio" className="mt-0">
        <FinRelatorioConciliacao />
      </TabsContent>
    </Tabs>
  );
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const cls = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${cls}`} />
      </div>
      <span className={`text-base font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function ScoreBadge({ score, metodo }: { score: number; metodo?: string }) {
  const barColor =
    score >= 90
      ? "bg-emerald-500"
      : score >= 75
      ? "bg-primary"
      : score >= 60
      ? "bg-amber-500"
      : "bg-rose-500";
  const label = score >= 90 ? "Alta" : score >= 75 ? "Boa" : score >= 60 ? "Média" : "Baixa";
  return (
    <div className="w-[64px] space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {metodo === "ia" && (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 h-3.5 border-primary/40 text-primary gap-0.5 mt-0.5"
        >
          <Sparkles className="w-2 h-2" /> IA
        </Badge>
      )}
    </div>
  );
}

function MotivosBadges({ motivos }: { motivos: Record<string, unknown> }) {
  const valor = motivos?.valor_match === true;
  const dias = Number(motivos?.diferenca_dias ?? -1);
  const sim = Number(motivos?.similaridade_descricao ?? 0);
  const mesmaConta = motivos?.mesma_conta === true;
  return (
    <div className="flex flex-wrap gap-1">
      {valor && (
        <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
          Valor exato
        </Badge>
      )}
      {dias >= 0 && (
        <Badge variant="outline" className="text-[10px]">
          {dias === 0 ? "Mesma data" : `±${dias}d`}
        </Badge>
      )}
      {sim > 0 && (
        <Badge variant="outline" className="text-[10px]">
          Texto {Math.round(sim * 100)}%
        </Badge>
      )}
      {mesmaConta && (
        <Badge variant="outline" className="text-[10px]">
          Mesma conta
        </Badge>
      )}
    </div>
  );
}

// ─── Diálogo de vínculo manual ────────────────────────────────────────────────

function DialogVincularManual({
  info,
  onClose,
  onConfirm,
}: {
  info: { movimento_id: string; valor: number; natureza: "receita" | "despesa" } | null;
  onClose: () => void;
  onConfirm: (lancamentoId: string) => void;
}) {
  const { data: lancamentos } = useLancamentos({ status: "todos" });
  if (!info) return null;

  const elegiveis = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      l.status !== "conciliado" &&
      l.status !== "cancelado"
  );

  const sugeridos = elegiveis.filter(
    (l) => info.valor > 0 && Math.abs(Number(l.valor) - info.valor) / info.valor < 0.02
  );
  const outros = elegiveis.filter((l) => !sugeridos.includes(l));

  const renderItem = (l: (typeof elegiveis)[number], destaque = false) => (
    <button
      key={l.id}
      onClick={() => onConfirm(l.id)}
      className="w-full text-left border rounded-md p-2.5 hover:bg-accent transition-colors mb-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm ${destaque ? "font-semibold" : ""} truncate`}>{l.descricao}</span>
        <span className="text-sm font-mono whitespace-nowrap tabular-nums">{formatBRL(Number(l.valor))}</span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
        <span>{statusLabel[l.status] ?? l.status}</span>
        <span>·</span>
        <span>
          {l.data_vencimento
            ? `Venc.: ${formatDate(l.data_vencimento)}`
            : `Comp.: ${formatDate(l.data_competencia)}`}
        </span>
      </div>
    </button>
  );

  return (
    <Dialog open={!!info} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular a um lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {sugeridos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Sugestões (valor próximo)
              </div>
              {sugeridos.map((l) => renderItem(l, true))}
            </div>
          )}
          {outros.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Outros lançamentos {info.natureza === "receita" ? "a receber" : "a pagar"} ({outros.length})
              </div>
              {outros.slice(0, 50).map((l) => renderItem(l))}
            </div>
          )}
          {sugeridos.length === 0 && outros.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
              <p>Nenhum lançamento disponível para vincular.</p>
              <p className="text-xs">
                Crie primeiro um lançamento em <strong>Lançamentos → Novo lançamento</strong>{" "}
                ({info.natureza === "receita" ? "a receber" : "a pagar"}) com valor de{" "}
                <strong>{formatBRL(info.valor)}</strong> e tente vincular novamente.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
