import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, Loader2 } from "lucide-react";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

// Regras de alçada por valor (configuráveis no futuro via tabela)
const ALCADAS = [
  { ate: 1000, papel: "Operacional", cor: "bg-info/10 text-info border-info/30" },
  { ate: 10000, papel: "Gerência", cor: "bg-warning/10 text-warning border-warning/30" },
  { ate: Infinity, papel: "Diretoria", cor: "bg-destructive/10 text-destructive border-destructive/30" },
];

function alcadaFor(valor: number) {
  return ALCADAS.find((a) => valor <= a.ate) ?? ALCADAS[ALCADAS.length - 1];
}

export default function FinAprovacoes() {
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["aprovacoes-pendentes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, data_vencimento, observacoes")
        .eq("empresa_id", empresaId!)
        .eq("tipo", "a_pagar")
        .eq("status", "previsto")
        .order("valor", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const totalPendente = useMemo(() => pendentes.reduce((a, b) => a + Number(b.valor), 0), [pendentes]);

  async function aprovar(id: string) {
    setActing(id);
    try {
      const { error } = await supabase.from("financeiro_lancamentos").update({
        observacoes: "✓ Aprovado em " + format(new Date(), "dd/MM/yyyy HH:mm"),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Pagamento aprovado.");
      qc.invalidateQueries({ queryKey: ["aprovacoes-pendentes"] });
    } catch (e) {
      toast.error("Não foi possível aprovar o pagamento", {
        description: e instanceof Error ? e.message : "Erro ao salvar no banco de dados. Verifique sua conexão e tente novamente.",
        duration: 6000,
      });
    } finally {
      setActing(null);
    }
  }

  async function rejeitar(id: string) {
    setActing(id);
    try {
      const { error } = await supabase.from("financeiro_lancamentos").update({
        status: "cancelado",
        observacoes: "✗ Rejeitado em " + format(new Date(), "dd/MM/yyyy HH:mm"),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Pagamento rejeitado.");
      qc.invalidateQueries({ queryKey: ["aprovacoes-pendentes"] });
    } catch (e) {
      toast.error("Não foi possível rejeitar o pagamento", {
        description: e instanceof Error ? e.message : "Erro ao salvar no banco de dados. Verifique sua conexão e tente novamente.",
        duration: 6000,
      });
    } finally {
      setActing(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-5 h-5 text-muted-foreground" /> Aprovação de Pagamentos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Workflow multi-nível com alçada por valor: até R$ 1.000 (Operacional) · até R$ 10.000 (Gerência) · acima (Diretoria).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
          <span className="text-sm">Pendente de aprovação:</span>
          <span className="font-semibold tabular-nums">
            {pendentes.length} · R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="rounded-md border max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></div>
          ) : pendentes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              ✓ Nenhum pagamento aguardando aprovação.
            </div>
          ) : (
            pendentes.map((l) => {
              const alc = alcadaFor(Number(l.valor));
              return (
                <div key={l.id} className="flex items-center gap-3 p-3 border-b">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{l.descricao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${alc.cor}`}>{alc.papel}</Badge>
                      {l.data_vencimento && (
                        <span className="text-xs text-muted-foreground">
                          Vence {format(new Date(l.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="tabular-nums font-semibold">
                    R$ {Number(l.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => rejeitar(l.id)} disabled={acting === l.id}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => aprovar(l.id)} disabled={acting === l.id}>
                      {acting === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
