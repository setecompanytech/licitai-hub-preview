import { useEffect, useMemo, useState } from "react";
import { hojeLocal, dataLocal } from "@/lib/financeiro/data-local";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
import ValorDeCartao from "./ValorDeCartao";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { formatBRL } from "@/lib/financeiro/formatters";

interface Resultado {
  receita: number;
  custo: number;
  despesa: number;
  liquido: number;
  rateado: number; // valor proveniente de rateios (informativo)
}

const today = () => hojeLocal();
const firstDayMonth = () => {
  const d = new Date();
  d.setDate(1);
  return dataLocal(d);
};

export default function FinDREporCentroCusto() {
  const { empresaAtiva } = useEmpresa();
  const { data: centros = [] } = useCentrosCusto(true);

  const [centroId, setCentroId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>(firstDayMonth());
  const [dataFim, setDataFim] = useState<string>(today());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (centros.length > 0 && !centroId) setCentroId(centros[0].id);
  }, [centros, centroId]);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      if (!empresaAtiva?.id || !centroId) return;
      setLoading(true);
      try {
        // 1) Lançamentos diretamente vinculados ao centro
        const { data: diretos } = await (supabase as any)
          .from("financeiro_lancamentos")
          .select("natureza, valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(grupo_dre)")
          .eq("empresa_id", empresaAtiva.id)
          .eq("centro_custo_id", centroId)
          // Transferência entre contas próprias vinha em duas pernas — uma de
          // natureza "receita", outra "despesa" — e entrava como faturamento E
          // como custo do centro. Mesma régua dos indicadores gerenciais.
          .in("tipo", ["a_receber", "a_pagar"])
          .in("status", ["realizado", "conciliado"])
          .gte("data_competencia", dataInicio)
          .lte("data_competencia", dataFim);

        // 2) Lançamentos rateados que incluem este centro
        const { data: rateios } = await (supabase as any)
          .from("fin_lancamento_rateios")
          .select("valor, financeiro_lancamentos!inner(natureza, tipo, status, data_competencia, empresa_id, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(grupo_dre))")
          .eq("centro_custo_id", centroId)
          .eq("financeiro_lancamentos.empresa_id", empresaAtiva.id)
          .in("financeiro_lancamentos.tipo", ["a_receber", "a_pagar"])
          .in("financeiro_lancamentos.status", ["realizado", "conciliado"])
          .gte("financeiro_lancamentos.data_competencia", dataInicio)
          .lte("financeiro_lancamentos.data_competencia", dataFim);

        let receita = 0, custo = 0, despesa = 0, rateado = 0;

        // A categoria nunca teve coluna `tipo` — quem separa CMV de despesa é
        // o `grupo_dre`, a mesma régua dos indicadores gerenciais e da
        // Calculadora de Margem. Pedir `tipo` derrubava a tela inteira.
        const aplicar = (natureza: string, grupo: string | undefined, v: number) => {
          if (natureza === "receita") {
            if (grupo !== "receita_financeira") receita += v;
          } else if (natureza === "despesa") {
            if (grupo === "cmv_cps") custo += v;
            else if (grupo !== "movimentacao") despesa += v;
          }
        };

        for (const l of diretos ?? []) {
          aplicar(l.natureza, l.categoria?.grupo_dre, Number(l.valor) || 0);
        }
        for (const r of rateios ?? []) {
          const v = Number(r.valor) || 0;
          rateado += v;
          aplicar(r.financeiro_lancamentos.natureza, r.financeiro_lancamentos.categoria?.grupo_dre, v);
        }

        if (!cancelado) {
          setResultado({ receita, custo, despesa, liquido: receita - custo - despesa, rateado });
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    carregar();
    return () => { cancelado = true; };
  }, [empresaAtiva?.id, centroId, dataInicio, dataFim]);

  const margem = useMemo(() => {
    if (!resultado || resultado.receita <= 0) return 0;
    return (resultado.liquido / resultado.receita) * 100;
  }, [resultado]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Análise por Centro de Custo
        </CardTitle>
        <CardDescription>
          Soma os lançamentos vinculados diretamente ao centro selecionado e a parcela rateada
          proveniente de outros lançamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dre-cc-centro">Centro de custo</Label>
            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger id="dre-cc-centro"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} · {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dre-cc-inicio">Início</Label>
            <Input id="dre-cc-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dre-cc-fim">Fim</Label>
            <Input id="dre-cc-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Calculando">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : resultado ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPI label="Receita" value={formatBRL(resultado.receita)} icone={TrendingUp} />
            <KPI label="(–) Custos" value={formatBRL(resultado.custo)} icone={ShoppingCart} muted />
            <KPI label="(–) Despesas" value={formatBRL(resultado.despesa)} icone={Receipt} muted />
            <KPI
              label="Resultado"
              value={formatBRL(resultado.liquido)}
              icone={Wallet}
              accent={resultado.liquido >= 0 ? "positive" : "negative"}
              hint={resultado.receita > 0 ? `Margem ${margem.toFixed(2)}%` : "Sem receita no centro: margem não se aplica"}
            />
            {/* Quatro zeros afirmam "este centro não custou nada"; o que há é
                ausência de vínculo. Dito com todas as letras (19/09). */}
            {resultado.receita === 0 && resultado.custo === 0 && resultado.despesa === 0 && resultado.rateado === 0 && (
              <p className="sm:col-span-2 lg:col-span-4 text-xs text-warning-ink">
                Nenhum lançamento vinculado a este centro de custo no período — nem direto, nem por rateio.
                O vínculo hoje é feito pelo rateio do lançamento (aba Rateio, em lançamentos já salvos).
              </p>
            )}
            {resultado.rateado > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <Badge variant="info">Rateio</Badge>
                <span className="tabular-nums">{formatBRL(resultado.rateado)} provenientes de lançamentos com rateio percentual.</span>
              </div>
            )}
          </div>
        ) : (
          <EstadoVazio icone={<FolderTree />} titulo="Selecione um centro de custo para iniciar." tamanho="compacto" />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Cartão KPI do Design System v3 (112px): rótulo em cima, ícone num ladrilho
 * tingido à direita, valor 28/36 que encolhe em vez de quebrar. Texto colorido
 * sempre na tinta `*-ink`, nunca na cor cheia sobre branco.
 */
function KPI({
  label, value, icone: Icone, muted, accent, hint,
}: { label: string; value: string; icone: React.ElementType; muted?: boolean; accent?: "positive" | "negative"; hint?: string }) {
  const accentClass =
    accent === "positive" ? "text-success-ink" :
    accent === "negative" ? "text-destructive-ink" : "text-foreground";
  const ladrilho =
    accent === "positive" ? "bg-success-tint text-success-ink" :
    accent === "negative" ? "bg-destructive-tint text-destructive-ink" : "bg-muted text-muted-foreground";
  return (
    <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ladrilho}`}>
          <Icone className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <ValorDeCartao valor={value} className={muted ? "text-muted-foreground" : accentClass} />
      {hint && <p className="text-xs leading-4 text-muted-foreground">{hint}</p>}
    </Card>
  );
}
