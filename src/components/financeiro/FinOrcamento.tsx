import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Copy, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Conta {
  id: string;
  codigo: string;
  nome: string;
  natureza: string;
  tipo_conta: string;
  aceita_lancamento: boolean;
}

interface Meta {
  id?: string;
  conta_id: string;
  ano: number;
  mes: number;
  valor_orcado: number;
}

interface Realizado {
  conta_id: string;
  mes: number;
  valor_realizado: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinOrcamento() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [contas, setContas] = useState<Conta[]>([]);
  const [metas, setMetas] = useState<Record<string, Record<number, number>>>({});
  const [realizado, setRealizado] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroNatureza, setFiltroNatureza] = useState<string>("receita");

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const { data: pc } = await supabase
        .from("financeiro_plano_contas")
        .select("id, codigo, nome, natureza, tipo_conta, aceita_lancamento")
        .eq("empresa_id", empresaAtiva.id)
        .eq("ativo", true)
        .order("codigo");
      setContas((pc as Conta[]) ?? []);

      const { data: ms } = await supabase
        .from("financeiro_metas")
        .select("conta_id, mes, valor_orcado")
        .eq("empresa_id", empresaAtiva.id)
        .eq("ano", ano);
      const mMap: Record<string, Record<number, number>> = {};
      (ms ?? []).forEach((m: any) => {
        mMap[m.conta_id] ??= {};
        mMap[m.conta_id][m.mes] = Number(m.valor_orcado);
      });
      setMetas(mMap);

      const { data: rs } = await supabase.rpc("financeiro_realizado_mensal", {
        p_empresa_id: empresaAtiva.id,
        p_ano: ano,
      });
      const rMap: Record<string, Record<number, number>> = {};
      (rs ?? []).forEach((r: Realizado) => {
        rMap[r.conta_id] ??= {};
        rMap[r.conta_id][r.mes] = Number(r.valor_realizado);
      });
      setRealizado(rMap);
    } catch (e: any) {
      toast({ title: "Erro ao carregar orçamento", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [empresaAtiva?.id, ano]);

  const contasFiltradas = useMemo(
    () => contas.filter((c) => c.natureza === filtroNatureza && c.aceita_lancamento),
    [contas, filtroNatureza]
  );

  const setMetaCell = (contaId: string, mes: number, val: number) => {
    setMetas((prev) => ({ ...prev, [contaId]: { ...(prev[contaId] ?? {}), [mes]: val } }));
  };

  const replicarLinha = (contaId: string, valor: number) => {
    const novo: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) novo[m] = valor;
    setMetas((prev) => ({ ...prev, [contaId]: novo }));
  };

  const totalLinha = (mapMes: Record<number, number> = {}) =>
    Array.from({ length: 12 }, (_, i) => mapMes[i + 1] ?? 0).reduce((a, b) => a + b, 0);

  const salvar = async () => {
    if (!empresaAtiva) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const rows: any[] = [];
      contasFiltradas.forEach((c) => {
        for (let m = 1; m <= 12; m++) {
          const v = metas[c.id]?.[m] ?? 0;
          if (v !== 0) {
            rows.push({
              empresa_id: empresaAtiva.id,
              user_id: userId,
              ano,
              mes: m,
              conta_id: c.id,
              valor_orcado: v,
              metodo_projecao: "manual",
            });
          }
        }
      });

      if (rows.length === 0) {
        toast({ title: "Nada a salvar", description: "Preencha valores antes." });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("financeiro_metas")
        .upsert(rows, { onConflict: "empresa_id,ano,mes,conta_id" });
      if (error) throw error;
      toast({ title: "Orçamento salvo", description: `${rows.length} valores gravados.` });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // cores por desempenho
  const corVariacao = (orcado: number, realizadoV: number, isReceita: boolean): string => {
    if (orcado === 0 && realizadoV === 0) return "";
    if (orcado === 0) return "text-foreground";
    const pct = (realizadoV / orcado) * 100;
    if (isReceita) {
      if (pct >= 100) return "text-emerald-600 dark:text-emerald-400 font-medium";
      if (pct >= 80) return "text-amber-600 dark:text-amber-400";
      return "text-destructive";
    } else {
      if (pct <= 100) return "text-emerald-600 dark:text-emerald-400 font-medium";
      if (pct <= 110) return "text-amber-600 dark:text-amber-400";
      return "text-destructive";
    }
  };

  if (!empresaAtiva) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Selecione uma empresa ativa para gerenciar o orçamento.
        </CardContent>
      </Card>
    );
  }

  const isReceita = filtroNatureza === "receita";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Orçamento Empresarial — Budget vs Actual
            </CardTitle>
            <CardDescription>
              Plano orçamentário mensal por conta contábil. Compare orçado x realizado.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[ano - 1, ano, ano + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroNatureza} onValueChange={setFiltroNatureza}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="passivo">Passivos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={salvar} disabled={saving || loading} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : contasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma conta analítica de {filtroNatureza} encontrada. Cadastre o Plano de Contas primeiro.
            </div>
          ) : (
            <Tabs defaultValue="orcado">
              <TabsList>
                <TabsTrigger value="orcado">Orçado</TabsTrigger>
                <TabsTrigger value="realizado">Realizado</TabsTrigger>
                <TabsTrigger value="variacao_abs">Variação R$</TabsTrigger>
                <TabsTrigger value="variacao_pct">Atingimento %</TabsTrigger>
              </TabsList>

              <TabsContent value="orcado" className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sticky left-0 bg-background min-w-[260px]">Conta</th>
                      {MESES.map((m) => (
                        <th key={m} className="p-1 text-right min-w-[88px]">{m}</th>
                      ))}
                      <th className="p-2 text-right font-semibold">Total</th>
                      <th className="p-1 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasFiltradas.map((c) => {
                      const linha = metas[c.id] ?? {};
                      const total = totalLinha(linha);
                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 sticky left-0 bg-background">
                            <div className="font-mono text-[10px] text-muted-foreground">{c.codigo}</div>
                            <div>{c.nome}</div>
                          </td>
                          {MESES.map((_, idx) => {
                            const m = idx + 1;
                            return (
                              <td key={m} className="p-0.5">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={linha[m] ?? ""}
                                  onChange={(e) => setMetaCell(c.id, m, Number(e.target.value) || 0)}
                                  className="h-7 text-right text-xs px-1"
                                />
                              </td>
                            );
                          })}
                          <td className="p-2 text-right font-medium tabular-nums">{fmt(total)}</td>
                          <td className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Replicar Jan para todos os meses"
                              onClick={() => replicarLinha(c.id, linha[1] ?? 0)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="realizado" className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 min-w-[260px]">Conta</th>
                      {MESES.map((m) => <th key={m} className="p-2 text-right">{m}</th>)}
                      <th className="p-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasFiltradas.map((c) => {
                      const r = realizado[c.id] ?? {};
                      const total = totalLinha(r);
                      return (
                        <tr key={c.id} className="border-b">
                          <td className="p-2">
                            <div className="font-mono text-[10px] text-muted-foreground">{c.codigo}</div>
                            <div>{c.nome}</div>
                          </td>
                          {MESES.map((_, idx) => (
                            <td key={idx} className="p-2 text-right tabular-nums">
                              {r[idx + 1] ? fmt(r[idx + 1]) : "—"}
                            </td>
                          ))}
                          <td className="p-2 text-right font-medium tabular-nums">{fmt(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="variacao_abs" className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 min-w-[260px]">Conta</th>
                      {MESES.map((m) => <th key={m} className="p-2 text-right">{m}</th>)}
                      <th className="p-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasFiltradas.map((c) => {
                      const o = metas[c.id] ?? {};
                      const r = realizado[c.id] ?? {};
                      let totalDif = 0;
                      return (
                        <tr key={c.id} className="border-b">
                          <td className="p-2">
                            <div className="font-mono text-[10px] text-muted-foreground">{c.codigo}</div>
                            <div>{c.nome}</div>
                          </td>
                          {MESES.map((_, idx) => {
                            const m = idx + 1;
                            const dif = (r[m] ?? 0) - (o[m] ?? 0);
                            totalDif += dif;
                            return (
                              <td key={m} className={cn("p-2 text-right tabular-nums", corVariacao(o[m] ?? 0, r[m] ?? 0, isReceita))}>
                                {dif !== 0 ? fmt(dif) : "—"}
                              </td>
                            );
                          })}
                          <td className={cn("p-2 text-right font-medium tabular-nums", corVariacao(totalLinha(o), totalLinha(r), isReceita))}>
                            {fmt(totalDif)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="variacao_pct" className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 min-w-[260px]">Conta</th>
                      {MESES.map((m) => <th key={m} className="p-2 text-right">{m}</th>)}
                      <th className="p-2 text-right font-semibold">Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasFiltradas.map((c) => {
                      const o = metas[c.id] ?? {};
                      const r = realizado[c.id] ?? {};
                      const tO = totalLinha(o);
                      const tR = totalLinha(r);
                      const pctTotal = tO > 0 ? (tR / tO) * 100 : 0;
                      return (
                        <tr key={c.id} className="border-b">
                          <td className="p-2">
                            <div className="font-mono text-[10px] text-muted-foreground">{c.codigo}</div>
                            <div>{c.nome}</div>
                          </td>
                          {MESES.map((_, idx) => {
                            const m = idx + 1;
                            const pct = (o[m] ?? 0) > 0 ? ((r[m] ?? 0) / (o[m] ?? 0)) * 100 : 0;
                            return (
                              <td key={m} className={cn("p-2 text-right tabular-nums", corVariacao(o[m] ?? 0, r[m] ?? 0, isReceita))}>
                                {(o[m] ?? 0) > 0 ? `${pct.toFixed(0)}%` : "—"}
                              </td>
                            );
                          })}
                          <td className={cn("p-2 text-right font-medium tabular-nums", corVariacao(tO, tR, isReceita))}>
                            {tO > 0 ? `${pctTotal.toFixed(0)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-4 text-xs text-muted-foreground border-t pt-3">
            <strong>Legenda:</strong>{" "}
            {isReceita ? (
              <>Receitas — <span className="text-emerald-600">verde ≥100%</span>, <span className="text-amber-600">amarelo 80–99%</span>, <span className="text-destructive">vermelho &lt;80%</span></>
            ) : (
              <>Despesas — <span className="text-emerald-600">verde ≤100%</span>, <span className="text-amber-600">amarelo 101–110%</span>, <span className="text-destructive">vermelho &gt;110%</span></>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
