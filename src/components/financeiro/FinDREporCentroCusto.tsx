import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FolderTree } from "lucide-react";
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

const today = () => new Date().toISOString().slice(0, 10);
const firstDayMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
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
          .select("natureza, valor, financeiro_categorias(tipo)")
          .eq("empresa_id", empresaAtiva.id)
          .eq("centro_custo_id", centroId)
          .in("status", ["realizado", "conciliado"])
          .gte("data_competencia", dataInicio)
          .lte("data_competencia", dataFim);

        // 2) Lançamentos rateados que incluem este centro
        const { data: rateios } = await (supabase as any)
          .from("fin_lancamento_rateios")
          .select("valor, financeiro_lancamentos!inner(natureza, status, data_competencia, empresa_id, financeiro_categorias(tipo))")
          .eq("centro_custo_id", centroId)
          .eq("financeiro_lancamentos.empresa_id", empresaAtiva.id)
          .in("financeiro_lancamentos.status", ["realizado", "conciliado"])
          .gte("financeiro_lancamentos.data_competencia", dataInicio)
          .lte("financeiro_lancamentos.data_competencia", dataFim);

        let receita = 0, custo = 0, despesa = 0, rateado = 0;

        const aplicar = (natureza: string, tipoCat: string | undefined, v: number) => {
          if (natureza === "receita") receita += v;
          else if (natureza === "despesa") {
            if (tipoCat === "custo") custo += v;
            else despesa += v;
          }
        };

        for (const l of diretos ?? []) {
          aplicar(l.natureza, l.financeiro_categorias?.tipo, Number(l.valor) || 0);
        }
        for (const r of rateios ?? []) {
          const v = Number(r.valor) || 0;
          rateado += v;
          aplicar(r.financeiro_lancamentos.natureza, r.financeiro_lancamentos.financeiro_categorias?.tipo, v);
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
        <CardTitle className="text-base flex items-center gap-2">
          <FolderTree className="w-4 h-4" />
          Análise por Centro de Custo
        </CardTitle>
        <CardDescription>
          Soma os lançamentos vinculados diretamente ao centro selecionado e a parcela rateada
          proveniente de outros lançamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Centro de custo</Label>
            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} · {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Calculando…</p>
        ) : resultado ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <KPI label="Receita" value={formatBRL(resultado.receita)} />
            <KPI label="(–) Custos" value={formatBRL(resultado.custo)} muted />
            <KPI label="(–) Despesas" value={formatBRL(resultado.despesa)} muted />
            <KPI
              label="Resultado"
              value={formatBRL(resultado.liquido)}
              accent={resultado.liquido >= 0 ? "positive" : "negative"}
              hint={`Margem ${margem.toFixed(2)}%`}
            />
            {resultado.rateado > 0 && (
              <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-2">Rateio</Badge>
                {formatBRL(resultado.rateado)} provenientes de lançamentos com rateio percentual.
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um centro de custo para iniciar.</p>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({
  label, value, muted, accent, hint,
}: { label: string; value: string; muted?: boolean; accent?: "positive" | "negative"; hint?: string }) {
  const accentClass =
    accent === "positive" ? "text-emerald-600 dark:text-emerald-400" :
    accent === "negative" ? "text-destructive" : "";
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${muted ? "text-muted-foreground" : accentClass}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
