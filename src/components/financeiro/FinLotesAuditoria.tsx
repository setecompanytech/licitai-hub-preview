import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { ExternalLink, Search, RefreshCw, History } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar por descrição, job ou origem..."
            className="pl-9"
            aria-label="Buscar lote por descrição, job ou origem"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={rodarBackfill} disabled={running}>
          <RefreshCw className={running ? "animate-spin" : undefined} aria-hidden="true" />
          {running ? "Backfilling..." : "Backfill origem (lançamentos legados)"}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data</TableHead>
              <TableHead className="whitespace-nowrap">Origem</TableHead>
              <TableHead className="whitespace-nowrap">Job</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="whitespace-nowrap text-right">Registros</TableHead>
              <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : filtrados.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <EstadoVazio
                    icone={<History />}
                    titulo={busca ? "Nenhum lote para esta busca" : "Nenhum lote registrado ainda"}
                    descricao="Imports e seeds passam a registrar lote automaticamente."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((l) => (
                <TableRow key={l.id}>
                  <TableCell nowrap className="tabular-nums text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                  <TableCell nowrap>
                    <Badge variant="muted">{l.origem_tipo}</Badge>
                  </TableCell>
                  <TableCell nowrap className="text-muted-foreground">{l.job ?? "—"}</TableCell>
                  <TableCell truncate title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.total_registros ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(l.total_valor ?? 0))}</TableCell>
                  <TableCell nowrap className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/financeiro/lancamentos?lote=${l.id}`)}
                    >
                      <ExternalLink aria-hidden="true" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
