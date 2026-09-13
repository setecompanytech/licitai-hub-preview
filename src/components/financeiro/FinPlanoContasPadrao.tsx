// FinPlanoContasPadrao — Fase 4
// Cria plano de contas padrão (31 contas, 5 grupos, 2 níveis) com 1 clique.
// Coexiste com FinPlanoContas (legado financeiro_plano_contas).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Sparkles, Loader2, FolderTree, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSyncPlanoContasCategorias } from "@/hooks/useFinanceiro";

interface PC {
  id: string; codigo: string; nome: string; tipo: string; natureza: string;
  nivel: number; pai_id: string | null; aceita_lancamentos: boolean; ativo: boolean;
}

/** Tipo do grupo na paleta semântica em tinta do Badge (identidade 12/09). */
type VarianteBadge = "success" | "warning" | "danger" | "info" | "muted";

const TIPO_VARIANT: Record<string, VarianteBadge> = {
  receita: "success",
  custo: "warning",
  despesa: "danger",
  imposto: "info",
};

export default function FinPlanoContasPadrao() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [contas, setContas] = useState<PC[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const syncCategorias = useSyncPlanoContasCategorias();

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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {contas.length > 0 && (
          <Button
            variant="outline"
            onClick={() => syncCategorias.mutate()}
            disabled={syncCategorias.isPending}
            title="Copia todas as contas deste plano para a lista de Categorias usada em Contas a Pagar/Receber"
          >
            {syncCategorias.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            Sincronizar com Categorias
          </Button>
        )}
        {contas.length === 0 && !loading && (
          <Button onClick={seed} disabled={seeding}>
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            Importar plano padrão
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Estrutura hierárquica padrão (31 contas em 5 grupos). Você pode editar, expandir ou criar contas adicionais
            por empresa.
          </p>

          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              Carregando plano de contas…
            </p>
          ) : contas.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<FolderTree aria-hidden="true" />}
              titulo="Nenhum plano de contas configurado"
              descricao="Importe o plano padrão para criar 31 contas pré-definidas (receitas, custos, despesas operacionais, despesas financeiras e impostos). Você pode editar livremente depois."
              acao={
                <Button onClick={seed} disabled={seeding}>
                  {seeding ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  Importar plano padrão
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <Alert variant="success">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <AlertDescription>
                  Plano ativo: <b>{contas.length} contas</b> em {grupos.length} grupos. Edição granular disponível em
                  Plano de Contas (legado).
                </AlertDescription>
              </Alert>
              {grupos.map((grupo) => {
                const filhos = contas.filter((c) => c.pai_id === grupo.id);
                return (
                  <section key={grupo.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{grupo.codigo}</span>
                        <span className="text-base font-semibold text-foreground">{grupo.nome}</span>
                        <Badge variant={TIPO_VARIANT[grupo.tipo] ?? "muted"} className="capitalize">
                          {grupo.tipo}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{filhos.length} subcontas</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {filhos.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{f.codigo}</span>
                          <span className="truncate text-foreground">{f.nome}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
