import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useApuracaoTributaria } from "@/hooks/useApuracaoTributaria";
import { Calculator, TrendingUp, AlertCircle, Sparkles, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

type Periodo = "3" | "6" | "12";

interface AnaliseFinanceira {
  receita: number;
  custo: number;
  despesa: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemBrutaPerc: number;
  margemLiquidaPerc: number;
  cargaTributariaPerc: number;
  meses: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${(v ?? 0).toFixed(2)}%`;

export default function FinCalculadoraMargem() {
  const { empresaAtiva } = useEmpresa();
  const { config, calcular } = useApuracaoTributaria();

  const [periodo, setPeriodo] = useState<Periodo>("6");
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState<AnaliseFinanceira | null>(null);

  // Parâmetros da sugestão
  const [margemDesejada, setMargemDesejada] = useState<number>(15);
  const [custoProduto, setCustoProduto] = useState<number>(100);

  const carregar = async () => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    try {
      const meses = parseInt(periodo, 10);
      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - meses);
      const inicioISO = dataInicio.toISOString().slice(0, 10);

      const { data, error } = await (supabase as any)
        .from("financeiro_lancamentos")
        .select("natureza, valor, status, data_competencia, financeiro_categorias(tipo)")
        .eq("empresa_id", empresaAtiva.id)
        .in("status", ["realizado", "conciliado"])
        .gte("data_competencia", inicioISO);

      if (error) throw error;

      let receita = 0, custo = 0, despesa = 0;
      for (const l of data ?? []) {
        const v = Number(l.valor) || 0;
        const tipoCat = l.financeiro_categorias?.tipo as string | undefined;
        if (l.natureza === "receita") receita += v;
        else if (l.natureza === "despesa") {
          // Heurística: categorias do tipo "custo" são CMV/CSP; demais são despesa operacional
          if (tipoCat === "custo") custo += v;
          else despesa += v;
        }
      }

      const lucroBruto = receita - custo;
      const lucroLiquido = receita - custo - despesa;
      const margemBrutaPerc = receita > 0 ? (lucroBruto / receita) * 100 : 0;
      const margemLiquidaPerc = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

      // Estimativa de carga tributária via simulação no regime cadastrado
      let cargaTributariaPerc = 0;
      if (config && receita > 0) {
        // Simplificação: trata todo faturamento como serviço se o anexo do Simples for de serviços (3-5),
        // caso contrário trata como comércio. Para presumido/real usa proporção 50/50 conservadora.
        const ehServico = config.regime === "simples" && (config.anexo_simples ?? 1) >= 3;
        const rComercio = ehServico ? 0 : receita;
        const rServico = ehServico ? receita : 0;
        const r = calcular(rComercio, rServico, receita * 12 / meses, despesa, 0);
        const total = r.simples?.valorDevido ?? r.presumido?.total ?? r.real?.total ?? 0;
        cargaTributariaPerc = receita > 0 ? (total / receita) * 100 : 0;
      }

      setAnalise({
        receita, custo, despesa, lucroBruto, lucroLiquido,
        margemBrutaPerc, margemLiquidaPerc, cargaTributariaPerc, meses,
      });
    } catch (e: any) {
      toast.error("Erro ao carregar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaAtiva?.id && config) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id, config, periodo]);

  // Sugestão: percentual de margem mínima ideal sobre o preço de venda
  // baseado em: carga tributária + % despesa operacional + margem desejada
  const sugestao = useMemo(() => {
    if (!analise || analise.receita <= 0) return null;
    const despPerc = (analise.despesa / analise.receita) * 100;
    const tribPerc = analise.cargaTributariaPerc;
    // Margem mínima de venda para cobrir tudo + lucro desejado
    const margemMinimaTotal = tribPerc + despPerc + margemDesejada;

    // Markup sobre o custo: preço = custo / (1 - margemMinimaTotal/100)
    const fator = 1 - margemMinimaTotal / 100;
    const precoSugerido = fator > 0 ? custoProduto / fator : 0;
    const markupPerc = custoProduto > 0 ? ((precoSugerido - custoProduto) / custoProduto) * 100 : 0;

    return {
      despPerc,
      tribPerc,
      margemDesejada,
      margemMinimaTotal,
      precoSugerido,
      markupPerc,
      viavel: fator > 0 && fator < 1,
    };
  }, [analise, margemDesejada, custoProduto]);

  if (!empresaAtiva) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-muted-foreground" />
                Calculadora Contábil de Margem
              </CardTitle>
              <CardDescription>
                Analisa receitas, custos e despesas reais lançadas no sistema, aplica o regime tributário
                cadastrado e sugere a margem percentual ideal para precificar produtos e serviços.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Últimos 12 meses</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!config && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Regime tributário não configurado</AlertTitle>
          <AlertDescription>
            Cadastre o regime tributário em <strong>Apuração</strong> para que a calculadora considere a
            carga tributária correta.
          </AlertDescription>
        </Alert>
      )}

      {analise && analise.receita === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem receitas no período</AlertTitle>
          <AlertDescription>
            Não há lançamentos de receita realizados/conciliados nos últimos {analise.meses} meses para
            esta empresa. Importe ou registre lançamentos antes de simular margens.
          </AlertDescription>
        </Alert>
      )}

      {analise && analise.receita > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Análise dos lançamentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Análise dos {analise.meses} últimos meses
              </CardTitle>
              <CardDescription>
                Regime: <Badge variant="secondary" className="ml-1 capitalize">{config?.regime ?? "—"}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Receita Bruta" value={fmtBRL(analise.receita)} bold />
              <Row label="(–) Custos (CMV/CSP)" value={fmtBRL(analise.custo)} muted />
              <Row label="(–) Despesas Operacionais" value={fmtBRL(analise.despesa)} muted />
              <Separator />
              <Row label="Lucro Bruto" value={fmtBRL(analise.lucroBruto)} />
              <Row label="Margem Bruta" value={fmtPct(analise.margemBrutaPerc)} />
              <Separator />
              <Row label="Lucro Líquido" value={fmtBRL(analise.lucroLiquido)} bold />
              <Row label="Margem Líquida" value={fmtPct(analise.margemLiquidaPerc)} bold />
              <Row label="Carga Tributária estimada" value={fmtPct(analise.cargaTributariaPerc)} />
            </CardContent>
          </Card>

          {/* Sugestão de margem */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                Sugestão de margem ideal
              </CardTitle>
              <CardDescription>
                Calcule o preço de venda mínimo para cobrir tributos + despesas + lucro desejado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="custo">Custo do produto/serviço</Label>
                  <Input
                    id="custo" type="number" min={0} step="0.01"
                    value={custoProduto}
                    onChange={(e) => setCustoProduto(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="margem">Lucro desejado (%)</Label>
                  <Input
                    id="margem" type="number" min={0} max={90} step="0.5"
                    value={margemDesejada}
                    onChange={(e) => setMargemDesejada(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {sugestao && (
                <>
                  <Separator />
                  <Row label="Tributos sobre venda" value={fmtPct(sugestao.tribPerc)} muted />
                  <Row label="Despesas sobre venda" value={fmtPct(sugestao.despPerc)} muted />
                  <Row label="Lucro desejado" value={fmtPct(sugestao.margemDesejada)} muted />
                  <Separator />
                  <Row
                    label="Margem mínima sobre venda"
                    value={fmtPct(sugestao.margemMinimaTotal)}
                    bold
                  />

                  {sugestao.viavel ? (
                    <div className="rounded-lg bg-muted border border-border/60 p-4 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Preço de venda sugerido</span>
                        <span className="text-2xl font-bold text-foreground">
                          {fmtBRL(sugestao.precoSugerido)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Markup sobre o custo</span>
                        <span className="font-medium">{fmtPct(sugestao.markupPerc)}</span>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Combinação inviável</AlertTitle>
                      <AlertDescription>
                        Tributos + despesas + lucro desejado ultrapassam 100% da venda. Reduza o lucro
                        desejado ou revise a estrutura de custos/despesas.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Como funciona:</strong> a análise soma todos os lançamentos com status <em>realizado</em> ou{" "}
          <em>conciliado</em> no período. Categorias do tipo <em>custo</em> compõem o CMV/CSP; as demais despesas
          são tratadas como operacionais. A carga tributária é estimada simulando o regime cadastrado em{" "}
          <em>Apuração</em>. A sugestão de preço usa a fórmula: <code>preço = custo ÷ (1 − margem mínima)</code>.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
