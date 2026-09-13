import { useState } from 'react';
import {
  TrendingUp, DollarSign, Server, Cpu, Mail, Globe, Shield, ChevronDown, ChevronUp,
  Monitor, Users, Building2, Bot, FileText, Search, BarChart3, Scale, Calculator,
  MessageSquare, Briefcase, Layers, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const R$ = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ========================================================================
   1. CUSTOS FIXOS DA PLATAFORMA (independem de qtd de clientes)
   ======================================================================== */
const fixedCosts = [
  { name: 'PostgreSQL + Auth + Storage (Cloud)', icon: Server, monthly: 125, detail: 'Banco relacional, autenticação, armazenamento de arquivos e backups' },
  { name: 'Edge Functions (APIs / Webhooks)', icon: Cpu, monthly: 75, detail: 'Processamento assíncrono: scraping, IA, integrações em tempo real' },
  { name: 'Firecrawl — base 10 portais prioritários', icon: Globe, monthly: 99, detail: 'Web scraping B2B para portais sem API (BLL, Licitações-e, BNC etc.)' },
  { name: 'E-mail Transacional (Resend)', icon: Mail, monthly: 40, detail: 'Alertas, boletins diários, confirmações e notificações' },
  { name: 'IA Generativa (Lovable AI)', icon: Cpu, monthly: 0, detail: 'Gemini / GPT incluídos — sem custo adicional' },
  { name: 'Domínio + SSL + CDN', icon: Shield, monthly: 25, detail: 'praefectus.com.br, certificado SSL e distribuição global' },
  { name: 'VPS Agente de Lances (8 GB / 4 vCPU)', icon: Server, monthly: 180, detail: 'Servidor dedicado para Chromium headless + PM2 + Nginx' },
  { name: 'Manutenção, Suporte e Correções', icon: Server, monthly: 200, detail: 'Atualização de código, suporte técnico, patches de segurança' },
];

/* ========================================================================
   2. CUSTOS VARIÁVEIS POR CLIENTE
   ======================================================================== */
const COST_PER_SESSION = 50;   // ~1 GB RAM + CPU compartilhada
const COST_PER_CNPJ   = 25;   // Scraping + monitoramento + storage por CNPJ
const COST_PER_USER   = 5;    // Auth session + storage marginal

/* ========================================================================
   3. PLANOS E SERVIÇOS
   ======================================================================== */
interface PlanTier {
  name: string;
  slug: string;
  monthly: number;
  cnpjs: number;
  sessions: number;
  users: number;
  color: string;
  services: string[];
}

const plans: PlanTier[] = [
  {
    name: 'Básico', slug: 'basico', monthly: 197, cnpjs: 1, sessions: 0, users: 1,
    color: 'text-muted-foreground',
    services: [
      'Monitoramento de editais (PNCP + 10 portais)',
      'Busca Inteligente com IA',
      'Kanban de processos',
      'Calendário de licitações',
      'Geração de propostas (PDF)',
      'Gestão de documentos com alertas de vencimento',
      'Boletins diários por e-mail',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Profissional', slug: 'profissional', monthly: 497, cnpjs: 3, sessions: 1, users: 3,
    color: 'text-foreground',
    services: [
      'Tudo do Básico +',
      'Monitoramento estendido (38 portais)',
      'Robô de Lances — Extensão de Navegador (1 sessão)',
      'Assistente IA (chat jurídico + contábil)',
      'Apoio Jurídico e Contábil com IA',
      'Análise de concorrentes (CNPJ/Sintegra)',
      'Proposta técnica com IA',
      'Índices de repactuação',
      'Analytics e relatórios',
      'WhatsApp CRM',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Enterprise Start', slug: 'enterprise-start', monthly: 997, cnpjs: 5, sessions: 3, users: 5,
    color: 'text-foreground',
    services: [
      'Tudo do Profissional +',
      'Agente Cloud Gerenciado (3 sessões simultâneas)',
      'Precificação avançada com composição de custos',
      'Gestão de Contratos + Aditivos',
      'Análise de Mercado (Contratos.gov + Transparência)',
      'Relatório Contábil Gerencial',
      'API de integração (ERP/BI)',
      'Equipe e colaboradores (5 usuários)',
      'Suporte dedicado',
    ],
  },
  {
    name: 'Enterprise Pro', slug: 'enterprise-pro', monthly: 1497, cnpjs: 7, sessions: 5, users: 10,
    color: 'text-foreground',
    services: [
      'Tudo do Enterprise Start +',
      'Agente Cloud Gerenciado (5 sessões simultâneas)',
      'Até 7 CNPJs / empresas',
      'Até 10 usuários',
      'Workflow IA avançado',
      'Backup agendado automático',
      'Onboarding personalizado',
    ],
  },
  {
    name: 'Enterprise Max', slug: 'enterprise-max', monthly: 1997, cnpjs: 10, sessions: 7, users: 15,
    color: 'text-foreground',
    services: [
      'Tudo do Enterprise Pro +',
      'Agente Cloud Gerenciado (7 sessões simultâneas)',
      'Até 10 CNPJs / empresas (holding)',
      'Até 15 usuários',
      'SLA 99.5% com suporte 24/7',
      'Relatórios white-label',
      'Treinamento presencial (remoto)',
    ],
  },
];

/* ========================================================================
   4. PREÇO SESSÃO ADICIONAL
   ======================================================================== */
const ADDITIONAL_SESSION_PRICE = 130; // custo R$50 / margem ~62%

/* Título de subseção da planilha — legenda em caixa alta, como as demais
   etiquetas de meta do sistema. */
const H3 = 'mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground';

/* ========================================================================
   COMPONENTE
   ======================================================================== */
export default function AnalyseCustosPlanos() {
  const [expanded, setExpanded] = useState(false);
  const [extraSessions, setExtraSessions] = useState<Record<string, number>>(
    Object.fromEntries(plans.filter(p => p.sessions > 0).map(p => [p.slug, 0]))
  );

  const totalFixed = fixedCosts.reduce((s, c) => s + c.monthly, 0);

  const varCost = (p: PlanTier, extra = 0) => {
    const s = (p.sessions + extra) * COST_PER_SESSION;
    const c = p.cnpjs * COST_PER_CNPJ;
    const u = p.users * COST_PER_USER;
    return { sessions: s, cnpjs: c, users: u, total: s + c + u };
  };

  const scenarios = [
    { label: 'Cenário Conservador — 8 clientes', mix: { basico: 3, profissional: 2, 'enterprise-start': 2, 'enterprise-pro': 1, 'enterprise-max': 0 } },
    { label: 'Cenário Moderado — 20 clientes', mix: { basico: 8, profissional: 5, 'enterprise-start': 4, 'enterprise-pro': 2, 'enterprise-max': 1 } },
    { label: 'Cenário Ideal — 40 clientes', mix: { basico: 15, profissional: 12, 'enterprise-start': 7, 'enterprise-pro': 4, 'enterprise-max': 2 } },
  ];

  const iconForIndex = (i: number) => {
    const icons = [Search, Bot, Layers, FileText, Calculator, Scale, BarChart3, MessageSquare, Briefcase, Users, Building2, Zap];
    return icons[i % icons.length];
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Planilha Completa — Custos, Receita e Lucratividade</h2>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="mt-6 space-y-8">

          {/* ─── SEÇÃO 1: CUSTOS FIXOS ─── */}
          <div>
            <h3 className={H3}>
              <Server className="h-4 w-4" aria-hidden="true" /> 1. Custos Fixos Mensais da Plataforma
            </h3>
            <div className="space-y-2">
              {fixedCosts.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.detail}</p>
                      </div>
                    </div>
                    <span className={cn('shrink-0 text-right text-sm font-bold tabular-nums', c.monthly === 0 ? 'text-success' : 'text-foreground')}>
                      {c.monthly === 0 ? 'Incluso' : R$(c.monthly)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-destructive-line bg-destructive-tint p-4 text-destructive-ink">
              <span className="text-sm font-bold">Total Fixo Mensal</span>
              <span className="text-right text-base font-bold tabular-nums">{R$(totalFixed)}</span>
            </div>
          </div>

          {/* ─── SEÇÃO 2: TABELA COMPLETA POR PLANO ─── */}
          <div>
            <h3 className={H3}>
              <Layers className="h-4 w-4" aria-hidden="true" /> 2. Planos — Preço, Custo Variável, Lucro Bruto por Cliente
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-3 py-3 text-left text-sm font-semibold text-foreground">Plano</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Mensal</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-foreground">CNPJs</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-foreground">Sessões</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-foreground">Usuários</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Custo Var.</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Lucro/cliente</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const v = varCost(p);
                    const profit = p.monthly - v.total;
                    const margin = (profit / p.monthly) * 100;
                    return (
                      <tr key={p.slug} className="border-b border-border transition-colors hover:bg-muted">
                        <td className={cn('px-3 py-3 font-bold', p.color)}>{p.name}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-success">{R$(p.monthly)}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{p.cnpjs}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{p.sessions || '—'}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{p.users}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-destructive">{R$(v.total)}</td>
                        <td className={cn('px-3 py-3 text-right font-bold tabular-nums', profit > 0 ? 'text-success' : 'text-destructive')}>{R$(profit)}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-foreground">{margin.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted">
                    <td className="px-3 py-3 font-bold text-foreground" colSpan={3}>Sessão Adicional (Enterprise)</td>
                    <td className="px-3 py-3 text-center font-bold">+1</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-destructive">{R$(COST_PER_SESSION)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-success">{R$(ADDITIONAL_SESSION_PRICE - COST_PER_SESSION)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-foreground">{R$(ADDITIONAL_SESSION_PRICE)}/mês</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Detalhamento do custo variável */}
            <div className="mt-3 rounded-lg border border-border bg-muted p-4">
              <p className="mb-2 text-sm font-bold text-muted-foreground">Composição do custo variável:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>• Sessão Chromium: <strong className="text-foreground">{R$(COST_PER_SESSION)}/mês</strong> (~1 GB RAM)</span>
                <span>• CNPJ (scraping + monit.): <strong className="text-foreground">{R$(COST_PER_CNPJ)}/mês</strong></span>
                <span>• Usuário (auth + storage): <strong className="text-foreground">{R$(COST_PER_USER)}/mês</strong></span>
              </div>
            </div>
          </div>

          {/* ─── SEÇÃO 3: SERVIÇOS POR PLANO ─── */}
          <div>
            <h3 className={H3}>
              <Briefcase className="h-4 w-4" aria-hidden="true" /> 3. Serviços Incluídos por Plano
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <div key={p.slug} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-bold', p.color)}>{p.name}</p>
                    <span className="text-sm font-bold tabular-nums text-success">{R$(p.monthly)}/mês</span>
                  </div>
                  <div className="mb-3 flex gap-3 text-xs text-muted-foreground">
                    <span>{p.cnpjs} CNPJ{p.cnpjs > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{p.sessions > 0 ? `${p.sessions} sessões` : 'Sem robô'}</span>
                    <span>•</span>
                    <span>{p.users} usuário{p.users > 1 ? 's' : ''}</span>
                  </div>
                  <ul className="space-y-2">
                    {p.services.map((s, i) => {
                      const Icon = iconForIndex(i);
                      const isHeader = s.startsWith('Tudo do');
                      return (
                        <li key={i} className={cn('flex items-start gap-2 text-sm', isHeader && 'mt-1 font-semibold text-foreground')}>
                          {!isHeader && <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          {isHeader && <Zap className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          <span>{s}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ─── SEÇÃO 4: SIMULADOR DE SESSÕES EXTRAS ─── */}
          <div>
            <h3 className={H3}>
              <Monitor className="h-4 w-4" aria-hidden="true" /> 4. Simulador — Receita com Sessões Adicionais
            </h3>
            <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
              {plans.filter(p => p.sessions > 0).map((p) => {
                const extra = extraSessions[p.slug] ?? 0;
                const totalSessions = p.sessions + extra;
                const base = varCost(p);
                const extraCostVal = extra * COST_PER_SESSION;
                const extraRevVal = extra * ADDITIONAL_SESSION_PRICE;
                const totalRevenue = p.monthly + extraRevVal;
                const totalCostVal = base.total + extraCostVal;
                const profit = totalRevenue - totalCostVal;
                const margin = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;

                return (
                  <div key={p.slug} className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-bold', p.color)}>{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sessions} base + {extra} extras = {totalSessions} sessões</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Sessões extras do plano ${p.name}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label="Remover uma sessão extra"
                        onClick={() => setExtraSessions(prev => ({ ...prev, [p.slug]: Math.max(0, (prev[p.slug] ?? 0) - 1) }))}
                      >−</Button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">{extra}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label="Adicionar uma sessão extra"
                        onClick={() => setExtraSessions(prev => ({ ...prev, [p.slug]: Math.min(10, (prev[p.slug] ?? 0) + 1) }))}
                      >+</Button>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-success">{R$(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">custo {R$(totalCostVal)} · lucro <span className={cn('font-semibold', profit > 0 ? 'text-success' : 'text-destructive')}>{R$(profit)}</span> · margem {margin.toFixed(0)}%</p>
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Sessão adicional: <strong className="text-foreground">{R$(ADDITIONAL_SESSION_PRICE)}/mês</strong> (custo {R$(COST_PER_SESSION)} · lucro {R$(ADDITIONAL_SESSION_PRICE - COST_PER_SESSION)} · margem {(((ADDITIONAL_SESSION_PRICE - COST_PER_SESSION) / ADDITIONAL_SESSION_PRICE) * 100).toFixed(0)}%)
              </p>
            </div>
          </div>

          {/* ─── SEÇÃO 5: PROJEÇÃO DE CENÁRIOS ─── */}
          <div>
            <h3 className={H3}>
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> 5. Projeção de Receita × Custo = Lucro
            </h3>
            <div className="space-y-3">
              {scenarios.map((sc) => {
                const revenue = plans.reduce((s, p) => s + p.monthly * (sc.mix[p.slug as keyof typeof sc.mix] || 0), 0);
                const totalVar = plans.reduce((s, p) => s + varCost(p).total * (sc.mix[p.slug as keyof typeof sc.mix] || 0), 0);
                const totalCostScenario = totalFixed + totalVar;
                const profit = revenue - totalCostScenario;
                const margin = revenue > 0 ? (profit / revenue * 100) : 0;
                const ok = profit > 0;

                return (
                  <div key={sc.label} className={cn('rounded-lg border p-4', ok ? 'border-success-line bg-success-tint' : 'border-destructive-line bg-destructive-tint')}>
                    <p className="mb-3 text-sm font-bold text-foreground">{sc.label}</p>

                    {/* Mix de clientes */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {plans.map((p) => {
                        const count = sc.mix[p.slug as keyof typeof sc.mix] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={p.slug} className="rounded-md border border-border bg-card px-3 py-2 text-center">
                            <p className="text-xs text-muted-foreground">{p.name}</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{count}× {R$(p.monthly)}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resultado */}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="rounded-md bg-card p-2 text-center">
                        <p className="text-xs uppercase text-muted-foreground">Receita</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{R$(revenue)}</p>
                      </div>
                      <div className="rounded-md bg-card p-2 text-center">
                        <p className="text-xs uppercase text-muted-foreground">Fixo + Var.</p>
                        <p className="text-sm font-bold tabular-nums text-destructive">{R$(totalCostScenario)}</p>
                        <p className="text-xs text-muted-foreground">{R$(totalFixed)} + {R$(totalVar)}</p>
                      </div>
                      <div className="rounded-md bg-card p-2 text-center">
                        <p className="text-xs uppercase text-muted-foreground">Lucro</p>
                        <p className={cn('text-sm font-bold tabular-nums', ok ? 'text-success' : 'text-destructive')}>{R$(profit)}</p>
                      </div>
                      <div className="rounded-md bg-card p-2 text-center">
                        <p className="text-xs uppercase text-muted-foreground">Margem</p>
                        <p className={cn('text-base font-bold tabular-nums', ok ? 'text-success' : 'text-destructive')}>{margin.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── SEÇÃO 6: BREAK-EVEN ─── */}
          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-bold text-foreground">6. Ponto de Equilíbrio (Break-even)</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Custos fixos: <strong className="text-foreground">{R$(totalFixed)}/mês</strong>.
              </p>
              {plans.map((p) => {
                const v = varCost(p);
                const margUnit = p.monthly - v.total;
                const needed = margUnit > 0 ? Math.ceil(totalFixed / margUnit) : '∞';
                return (
                  <p key={p.slug}>
                    • <strong className="text-foreground">{p.name}</strong>: lucro/cliente = {R$(margUnit)} →
                    {' '}break-even com <strong className="text-foreground">{needed} cliente{typeof needed === 'number' && needed > 1 ? 's' : ''}</strong>
                  </p>
                );
              })}
            </div>
          </div>

          {/* ─── SEÇÃO 7: RESUMO EXECUTIVO ─── */}
          <div className="rounded-lg border border-success-line bg-success-tint p-4">
            <p className="mb-2 text-center text-base font-bold text-success-ink">Resumo Executivo — Viabilidade Financeira</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Custos fixos de {R$(totalFixed)}/mês</strong> cobrem infraestrutura completa
                (DB, IA, VPS, domínio, suporte) independente do número de clientes.
              </p>
              <p>
                <strong className="text-foreground">Margens brutas por plano:</strong>{' '}
                {plans.map((p, i) => {
                  const v = varCost(p);
                  const m = ((p.monthly - v.total) / p.monthly * 100).toFixed(0);
                  return <span key={p.slug}>{i > 0 && ' · '}<strong className="text-success-ink">{p.name}: {m}%</strong></span>;
                })}
              </p>
              <p>
                <strong className="text-foreground">Sessão adicional a {R$(ADDITIONAL_SESSION_PRICE)}/mês</strong> mantém margem de{' '}
                <strong className="text-success-ink">{(((ADDITIONAL_SESSION_PRICE - COST_PER_SESSION) / ADDITIONAL_SESSION_PRICE) * 100).toFixed(0)}%</strong>,
                {' '}permitindo ao cliente escalar sem comprometer a rentabilidade.
              </p>
              <p>
                <strong className="text-foreground">Break-even:</strong> atingido com{' '}
                <strong className="text-success-ink">5 clientes Básicos + 2 Profissionais</strong> ou{' '}
                <strong className="text-success-ink">2 Enterprise Start</strong>.
                A partir daí, cada novo cliente é lucro quase integral.
              </p>
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
