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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate } from "@/lib/financeiro/formatters";
import { parseCsvExtrato, csvParaOfx } from "@/lib/financeiro/csvToOfx";
import { toast } from "sonner";
import FinRelatorioConciliacao from "./FinRelatorioConciliacao";

type MatchSugestao = {
  movimento_id: string;
  lancamento_id: string;
  score: number;
  motivos: Record<string, unknown>;
};

export default function FinConciliacao() {
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [filtroConciliado, setFiltroConciliado] = useState<"todos" | "pendente" | "conciliado">(
    "pendente"
  );
  const [scoreMinimo, setScoreMinimo] = useState<number>(75);
  const [sugestoes, setSugestoes] = useState<MatchSugestao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [dialogManual, setDialogManual] = useState<{
    movimento_id: string;
    valor: number;
    natureza: "receita" | "despesa";
  } | null>(null);

  const { data: contas } = useContas();
  const { data: extratos } = useExtratosImportados();
  const { data: movimentos, isLoading: loadingMov } = useMovimentosExtrato({
    conta_id: contaSelecionada || undefined,
    conciliado: filtroConciliado === "todos" ? undefined : filtroConciliado === "conciliado",
  });
  const { data: lancamentosTodos } = useLancamentos({});

  const importar = useImportarOFX();
  const conciliarAuto = useConciliarAutomatico();
  const conciliarManual = useConciliarManual();
  const desfazer = useDesfazerConciliacao();

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

  function buscarSugestoes() {
    conciliarAuto.mutate(
      {
        conta_id: contaSelecionada || undefined,
        auto_aplicar: false,
        score_minimo: scoreMinimo,
      },
      {
        onSuccess: (data) => {
          setSugestoes(data.matches ?? []);
          setSelecionadas(new Set((data.matches ?? []).map((m) => m.movimento_id)));
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
    <div className="space-y-4">
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
              onClick={buscarSugestoes}
              disabled={conciliarAuto.isPending}
            >
              {conciliarAuto.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-1.5" />
              )}
              Buscar sugestões
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
                          <ScoreBadge score={s.score} />
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
                          <MotivosBadges motivos={s.motivos} />
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
                  className="border rounded-md p-3 text-sm flex items-start justify-between"
                >
                  <div>
                    <div className="font-medium flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-primary" />
                      {ex.arquivo_nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.conta?.nome ?? "—"} • {ex.total_movimentos ?? 0} mov.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ex.data_inicio ? formatDate(ex.data_inicio) : "?"} a{" "}
                      {ex.data_fim ? formatDate(ex.data_fim) : "?"}
                    </div>
                  </div>
                  <Badge variant={ex.status === "concluido" ? "default" : "secondary"}>
                    {ex.status}
                  </Badge>
                </div>
              ))}
            </div>
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
                {!loadingMov && (movimentos?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum movimento. Importe um arquivo OFX para começar.
                    </TableCell>
                  </TableRow>
                )}
                {(movimentos ?? []).map((m) => (
                  <TableRow key={m.id}>
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
                    </TableCell>
                    <TableCell className="text-xs">{m.conta?.nome ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        Number(m.valor) >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatBRL(Number(m.valor))}
                    </TableCell>
                    <TableCell>
                      {m.conciliado ? (
                        <Badge variant="default">conciliado</Badge>
                      ) : (
                        <Badge variant="secondary">pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                        >
                          <Unlink className="w-3.5 h-3.5 mr-1" />
                          Desfazer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialogManual({
                              movimento_id: m.id,
                              valor: Math.abs(Number(m.valor)),
                              natureza: Number(m.valor) >= 0 ? "receita" : "despesa",
                            })
                          }
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Vincular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
    </div>
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
  const { data: lancamentos } = useLancamentos({ status: "previsto" });
  if (!info) return null;

  // Sugestão: lançamentos com valor próximo (±10%) e mesma natureza
  const sugeridos = (lancamentos ?? []).filter(
    (l) =>
      l.natureza === info.natureza &&
      Math.abs(Number(l.valor) - info.valor) / info.valor < 0.1
  );
  const outros = (lancamentos ?? []).filter(
    (l) => l.natureza === info.natureza && !sugeridos.includes(l)
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
              {sugeridos.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onConfirm(l.id)}
                  className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors mb-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{l.descricao}</span>
                    <span className="text-sm font-mono">{formatBRL(Number(l.valor))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venc.: {l.data_vencimento ? formatDate(l.data_vencimento) : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
          {outros.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                Outros lançamentos {info.natureza === "receita" ? "a receber" : "a pagar"}
              </div>
              {outros.slice(0, 30).map((l) => (
                <button
                  key={l.id}
                  onClick={() => onConfirm(l.id)}
                  className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors mb-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{l.descricao}</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatBRL(Number(l.valor))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {sugeridos.length === 0 && outros.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhum lançamento previsto encontrado para vincular.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
