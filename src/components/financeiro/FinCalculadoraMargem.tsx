import { useEffect, useMemo, useState } from "react";
import { dataLocal } from '@/lib/financeiro/data-local';
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
import { TrendingUp, AlertCircle, Sparkles, RefreshCw, Info, Loader2 } from "lucide-react";
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
  const { config, calcular, loading: carregandoConfig } = useApuracaoTributaria();

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
      const inicioISO = dataLocal(dataInicio);

      // O lançamento tem DUAS chaves para categorias — `categoria_id` (a
      // classificada) e `categoria_sugerida_id` (o palpite da conciliação) —
      // e sem dizer qual, o PostgREST recusa: "more than one relationship was
      // found". Aqui só a classificada vale; sugestão não é classificação.
      const { data, error } = await (supabase as any)
        .from("financeiro_lancamentos")
        .select("natureza, valor, status, data_competencia, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(grupo_dre)")
        .eq("empresa_id", empresaAtiva.id)
        // Só título: a transferência entre contas próprias vinha em DUAS pernas,
        // uma com natureza "receita" e outra com "despesa", e sem categoria —
        // então caía nos dois ramos abaixo e a MESMA operação entrava como
        // faturamento E como custo. Na base da ETHOS são 156 pernas somando
        // R$ 19,17 milhões, justamente nesta tela que decide margem.
        //
        // O movimento de extrato também sai, pela mesma régua de
        // financeiro_indicadores_gerenciais: enquanto não for conciliado contra
        // o título, ele é o mesmo dinheiro por outro caminho.
        .in("tipo", ["a_receber", "a_pagar"])
        .in("status", ["realizado", "conciliado"])
        .gte("data_competencia", inicioISO);

      if (error) throw error;

      let receita = 0, custo = 0, despesa = 0;
      for (const l of data ?? []) {
        const v = Number(l.valor) || 0;
        const cat = l.categoria as { grupo_dre?: string } | null;
        // A categoria NUNCA teve coluna `tipo` — só `tipo_servico` e
        // `dfc_classe`. Esta tela pedia `tipo` desde que nasceu, e por isso
        // nunca chegou a carregar. Quem separa CMV de despesa é o `grupo_dre`,
        // a mesma régua dos indicadores gerenciais.
        if (l.natureza === "receita") {
          // Rendimento de aplicação não é faturamento: infla a receita e
          // baixa artificialmente a margem necessária.
          if (cat?.grupo_dre !== "receita_financeira") receita += v;
        } else if (l.natureza === "despesa") {
          if (cat?.grupo_dre === "cmv_cps") custo += v;
          // Movimentação patrimonial (distribuição de lucro, empréstimo) não é
          // despesa do período — incluí-la encareceria o preço sem razão.
          else if (cat?.grupo_dre !== "movimentacao") despesa += v;
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
        // Mensaliza antes de calcular: o limite do adicional de IRPJ é por
        // período — aplicá-lo uma vez sobre base de N meses superestimava o
        // adicional (B15 da auditoria). A carga percentual mensal é a do período.
        const rMes = receita / meses;
        const r = calcular(rComercio / meses, rServico / meses, receita * 12 / meses, despesa / meses, 0);
        const total = r.simples?.valorDevido ?? r.presumido?.total ?? r.real?.total ?? 0;
        cargaTributariaPerc = rMes > 0 ? (total / rMes) * 100 : 0;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Analisa receitas, custos e despesas reais lançadas no sistema, aplica o regime tributário cadastrado e sugere
          a margem percentual ideal para precificar produtos e serviços.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="margem-periodo">Período</Label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger id="margem-periodo" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Enquanto o regime ainda está sendo lido, `config` é null — anunciar
          "não configurado" nesse intervalo é um status falso na tela. */}
      {!config && !carregandoConfig && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Regime tributário não configurado</AlertTitle>
          <AlertDescription>
            Cadastre o regime tributário em <strong>Apuração</strong> para que a calculadora considere a
            carga tributária correta.
          </AlertDescription>
        </Alert>
      )}

      {(carregandoConfig || loading) && !analise && (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Carregando lançamentos do período…
        </p>
      )}

      {analise && analise.receita === 0 && (
        <Alert variant="info">
          <Info className="h-4 w-4" aria-hidden="true" />
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
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                Análise dos {analise.meses} últimos meses
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                Regime: <Badge variant="muted" className="capitalize">{config?.regime ?? "—"}</Badge>
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
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                Sugestão de margem ideal
              </CardTitle>
              <CardDescription>
                Calcule o preço de venda mínimo para cobrir tributos + despesas + lucro desejado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="custo">Custo do produto/serviço</Label>
                  <Input
                    id="custo" type="number" min={0} step="0.01"
                    value={custoProduto}
                    onChange={(e) => setCustoProduto(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
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
                    <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Preço de venda sugerido</span>
                        <span className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                          {fmtBRL(sugestao.precoSugerido)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Markup sobre o custo</span>
                        <span className="font-medium tabular-nums text-foreground">{fmtPct(sugestao.markupPerc)}</span>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
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

      <Alert variant="info">
        <Info className="h-4 w-4" aria-hidden="true" />
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
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <span className={bold ? "text-right font-semibold tabular-nums text-foreground" : "text-right tabular-nums text-foreground"}>
        {value}
      </span>
    </div>
  );
}
