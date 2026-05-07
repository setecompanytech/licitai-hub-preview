import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Search, RefreshCw } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/financeiro/formatters";
import { toast } from "sonner";

type Lote = {
  id: string;
  empresa_id: string;
  origem_tipo: string;
  job: string | null;
  descricao: string | null;
  usuario_id: string | null;
  total_registros: number | null;
  total_valor: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default function FinLotesAuditoria() {
  const empresaId = useEmpresaId();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [running, setRunning] = useState(false);

  const { data: lotes = [], isLoading, refetch } = useQuery({
    queryKey: ["fin-lotes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_origem_lotes")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lote[];
    },
  });

  const filtrados = lotes.filter((l) => {
    if (!busca) return true;
    const t = busca.toLowerCase();
    return (
      (l.descricao ?? "").toLowerCase().includes(t) ||
      (l.job ?? "").toLowerCase().includes(t) ||
      l.origem_tipo.toLowerCase().includes(t)
    );
  });

  async function rodarBackfill() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("fin-backfill-origem", {
        body: { batchSize: 5000 },
      });
      if (error) throw error;
      toast.success(`Backfill concluído: ${(data as any)?.total_atualizado ?? 0} registro(s) atualizados.`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar backfill");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Auditoria de Lotes — Origem dos Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, job ou origem..."
                className="pl-8"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={rodarBackfill} disabled={running}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${running ? "animate-spin" : ""}`} />
              {running ? "Backfilling..." : "Backfill origem (lançamentos legados)"}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Data</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Origem</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Job</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Registros</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Valor total</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
                  ))
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Nenhum lote registrado ainda. Imports e seeds passam a registrar lote automaticamente.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(l.created_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{l.origem_tipo}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{l.job ?? "—"}</td>
                      <td className="px-3 py-2 max-w-[420px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.total_registros ?? 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(Number(l.total_valor ?? 0))}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/financeiro?view=lancamentos&lote=${l.id}`)}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
