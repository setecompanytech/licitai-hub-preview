import { useState } from 'react';
import {
  TrendingUp, DollarSign, Server, Cpu, Mail, Globe, Shield, ChevronDown, ChevronUp,
  Monitor, Users, Building2, Bot, FileText, Search, BarChart3, Scale, Calculator,
  MessageSquare, Briefcase, Layers, Zap
} from 'lucide-react';
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
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Planilha Completa — Custos, Receita e Lucratividade</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-8">

          {/* ─── SEÇÃO 1: CUSTOS FIXOS ─── */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Server className="w-3.5 h-3.5" /> 1. Custos Fixos Mensais da Plataforma
            </h3>
            <div className="space-y-1.5">
              {fixedCosts.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.detail}</p>
                      </div>
                    </div>
                    <span className={cn('text-xs font-bold tabular-nums ml-3 shrink-0', c.monthly === 0 ? 'text-success' : 'text-foreground')}>
                      {c.monthly === 0 ? 'Incluso' : R$(c.monthly)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <span className="text-xs font-bold text-destructive">Total Fixo Mensal</span>
              <span className="text-sm font-extrabold text-destructive tabular-nums">{R$(totalFixed)}</span>
            </div>
          </div>

          {/* ─── SEÇÃO 2: TABELA COMPLETA POR PLANO ─── */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> 2. Planos — Preço, Custo Variável, Lucro Bruto por Cliente
            </h3>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 font-bold text-muted-foreground">Plano</th>
                    <th className="text-center py-2.5 font-bold text-muted-foreground">Mensal</th>
                    <th className="text-center py-2.5 font-bold text-muted-foreground">CNPJs</th>
                    <th className="text-center py-2.5 font-bold text-muted-foreground">Sessões</th>
                    <th className="text-center py-2.5 font-bold text-muted-foreground">Usuários</th>
                    <th className="text-center py-2.5 font-bold text-destructive">Custo Var.</th>
                    <th className="text-center py-2.5 font-bold text-success">Lucro/cliente</th>
                    <th className="text-center py-2.5 font-bold text-foreground">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const v = varCost(p);
                    const profit = p.monthly - v.total;
                    const margin = (profit / p.monthly) * 100;
                    return (
                      <tr key={p.slug} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className={cn('py-2.5 font-bold', p.color)}>{p.name}</td>
                        <td className="py-2.5 text-center font-bold text-success tabular-nums">{R$(p.monthly)}</td>
                        <td className="py-2.5 text-center">{p.cnpjs}</td>
                        <td className="py-2.5 text-center">{p.sessions || '—'}</td>
                        <td className="py-2.5 text-center">{p.users}</td>
                        <td className="py-2.5 text-center font-semibold text-destructive tabular-nums">{R$(v.total)}</td>
                        <td className={cn('py-2.5 text-center font-bold tabular-nums', profit > 0 ? 'text-success' : 'text-destructive')}>{R$(profit)}</td>
                        <td className="py-2.5 text-center font-bold text-foreground">{margin.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t border-border">
                    <td className="py-2.5 font-bold text-foreground" colSpan={3}>Sessão Adicional (Enterprise)</td>
                    <td className="py-2.5 text-center font-bold">+1</td>
                    <td className="py-2.5 text-center">—</td>
                    <td className="py-2.5 text-center font-semibold text-destructive tabular-nums">{R$(COST_PER_SESSION)}</td>
                    <td className="py-2.5 text-center font-bold text-success tabular-nums">{R$(ADDITIONAL_SESSION_PRICE - COST_PER_SESSION)}</td>
                    <td className="py-2.5 text-center font-bold text-foreground">{R$(ADDITIONAL_SESSION_PRICE)}/mês</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Detalhamento do custo variável */}
            <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30">
              <p className="text-xs font-bold text-muted-foreground mb-1.5">Composição do custo variável:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>• Sessão Chromium: <strong className="text-foreground">{R$(COST_PER_SESSION)}/mês</strong> (~1 GB RAM)</span>
                <span>• CNPJ (scraping + monit.): <strong className="text-foreground">{R$(COST_PER_CNPJ)}/mês</strong></span>
                <span>• Usuário (auth + storage): <strong className="text-foreground">{R$(COST_PER_USER)}/mês</strong></span>
              </div>
            </div>
          </div>

          {/* ─── SEÇÃO 3: SERVIÇOS POR PLANO ─── */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" /> 3. Serviços Incluídos por Plano
            </h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <div key={p.slug} className="p-4 rounded-xl border border-border/50 bg-muted/10">
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn('text-xs font-bold', p.color)}>{p.name}</p>
                    <span className="text-xs font-extrabold text-success tabular-nums">{R$(p.monthly)}/mês</span>
                  </div>
                  <div className="flex gap-3 mb-3 text-xs text-muted-foreground">
                    <span>{p.cnpjs} CNPJ{p.cnpjs > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{p.sessions > 0 ? `${p.sessions} sessões` : 'Sem robô'}</span>
                    <span>•</span>
                    <span>{p.users} usuário{p.users > 1 ? 's' : ''}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {p.services.map((s, i) => {
                      const Icon = iconForIndex(i);
                      const isHeader = s.startsWith('Tudo do');
                      return (
                        <li key={i} className={cn('flex items-start gap-1.5 text-xs', isHeader && 'text-foreground font-semibold mt-1')}>
                          {!isHeader && <Icon className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />}
                          {isHeader && <Zap className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />}
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
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5" /> 4. Simulador — Receita com Sessões Adicionais
            </h3>
            <div className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-2.5">
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
                  <div key={p.slug} className="flex items-center gap-3 p-3 rounded-lg bg-background/60">
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-bold', p.color)}>{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sessions} base + {extra} extras = {totalSessions} sessões</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExtraSessions(prev => ({ ...prev, [p.slug]: Math.max(0, (prev[p.slug] ?? 0) - 1) }))}
                        className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/80 transition-colors"
                      >−</button>
                      <span className="w-6 text-center text-xs font-bold tabular-nums">{extra}</span>
                      <button
                        onClick={() => setExtraSessions(prev => ({ ...prev, [p.slug]: Math.min(10, (prev[p.slug] ?? 0) + 1) }))}
                        className="w-6 h-6 rounded bg-muted text-xs font-bold hover:bg-muted/80 transition-colors"
                      >+</button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-success tabular-nums">{R$(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">custo {R$(totalCostVal)} · lucro <span className={cn('font-semibold', profit > 0 ? 'text-success' : 'text-destructive')}>{R$(profit)}</span> · margem {margin.toFixed(0)}%</p>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground text-center pt-1">
                Sessão adicional: <strong className="text-foreground">{R$(ADDITIONAL_SESSION_PRICE)}/mês</strong> (custo {R$(COST_PER_SESSION)} · lucro {R$(ADDITIONAL_SESSION_PRICE - COST_PER_SESSION)} · margem {(((ADDITIONAL_SESSION_PRICE - COST_PER_SESSION) / ADDITIONAL_SESSION_PRICE) * 100).toFixed(0)}%)
              </p>
            </div>
          </div>

          {/* ─── SEÇÃO 5: PROJEÇÃO DE CENÁRIOS ─── */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> 5. Projeção de Receita × Custo = Lucro
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
                  <div key={sc.label} className={cn('p-4 rounded-xl border', ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
                    <p className="text-xs font-bold mb-3">{sc.label}</p>

                    {/* Mix de clientes */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {plans.map((p) => {
                        const count = sc.mix[p.slug as keyof typeof sc.mix] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={p.slug} className="text-center px-3 py-1.5 rounded-lg bg-background/60 border border-border/30">
                            <p className="text-xs text-muted-foreground">{p.name}</p>
                            <p className="text-xs font-bold">{count}× {R$(p.monthly)}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resultado */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2 rounded-lg bg-background/40 text-center">
                        <p className="text-xs text-muted-foreground uppercase">Receita</p>
                        <p className="text-xs font-extrabold text-foreground tabular-nums">{R$(revenue)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-background/40 text-center">
                        <p className="text-xs text-muted-foreground uppercase">Fixo + Var.</p>
                        <p className="text-xs font-extrabold text-destructive tabular-nums">{R$(totalCostScenario)}</p>
                        <p className="text-xs text-muted-foreground">{R$(totalFixed)} + {R$(totalVar)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-background/40 text-center">
                        <p className="text-xs text-muted-foreground uppercase">Lucro</p>
                        <p className={cn('text-xs font-extrabold tabular-nums', ok ? 'text-success' : 'text-destructive')}>{R$(profit)}</p>
                      </div>
                      <div className={cn('p-2 rounded-lg text-center', ok ? 'bg-success/10' : 'bg-destructive/10')}>
                        <p className="text-xs text-muted-foreground uppercase">Margem</p>
                        <p className={cn('text-sm font-extrabold', ok ? 'text-success' : 'text-destructive')}>{margin.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── SEÇÃO 6: BREAK-EVEN ─── */}
          <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-bold text-foreground">6. Ponto de Equilíbrio (Break-even)</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
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
          <div className="p-4 rounded-xl border border-success/30 bg-success/5">
            <p className="text-sm font-bold text-success mb-2 text-center">✅ Resumo Executivo — Viabilidade Financeira</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Custos fixos de {R$(totalFixed)}/mês</strong> cobrem infraestrutura completa 
                (DB, IA, VPS, domínio, suporte) independente do número de clientes.
              </p>
              <p>
                <strong className="text-foreground">Margens brutas por plano:</strong>{' '}
                {plans.map((p, i) => {
                  const v = varCost(p);
                  const m = ((p.monthly - v.total) / p.monthly * 100).toFixed(0);
                  return <span key={p.slug}>{i > 0 && ' · '}<strong className="text-success">{p.name}: {m}%</strong></span>;
                })}
              </p>
              <p>
                <strong className="text-foreground">Sessão adicional a {R$(ADDITIONAL_SESSION_PRICE)}/mês</strong> mantém margem de{' '}
                <strong className="text-success">{(((ADDITIONAL_SESSION_PRICE - COST_PER_SESSION) / ADDITIONAL_SESSION_PRICE) * 100).toFixed(0)}%</strong>,
                {' '}permitindo ao cliente escalar sem comprometer a rentabilidade.
              </p>
              <p>
                <strong className="text-foreground">Break-even:</strong> atingido com{' '}
                <strong className="text-success">5 clientes Básicos + 2 Profissionais</strong> ou{' '}
                <strong className="text-success">2 Enterprise Start</strong>.
                A partir daí, cada novo cliente é lucro quase integral.
              </p>
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
