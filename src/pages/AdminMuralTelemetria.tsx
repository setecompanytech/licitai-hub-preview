import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";

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
  info: <CheckCircle2 className="h-4 w-4 text-success" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  error: <AlertOctagon className="h-4 w-4 text-destructive" />,
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

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [horas]);

  const taxaDivergencia = data && data.total_buscas > 0
    ? Math.round((data.com_divergencia / data.total_buscas) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Telemetria do Mural</h1>
            <p className="text-sm text-muted-foreground">
              Consistência entre totais reportados (live/cache) e quantidade efetivamente exibida.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(horas)} onValueChange={(v) => setHoras(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Última 1h</SelectItem>
                <SelectItem value="6">Últimas 6h</SelectItem>
                <SelectItem value="24">Últimas 24h</SelectItem>
                <SelectItem value="72">Últimas 72h</SelectItem>
                <SelectItem value="168">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
              <RefreshCw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Buscas registradas</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{data?.total_buscas ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Com divergência</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{data?.com_divergencia ?? 0}</p>
              <p className="text-xs text-muted-foreground">{taxaDivergencia}% do total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Média de duplicatas</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{data?.media_duplicatas ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Duração média</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{data?.media_duracao_ms ?? 0} ms</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Por severidade</CardTitle></CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              {data?.por_severidade
                ? Object.entries(data.por_severidade).map(([k, v]) => (
                    <Badge key={k} variant={k === "error" ? "destructive" : k === "warning" ? "secondary" : "outline"} className="gap-1">
                      {SEV_ICON[k]} {k}: {v}
                    </Badge>
                  ))
                : <span className="text-sm text-muted-foreground">Sem dados.</span>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Por fonte</CardTitle></CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              {data?.por_fonte
                ? Object.entries(data.por_fonte).map(([k, v]) => (
                    <Badge key={k} variant="outline">{k}: {v}</Badge>
                  ))
                : <span className="text-sm text-muted-foreground">Sem dados.</span>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Top discrepâncias recentes</CardTitle></CardHeader>
          <CardContent>
            {!data?.top_divergencias?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma discrepância no período.</p>
            ) : (
              <div className="overflow-x-auto">
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
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.fonte}</Badge></TableCell>
                        <TableCell className="text-right">{row.total_somado}</TableCell>
                        <TableCell className="text-right">{row.total_recebido}</TableCell>
                        <TableCell className="text-right">{row.total_unico}</TableCell>
                        <TableCell className="text-right font-medium">{row.total_final}</TableCell>
                        <TableCell className="text-xs">
                          {Object.entries(row.divergencias || {}).map(([k, v]) => (
                            <div key={k}><span className="text-muted-foreground">{k}:</span> {v}</div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.severidade === "error" ? "destructive" : row.severidade === "warning" ? "secondary" : "outline"} className="gap-1">
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
