/**
 * FinQuadroOmie — Quadro Financeiro estilo Omie (9 cards principais).
 *
 * Implementa o "Modelo Omie" da especificação INTERFACE FINANCEIRO 2 (seção 1):
 *   1. Clientes & Fornecedores  2. Contas a Pagar     3. Contas a Receber
 *   4. Contas Correntes         5. Previsto x Realizado  6. Atividades dos Usuários
 *   7. Comissão de Vendas       8. Movimentação Financeira (12m)  9. Meus Relatórios
 *
 * Cada card mostra um resumo numérico em tempo real e um CTA "+ Incluir" / "Abrir"
 * que dispara navegação programática via window event "fin:navigate".
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users, ArrowUpCircle, ArrowDownCircle, Wallet, Target,
  Activity, Receipt, BarChart3, FileDown, Plus, ChevronRight,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";

function navegar(view: string) {
  window.dispatchEvent(new CustomEvent("fin:navigate", { detail: view }));
}

const MESES_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function useQuadroOmie() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-quadro-omie", empresaId],
    enabled: !!empresaId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date();
      const ini12m = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 10);

      const [pessoasRes, lancsRes, contasRes, comissoesRes] = await Promise.all([
        supabase.from("financeiro_pessoas").select("id, tipo").eq("empresa_id", empresaId!).eq("ativo", true),
        supabase.from("financeiro_lancamentos")
          .select("tipo, status, valor, data_competencia, data_vencimento")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", ini12m),
        supabase.from("financeiro_contas").select("id, nome, saldo_atual, ativa").eq("empresa_id", empresaId!).eq("ativa", true),
        supabase.from("financeiro_comissoes_calculadas").select("valor, status").eq("empresa_id", empresaId!).limit(1000),
      ]);

      const pessoas = pessoasRes.data ?? [];
      const lancs = lancsRes.data ?? [];
      const contas = contasRes.data ?? [];
      const comissoes = comissoesRes.data ?? [];

      const clientes = pessoas.filter((p) => p.tipo === "cliente" || p.tipo === "ambos").length;
      const fornecedores = pessoas.filter((p) => p.tipo === "fornecedor" || p.tipo === "ambos").length;

      const aPagar = lancs.filter((l) => l.tipo === "a_pagar" && ["previsto", "em_atraso"].includes(l.status as string));
      const aReceber = lancs.filter((l) => l.tipo === "a_receber" && ["previsto", "em_atraso"].includes(l.status as string));
      const totalPagar = aPagar.reduce((s, l) => s + Number(l.valor), 0);
      const totalReceber = aReceber.reduce((s, l) => s + Number(l.valor), 0);
      const atrasoPagar = aPagar.filter((l) => l.status === "em_atraso").reduce((s, l) => s + Number(l.valor), 0);
      const atrasoReceber = aReceber.filter((l) => l.status === "em_atraso").reduce((s, l) => s + Number(l.valor), 0);

      const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);

      // Movimentação 12 meses (entradas vs saídas realizadas)
      const movMap = new Map<string, { mes: string; entradas: number; saidas: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        movMap.set(key, { mes: MESES_CURTO[d.getMonth()], entradas: 0, saidas: 0 });
      }
      lancs.forEach((l) => {
        if (!["realizado", "conciliado"].includes(l.status as string)) return;
        const key = String(l.data_competencia).slice(0, 7);
        const m = movMap.get(key);
        if (!m) return;
        if (l.tipo === "a_receber") m.entradas += Number(l.valor);
        else m.saidas += Number(l.valor);
      });
      const movimentacao = Array.from(movMap.values());

      // Previsto x Realizado do mês corrente
      const mesAtual = hoje.toISOString().slice(0, 7);
      const noMes = lancs.filter((l) => String(l.data_competencia).slice(0, 7) === mesAtual);
      const previstoReceitas = noMes.filter((l) => l.tipo === "a_receber").reduce((s, l) => s + Number(l.valor), 0);
      const realizadoReceitas = noMes.filter((l) => l.tipo === "a_receber" && ["realizado", "conciliado"].includes(l.status as string)).reduce((s, l) => s + Number(l.valor), 0);
      const previstoDespesas = noMes.filter((l) => l.tipo === "a_pagar").reduce((s, l) => s + Number(l.valor), 0);
      const realizadoDespesas = noMes.filter((l) => l.tipo === "a_pagar" && ["realizado", "conciliado"].includes(l.status as string)).reduce((s, l) => s + Number(l.valor), 0);

      const comissoesAbertas = comissoes.filter((c) => c.status !== "paga").reduce((s, c) => s + Number(c.valor ?? 0), 0);

      // Atividades hoje (audit log)
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
      const { count: atividadesHoje } = await supabase
        .from("financeiro_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .gte("created_at", inicioHoje.toISOString());

      return {
        clientes, fornecedores,
        cp: { qtd: aPagar.length, total: totalPagar, atraso: atrasoPagar },
        cr: { qtd: aReceber.length, total: totalReceber, atraso: atrasoReceber },
        contas: { qtd: contas.length, saldo: saldoTotal, lista: contas.slice(0, 4) },
        previstoXrealizado: { previstoReceitas, realizadoReceitas, previstoDespesas, realizadoDespesas },
        atividadesHoje: atividadesHoje ?? 0,
        comissoesAbertas,
        movimentacao,
      };
    },
  });
}

export default function FinQuadroOmie() {
  const { data, isLoading } = useQuadroOmie();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Visão consolidada inspirada no modelo Omie · atualização automática a cada 60s
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Clientes & Fornecedores */}
        <CardOmie title="Clientes e Fornecedores" icon={Users} onOpen={() => navegar("pessoas")} cta="Incluir">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-2xl font-semibold tabular-nums">{data.clientes}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Clientes</div>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-2xl font-semibold tabular-nums">{data.fornecedores}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedores</div>
            </div>
          </div>
        </CardOmie>

        {/* 2. Contas a Pagar */}
        <CardOmie title="Contas a Pagar" icon={ArrowUpCircle} tone="danger" onOpen={() => navegar("a_pagar")} cta="Incluir">
          <div className="space-y-1">
            <div className="text-2xl font-semibold tabular-nums text-destructive">{formatBRL(data.cp.total)}</div>
            <div className="text-xs text-muted-foreground">{data.cp.qtd} conta(s) em aberto</div>
            {data.cp.atraso > 0 && (
              <Badge variant="destructive" className="text-xs mt-1">Em atraso: {formatBRL(data.cp.atraso)}</Badge>
            )}
          </div>
        </CardOmie>

        {/* 3. Contas a Receber */}
        <CardOmie title="Contas a Receber" icon={ArrowDownCircle} tone="success" onOpen={() => navegar("a_receber")} cta="Incluir">
          <div className="space-y-1">
            <div className="text-2xl font-semibold tabular-nums text-success">{formatBRL(data.cr.total)}</div>
            <div className="text-xs text-muted-foreground">{data.cr.qtd} conta(s) em aberto</div>
            {data.cr.atraso > 0 && (
              <Badge variant="outline" className="text-xs mt-1 border-warning text-warning">Em atraso: {formatBRL(data.cr.atraso)}</Badge>
            )}
          </div>
        </CardOmie>

        {/* 4. Contas Correntes */}
        <CardOmie title="Contas Correntes" icon={Wallet} onOpen={() => navegar("contas")} cta="Incluir">
          <div className="space-y-1">
            <div className="text-2xl font-semibold tabular-nums">{formatBRL(data.contas.saldo)}</div>
            <div className="text-xs text-muted-foreground">{data.contas.qtd} conta(s) ativas</div>
            {data.contas.lista.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {data.contas.lista.map((c: any) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.nome}</span>
                    <span className="tabular-nums shrink-0">{formatBRL(Number(c.saldo_atual ?? 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardOmie>

        {/* 5. Previsto x Realizado */}
        <CardOmie title="Previsto x Realizado" icon={Target} onOpen={() => navegar("previsto_realizado")}>
          <div className="space-y-2 text-xs">
            <Linha label="Receitas previstas" valor={data.previstoXrealizado.previstoReceitas} />
            <Linha label="Receitas realizadas" valor={data.previstoXrealizado.realizadoReceitas} tone="success" />
            <Linha label="Despesas previstas" valor={data.previstoXrealizado.previstoDespesas} />
            <Linha label="Despesas realizadas" valor={data.previstoXrealizado.realizadoDespesas} tone="danger" />
          </div>
        </CardOmie>

        {/* 6. Atividade dos Usuários */}
        <CardOmie title="Atividades dos Usuários" icon={Activity} onOpen={() => navegar("atividade_usuarios")}>
          <div className="space-y-1">
            <div className="text-2xl font-semibold tabular-nums">{data.atividadesHoje}</div>
            <div className="text-xs text-muted-foreground">eventos registrados hoje</div>
            <div className="text-xs text-muted-foreground mt-1">Inclusões, alterações e exclusões em lançamentos, contas e cadastros.</div>
          </div>
        </CardOmie>

        {/* 7. Comissão de Vendas */}
        <CardOmie title="Comissão de Vendas" icon={Receipt} onOpen={() => navegar("comissoes")}>
          <div className="space-y-1">
            <div className="text-2xl font-semibold tabular-nums">{formatBRL(data.comissoesAbertas)}</div>
            <div className="text-xs text-muted-foreground">a pagar a vendedores</div>
            <div className="text-xs text-muted-foreground mt-1">Quitação automática via NF-e Financeiro.</div>
          </div>
        </CardOmie>

        {/* 8. Movimentação Financeira (12 meses) */}
        <CardOmie title="Movimentação Financeira (12 meses)" icon={BarChart3} onOpen={() => navegar("fluxo_caixa")} className="lg:col-span-2">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.movimentacao} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardOmie>

        {/* 9. Meus Relatórios */}
        <CardOmie title="Meus Relatórios" icon={FileDown} onOpen={() => navegar("relatorios")}>
          <div className="space-y-1.5 text-xs">
            <button onClick={() => navegar("resumo_exec")} className="block w-full text-left hover:text-primary transition-colors">→ Resumo Executivo</button>
            <button onClick={() => navegar("dre")} className="block w-full text-left hover:text-primary transition-colors">→ DRE</button>
            <button onClick={() => navegar("fluxo_caixa")} className="block w-full text-left hover:text-primary transition-colors">→ Fluxo de Caixa</button>
            <button onClick={() => navegar("atividade_usuarios")} className="block w-full text-left hover:text-primary transition-colors">→ Atividades dos Usuários</button>
          </div>
        </CardOmie>
      </div>
    </div>
  );
}

function CardOmie({
  title, icon: Icon, children, onOpen, cta = "Abrir", tone, className,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onOpen: () => void;
  cta?: string;
  tone?: "success" | "danger";
  className?: string;
}) {
  const accent = tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : "text-muted-foreground";
  return (
    <Card className={`group hover:shadow-md transition-shadow ${className ?? ""}`}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
            <h3 className="text-sm font-semibold truncate">{title}</h3>
          </div>
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={onOpen}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex-1">{children}</div>
        <div className="mt-3 pt-2 border-t flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onOpen}>
            {cta === "Incluir" ? <><Plus className="w-3 h-3 mr-1" /> Incluir</> : <>Abrir <ChevronRight className="w-3 h-3 ml-0.5" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ label, valor, tone }: { label: string; valor: number; tone?: "success" | "danger" }) {
  const cor = tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`tabular-nums font-medium ${cor} shrink-0`}>{formatBRL(valor)}</span>
    </div>
  );
}
