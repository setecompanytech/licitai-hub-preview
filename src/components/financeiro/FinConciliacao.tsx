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
  BarChart3,
  Plus,
  ArrowLeftRight,
  Ban,
  ChevronDown,
  RotateCcw,
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
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const reprocFileRef = useRef<HTMLInputElement>(null);
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const reprocAlvo = useRef<{ extrato_id: string; conta_id: string; arquivo_nome: string } | null>(null);
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

  // Diálogo de criação on-the-fly de lançamento direto da conciliação (estilo Omie)
  const [novoLanc, setNovoLanc] = useState<{
    movimento_id: string;
    initial: Record<string, unknown>;
    defaultTipo: "a_pagar" | "a_receber" | "movimentacao";
  } | null>(null);

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

  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const desfazer = useDesfazerConciliacao();

  // Marca/desmarca movimento como ignorado (tarifas, estornos, lançamentos pessoais)
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

  // Filtragem client-side por status "ignorado" (mantém compatibilidade com o hook atual)
  const movimentosFiltrados = useMemo(() => {
    const lista = movimentos ?? [];
    if (filtroConciliado === "ignorado") return lista.filter((m: any) => m.ignorado === true);
    if (filtroConciliado === "pendente") return lista.filter((m: any) => !m.ignorado);
    return lista;
  }, [movimentos, filtroConciliado]);

  // Indexa movimentos e lançamentos para exibir detalhes nas sugestões
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
    reprocAlvo.current = { extrato_id, conta_id, arquivo_nome };
    reprocFileRef.current?.click();
  }

  async function onReprocessarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const alvo = reprocAlvo.current;
    e.target.value = "";
    if (!file || !alvo) return;
    setReprocessando(alvo.extrato_id);
    try {
      // Apaga movimentos e extrato antigo (cascade já remove conciliações pendentes)
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
          if (usar_ia && iaSug) {
            toast.success(`IA sugeriu ${iaSug} novos matches.`);
          }
        },
      }
    );
  }

  function aplicarSelecionadas() {
    const aAplicar = sugestoes.filter((s) => selecionadas.has(s.movimento_id));
    if (aAplicar.length === 0) {
      toast.info("Nenhuma sugestão selecionada.");
      return;
    }
    let aplicados = 0;
    let erros = 0;
    Promise.all(
      aAplicar.map(
        (s) =>
          new Promise<void>((resolve) => {
            conciliarManual.mutate(
              { movimento_id: s.movimento_id, lancamento_id: s.lancamento_id },
              {
                onSuccess: () => {
                  aplicados++;
                  resolve();
                },
                onError: () => {
                  erros++;
                  resolve();
                },
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
    if (auto.length === 0) {
      toast.info("Nenhuma sugestão com score ≥ 90 disponível.");
      return;
    }
    setSelecionadas(new Set(auto.map((s) => s.movimento_id)));
    setTimeout(() => aplicarSelecionadas(), 50);
  }

  function toggleTodas(check: boolean) {
    if (check) setSelecionadas(new Set(sugestoes.map((s) => s.movimento_id)));
    else setSelecionadas(new Set());
  }

  return (
    <Tabs defaultValue="conciliar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="conciliar">
          <Link2 className="w-3.5 h-3.5 mr-1.5" />Conciliação
        </TabsTrigger>
        <TabsTrigger value="relatorio">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Relatório por período
        </TabsTrigger>
      </TabsList>

      <TabsContent value="conciliar" className="space-y-4 mt-0">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Conta bancária</label>
            <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {(contas ?? [])
                  .filter((c) => c.tipo === "corrente" || c.tipo === "poupanca" || c.tipo === "caixa")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={filtroConciliado}
              onValueChange={(v) => setFiltroConciliado(v as typeof filtroConciliado)}
            >
              <SelectTrigger>
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

          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.OFX"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importar.isPending || !contaSelecionada}
          >
            {importar.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Importar OFX
          </Button>

          <input
            ref={csvRef}
            type="file"
            accept=".csv,.CSV,text/csv"
            className="hidden"
            onChange={onCsvFile}
          />
          <Button
            variant="outline"
            onClick={() => csvRef.current?.click()}
            disabled={importar.isPending || !contaSelecionada}
            title="CSV com colunas: data, descricao, valor (opcional documento)"
          >
            {importar.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Importar CSV
          </Button>

          <Button
            onClick={() =>
              conciliarAuto.mutate({
                conta_id: contaSelecionada || undefined,
                auto_aplicar: true,
                score_minimo: 90,
              })
            }
            disabled={conciliarAuto.isPending}
          >
            {conciliarAuto.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1.5" />
            )}
            Auto-conciliar (score ≥ 90)
          </Button>
        </CardContent>
      </Card>

      {/* Painel de Sugestões com Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Sugestões assistidas (Score 0–100)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Score mínimo para análise</span>
                <span className="font-mono font-semibold text-foreground">{scoreMinimo}</span>
              </label>
              <Slider
                value={[scoreMinimo]}
                onValueChange={([v]) => setScoreMinimo(v)}
                min={50}
                max={100}
                step={5}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Permissivo (50)</span>
                <span>Recomendado (75)</span>
                <span>Estrito (100)</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => buscarSugestoes(false)}
              disabled={conciliarAuto.isPending}
            >
              {conciliarAuto.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-1.5" />
              )}
              Buscar sugestões
            </Button>
            <Button
              variant="outline"
              onClick={() => buscarSugestoes(true)}
              disabled={conciliarAuto.isPending}
              title="Usa IA para encontrar matches em casos ambíguos (descrições diferentes, valores próximos)"
            >
              {conciliarAuto.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1.5 text-primary" />
              )}
              Sugerir com IA
            </Button>
            {sugestoes.length > 0 && (
              <>
                <Button onClick={aplicarSelecionadas} disabled={selecionadas.size === 0}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Aplicar selecionadas ({selecionadas.size})
                </Button>
                <Button variant="secondary" onClick={aplicarTodasAlta}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Aprovar todas com score ≥ 90
                </Button>
              </>
            )}
          </div>

          {sugestoes.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
              Clique em <strong>Buscar sugestões</strong> para listar correspondências entre
              movimentos do extrato e lançamentos previstos, sem aplicar alterações.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          selecionadas.size === sugestoes.length && sugestoes.length > 0
                        }
                        onCheckedChange={(v) => toggleTodas(!!v)}
                        aria-label="Selecionar todas"
                      />
                    </TableHead>
                    <TableHead className="w-[110px]">Score</TableHead>
                    <TableHead>Movimento (extrato)</TableHead>
                    <TableHead>Lançamento previsto</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead className="text-right w-[120px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sugestoes.map((s) => {
                    const mov = movMap.get(s.movimento_id);
                    const lanc = lancMap.get(s.lancamento_id);
                    const checked = selecionadas.has(s.movimento_id);
                    return (
                      <TableRow key={s.movimento_id + s.lancamento_id}>
                        <TableCell>
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
                          <div className="flex flex-col gap-1">
                            <ScoreBadge score={s.score} />
                            {s.metodo === "ia" && (
                              <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                                <Sparkles className="w-2.5 h-2.5" />
                                IA
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {mov ? (
                            <div>
                              <div className="text-sm font-medium truncate max-w-[260px]">
                                {mov.descricao}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(mov.data_movimento)} •{" "}
                                <span
                                  className={
                                    Number(mov.valor) >= 0 ? "text-success" : "text-destructive"
                                  }
                                >
                                  {formatBRL(Number(mov.valor))}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lanc ? (
                            <div>
                              <div className="text-sm font-medium truncate max-w-[260px]">
                                {lanc.descricao}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Venc.:{" "}
                                {lanc.data_vencimento ? formatDate(lanc.data_vencimento) : "—"}{" "}
                                • {formatBRL(Number(lanc.valor))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Lançamento fora da página atual
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <MotivosBadges motivos={s.motivos} />
                            {s.justificativa_ia && (
                              <p className="text-[11px] italic text-muted-foreground max-w-[280px] leading-snug">
                                "{s.justificativa_ia}"
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              conciliarManual.mutate(
                                {
                                  movimento_id: s.movimento_id,
                                  lancamento_id: s.lancamento_id,
                                },
                                {
                                  onSuccess: () =>
                                    setSugestoes((curr) =>
                                      curr.filter((x) => x.movimento_id !== s.movimento_id)
                                    ),
                                }
                              )
                            }
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1" />
                            Aplicar
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

      {/* Histórico de extratos */}
      {(extratos?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Extratos importados (últimos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(extratos ?? []).slice(0, 6).map((ex) => (
                <div
                  key={ex.id}
                  className="border rounded-md p-3 text-sm flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{ex.arquivo_nome}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.conta?.nome ?? "—"} • {ex.total_movimentos ?? 0} mov.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.data_inicio ? formatDate(ex.data_inicio) : "?"} a{" "}
                      {ex.data_fim ? formatDate(ex.data_fim) : "?"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant={ex.status === "concluido" ? "default" : "secondary"}>
                      {ex.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => iniciarReprocesso(ex.id, ex.conta_id, ex.arquivo_nome)}
                      disabled={reprocessando === ex.id}
                      title="Selecione novamente o arquivo OFX para reprocessar com o parser atualizado"
                    >
                      {reprocessando === ex.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      )}
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

      {/* Movimentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimentos do extrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMov && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!loadingMov && movimentosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum movimento. Importe um arquivo OFX para começar.
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
                    <TableRow key={m.id} className={m.ignorado ? "opacity-60" : ""}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(m.data_movimento)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{m.descricao}</div>
                        {m.descricao_extra && (
                          <div className="text-xs text-muted-foreground">{m.descricao_extra}</div>
                        )}
                        {m.lancamento && (
                          <div className="text-xs text-primary mt-0.5">
                            → {m.lancamento.descricao}
                          </div>
                        )}
                        {m.ignorado && m.ignorado_motivo && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">
                            Ignorado: {m.ignorado_motivo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{m.conta?.nome ?? "—"}</TableCell>
                      <TableCell
                        className={`text-right font-mono whitespace-nowrap tabular-nums ${
                          isCredito ? "text-success" : "text-destructive"
                        }`}
                      >
                        {formatBRL(Number(m.valor))}
                      </TableCell>
                      <TableCell>
                        {m.ignorado ? (
                          <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                            ignorado
                          </Badge>
                        ) : m.conciliado ? (
                          <Badge variant="default">conciliado</Badge>
                        ) : (
                          <Badge variant="secondary">pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {m.conciliado && m.lancamento_id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              desfazer.mutate({
                                movimento_id: m.id,
                                lancamento_id: m.lancamento_id!,
                              })
                            }
                            className="shrink-0"
                          >
                            <Unlink className="w-3.5 h-3.5 mr-1" />
                            Desfazer
                          </Button>
                        ) : m.ignorado ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => ignorarMov.mutate({ id: m.id, ignorar: false })}
                            className="shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restaurar
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="shrink-0">
                                <Link2 className="w-3.5 h-3.5 mr-1" />
                                Tratar
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel className="text-xs">
                                Tratar movimento ({formatBRL(Number(m.valor))})
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setDialogManual({
                                    movimento_id: m.id,
                                    valor: valorAbs,
                                    natureza: naturezaSugerida,
                                  })
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
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Criar conta a pagar
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
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Criar conta a receber
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
                                <ArrowLeftRight className="w-3.5 h-3.5 mr-2" />
                                Transferência / Movimentação
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-muted-foreground"
                                onClick={() => {
                                  const motivo = window.prompt(
                                    "Motivo (opcional) para ignorar este movimento:",
                                    ""
                                  );
                                  if (motivo === null) return;
                                  ignorarMov.mutate({ id: m.id, ignorar: true, motivo: motivo || undefined });
                                }}
                              >
                                <Ban className="w-3.5 h-3.5 mr-2" />
                                Ignorar / desconsiderar
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

      {/* Criação de lançamento on-the-fly direto da conciliação (estilo Omie).
          Após salvar, vincula automaticamente o movimento ao lançamento criado. */}
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
              {
                onSuccess: () => toast.success("Lançamento criado e movimento conciliado."),
              }
            );
          }}
        />
      )}
      </TabsContent>

      <TabsContent value="relatorio" className="mt-0">
        <FinRelatorioConciliacao />
      </TabsContent>
    </Tabs>
  );
}

// ----------------------------------------------------------------------------
// Auxiliares visuais
// ----------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  const cor =
    score >= 90
      ? "bg-success text-success-foreground"
      : score >= 75
      ? "bg-primary text-primary-foreground"
      : score >= 60
      ? "bg-warning text-warning-foreground"
      : "bg-destructive text-destructive-foreground";
  const rotulo =
    score >= 90 ? "Alta" : score >= 75 ? "Boa" : score >= 60 ? "Média" : "Baixa";
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-2 py-0.5 ${cor}`}
      >
        {score}/100
      </span>
      <span className="text-[10px] text-muted-foreground text-center">{rotulo}</span>
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
        <Badge variant="outline" className="text-[10px] border-success text-success">
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

// ----------------------------------------------------------------------------
// Diálogo de vínculo manual
// ----------------------------------------------------------------------------

function DialogVincularManual({
  info,
  onClose,
  onConfirm,
}: {
  info: { movimento_id: string; valor: number; natureza: "receita" | "despesa" } | null;
  onClose: () => void;
  onConfirm: (lancamentoId: string) => void;
}) {
  // Busca todos os lançamentos não cancelados/conciliados para permitir vínculo
  // tanto com previstos (a pagar/a receber) quanto realizados (já lançados manualmente)
  const { data: lancamentos } = useLancamentos({ status: "todos" });
  if (!info) return null;

  const elegiveis = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      l.status !== "conciliado" &&
      l.status !== "cancelado",
  );

  // Sugestão: valor próximo (±2%) e mesma natureza — alta probabilidade de match
  const sugeridos = elegiveis.filter(
    (l) =>
      info.valor > 0 &&
      Math.abs(Number(l.valor) - info.valor) / info.valor < 0.02,
  );
  const outros = elegiveis.filter((l) => !sugeridos.includes(l));

  const renderItem = (l: (typeof elegiveis)[number], destaque = false) => (
    <button
      key={l.id}
      onClick={() => onConfirm(l.id)}
      className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors mb-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm ${destaque ? "font-medium" : ""} truncate`}>
          {l.descricao}
        </span>
        <span className="text-sm font-mono whitespace-nowrap">
          {formatBRL(Number(l.valor))}
        </span>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span>{statusLabel[l.status] ?? l.status}</span>
        <span>•</span>
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
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {sugeridos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Sugestões (valor próximo)
              </div>
              {sugeridos.map((l) => renderItem(l, true))}
            </div>
          )}
          {outros.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Outros lançamentos {info.natureza === "receita" ? "a receber" : "a pagar"} ({outros.length})
              </div>
              {outros.slice(0, 50).map((l) => renderItem(l))}
            </div>
          )}
          {sugeridos.length === 0 && outros.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 space-y-2">
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
