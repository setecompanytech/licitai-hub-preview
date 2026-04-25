import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useApuracaoTributaria, type Regime } from "@/hooks/useApuracaoTributaria";
import { Calculator, Settings, FileBarChart, Save, Download, RefreshCw, CheckCircle2 } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const pct = (n: number) => `${(n || 0).toFixed(4)}%`;

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function FinApuracao() {
  const { config, apuracoes, loading, salvarConfig, buscarReceita, calcular, salvarApuracao, marcarComoPago } = useApuracaoTributaria();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [receitaComercio, setReceitaComercio] = useState(0);
  const [receitaServico, setReceitaServico] = useState(0);
  const [rbt12, setRbt12] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [creditos, setCreditos] = useState(0);
  const [carregandoReceita, setCarregandoReceita] = useState(false);

  const resultado = useMemo(() => {
    if (!config) return {};
    return calcular(receitaComercio, receitaServico, rbt12, despesas, creditos);
  }, [config, receitaComercio, receitaServico, rbt12, despesas, creditos, calcular]);

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
      ["Competência", "Regime", "Receita Total", "Total Devido", "Status", "Pago em"].join(";"),
      ...apuracoes.map(a => [
        a.competencia, a.regime,
        a.receita_bruta_total.toFixed(2),
        a.valor_total.toFixed(2),
        a.status, a.pago_em ?? "",
      ].join(";")),
    ].join("\n");
    const blob = new Blob([linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `apuracoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading || !config) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>;
  }

  return (
    <Tabs defaultValue="apurar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="apurar"><Calculator className="w-4 h-4 mr-1.5" />Apuração</TabsTrigger>
        <TabsTrigger value="historico"><FileBarChart className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
        <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1.5" />Configuração</TabsTrigger>
      </TabsList>

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
                <Label>Receita — Comércio/Indústria (R$)</Label>
                <Input type="number" value={receitaComercio} onChange={e => setReceitaComercio(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Receita — Serviços (R$)</Label>
                <Input type="number" value={receitaServico} onChange={e => setReceitaServico(Number(e.target.value) || 0)} />
              </div>
              {config.regime === "simples" && (
                <div>
                  <Label>RBT12 — Receita 12 meses (R$)</Label>
                  <Input type="number" value={rbt12} onChange={e => setRbt12(Number(e.target.value) || 0)} />
                </div>
              )}
              {config.regime === "real" && (
                <>
                  <div>
                    <Label>Despesas operacionais dedutíveis (R$)</Label>
                    <Input type="number" value={despesas} onChange={e => setDespesas(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label>Créditos PIS/COFINS — insumos (R$)</Label>
                    <Input type="number" value={creditos} onChange={e => setCreditos(Number(e.target.value) || 0)} />
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
                      <TableRow><TableCell>Adicional IRPJ</TableCell><TableCell className="text-right">{fmt((resultado.presumido ?? resultado.real)!.adicionalIrpj)}</TableCell></TableRow>
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
              <Button onClick={() => salvarApuracao(competencia, receitaComercio, receitaServico, rbt12, resultado)}>
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
              <Button size="sm" variant="outline" onClick={exportarCSV}><Download className="w-4 h-4 mr-1.5" />Exportar CSV</Button>
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
                          <Badge variant={a.status === "pago" ? "default" : a.status === "apurado" ? "secondary" : "outline"}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.status !== "pago" && (
                            <Button size="sm" variant="ghost" onClick={() => marcarComoPago(a.id)}>
                              <CheckCircle2 className="w-4 h-4 mr-1" />Marcar pago
                            </Button>
                          )}
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
              <div>
                <Label>Regime tributário</Label>
                <Select value={config.regime} onValueChange={(v: Regime) => salvarConfig({ regime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
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
                <div className="text-sm font-medium">Alíquotas (%)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>IRPJ</Label><Input type="number" step="0.01" defaultValue={config.aliquota_irpj} onBlur={e => salvarConfig({ aliquota_irpj: Number(e.target.value) })} /></div>
                  <div><Label>Adicional IRPJ</Label><Input type="number" step="0.01" defaultValue={config.adicional_irpj} onBlur={e => salvarConfig({ adicional_irpj: Number(e.target.value) })} /></div>
                  <div><Label>Limite mensal</Label><Input type="number" step="0.01" defaultValue={config.limite_adicional_irpj} onBlur={e => salvarConfig({ limite_adicional_irpj: Number(e.target.value) })} /></div>
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
  );
}
