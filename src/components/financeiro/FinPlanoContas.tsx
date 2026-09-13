import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { ChevronRight, ChevronDown, Sparkles, Loader2, FolderTree, Plus } from "lucide-react";
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

/** Natureza da conta na paleta semântica em tinta do Badge (identidade 12/09). */
type VarianteBadge = "success" | "warning" | "danger" | "info" | "muted";

const NATUREZA_VARIANT: Record<string, VarianteBadge> = {
  ativo: "info",
  passivo: "warning",
  pl: "muted",
  receita: "success",
  despesa: "danger",
  custo: "warning",
  apuracao: "muted",
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
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/40"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {tem ? (
            <button
              type="button"
              onClick={() => toggle(conta.id)}
              aria-expanded={aberto}
              aria-label={`${aberto ? "Recolher" : "Expandir"} ${conta.nome}`}
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {aberto ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-4" aria-hidden="true" />
          )}
          <code className="min-w-[4.25rem] font-mono text-xs text-muted-foreground">{conta.codigo}</code>
          <span className={conta.tipo_conta === "sintetica" ? "font-medium text-foreground" : "text-foreground"}>{conta.nome}</span>
          <Badge variant={NATUREZA_VARIANT[conta.natureza] ?? "muted"}>
            {NATUREZA_LABEL[conta.natureza] || conta.natureza}
          </Badge>
          <Badge variant="muted">
            {conta.natureza_saldo === "D" ? "Devedora" : "Credora"}
          </Badge>
          {conta.aceita_lancamento && <Badge variant="info">Analítica</Badge>}
          {conta.conta_referencial_sped && (
            <span className="ml-auto whitespace-nowrap font-mono text-xs text-muted-foreground">SPED {conta.conta_referencial_sped}</span>
          )}
        </div>
        {aberto && tem && <div>{filhos.map((f) => renderNo(f, depth + 1))}</div>}
      </div>
    );
  };

  if (!empresaAtiva) return null;

  const vazio = contas.length === 0 && !loading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={aplicarSeed} disabled={seeding || loading}>
          {seeding ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          Importar plano padrão PME
        </Button>
        <Button variant="outline" disabled title="Cadastro manual de conta — em breve">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nova conta
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Estrutura contábil compatível com SPED ECF (NBC TG 1000 / ITG 2000). Apenas contas analíticas aceitam
            lançamentos.
          </p>

          <div className="space-y-2">
            <Label htmlFor="plano-contas-busca">Buscar conta</Label>
            <Input
              id="plano-contas-busca"
              placeholder="Código, nome ou conta referencial SPED…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Carregando contas…
              </p>
            ) : vazio ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<FolderTree aria-hidden="true" />}
                titulo="Nenhuma conta cadastrada"
                descricao="Importe o plano padrão PME para popular ~120 contas alinhadas ao SPED ECF (receitas, custos, despesas e patrimoniais)."
                acao={
                  <Button onClick={aplicarSeed} disabled={seeding}>
                    {seeding ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    )}
                    Importar plano padrão PME
                  </Button>
                }
              />
            ) : filtrados ? (
              <div className="divide-y divide-border">
                {filtrados.length === 0 ? (
                  <EstadoVazio
                    tamanho="compacto"
                    icone={<FolderTree aria-hidden="true" />}
                    titulo="Nenhuma conta encontrada"
                    descricao="Nenhuma conta bate com o texto buscado. Revise o código, o nome ou a conta referencial SPED."
                  />
                ) : (
                  filtrados.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <code className="min-w-[4.25rem] font-mono text-xs text-muted-foreground">{c.codigo}</code>
                      <span className={c.tipo_conta === "sintetica" ? "font-medium text-foreground" : "text-foreground"}>
                        {c.nome}
                      </span>
                      <Badge variant={NATUREZA_VARIANT[c.natureza] ?? "muted"}>
                        {NATUREZA_LABEL[c.natureza] || c.natureza}
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
            <strong className="font-semibold text-foreground tabular-nums">{contas.length}</strong> contas · Analíticas:{" "}
            <span className="tabular-nums">{contas.filter((c) => c.aceita_lancamento).length}</span> · Sintéticas:{" "}
            <span className="tabular-nums">{contas.filter((c) => c.tipo_conta === "sintetica").length}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
