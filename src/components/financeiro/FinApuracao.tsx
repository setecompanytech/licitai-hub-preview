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
import { useApuracaoTributaria } from "@/hooks/useApuracaoTributaria";
import { useValidacaoApuracao, type DivergenciaApuracao } from "@/hooks/useValidacaoApuracao";
import { DialogDivergenciasApuracao } from "./DialogDivergenciasApuracao";
import FinImportarNotas from "./FinImportarNotas";
import { Calculator, Settings, FileBarChart, Save, Download, RefreshCw, CheckCircle2, ShieldCheck, FileUp, AlertTriangle } from "lucide-react";
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
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>;
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
        <CardContent className="py-12 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-warning" />
          <div>
            <p className="text-sm font-medium">Regime tributário não definido</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {empresaAtiva?.razao_social ? <><strong>{empresaAtiva.razao_social}</strong> ainda não tem</> : 'Esta empresa ainda não tem'}{' '}
              regime no cadastro. Sem ele não há por qual tabela apurar — e adotar um padrão
              aqui seria decidir no lugar de quem pode decidir.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/configuracoes?aba=tributario')}>
            Definir em Configurações
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Tabs defaultValue="apurar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="apurar"><Calculator className="w-4 h-4 mr-1.5" />Apuração</TabsTrigger>
        <TabsTrigger value="importar"><FileUp className="w-4 h-4 mr-1.5" />Importar notas</TabsTrigger>
        <TabsTrigger value="historico"><FileBarChart className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
        <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" />Configuração</TabsTrigger>
      </TabsList>

      {/* IMPORTAR NOTAS */}
      <TabsContent value="importar" className="space-y-4">
        <FinImportarNotas onImportacaoConcluida={carregar} />
      </TabsContent>

      {/* APURAÇÃO */}
      <TabsContent value="apurar" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Apuração mensal — {config.regime === "simples" ? "Simples Nacional" : config.regime === "presumido" ? "Lucro Presumido" : "Lucro Real"}</span>
              <Badge variant="secondary">{config.regime === "simples" ? `Anexo ${config.anexo_simples ?? "—"}` : "Regime apurado"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Competência</Label>
                <Input type="month" value={competencia.slice(0, 7)} onChange={e => setCompetencia(`${e.target.value}-01`)} />
              </div>
              <div className="md:col-span-3 flex items-end">
                <Button variant="outline" onClick={importarReceita} disabled={carregandoReceita}>
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${carregandoReceita ? "animate-spin" : ""}`} />
                  Importar receita realizada do mês
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Receita — Comércio/Indústria</Label>
                <MoneyInput value={receitaComercio} onValueChange={setReceitaComercio} />
              </div>
              <div>
                <Label>Receita — Serviços</Label>
                <MoneyInput value={receitaServico} onValueChange={setReceitaServico} />
              </div>
              {config.regime === "simples" && (
                <div>
                  <Label>RBT12 — Receita 12 meses</Label>
                  <MoneyInput value={rbt12} onValueChange={setRbt12} />
                </div>
              )}
              {config.regime === "simples" && excedeTetoDoSimples(rbt12) && (
                <div className="md:col-span-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-4 h-4" /> RBT12 acima do teto do Simples Nacional
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O Anexo I termina em {fmt(TETO_SIMPLES_NACIONAL)} de RBT12 (LC 123/2006, art. 3º, II).
                    Com {fmt(rbt12)} não há faixa aplicável — o cálculo abaixo estende a sexta faixa e
                    produz um imposto que não é devido dessa forma. Confira o regime no cadastro da
                    empresa antes de usar este número.
                  </p>
                </div>
              )}
              {config.regime === "real" && (
                <>
                  <div>
                    <Label>Despesas operacionais dedutíveis</Label>
                    <MoneyInput value={despesas} onValueChange={setDespesas} />
                  </div>
                  <div>
                    <Label>Créditos PIS/COFINS — insumos</Label>
                    <MoneyInput value={creditos} onValueChange={setCreditos} />
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Resultado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Receita do mês</div>
                <div className="text-xl font-semibold">{fmt(receitaComercio + receitaServico)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total de tributos</div>
                <div className="text-xl font-semibold text-destructive">{fmt(totalDevido)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Carga tributária efetiva</div>
                <div className="text-xl font-semibold">{cargaTributaria.toFixed(2)}%</div>
              </CardContent></Card>
            </div>

            {/* Memória de cálculo */}
            {resultado.simples && (
              <Card>
                <CardHeader><CardTitle className="text-base">Memória — Simples Nacional</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell>RBT12 base</TableCell><TableCell className="text-right">{fmt(resultado.simples.rbt12)}</TableCell></TableRow>
                      <TableRow><TableCell>Anexo / Faixa</TableCell><TableCell className="text-right">Anexo {resultado.simples.anexo} — Faixa {resultado.simples.faixa}</TableCell></TableRow>
                      <TableRow><TableCell>Alíquota nominal</TableCell><TableCell className="text-right">{resultado.simples.aliquotaNominal.toFixed(2)}%</TableCell></TableRow>
                      <TableRow><TableCell>Parcela a deduzir</TableCell><TableCell className="text-right">{fmt(resultado.simples.parcelaDeduzir)}</TableCell></TableRow>
                      <TableRow><TableCell>Alíquota efetiva</TableCell><TableCell className="text-right font-semibold">{pct(resultado.simples.aliquotaEfetiva)}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">DAS devido</TableCell><TableCell className="text-right font-semibold">{fmt(resultado.simples.valorDevido)}</TableCell></TableRow>
                      {resultado.simples.excedeuLimite && <TableRow><TableCell colSpan={2}><Badge variant="destructive">Excedeu o limite anual de R$ 4,8 milhões</Badge></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {(resultado.presumido || resultado.real) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Memória — {resultado.presumido ? "Lucro Presumido" : "Lucro Real"}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      {resultado.real && <TableRow><TableCell>Lucro antes IR/CSLL</TableCell><TableCell className="text-right">{fmt(resultado.real.lucroAntesIRCSLL)}</TableCell></TableRow>}
                      {resultado.presumido && <>
                        <TableRow><TableCell>Base IRPJ (presunção)</TableCell><TableCell className="text-right">{fmt(resultado.presumido.baseIrpj)}</TableCell></TableRow>
                        <TableRow><TableCell>Base CSLL (presunção)</TableCell><TableCell className="text-right">{fmt(resultado.presumido.baseCsll)}</TableCell></TableRow>
                      </>}
                      <TableRow><TableCell>IRPJ</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.irpj)}</TableCell></TableRow>
                      <TableRow><TableCell>Adicional IRPJ{resultado.presumido && trimestre ? ` — trimestral, mês ${trimestre.posicao}/3` : ""}</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.adicionalIrpj)}</TableCell></TableRow>
                      <TableRow><TableCell>CSLL</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.csll)}</TableCell></TableRow>
                      <TableRow><TableCell>PIS {resultado.real ? "(não-cumulativo)" : "(cumulativo)"}</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.pis)}</TableCell></TableRow>
                      <TableRow><TableCell>COFINS {resultado.real ? "(não-cumulativo)" : "(cumulativo)"}</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.cofins)}</TableCell></TableRow>
                      <TableRow><TableCell>ISS</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.iss)}</TableCell></TableRow>
                      <TableRow><TableCell>ICMS</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.icms)}</TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Total devido</TableCell><TableCell className="text-right font-semibold">{fmt((resultado.presumido ?? resultado.real)!.total)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => salvarApuracao(competencia, receitaComercio, receitaServico, rbt12, resultado, { despesasOperacionais: despesas, creditosPisCofins: creditos })}>
                <Save className="w-4 h-4 mr-1.5" />Salvar apuração
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* HISTÓRICO */}
      <TabsContent value="historico" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Histórico de apurações</span>
              <Button size="sm" variant="outline" onClick={validarEAbrir}><ShieldCheck className="w-4 h-4 mr-1.5" />Validar e exportar CSV</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apuracoes.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma apuração registrada ainda.</div>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apuracoes.map(a => {
                    const carga = a.receita_bruta_total > 0 ? (a.valor_total / a.receita_bruta_total) * 100 : 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{a.competencia.slice(0, 7)}</TableCell>
                        <TableCell><Badge variant="outline">{a.regime}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(a.receita_bruta_total)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(a.valor_total)}</TableCell>
                        <TableCell className="text-right">{carga.toFixed(2)}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={a.status === "pago" ? "default" : a.status === "apurado" ? "secondary" : "outline"}>
                              {a.status}
                            </Badge>
                            {a.apuracao_desatualizada && (
                              <Badge variant="destructive" className="gap-1" title={a.desatualizada_motivo ?? "Apuração desatualizada"}>
                                <AlertTriangle className="w-3 h-3" />desatualizada
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {a.apuracao_desatualizada && a.status !== "pago" && (
                              <Button size="sm" variant="outline" onClick={() => recalcular(a)}>
                                <RefreshCw className="w-4 h-4 mr-1" />Recalcular
                              </Button>
                            )}
                            {a.status !== "pago" && (
                              <Button size="sm" variant="ghost" onClick={() => marcarComoPago(a.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />Marcar pago
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* O regime não se escolhe aqui. Escolhia-se, e era esse o defeito:
                  duas telas gravando a mesma decisão em colunas diferentes, com
                  palavras diferentes, sem se falarem. Quem trocava em
                  Configurações via esta aqui ignorar a troca. */}
              <div>
                <Label>Regime tributário</Label>
                <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3">
                  <span className="text-sm font-medium">{rotuloDoRegime(empresaAtiva?.regime_tributario)}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => navigate('/configuracoes?aba=tributario')}>
                    Alterar em Configurações
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Vem do cadastro da empresa e vale para Precificação, Contratos e Proposta.
                </p>
              </div>
              {config.regime === "simples" && (
                <div>
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
                <div className="text-sm font-medium">Alíquotas (%) e limite do adicional</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>IRPJ</Label><Input type="number" step="0.01" defaultValue={config.aliquota_irpj} onBlur={e => salvarConfig({ aliquota_irpj: Number(e.target.value) })} /></div>
                  <div><Label>Adicional IRPJ</Label><Input type="number" step="0.01" defaultValue={config.adicional_irpj} onBlur={e => salvarConfig({ adicional_irpj: Number(e.target.value) })} /></div>
                  <div><Label>Limite mensal do adicional</Label>
                    <MoneyInput value={limiteAdicional} onValueChange={setLimiteAdicional}
                      onBlur={() => salvarConfig({ limite_adicional_irpj: limiteAdicional })} /></div>
                  <div><Label>CSLL</Label><Input type="number" step="0.01" defaultValue={config.aliquota_csll} onBlur={e => salvarConfig({ aliquota_csll: Number(e.target.value) })} /></div>
                  <div><Label>PIS {config.regime === "real" ? "(NC)" : "cumul."}</Label>
                    <Input type="number" step="0.01"
                      defaultValue={config.regime === "real" ? config.aliquota_pis_nc : config.aliquota_pis}
                      onBlur={e => salvarConfig(config.regime === "real"
                        ? { aliquota_pis_nc: Number(e.target.value) }
                        : { aliquota_pis: Number(e.target.value) })} /></div>
                  <div><Label>COFINS {config.regime === "real" ? "(NC)" : "cumul."}</Label>
                    <Input type="number" step="0.01"
                      defaultValue={config.regime === "real" ? config.aliquota_cofins_nc : config.aliquota_cofins}
                      onBlur={e => salvarConfig(config.regime === "real"
                        ? { aliquota_cofins_nc: Number(e.target.value) }
                        : { aliquota_cofins: Number(e.target.value) })} /></div>
                  <div><Label>ISS</Label><Input type="number" step="0.01" defaultValue={config.aliquota_iss} onBlur={e => salvarConfig({ aliquota_iss: Number(e.target.value) })} /></div>
                  <div><Label>ICMS</Label><Input type="number" step="0.01" defaultValue={config.aliquota_icms} onBlur={e => salvarConfig({ aliquota_icms: Number(e.target.value) })} /></div>
                </div>

                {config.regime === "presumido" && (
                  <>
                    <Separator />
                    <div className="text-sm font-medium">Presunções de lucro (%)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Label>IRPJ Comércio</Label><Input type="number" step="0.01" defaultValue={config.presuncao_irpj_comercio} onBlur={e => salvarConfig({ presuncao_irpj_comercio: Number(e.target.value) })} /></div>
                      <div><Label>IRPJ Serviço</Label><Input type="number" step="0.01" defaultValue={config.presuncao_irpj_servico} onBlur={e => salvarConfig({ presuncao_irpj_servico: Number(e.target.value) })} /></div>
                      <div><Label>CSLL Comércio</Label><Input type="number" step="0.01" defaultValue={config.presuncao_csll_comercio} onBlur={e => salvarConfig({ presuncao_csll_comercio: Number(e.target.value) })} /></div>
                      <div><Label>CSLL Serviço</Label><Input type="number" step="0.01" defaultValue={config.presuncao_csll_servico} onBlur={e => salvarConfig({ presuncao_csll_servico: Number(e.target.value) })} /></div>
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
