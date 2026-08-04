// FinAuditoriaConciliacao — Fase 3
// Histórico reversível de conciliações (auto, manual, IA) com 1-clique para reverter.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Undo2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LogRow {
  id: string;
  movimento_id: string | null;
  lancamento_id: string | null;
  acao: string;
  confianca: number | null;
  metodo: string;
  detalhes: any;
  revertido: boolean;
  revertido_em: string | null;
  created_at: string;
}

const ACAO_LABEL: Record<string, { label: string; tone: string; icon: any }> = {
  auto_match: { label: "Auto", tone: "bg-success/15 text-success border-success/30", icon: ShieldCheck },
  manual_match: { label: "Manual", tone: "bg-info/15 text-info border-info/30", icon: History },
  ai_suggestion: { label: "IA", tone: "bg-muted text-muted-foreground border-border", icon: Sparkles },
  revert: { label: "Revertido", tone: "bg-destructive/15 text-destructive border-destructive/30", icon: Undo2 },
};

export default function FinAuditoriaConciliacao() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertendo, setRevertendo] = useState<string | null>(null);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_conciliacao_log" as any)
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setLogs((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id]);

  const reverter = async (log: LogRow) => {
    if (log.revertido) return;
    if (!confirm("Reverter esta conciliação? O lançamento volta a 'previsto' e o movimento bancário fica disponível para nova conciliação.")) return;
    setRevertendo(log.id);
    try {
      // Busca a conciliação correspondente para passar o ID
      const { data: conc } = await supabase
        .from("financeiro_conciliacoes" as any)
        .select("id")
        .eq("extrato_movimento_id", log.movimento_id || "")
        .eq("lancamento_id", log.lancamento_id || "")
        .maybeSingle();
      if (!conc) {
        toast({ title: "Já revertido", description: "Esta conciliação não está mais ativa." });
        await carregar();
        return;
      }
      const { error } = await supabase.functions.invoke("fin-conciliacao-reversao", {
        body: { conciliacao_id: (conc as any).id, motivo: "Reversão manual via auditoria" },
      });
      if (error) throw error;
      toast({ title: "Conciliação revertida", description: "Movimento e lançamento liberados." });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao reverter", description: e.message, variant: "destructive" });
    } finally {
      setRevertendo(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Auditoria de Conciliação
          </CardTitle>
          <CardDescription>
            Histórico completo de conciliações automáticas e manuais. Auto-conciliações ocorrem com confiança ≥ 90%; demais ficam para revisão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conciliação registrada ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Confiança</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="text-right">Operação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const meta = ACAO_LABEL[log.acao] || ACAO_LABEL.manual_match;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${meta.tone} gap-1`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{log.metodo}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.confianca ? `${log.confianca.toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {log.detalhes?.justificativa_ia || log.detalhes?.motivo || JSON.stringify(log.detalhes).slice(0, 80)}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.acao !== "revert" && !log.revertido && (
                          <Button
                            variant="ghost" size="sm"
                            disabled={revertendo === log.id}
                            onClick={() => reverter(log)}
                            className="shrink-0"
                          >
                            {revertendo === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3 mr-1" />}
                            Reverter
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
    </div>
  );
}
