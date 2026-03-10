import { useState } from 'react';
import { TrendingUp, DollarSign, Server, Cpu, Mail, Globe, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CostItem {
  name: string;
  icon: typeof Server;
  monthly: number;
  description: string;
}

const operationalCosts: CostItem[] = [
  { name: 'Infraestrutura Cloud (DB + Auth + Storage)', icon: Server, monthly: 125, description: 'Banco PostgreSQL, autenticação, armazenamento de arquivos' },
  { name: 'Edge Functions (APIs e Automações)', icon: Cpu, monthly: 75, description: 'Scraping, IA, webhooks, integrações em tempo real' },
  { name: 'Firecrawl (Pesquisa de Mercado)', icon: Globe, monthly: 99, description: 'Scraping B2B de 30+ fontes para precificação' },
  { name: 'E-mail Transacional (Resend)', icon: Mail, monthly: 40, description: 'Alertas, boletins diários, notificações' },
  { name: 'IA Generativa (Lovable AI)', icon: Cpu, monthly: 0, description: 'Incluído na plataforma — sem custo adicional' },
  { name: 'Domínio + SSL + CDN', icon: Shield, monthly: 25, description: 'Hospedagem, certificado SSL e distribuição global' },
  { name: 'Manutenção e Suporte', icon: Server, monthly: 200, description: 'Atualizações, correções, suporte técnico' },
];

const plans = [
  { name: 'Básico', slug: 'basico', monthly: 197, color: 'text-muted-foreground' },
  { name: 'Profissional', slug: 'profissional', monthly: 497, color: 'text-accent' },
  { name: 'Enterprise', slug: 'enterprise', monthly: 997, color: 'text-primary' },
];

export default function AnalyseCustosPlanos() {
  const [expanded, setExpanded] = useState(false);

  const totalCost = operationalCosts.reduce((s, c) => s + c.monthly, 0);

  // Revenue projections per scenario (number of clients per plan)
  const scenarios = [
    { label: 'Cenário Mínimo (5 clientes)', clients: { basico: 3, profissional: 1, enterprise: 1 } },
    { label: 'Cenário Moderado (20 clientes)', clients: { basico: 10, profissional: 7, enterprise: 3 } },
    { label: 'Cenário Ideal (50 clientes)', clients: { basico: 25, profissional: 18, enterprise: 7 } },
  ];

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Análise de Custos vs. Receita</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          {/* Operational Costs */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custos Operacionais Mensais</h3>
            <div className="space-y-2">
              {operationalCosts.map((cost) => {
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
              <span className="text-xs font-bold text-destructive">Total de Custos Mensais</span>
              <span className="text-sm font-extrabold text-destructive">{formatBRL(totalCost)}</span>
            </div>
          </div>

          {/* Revenue Scenarios */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Projeção de Receita</h3>
            <div className="space-y-3">
              {scenarios.map((scenario) => {
                const revenue = plans.reduce((sum, plan) => {
                  const clientCount = scenario.clients[plan.slug as keyof typeof scenario.clients] || 0;
                  return sum + (plan.monthly * clientCount);
                }, 0);
                const profit = revenue - totalCost;
                const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;
                const coverssCosts = profit > 0;

                return (
                  <div key={scenario.label} className={cn(
                    'p-4 rounded-lg border',
                    coverssCosts ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
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
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Receita</p>
                          <p className="text-xs font-bold text-foreground">{formatBRL(revenue)}</p>
                        </div>
                        <span className="text-muted-foreground">—</span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Custos</p>
                          <p className="text-xs font-bold text-destructive">{formatBRL(totalCost)}</p>
                        </div>
                        <span className="text-muted-foreground">=</span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Lucro</p>
                          <p className={cn('text-xs font-bold', coverssCosts ? 'text-success' : 'text-destructive')}>
                            {formatBRL(profit)}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold',
                        coverssCosts ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                      )}>
                        Margem {margin.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Break-even */}
          <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <p className="text-xs font-bold text-accent">Ponto de Equilíbrio (Break-even)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Para cobrir os custos de <strong className="text-foreground">{formatBRL(totalCost)}/mês</strong>, 
              são necessários no mínimo <strong className="text-foreground">{Math.ceil(totalCost / 497)} clientes Profissional</strong> ou{' '}
              <strong className="text-foreground">{Math.ceil(totalCost / 197)} clientes Básico</strong>.
              Com <strong className="text-foreground">apenas 2 clientes Enterprise</strong> o sistema já se torna lucrativo.
            </p>
          </div>

          {/* Verdict */}
          <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-center">
            <p className="text-sm font-bold text-success mb-1">✅ Precificação Sustentável</p>
            <p className="text-xs text-muted-foreground">
              Os valores de R$197 (Básico), R$497 (Profissional) e R$997 (Enterprise) 
              cobrem os custos operacionais a partir de 2-3 clientes e geram margem saudável com escala.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
