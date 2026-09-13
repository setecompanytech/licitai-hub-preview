// FinAuditoriaConciliacao — Fase 3
// Histórico reversível de conciliações (auto, manual, IA) com 1-clique para reverter.
import { useEffect, useState, type ElementType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Undo2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import EstadoVazio from "@/components/shared/EstadoVazio";
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

/** Cada ação vira um Badge da família semântica — a cor reforça, o texto informa. */
const ACAO_LABEL: Record<string, { label: string; variant: BadgeProps["variant"]; icon: ElementType }> = {
  auto_match: { label: "Auto", variant: "success", icon: ShieldCheck },
  manual_match: { label: "Manual", variant: "info", icon: History },
  ai_suggestion: { label: "IA", variant: "muted", icon: Sparkles },
  revert: { label: "Revertido", variant: "danger", icon: Undo2 },
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
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando histórico…
            </div>
          ) : logs.length === 0 ? (
            <EstadoVazio
              icone={<History />}
              titulo="Nenhuma conciliação registrada ainda"
              descricao="Assim que um movimento for conciliado — por regra, à mão ou por IA — o histórico reversível aparece aqui"
            />
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
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className="w-3 h-3" /> {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{log.metodo}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {log.confianca ? `${log.confianca.toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={log.detalhes?.justificativa_ia || log.detalhes?.motivo || undefined}>
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
                            {revertendo === log.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
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
