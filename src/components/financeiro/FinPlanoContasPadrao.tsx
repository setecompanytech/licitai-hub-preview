// FinPlanoContasPadrao — Fase 4
// Cria plano de contas padrão (31 contas, 5 grupos, 2 níveis) com 1 clique.
// Coexiste com FinPlanoContas (legado financeiro_plano_contas).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Loader2, FolderTree, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PC {
  id: string; codigo: string; nome: string; tipo: string; natureza: string;
  nivel: number; pai_id: string | null; aceita_lancamentos: boolean; ativo: boolean;
}

const TIPO_COLOR: Record<string, string> = {
  receita: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  custo: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  despesa: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  imposto: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export default function FinPlanoContasPadrao() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [contas, setContas] = useState<PC[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_plano_contas" as any)
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("codigo");
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setContas((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [empresaAtiva?.id]);

  const seed = async () => {
    if (!empresaAtiva) return;
    setSeeding(true);
    try {
      const { data, error } = await supabase.rpc("fin_seed_plano_contas_padrao" as any, {
        p_empresa_id: empresaAtiva.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.status === "ja_existe") {
        toast({ title: "Plano já existe", description: `${result.total} contas já cadastradas.` });
      } else {
        toast({ title: "Plano criado", description: `${result.total} contas padrão importadas.` });
      }
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const grupos = contas.filter((c) => c.nivel === 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" /> Plano de Contas (Configurável)
            </CardTitle>
            <CardDescription>
              Estrutura hierárquica padrão (31 contas em 5 grupos). Você pode editar, expandir ou criar contas adicionais por empresa.
            </CardDescription>
          </div>
          {contas.length === 0 && !loading && (
            <Button onClick={seed} disabled={seeding} className="shrink-0">
              {seeding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Importar plano padrão
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : contas.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum plano de contas configurado. Clique em <b>Importar plano padrão</b> para criar 31 contas pré-definidas (Receitas, Custos, Despesas Operacionais, Despesas Financeiras e Impostos). Você pode editar livremente depois.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  Plano ativo: <b>{contas.length} contas</b> em {grupos.length} grupos. Edição granular disponível em Plano de Contas (legado).
                </AlertDescription>
              </Alert>
              {grupos.map((grupo) => {
                const filhos = contas.filter((c) => c.pai_id === grupo.id);
                return (
                  <div key={grupo.id} className="border border-border/50 rounded-lg p-3 bg-card/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{grupo.codigo}</span>
                        <span className="font-medium">{grupo.nome}</span>
                        <Badge variant="outline" className={TIPO_COLOR[grupo.tipo] || ""}>
                          {grupo.tipo}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{filhos.length} subcontas</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-4">
                      {filhos.map((f) => (
                        <div key={f.id} className="text-xs flex items-center gap-2 py-0.5">
                          <span className="font-mono text-muted-foreground w-12 shrink-0">{f.codigo}</span>
                          <span className="truncate">{f.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
