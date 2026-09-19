import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import CabecalhoPagina from "@/components/shared/CabecalhoPagina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle2, AlertOctagon, Activity } from "lucide-react";

type PainelData = {
  janela_horas: number;
  total_buscas: number;
  com_divergencia: number;
  por_severidade: Record<string, number> | null;
  por_fonte: Record<string, number> | null;
  media_duplicatas: number | null;
  media_duracao_ms: number | null;
  top_divergencias: Array<{
    created_at: string;
    fonte: string;
    total_somado: number;
    total_recebido: number;
    total_unico: number;
    total_final: number;
    divergencias: Record<string, number>;
    severidade: string;
  }> | null;
};

const SEV_ICON: Record<string, JSX.Element> = {
  info: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
  error: <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />,
};

/** Selo por severidade — o trio suave de cada estado. */
const SEV_BADGE: Record<string, "success" | "warning" | "danger"> = {
  info: "success",
  warning: "warning",
  error: "danger",
};

export default function AdminMuralTelemetria() {
  const [horas, setHoras] = useState<number>(24);
  const [data, setData] = useState<PainelData | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data: painel, error } = await supabase.rpc(
        "mural_telemetria_painel" as any,
        { p_horas: horas } as any,
      );
      if (error) throw error;
      setData(painel as unknown as PainelData);
    } catch (e) {
      console.error("[AdminMuralTelemetria] erro:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar();   }, [horas]);

  const taxaDivergencia = data && data.total_buscas > 0
    ? Math.round((data.com_divergencia / data.total_buscas) * 100)
    : 0;

  const kpis = [
    { rotulo: "Buscas registradas", valor: String(data?.total_buscas ?? 0) },
    { rotulo: "Com divergência", valor: String(data?.com_divergencia ?? 0), detalhe: `${taxaDivergencia}% do total` },
    { rotulo: "Média de duplicatas", valor: String(data?.media_duplicatas ?? 0) },
    { rotulo: "Duração média", valor: `${data?.media_duracao_ms ?? 0} ms` },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          titulo="Telemetria do Mural"
          descricao="Consistência entre totais reportados (live/cache) e quantidade efetivamente exibida."
          icone={<Activity />}
          acoes={
            <>
              <Select value={String(horas)} onValueChange={(v) => setHoras(Number(v))}>
                <SelectTrigger className="w-40" aria-label="Janela de tempo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Última 1h</SelectItem>
                  <SelectItem value="6">Últimas 6h</SelectItem>
                  <SelectItem value="24">Últimas 24h</SelectItem>
                  <SelectItem value="72">Últimas 72h</SelectItem>
                  <SelectItem value="168">Últimos 7 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={carregar} disabled={carregando}>
                <RefreshCw className={carregando ? "animate-spin" : ""} aria-hidden="true" />
                Atualizar
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
          {kpis.map((k) => (
            <div key={k.rotulo} className="flex min-h-[96px] flex-col justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <p className="truncate text-sm font-medium text-muted-foreground">{k.rotulo}</p>
              <div>
                <p className="text-2xl font-semibold leading-8 tabular-nums text-foreground">{k.valor}</p>
                {k.detalhe && <p className="text-xs text-muted-foreground">{k.detalhe}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Por severidade</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data?.por_severidade
                ? Object.entries(data.por_severidade).map(([k, v]) => (
                    <Badge key={k} variant={SEV_BADGE[k] ?? "muted"} className="gap-1">
                      {SEV_ICON[k]} {k}: {v}
                    </Badge>
                  ))
                : <span className="text-sm text-muted-foreground">Sem dados.</span>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Por fonte</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data?.por_fonte
                ? Object.entries(data.por_fonte).map(([k, v]) => (
                    <Badge key={k} variant="outline">{k}: {v}</Badge>
                  ))
                : <span className="text-sm text-muted-foreground">Sem dados.</span>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Top discrepâncias recentes</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!data?.top_divergencias?.length ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma discrepância no período.</p>
            ) : (
              <div className="overflow-x-auto border-t border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Somado</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Único</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead>Divergências</TableHead>
                      <TableHead>Severidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_divergencias.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.fonte}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_somado}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_recebido}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_unico}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{row.total_final}</TableCell>
                        <TableCell className="text-xs">
                          {Object.entries(row.divergencias || {}).map(([k, v]) => (
                            <div key={k}><span className="text-muted-foreground">{k}:</span> {v}</div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEV_BADGE[row.severidade] ?? "muted"} className="gap-1">
                            {SEV_ICON[row.severidade]} {row.severidade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
