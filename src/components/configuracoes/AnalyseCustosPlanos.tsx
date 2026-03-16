import { useState } from 'react';
import { TrendingUp, DollarSign, Server, Cpu, Mail, Globe, Shield, ChevronDown, ChevronUp, Plus, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CostItem {
  name: string;
  icon: typeof Server;
  monthly: number;
  description: string;
}

const fixedCosts: CostItem[] = [
  { name: 'Infraestrutura Cloud (DB + Auth + Storage)', icon: Server, monthly: 125, description: 'Banco PostgreSQL, autenticação, armazenamento de arquivos' },
  { name: 'Edge Functions (APIs e Automações)', icon: Cpu, monthly: 75, description: 'Scraping, IA, webhooks, integrações em tempo real' },
  { name: 'Firecrawl (Pesquisa de Mercado — base)', icon: Globe, monthly: 99, description: 'Scraping B2B de portais prioritários' },
  { name: 'E-mail Transacional (Resend)', icon: Mail, monthly: 40, description: 'Alertas, boletins diários, notificações' },
  { name: 'IA Generativa (Lovable AI)', icon: Cpu, monthly: 0, description: 'Incluído na plataforma — sem custo adicional' },
  { name: 'Domínio + SSL + CDN', icon: Shield, monthly: 25, description: 'Hospedagem, certificado SSL e distribuição global' },
  { name: 'Manutenção e Suporte', icon: Server, monthly: 200, description: 'Atualizações, correções, suporte técnico' },
];

const COST_PER_SESSION = 50;   // R$/mês por sessão (1GB RAM + CPU)
const COST_PER_CNPJ = 25;     // R$/mês por CNPJ (scraping + monitoramento)

const plans = [
  { name: 'Enterprise Start', slug: 'enterprise-start', monthly: 997, cnpjs: 5, sessions: 3, color: 'text-muted-foreground' },
  { name: 'Enterprise Pro', slug: 'enterprise-pro', monthly: 1497, cnpjs: 7, sessions: 5, color: 'text-accent' },
  { name: 'Enterprise Max', slug: 'enterprise-max', monthly: 1997, cnpjs: 10, sessions: 7, color: 'text-primary' },
];

export default function AnalyseCustosPlanos() {
  const [expanded, setExpanded] = useState(false);
  const [extraSessions, setExtraSessions] = useState({ 'enterprise-start': 0, 'enterprise-pro': 0, 'enterprise-max': 0 });

  const totalFixedCost = fixedCosts.reduce((s, c) => s + c.monthly, 0);

  const getVariableCost = (sessions: number, cnpjs: number) => ({
    sessions: sessions * COST_PER_SESSION,
    cnpjs: cnpjs * COST_PER_CNPJ,
    total: sessions * COST_PER_SESSION + cnpjs * COST_PER_CNPJ,
  });

  // Preço sugerido por sessão adicional: custo + margem 60%
  const ADDITIONAL_SESSION_PRICE = Math.ceil((COST_PER_SESSION / 0.4) / 10) * 10; // R$130 arredondado

  // Cenários: quantos clientes de cada tier
  const scenarios = [
    { label: 'Cenário Mínimo (5 clientes)', clients: { 'enterprise-start': 3, 'enterprise-pro': 1, 'enterprise-max': 1 } },
    { label: 'Cenário Moderado (15 clientes)', clients: { 'enterprise-start': 8, 'enterprise-pro': 5, 'enterprise-max': 2 } },
    { label: 'Cenário Ideal (30 clientes)', clients: { 'enterprise-start': 15, 'enterprise-pro': 10, 'enterprise-max': 5 } },
  ];

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Análise de Custos vs. Receita — Enterprise Tiers</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          {/* Fixed Costs */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custos Fixos da Plataforma</h3>
            <div className="space-y-2">
              {fixedCosts.map((cost) => {
                const Icon = cost.icon;
                return (
                  <div key={cost.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs font-medium">{cost.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cost.description}</p>
                      </div>
                    </div>
                    <span className={cn('text-xs font-bold tabular-nums', cost.monthly === 0 ? 'text-success' : 'text-foreground')}>
                      {cost.monthly === 0 ? 'Grátis' : formatBRL(cost.monthly)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <span className="text-xs font-bold text-destructive">Total Fixo Mensal</span>
              <span className="text-sm font-extrabold text-destructive">{formatBRL(totalFixedCost)}</span>
            </div>
          </div>

          {/* Variable Costs per Plan */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custos Variáveis por Plano (por cliente)</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const variable = getVariableCost(plan.sessions, plan.cnpjs);
                return (
                  <div key={plan.slug} className="p-4 rounded-xl border border-border/50 bg-muted/20">
                    <p className={cn('text-xs font-bold mb-2', plan.color)}>{plan.name}</p>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{plan.sessions} sessões × {formatBRL(COST_PER_SESSION)}</span>
                        <span className="font-semibold">{formatBRL(variable.sessions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{plan.cnpjs} CNPJs × {formatBRL(COST_PER_CNPJ)}</span>
                        <span className="font-semibold">{formatBRL(variable.cnpjs)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-border/50">
                        <span className="font-bold">Custo variável</span>
                        <span className="font-extrabold text-destructive">{formatBRL(variable.total)}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="font-bold text-success">Receita</span>
                        <span className="font-extrabold text-success">{formatBRL(plan.monthly)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold">Margem bruta</span>
                        <span className={cn('font-extrabold', plan.monthly - variable.total > 0 ? 'text-success' : 'text-destructive')}>
                          {(((plan.monthly - variable.total) / plan.monthly) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Session Pricing */}
          <div className="p-4 rounded-xl border border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-accent" />
              <p className="text-xs font-bold text-accent">Sessão Adicional — Precificação</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2.5 rounded-lg bg-background/50">
                <p className="text-[10px] text-muted-foreground">Custo/sessão</p>
                <p className="text-sm font-extrabold text-destructive">{formatBRL(COST_PER_SESSION)}</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-background/50">
                <p className="text-[10px] text-muted-foreground">Preço sugerido</p>
                <p className="text-sm font-extrabold text-accent">{formatBRL(ADDITIONAL_SESSION_PRICE)}</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-background/50">
                <p className="text-[10px] text-muted-foreground">Margem/sessão</p>
                <p className="text-sm font-extrabold text-success">{(((ADDITIONAL_SESSION_PRICE - COST_PER_SESSION) / ADDITIONAL_SESSION_PRICE) * 100).toFixed(0)}%</p>
              </div>
            </div>

            {/* Simulator */}
            <h4 className="text-[11px] font-semibold text-muted-foreground mb-2">Simulador — Cliente com sessões extras</h4>
            <div className="space-y-2">
              {plans.map((plan) => {
                const extra = extraSessions[plan.slug as keyof typeof extraSessions];
                const totalSessions = plan.sessions + extra;
                const baseCost = getVariableCost(plan.sessions, plan.cnpjs).total;
                const extraCost = extra * COST_PER_SESSION;
                const extraRevenue = extra * ADDITIONAL_SESSION_PRICE;
                const totalRevenue = plan.monthly + extraRevenue;
                const totalCost = baseCost + extraCost;
                const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

                return (
                  <div key={plan.slug} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold truncate">{plan.name}</p>
                      <p className="text-[10px] text-muted-foreground">{plan.sessions} base + {extra} extras = {totalSessions} sessões</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setExtraSessions(prev => ({ ...prev, [plan.slug]: Math.max(0, prev[plan.slug as keyof typeof prev] - 1) }))}
                        className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/80"
                      >−</button>
                      <span className="w-6 text-center text-xs font-bold">{extra}</span>
                      <button
                        onClick={() => setExtraSessions(prev => ({ ...prev, [plan.slug]: Math.min(10, prev[plan.slug as keyof typeof prev] + 1) }))}
                        className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/80"
                      >+</button>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-success">{formatBRL(totalRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">margem {margin.toFixed(0)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue Scenarios */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Projeção de Receita (sem sessões extras)</h3>
            <div className="space-y-3">
              {scenarios.map((scenario) => {
                const revenue = plans.reduce((sum, plan) => {
                  const count = scenario.clients[plan.slug as keyof typeof scenario.clients] || 0;
                  return sum + plan.monthly * count;
                }, 0);
                const variableCosts = plans.reduce((sum, plan) => {
                  const count = scenario.clients[plan.slug as keyof typeof scenario.clients] || 0;
                  return sum + getVariableCost(plan.sessions, plan.cnpjs).total * count;
                }, 0);
                const totalCost = totalFixedCost + variableCosts;
                const profit = revenue - totalCost;
                const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;
                const coversCosts = profit > 0;

                return (
                  <div key={scenario.label} className={cn(
                    'p-4 rounded-lg border',
                    coversCosts ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
                  )}>
                    <p className="text-xs font-semibold mb-2">{scenario.label}</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {plans.map((plan) => {
                        const count = scenario.clients[plan.slug as keyof typeof scenario.clients] || 0;
                        return (
                          <div key={plan.slug} className="text-center p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground">{plan.name}</p>
                            <p className="text-xs font-bold">{count} clientes</p>
                            <p className="text-[10px] text-muted-foreground">{formatBRL(plan.monthly * count)}/mês</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Receita</p>
                          <p className="text-xs font-bold text-foreground">{formatBRL(revenue)}</p>
                        </div>
                        <span className="text-muted-foreground">—</span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Custos (fixo+var)</p>
                          <p className="text-xs font-bold text-destructive">{formatBRL(totalCost)}</p>
                        </div>
                        <span className="text-muted-foreground">=</span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Lucro</p>
                          <p className={cn('text-xs font-bold', coversCosts ? 'text-success' : 'text-destructive')}>
                            {formatBRL(profit)}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap',
                        coversCosts ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                      )}>
                        Margem {margin.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Summary Table */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumo dos Tiers Enterprise</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 font-semibold text-muted-foreground">Tier</th>
                    <th className="text-center py-2 font-semibold text-muted-foreground">Preço</th>
                    <th className="text-center py-2 font-semibold text-muted-foreground">CNPJs</th>
                    <th className="text-center py-2 font-semibold text-muted-foreground">Sessões</th>
                    <th className="text-center py-2 font-semibold text-muted-foreground">Custo Var.</th>
                    <th className="text-center py-2 font-semibold text-muted-foreground">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => {
                    const variable = getVariableCost(plan.sessions, plan.cnpjs);
                    const margin = ((plan.monthly - variable.total) / plan.monthly * 100);
                    return (
                      <tr key={plan.slug} className="border-b border-border/30">
                        <td className="py-2.5 font-bold">{plan.name}</td>
                        <td className="py-2.5 text-center font-bold text-success">{formatBRL(plan.monthly)}</td>
                        <td className="py-2.5 text-center">{plan.cnpjs}</td>
                        <td className="py-2.5 text-center">{plan.sessions}</td>
                        <td className="py-2.5 text-center text-destructive font-semibold">{formatBRL(variable.total)}</td>
                        <td className="py-2.5 text-center font-bold text-success">{margin.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-accent/5">
                    <td className="py-2.5 font-bold" colSpan={2}>Sessão Adicional</td>
                    <td className="py-2.5 text-center">—</td>
                    <td className="py-2.5 text-center font-bold">+1</td>
                    <td className="py-2.5 text-center text-destructive font-semibold">{formatBRL(COST_PER_SESSION)}</td>
                    <td className="py-2.5 text-center font-bold text-accent">{formatBRL(ADDITIONAL_SESSION_PRICE)}/mês</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Break-even */}
          <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <p className="text-xs font-bold text-accent">Ponto de Equilíbrio (Break-even)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Custos fixos de <strong className="text-foreground">{formatBRL(totalFixedCost)}/mês</strong>.
              {' '}Com <strong className="text-foreground">1 cliente Enterprise Start</strong> (margem de{' '}
              {formatBRL(plans[0].monthly - getVariableCost(plans[0].sessions, plans[0].cnpjs).total)}) 
              e <strong className="text-foreground">1 cliente Enterprise Pro</strong> (margem de{' '}
              {formatBRL(plans[1].monthly - getVariableCost(plans[1].sessions, plans[1].cnpjs).total)}), 
              o custo fixo já é coberto. Com <strong className="text-foreground">apenas 2 clientes Enterprise Max</strong>,
              o sistema gera lucro de <strong className="text-success">
                {formatBRL(2 * (plans[2].monthly - getVariableCost(plans[2].sessions, plans[2].cnpjs).total) - totalFixedCost)}
              </strong>/mês.
            </p>
          </div>

          {/* Verdict */}
          <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-center">
            <p className="text-sm font-bold text-success mb-1">✅ Modelo Financeiramente Sustentável</p>
            <p className="text-xs text-muted-foreground">
              Tiers de {formatBRL(plans[0].monthly)} a {formatBRL(plans[2].monthly)} mantêm margens brutas acima de 70%.
              Sessões adicionais a <strong>{formatBRL(ADDITIONAL_SESSION_PRICE)}/mês</strong> garantem 62% de margem por sessão extra,
              permitindo ao cliente escalar sem comprometer a viabilidade operacional.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}