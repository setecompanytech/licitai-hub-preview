import { useState, useEffect, useMemo } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useNavigate } from "react-router-dom";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { rotuloDoRegime, excedeTetoDoSimples, regimeDaEmpresa, TETO_SIMPLES_NACIONAL } from "@/lib/tributario/regime";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Skeleton } from "@/components/ui/skeleton";
import ValorDeCartao from "./ValorDeCartao";
import { useApuracaoTributaria } from "@/hooks/useApuracaoTributaria";
import { useValidacaoApuracao, type DivergenciaApuracao } from "@/hooks/useValidacaoApuracao";
import { DialogDivergenciasApuracao } from "./DialogDivergenciasApuracao";
import FinImportarNotas from "./FinImportarNotas";
import { Calculator, Settings, FileBarChart, Save, Download, RefreshCw, CheckCircle2, ShieldCheck, FileUp, AlertTriangle, Wallet, Percent } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const pct = (n: number) => `${(n || 0).toFixed(4)}%`;

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function FinApuracao() {
  const { config, apuracoes, loading, salvarConfig, buscarReceita, calcular, salvarApuracao, marcarComoPago, carregar, recalcular, montarTrimestre } = useApuracaoTributaria();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [receitaComercio, setReceitaComercio] = useState(0);
  const [receitaServico, setReceitaServico] = useState(0);
  const [rbt12, setRbt12] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [creditos, setCreditos] = useState(0);
  /**
   * O "Limite mensal" mora num grid rotulado "Alíquotas (%)", mas é dinheiro:
   * os R$ 20.000,00/mês acima dos quais incide o adicional de IRPJ. Digitado
   * como número solto no meio de oito percentuais, passava por percentual aos
   * olhos de quem edita — a máscara de R$ é o que desfaz a confusão.
   */
  const [limiteAdicional, setLimiteAdicional] = useState(0);
  const [carregandoReceita, setCarregandoReceita] = useState(false);
  const [receitaSemClassificacao, setReceitaSemClassificacao] = useState(0);
  const { validar } = useValidacaoApuracao();
  const navigate = useNavigate();
  const { empresaAtiva } = useEmpresa();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [divergencias, setDivergencias] = useState<DivergenciaApuracao[] | null>(null);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    if (config) setLimiteAdicional(Number(config.limite_adicional_irpj) || 0);
  }, [config]);

  /** Contexto trimestral do adicional de IRPJ (posição no trimestre + base
   *  acumulada dos meses irmãos) — recarregado quando a competência muda. */
  const [trimestre, setTrimestre] = useState<
    { posicao: number; baseIrpjMesesAnteriores: number } | undefined
  >(undefined);
  useEffect(() => {
    let vivo = true;
    setTrimestre(undefined);
    montarTrimestre(competencia).then((t) => { if (vivo) setTrimestre(t); });
    return () => { vivo = false; };
  }, [competencia, montarTrimestre]);

  const resultado = useMemo(() => {
    if (!config) return {};
    return calcular(receitaComercio, receitaServico, rbt12, despesas, creditos, trimestre);
  }, [config, receitaComercio, receitaServico, rbt12, despesas, creditos, calcular, trimestre]);

  const totalDevido = useMemo(() => {
    if (resultado.simples) return resultado.simples.valorDevido;
    if (resultado.presumido) return resultado.presumido.total;
    if (resultado.real) return resultado.real.total;
    return 0;
  }, [resultado]);

  const cargaTributaria = useMemo(() => {
    const receita = receitaComercio + receitaServico;
    return receita > 0 ? (totalDevido / receita) * 100 : 0;
  }, [totalDevido, receitaComercio, receitaServico]);

  async function importarReceita() {
    setCarregandoReceita(true);
    const data = await buscarReceita(competencia);
    setReceitaSemClassificacao(Number((data as any)?.sem_classificacao) || 0);
    if (data) {
      setReceitaComercio(Number(data.comercio) || 0);
      setReceitaServico(Number(data.servico) || 0);
      setRbt12(Number(data.rbt12) || 0);
    }
    setCarregandoReceita(false);
  }

  function exportarCSV() {
    const linhas = [
      ["Competência", "Regime", "Receita Comércio", "Receita Serviço", "Receita Total", "Total Devido", "Status", "Pago em"].join(";"),
      ...apuracoes.map(a => [
        a.competencia, a.regime,
        a.receita_bruta_comercio.toFixed(2),
        a.receita_bruta_servico.toFixed(2),
        a.receita_bruta_total.toFixed(2),
        a.valor_total.toFixed(2),
        a.status, a.pago_em ?? "",
      ].join(";")),
    ].join("\n");
    const blob = new Blob([linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `apuracoes_${hojeLocal()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setDialogOpen(false);
  }

  async function validarEAbrir() {
    if (apuracoes.length === 0) {
      toast.info("Não há apurações para exportar.");
      return;
    }
    setDialogOpen(true);
    setValidando(true);
    setDivergencias(null);
    try {
      const divs = await validar(apuracoes);
      setDivergencias(divs);
    } catch (e: any) {
      toast.error("Erro ao validar: " + e.message);
      setDialogOpen(false);
    } finally {
      setValidando(false);
    }
  }

  if (loading || !config) {
    // Espera na forma do conteúdo — abas, formulário e os três cartões —, não
    // um texto no centro (Design System v3).
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Carregando...</span>
        <Skeleton className="h-10 w-full max-w-md" />
        <Card className="space-y-4 p-5">
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Cadastro sem regime não vira apuração.
   *
   * `regimeDaEmpresa()` devolve null quando ninguém escolheu, e aqui esse null
   * precisa PARAR a tela. Se ele apenas caísse no valor da tabela, voltaríamos
   * ao defeito por outra porta: a coluna `regime` tem DEFAULT 'simples', então
   * uma empresa que nunca foi classificada seria apurada como Simples Nacional
   * — de novo por um padrão de banco, de novo sem ninguém ter decidido nada.
   *
   * Imposto calculado pelo regime errado é pior do que imposto não calculado:
   * o primeiro parece pronto.
   */
  if (!regimeDaEmpresa(empresaAtiva?.regime_tributario)) {
    return (
      <Card>
        <CardContent className="p-6">
          <EstadoVazio
            icone={<AlertTriangle />}
            titulo="Regime tributário não definido"
            descricao={
              <>
                {empresaAtiva?.razao_social ? <><strong>{empresaAtiva.razao_social}</strong> ainda não tem</> : 'Esta empresa ainda não tem'}{' '}
                regime no cadastro. Sem ele não há por qual tabela apurar — e adotar um padrão
                aqui seria decidir no lugar de quem pode decidir.
              </>
            }
            acao={
              <Button onClick={() => navigate('/configuracoes?aba=tributario')}>
                Definir em Configurações
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Tabs defaultValue="apurar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="apurar"><Calculator className="h-4 w-4" aria-hidden="true" />Apuração</TabsTrigger>
        <TabsTrigger value="importar"><FileUp className="h-4 w-4" aria-hidden="true" />Importar notas</TabsTrigger>
        <TabsTrigger value="historico"><FileBarChart className="h-4 w-4" aria-hidden="true" />Histórico</TabsTrigger>
        <TabsTrigger value="config"><Settings className="h-4 w-4" aria-hidden="true" />Configuração</TabsTrigger>
      </TabsList>

      {/* IMPORTAR NOTAS */}
      <TabsContent value="importar" className="space-y-4">
        <FinImportarNotas onImportacaoConcluida={carregar} />
      </TabsContent>

      {/* APURAÇÃO */}
      <TabsContent value="apurar" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Apuração mensal — {config.regime === "simples" ? "Simples Nacional" : config.regime === "presumido" ? "Lucro Presumido" : "Lucro Real"}</span>
              <Badge variant="muted">{config.regime === "simples" ? `Anexo ${config.anexo_simples ?? "—"}` : "Regime apurado"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Competência</Label>
                <Input type="month" value={competencia.slice(0, 7)} onChange={e => setCompetencia(`${e.target.value}-01`)} />
              </div>
              <div className="flex items-end md:col-span-3">
                <Button variant="outline" onClick={importarReceita} disabled={carregandoReceita}>
                  <RefreshCw className={carregandoReceita ? "animate-spin" : undefined} aria-hidden="true" />
                  Importar receita realizada do mês
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Receita — Comércio/Indústria</Label>
                <MoneyInput value={receitaComercio} onValueChange={setReceitaComercio} />
              </div>
              <div className="space-y-1.5">
                <Label>Receita — Serviços</Label>
                <MoneyInput value={receitaServico} onValueChange={setReceitaServico} />
              </div>
              {config.regime === "simples" && (
                <div className="space-y-1.5">
                  <Label>RBT12 — Receita 12 meses</Label>
                  <MoneyInput value={rbt12} onValueChange={setRbt12} />
                </div>
              )}
              {config.regime === "simples" && excedeTetoDoSimples(rbt12) && (
                <Alert variant="destructive" className="md:col-span-3">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>RBT12 acima do teto do Simples Nacional</AlertTitle>
                  <AlertDescription>
                    O Anexo I termina em {fmt(TETO_SIMPLES_NACIONAL)} de RBT12 (LC 123/2006, art. 3º, II).
                    Com {fmt(rbt12)} não há faixa aplicável — o cálculo abaixo estende a sexta faixa e
                    produz um imposto que não é devido dessa forma. Confira o regime no cadastro da
                    empresa antes de usar este número.
                  </AlertDescription>
                </Alert>
              )}
              {config.regime === "real" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Despesas operacionais dedutíveis</Label>
                    <MoneyInput value={despesas} onValueChange={setDespesas} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Créditos PIS/COFINS — insumos</Label>
                    <MoneyInput value={creditos} onValueChange={setCreditos} />
                  </div>
                </>
              )}
            </div>

            <Separator />

            {receitaSemClassificacao > 0.005 && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  <strong>{fmt(receitaSemClassificacao)}</strong> de receita da competência estão em
                  categorias <strong>sem tipo (comércio/serviço)</strong> e ficaram FORA da base de
                  cálculo. Classifique as categorias antes de salvar — apurar assim tributa de menos.
                </AlertDescription>
              </Alert>
            )}

            {/* Resultado — os mesmos três números, no cartão KPI do Design
                System v3 (112px): rótulo em cima, ícone num ladrilho tingido à
                direita, valor 28/36 embaixo. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Receita do mês</p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <ValorDeCartao valor={fmt(receitaComercio + receitaServico)} className="text-foreground" />
              </Card>
              <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Total de tributos</p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive-tint text-destructive-ink">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <ValorDeCartao valor={fmt(totalDevido)} className="text-destructive-ink" />
              </Card>
              <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Carga tributária efetiva</p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info-tint text-info-ink">
                    <Percent className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-1 whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">{cargaTributaria.toFixed(2)}%</p>
              </Card>
            </div>

            {/* Memória de cálculo */}
            {resultado.simples && (
              <Card className="overflow-hidden">
                <CardHeader><CardTitle>Memória — Simples Nacional</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      <TableRow><TableCell>RBT12 base</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.simples.rbt12)}</TableCell></TableRow>
                      <TableRow><TableCell>Anexo / Faixa</TableCell><TableCell className="text-right tabular-nums">Anexo {resultado.simples.anexo} — Faixa {resultado.simples.faixa}</TableCell></TableRow>
                      <TableRow><TableCell>Alíquota nominal</TableCell><TableCell className="text-right tabular-nums">{resultado.simples.aliquotaNominal.toFixed(2)}%</TableCell></TableRow>
                      <TableRow><TableCell>Parcela a deduzir</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.simples.parcelaDeduzir)}</TableCell></TableRow>
                      <TableRow><TableCell>Alíquota efetiva</TableCell><TableCell className="text-right font-semibold tabular-nums">{pct(resultado.simples.aliquotaEfetiva)}</TableCell></TableRow>
                      <TableRow className="bg-secondary font-semibold"><TableCell>DAS devido</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.simples.valorDevido)}</TableCell></TableRow>
                      {resultado.simples.excedeuLimite && <TableRow><TableCell colSpan={2}><Badge variant="danger">Excedeu o limite anual de R$ 4,8 milhões</Badge></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {(resultado.presumido || resultado.real) && (
              <Card className="overflow-hidden">
                <CardHeader><CardTitle>Memória — {resultado.presumido ? "Lucro Presumido" : "Lucro Real"}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {resultado.real && <TableRow><TableCell>Lucro antes IR/CSLL</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.real.lucroAntesIRCSLL)}</TableCell></TableRow>}
                      {resultado.presumido && <>
                        <TableRow><TableCell>Base IRPJ (presunção)</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.presumido.baseIrpj)}</TableCell></TableRow>
                        <TableRow><TableCell>Base CSLL (presunção)</TableCell><TableCell className="text-right tabular-nums">{fmt(resultado.presumido.baseCsll)}</TableCell></TableRow>
                      </>}
                      <TableRow><TableCell>IRPJ</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.irpj)}</TableCell></TableRow>
                      <TableRow><TableCell>Adicional IRPJ{resultado.presumido && trimestre ? ` — trimestral, mês ${trimestre.posicao}/3` : ""}</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.adicionalIrpj)}</TableCell></TableRow>
                      <TableRow><TableCell>CSLL</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.csll)}</TableCell></TableRow>
                      <TableRow><TableCell>PIS {resultado.real ? "(não-cumulativo)" : "(cumulativo)"}</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.pis)}</TableCell></TableRow>
                      <TableRow><TableCell>COFINS {resultado.real ? "(não-cumulativo)" : "(cumulativo)"}</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.cofins)}</TableCell></TableRow>
                      <TableRow><TableCell>ISS</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.iss)}</TableCell></TableRow>
                      <TableRow><TableCell>ICMS</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.icms)}</TableCell></TableRow>
                      <TableRow className="bg-secondary font-semibold"><TableCell>Total devido</TableCell><TableCell className="text-right tabular-nums">{fmt((resultado.presumido ?? resultado.real)!.total)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => salvarApuracao(competencia, receitaComercio, receitaServico, rbt12, resultado, { despesasOperacionais: despesas, creditosPisCofins: creditos })}>
                <Save aria-hidden="true" />Salvar apuração
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* HISTÓRICO */}
      <TabsContent value="historico" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle>Histórico de apurações</CardTitle>
            <Button size="sm" variant="outline" onClick={validarEAbrir}><ShieldCheck aria-hidden="true" />Validar e exportar CSV</Button>
          </CardHeader>
          <CardContent className="p-0">
            {apuracoes.length === 0 ? (
              <EstadoVazio icone={<FileBarChart />} titulo="Nenhuma apuração registrada ainda." tamanho="compacto" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Regime</TableHead>
                    <TableHead className="text-right">Receita Bruta</TableHead>
                    <TableHead className="text-right">Total Tributos</TableHead>
                    <TableHead className="text-right">Carga %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apuracoes.map(a => {
                    const carga = a.receita_bruta_total > 0 ? (a.valor_total / a.receita_bruta_total) * 100 : 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="tabular-nums">{a.competencia.slice(0, 7)}</TableCell>
                        <TableCell><Badge variant="muted">{a.regime}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(a.receita_bruta_total)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmt(a.valor_total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{carga.toFixed(2)}%</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={a.status === "pago" ? "success" : a.status === "apurado" ? "info" : "muted"}>
                              {a.status}
                            </Badge>
                            {a.apuracao_desatualizada && (
                              <Badge variant="danger" title={a.desatualizada_motivo ?? "Apuração desatualizada"}>
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />desatualizada
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {a.apuracao_desatualizada && a.status !== "pago" && (
                              <Button size="sm" variant="outline" onClick={() => recalcular(a)}>
                                <RefreshCw aria-hidden="true" />Recalcular
                              </Button>
                            )}
                            {a.status !== "pago" && (
                              <Button size="sm" variant="ghost" onClick={() => marcarComoPago(a.id)}>
                                <CheckCircle2 aria-hidden="true" />Marcar pago
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* CONFIGURAÇÃO */}
      <TabsContent value="config" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Configuração tributária</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* O regime não se escolhe aqui. Escolhia-se, e era esse o defeito:
                  duas telas gravando a mesma decisão em colunas diferentes, com
                  palavras diferentes, sem se falarem. Quem trocava em
                  Configurações via esta aqui ignorar a troca. */}
              <div className="space-y-1.5">
                <Label>Regime tributário</Label>
                <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-secondary px-3">
                  <span className="text-sm font-medium">{rotuloDoRegime(empresaAtiva?.regime_tributario)}</span>
                  <Button variant="link" size="sm" className="h-auto px-0"
                    onClick={() => navigate('/configuracoes?aba=tributario')}>
                    Alterar em Configurações
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vem do cadastro da empresa e vale para Precificação, Contratos e Proposta.
                </p>
              </div>
              {config.regime === "simples" && (
                <div className="space-y-1.5">
                  <Label>Anexo do Simples</Label>
                  <Select value={String(config.anexo_simples ?? 1)} onValueChange={v => salvarConfig({ anexo_simples: Number(v) as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Anexo I — Comércio</SelectItem>
                      <SelectItem value="2">Anexo II — Indústria</SelectItem>
                      <SelectItem value="3">Anexo III — Serviços (geral)</SelectItem>
                      <SelectItem value="4">Anexo IV — Serviços (limpeza, vigilância, obras)</SelectItem>
                      <SelectItem value="5">Anexo V — Serviços técnicos/intelectuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {config.regime !== "simples" && (
              <>
                <Separator />
                <h3 className="text-base font-semibold leading-6 text-foreground">Alíquotas (%) e limite do adicional</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5"><Label>IRPJ</Label><Input type="number" step="0.01" defaultValue={config.aliquota_irpj} onBlur={e => salvarConfig({ aliquota_irpj: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Adicional IRPJ</Label><Input type="number" step="0.01" defaultValue={config.adicional_irpj} onBlur={e => salvarConfig({ adicional_irpj: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>Limite mensal do adicional</Label>
                    <MoneyInput value={limiteAdicional} onValueChange={setLimiteAdicional}
                      onBlur={() => salvarConfig({ limite_adicional_irpj: limiteAdicional })} /></div>
                  <div className="space-y-1.5"><Label>CSLL</Label><Input type="number" step="0.01" defaultValue={config.aliquota_csll} onBlur={e => salvarConfig({ aliquota_csll: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>PIS {config.regime === "real" ? "(NC)" : "cumul."}</Label>
                    <Input type="number" step="0.01"
                      defaultValue={config.regime === "real" ? config.aliquota_pis_nc : config.aliquota_pis}
                      onBlur={e => salvarConfig(config.regime === "real"
                        ? { aliquota_pis_nc: Number(e.target.value) }
                        : { aliquota_pis: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>COFINS {config.regime === "real" ? "(NC)" : "cumul."}</Label>
                    <Input type="number" step="0.01"
                      defaultValue={config.regime === "real" ? config.aliquota_cofins_nc : config.aliquota_cofins}
                      onBlur={e => salvarConfig(config.regime === "real"
                        ? { aliquota_cofins_nc: Number(e.target.value) }
                        : { aliquota_cofins: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>ISS</Label><Input type="number" step="0.01" defaultValue={config.aliquota_iss} onBlur={e => salvarConfig({ aliquota_iss: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label>ICMS</Label><Input type="number" step="0.01" defaultValue={config.aliquota_icms} onBlur={e => salvarConfig({ aliquota_icms: Number(e.target.value) })} /></div>
                </div>

                {config.regime === "presumido" && (
                  <>
                    <Separator />
                    <h3 className="text-base font-semibold leading-6 text-foreground">Presunções de lucro (%)</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5"><Label>IRPJ Comércio</Label><Input type="number" step="0.01" defaultValue={config.presuncao_irpj_comercio} onBlur={e => salvarConfig({ presuncao_irpj_comercio: Number(e.target.value) })} /></div>
                      <div className="space-y-1.5"><Label>IRPJ Serviço</Label><Input type="number" step="0.01" defaultValue={config.presuncao_irpj_servico} onBlur={e => salvarConfig({ presuncao_irpj_servico: Number(e.target.value) })} /></div>
                      <div className="space-y-1.5"><Label>CSLL Comércio</Label><Input type="number" step="0.01" defaultValue={config.presuncao_csll_comercio} onBlur={e => salvarConfig({ presuncao_csll_comercio: Number(e.target.value) })} /></div>
                      <div className="space-y-1.5"><Label>CSLL Serviço</Label><Input type="number" step="0.01" defaultValue={config.presuncao_csll_servico} onBlur={e => salvarConfig({ presuncao_csll_servico: Number(e.target.value) })} /></div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="text-xs text-muted-foreground">
              Dica: classifique cada categoria de receita como "comércio" ou "serviço" no cadastro de Categorias para que a importação automática separe corretamente as bases.
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    <DialogDivergenciasApuracao
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      divergencias={divergencias}
      validando={validando}
      onExportar={exportarCSV}
    />
    </>
  );
}
