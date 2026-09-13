/**
 * FinQuadroOmie — Quadro Financeiro estilo Omie (9 cards principais).
 *
 * Implementa o "Modelo Omie" da especificação INTERFACE FINANCEIRO 2 (seção 1):
 *   1. Clientes & Fornecedores  2. Contas a Pagar     3. Contas a Receber
 *   4. Contas Correntes         5. Previsto x Realizado  6. Atividades dos Usuários
 *   7. Bonificação de Vendas       8. Movimentação Financeira (12m)  9. Meus Relatórios
 *
 * Cada card mostra um resumo numérico em tempo real e um CTA "+ Incluir" / "Abrir"
 * que dispara navegação programática via window event "fin:navigate".
 */
import { useQuery } from "@tanstack/react-query";
import { dataLocal, mesLocal } from '@/lib/financeiro/data-local';
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
      const ini12m = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));

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
        const key = dataLocal(d).slice(0, 7);
        movMap.set(key, { mes: MESES_CURTO[d.getMonth()], entradas: 0, saidas: 0 });
      }
      lancs.forEach((l) => {
        if (!["realizado", "conciliado"].includes(l.status as string)) return;
        const key = String(l.data_competencia).slice(0, 7);
        const m = movMap.get(key);
        if (!m) return;
        // Só título é entrada/saída de resultado: transferência própria e
        // movimento de extrato inflavam a barra vermelha em cada repasse.
        if (l.tipo === "a_receber") m.entradas += Number(l.valor);
        else if (l.tipo === "a_pagar") m.saidas += Number(l.valor);
      });
      const movimentacao = Array.from(movMap.values());

      // Previsto x Realizado do mês corrente
      const mesAtual = mesLocal(hoje);
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Visão consolidada inspirada no modelo Omie · atualização automática a cada 60s
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Clientes & Fornecedores */}
        <CardOmie title="Clientes e Fornecedores" icon={Users} onOpen={() => navegar("pessoas")} cta="Incluir">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md bg-muted p-3">
              <div className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{data.clientes}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Clientes</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{data.fornecedores}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedores</div>
            </div>
          </div>
        </CardOmie>

        {/* 2. Contas a Pagar */}
        <CardOmie title="Contas a Pagar" icon={ArrowUpCircle} tone="danger" onOpen={() => navegar("a_pagar")} cta="Incluir">
          <div className="space-y-2">
            <div className="text-[2rem] font-bold leading-10 tabular-nums text-destructive-ink">{formatBRL(data.cp.total)}</div>
            <div className="text-sm text-muted-foreground">{data.cp.qtd} conta(s) em aberto</div>
            {data.cp.atraso > 0 && (
              <Badge variant="danger">Em atraso: {formatBRL(data.cp.atraso)}</Badge>
            )}
          </div>
        </CardOmie>

        {/* 3. Contas a Receber */}
        <CardOmie title="Contas a Receber" icon={ArrowDownCircle} tone="success" onOpen={() => navegar("a_receber")} cta="Incluir">
          <div className="space-y-2">
            <div className="text-[2rem] font-bold leading-10 tabular-nums text-success-ink">{formatBRL(data.cr.total)}</div>
            <div className="text-sm text-muted-foreground">{data.cr.qtd} conta(s) em aberto</div>
            {data.cr.atraso > 0 && (
              <Badge variant="warning">Em atraso: {formatBRL(data.cr.atraso)}</Badge>
            )}
          </div>
        </CardOmie>

        {/* 4. Contas Correntes */}
        <CardOmie title="Contas Correntes" icon={Wallet} onOpen={() => navegar("contas")} cta="Incluir">
          <div className="space-y-2">
            <div className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{formatBRL(data.contas.saldo)}</div>
            <div className="text-sm text-muted-foreground">{data.contas.qtd} conta(s) ativas</div>
            {data.contas.lista.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.contas.lista.map((c: any) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{c.nome}</span>
                    <span className="shrink-0 tabular-nums">{formatBRL(Number(c.saldo_atual ?? 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardOmie>

        {/* 5. Previsto x Realizado */}
        <CardOmie title="Previsto x Realizado" icon={Target} onOpen={() => navegar("previsto_realizado")}>
          <div className="space-y-2 text-sm">
            <Linha label="Receitas previstas" valor={data.previstoXrealizado.previstoReceitas} />
            <Linha label="Receitas realizadas" valor={data.previstoXrealizado.realizadoReceitas} tone="success" />
            <Linha label="Despesas previstas" valor={data.previstoXrealizado.previstoDespesas} />
            <Linha label="Despesas realizadas" valor={data.previstoXrealizado.realizadoDespesas} tone="danger" />
          </div>
        </CardOmie>

        {/* 6. Atividade dos Usuários */}
        <CardOmie title="Atividades dos Usuários" icon={Activity} onOpen={() => navegar("atividade_usuarios")}>
          <div className="space-y-2">
            <div className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{data.atividadesHoje}</div>
            <div className="text-sm text-muted-foreground">eventos registrados hoje</div>
            <div className="text-sm text-muted-foreground">Inclusões, alterações e exclusões em lançamentos, contas e cadastros.</div>
          </div>
        </CardOmie>

        {/* 7. Bonificação de Vendas */}
        <CardOmie title="Bonificação de Vendas" icon={Receipt} onOpen={() => navegar("comissoes")}>
          <div className="space-y-2">
            <div className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{formatBRL(data.comissoesAbertas)}</div>
            <div className="text-sm text-muted-foreground">a pagar a vendedores</div>
            <div className="text-sm text-muted-foreground">Quitação automática via NF-e Financeiro.</div>
          </div>
        </CardOmie>

        {/* 8. Movimentação Financeira (12 meses) */}
        <CardOmie title="Movimentação Financeira (12 meses)" icon={BarChart3} onOpen={() => navegar("fluxo_caixa")} className="lg:col-span-2">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.movimentacao} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{ fontSize: 13 }}
                />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardOmie>

        {/* 9. Meus Relatórios */}
        <CardOmie title="Meus Relatórios" icon={FileDown} onOpen={() => navegar("relatorios")}>
          <div className="space-y-1 text-sm">
            <button type="button" onClick={() => navegar("resumo_exec")} className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">→ Resumo Executivo</button>
            <button type="button" onClick={() => navegar("dre")} className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">→ DRE</button>
            <button type="button" onClick={() => navegar("fluxo_caixa")} className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">→ Fluxo de Caixa</button>
            <button type="button" onClick={() => navegar("atividade_usuarios")} className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">→ Atividades dos Usuários</button>
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
  const accent = tone === "success" ? "text-success-ink"
    : tone === "danger" ? "text-destructive-ink"
    : "text-muted-foreground";
  return (
    <Card className={`group border-border transition-shadow hover:shadow-md ${className ?? ""}`}>
      <CardContent className="flex h-full flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={`h-5 w-5 shrink-0 ${accent}`} aria-hidden="true" />
            <h3 className="truncate text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Abrir ${title}`}
            className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            onClick={onOpen}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1">{children}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={onOpen}>
            {cta === "Incluir"
              ? <><Plus className="h-4 w-4" aria-hidden="true" /> Incluir</>
              : <>Abrir <ChevronRight className="h-4 w-4" aria-hidden="true" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ label, valor, tone }: { label: string; valor: number; tone?: "success" | "danger" }) {
  const cor = tone === "success" ? "text-success-ink"
    : tone === "danger" ? "text-destructive-ink"
    : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className={`shrink-0 font-medium tabular-nums ${cor}`}>{formatBRL(valor)}</span>
    </div>
  );
}
