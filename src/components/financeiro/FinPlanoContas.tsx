import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronRight, ChevronDown, Search, Sparkles, Loader2, FolderTree, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Conta {
  id: string;
  codigo: string;
  nivel: number;
  natureza: string;
  natureza_saldo: "D" | "C";
  tipo_conta: "sintetica" | "analitica";
  parent_id: string | null;
  nome: string;
  conta_referencial_sped: string | null;
  aceita_lancamento: boolean;
  ativo: boolean;
  ordem: number;
}

const NATUREZA_LABEL: Record<string, string> = {
  ativo: "Ativo",
  passivo: "Passivo",
  pl: "Patrimônio Líquido",
  receita: "Receita",
  despesa: "Despesa",
  custo: "Custo",
  apuracao: "Apuração",
};

const NATUREZA_COLOR: Record<string, string> = {
  ativo: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  passivo: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  pl: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  receita: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  despesa: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  custo: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  apuracao: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function FinPlanoContas() {
  const { empresaAtiva } = useEmpresa();
  const { toast } = useToast();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const carregar = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("financeiro_plano_contas" as any)
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("codigo", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar plano de contas", description: error.message, variant: "destructive" });
    } else {
      setContas((data || []) as any);
      // Expandir nível 1 e 2 por padrão
      const exp = new Set<string>();
      (data || []).forEach((c: any) => {
        if (c.nivel <= 2) exp.add(c.id);
      });
      setExpandidos(exp);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [empresaAtiva?.id]);

  const aplicarSeed = async () => {
    if (!empresaAtiva) return;
    if (!confirm("Importar Plano de Contas Padrão PME (~120 contas alinhadas SPED ECF)?\n\nContas existentes não serão duplicadas. Esta ação é segura.")) return;
    setSeeding(true);
    const { data, error } = await supabase.rpc("financeiro_seed_plano_contas_pme" as any, {
      p_empresa_id: empresaAtiva.id,
    });
    setSeeding(false);
    if (error) {
      toast({ title: "Erro ao aplicar seed", description: error.message, variant: "destructive" });
    } else {
      const r = data as any;
      toast({
        title: "Plano de contas atualizado",
        description: `${r?.inseridas || 0} contas inseridas. Total na empresa: ${r?.total_apos || 0}.`,
      });
      carregar();
    }
  };

  // Árvore: agrupa por parent_id
  const filhosDe = useMemo(() => {
    const map = new Map<string | null, Conta[]>();
    contas.forEach((c) => {
      const k = c.parent_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return map;
  }, [contas]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return null;
    const q = busca.toLowerCase().trim();
    return contas.filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        (c.conta_referencial_sped || "").toLowerCase().includes(q),
    );
  }, [busca, contas]);

  const toggle = (id: string) => {
    const novo = new Set(expandidos);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setExpandidos(novo);
  };

  const renderNo = (conta: Conta, depth: number = 0): JSX.Element => {
    const filhos = filhosDe.get(conta.id) || [];
    const aberto = expandidos.has(conta.id);
    const tem = filhos.length > 0;

    return (
      <div key={conta.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/40 text-sm transition-colors"
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          {tem ? (
            <button onClick={() => toggle(conta.id)} className="text-muted-foreground hover:text-foreground">
              {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}
          <code className="text-xs font-mono text-muted-foreground min-w-[68px]">{conta.codigo}</code>
          <span className={conta.tipo_conta === "sintetica" ? "font-medium" : ""}>{conta.nome}</span>
          <Badge variant="outline" className={`text-xs ${NATUREZA_COLOR[conta.natureza] || ""}`}>
            {NATUREZA_LABEL[conta.natureza] || conta.natureza}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {conta.natureza_saldo === "D" ? "Devedora" : "Credora"}
          </Badge>
          {conta.aceita_lancamento && (
            <Badge variant="secondary" className="text-xs">
              Analítica
            </Badge>
          )}
          {conta.conta_referencial_sped && (
            <span className="text-xs text-muted-foreground ml-auto font-mono">SPED {conta.conta_referencial_sped}</span>
          )}
        </div>
        {aberto && tem && <div>{filhos.map((f) => renderNo(f, depth + 1))}</div>}
      </div>
    );
  };

  if (!empresaAtiva) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              Plano de Contas Hierárquico
            </CardTitle>
            <CardDescription>
              Estrutura contábil compatível com SPED ECF (NBC TG 1000 / ITG 2000). Apenas contas analíticas aceitam
              lançamentos.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={aplicarSeed} disabled={seeding || loading} variant="default">
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Importar Plano Padrão PME
            </Button>
            <Button variant="outline" disabled>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contas.length === 0 && !loading && (
          <Alert>
            <Sparkles className="w-4 h-4" />
            <AlertDescription>
              Nenhuma conta cadastrada. Use <strong>Importar Plano Padrão PME</strong> para popular ~120 contas alinhadas
              SPED ECF (Receitas, Custos, Despesas e Patrimoniais).
            </AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nome ou SPED..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="border rounded-md max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Carregando contas...
            </div>
          ) : filtrados ? (
            <div className="divide-y">
              {filtrados.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</div>
              ) : (
                filtrados.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 px-3 text-sm">
                    <code className="text-xs font-mono text-muted-foreground min-w-[68px]">{c.codigo}</code>
                    <span className={c.tipo_conta === "sintetica" ? "font-medium" : ""}>{c.nome}</span>
                    <Badge variant="outline" className={`text-xs ${NATUREZA_COLOR[c.natureza] || ""}`}>
                      {NATUREZA_LABEL[c.natureza]}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-1">{(filhosDe.get(null) || []).map((c) => renderNo(c))}</div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>{contas.length}</strong> contas · Analíticas: {contas.filter((c) => c.aceita_lancamento).length} ·
          Sintéticas: {contas.filter((c) => c.tipo_conta === "sintetica").length}
        </p>
      </CardContent>
    </Card>
  );
}
