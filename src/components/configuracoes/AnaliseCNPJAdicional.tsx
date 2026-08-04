import { useState } from 'react';
import { Building2, TrendingUp, ChevronDown, ChevronUp, BarChart3, Target, Scale, Users, Plus, DollarSign, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ─── Benchmark: concorrentes reais (dados públicos coletados mar/2026) ─── */
const BENCHMARKS = [
  {
    nome: 'ConLicitação',
    modelo: 'Plano único por CNPJ',
    planos: [
      { nome: 'Advanced (sem Robô)', mensal: 395, ciclo: 'semestral' },
      { nome: 'Premium (sem Robô)', mensal: 335, ciclo: 'semestral' },
      { nome: 'Super (com Robô)', mensal: 264, ciclo: 'semestral' },
      { nome: 'Black (com Robô)', mensal: 515, ciclo: 'semestral' },
      { nome: 'Black Anual', mensal: 416, ciclo: 'anual' },
      { nome: 'Black Bienal', mensal: 310, ciclo: 'bienal' },
    ],
    cnpjAdicional: 'Novo plano completo por CNPJ',
    obs: '1 CNPJ por plano. Multi-empresa = múltiplas assinaturas.',
  },
  {
    nome: 'Licitei',
    modelo: 'Plano Multi-Empresa dedicado',
    planos: [
      { nome: 'Busca', mensal: 101, ciclo: 'mensal' },
      { nome: 'Premium', mensal: 393, ciclo: 'mensal' },
      { nome: 'Multiempresas 3 CNPJs', mensal: 1179, ciclo: 'mensal' },
    ],
    cnpjAdicional: 'Plano "Multiempresas" com 3 CNPJs = R$1.179/mês (R$393/CNPJ)',
    obs: 'O plano Multi cobra ~3x o Premium, sem desconto por volume.',
  },
  {
    nome: 'Licitante Prime',
    modelo: 'Até 5 CNPJs inclusos',
    planos: [
      { nome: 'Mensal', mensal: 180, ciclo: 'mensal' },
      { nome: 'Semestral', mensal: 130, ciclo: 'semestral' },
      { nome: 'Anual', mensal: 103, ciclo: 'anual' },
    ],
    cnpjAdicional: 'Inclui até 5 empresas no mesmo plano',
    obs: 'Preço agressivo, mas funcionalidades limitadas (sem robô de lances).',
  },
  {
    nome: 'WS Licita',
    modelo: 'Consultoria + plataforma',
    planos: [
      { nome: 'Essencial', mensal: 790, ciclo: 'mensal' },
      { nome: 'Profissional', mensal: 1190, ciclo: 'mensal' },
    ],
    cnpjAdicional: 'Não informa — atendimento personalizado',
    obs: 'Modelo de consultoria (R$790-1.190/mês + taxa de R$2.500). Cobra 3-5% de comissão sobre contratos.',
  },
  {
    nome: 'Effecti',
    modelo: 'Plano por CNPJ (sob consulta)',
    planos: [
      { nome: 'Não divulga publicamente', mensal: 0, ciclo: 'sob consulta' },
    ],
    cnpjAdicional: 'Cada CNPJ = assinatura separada (estimado R$300-600/mês)',
    obs: '3.000+ clientes. Referência de mercado. Preço negociável por volume.',
  },
];

/* ─── Modelo proposto PRAEFECTUS ─── */
const CNPJ_ADDON_PRICE = 97; // por CNPJ adicional/mês

const PLANS = [
  { nome: 'Básico', mensal: 197, cnpjsInclusos: 1, maxCnpjs: 3 },
  { nome: 'Profissional', mensal: 497, cnpjsInclusos: 2, maxCnpjs: 5 },
  { nome: 'Enterprise', mensal: 997, cnpjsInclusos: 5, maxCnpjs: 10 },
];

/* Custo incremental real por CNPJ adicional para a plataforma */
const COST_PER_CNPJ = {
  scraping: 15,       // Firecrawl: buscas adicionais por CNPJ
  storage: 3,         // Storage: documentos por empresa
  emailAlerts: 5,     // Resend: boletins por empresa
  edgeFunctions: 7,   // Edge Functions: consultas adicionais
  total: 30,          // ~R$30/mês de custo real por CNPJ adicional
};

export default function AnaliseCNPJAdicional() {
  const [expanded, setExpanded] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(1);

  // Cenários com CNPJs adicionais
  const scenarios = [
    {
      label: '10 clientes (conservador)',
      clients: [
        { plan: 0, count: 5, extraCnpjs: 1 },  // 5 Básicos com 1 CNPJ extra cada
        { plan: 1, count: 3, extraCnpjs: 2 },  // 3 Profissionais com 2 extras cada
        { plan: 2, count: 2, extraCnpjs: 3 },  // 2 Enterprise com 3 extras cada
      ],
    },
    {
      label: '25 clientes (moderado)',
      clients: [
        { plan: 0, count: 12, extraCnpjs: 1 },
        { plan: 1, count: 8, extraCnpjs: 3 },
        { plan: 2, count: 5, extraCnpjs: 4 },
      ],
    },
    {
      label: '50 clientes (escala)',
      clients: [
        { plan: 0, count: 25, extraCnpjs: 1 },
        { plan: 1, count: 15, extraCnpjs: 3 },
        { plan: 2, count: 10, extraCnpjs: 5 },
      ],
    },
  ];

  const baseCost = 564; // custo fixo operacional mensal

  const calcScenario = (idx: number) => {
    const s = scenarios[idx];
    let revBase = 0, revAddon = 0, totalCnpjs = 0, costAddon = 0;

    s.clients.forEach(({ plan, count, extraCnpjs }) => {
      revBase += PLANS[plan].mensal * count;
      revAddon += CNPJ_ADDON_PRICE * extraCnpjs * count;
      totalCnpjs += (PLANS[plan].cnpjsInclusos + extraCnpjs) * count;
      costAddon += COST_PER_CNPJ.total * extraCnpjs * count;
    });

    const totalClients = s.clients.reduce((a, c) => a + c.count, 0);
    const totalRev = revBase + revAddon;
    const totalCostAll = baseCost + costAddon;
    const profit = totalRev - totalCostAll;
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
    const addonShare = totalRev > 0 ? (revAddon / totalRev) * 100 : 0;

    return { revBase, revAddon, totalRev, totalCostAll, costAddon, profit, margin, totalClients, totalCnpjs, addonShare, label: s.label, clients: s.clients };
  };

  const sc = calcScenario(selectedScenario);

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Análise: Modelo CNPJ Adicional (Benchmark de Mercado)</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          {/* 1. Benchmark do Mercado */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Benchmark: Como o Mercado Cobra por CNPJ
            </h3>
            <div className="space-y-2">
              {BENCHMARKS.map((b) => (
                <div key={b.nome} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{b.nome}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{b.modelo}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {b.planos.filter(p => p.mensal > 0).map((p) => (
                      <span key={p.nome} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {p.nome}: {fmt(p.mensal)}/mês ({p.ciclo})
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>CNPJ adicional:</strong> {b.cnpjAdicional}
                  </p>
                  <p className="text-xs text-muted-foreground italic mt-0.5">{b.obs}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Conclusões do Benchmark */}
          <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
            <h3 className="text-xs font-bold text-accent mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Conclusões do Benchmark
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-accent font-bold shrink-0">1.</span>
                <span><strong className="text-foreground">Padrão do mercado: 1 CNPJ = 1 assinatura.</strong> ConLicitação, Effecti e a maioria cobram um plano completo por empresa. A Licitei cobra 3x pelo multi-empresa (sem desconto).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent font-bold shrink-0">2.</span>
                <span><strong className="text-foreground">Exceção: Licitante Prime inclui 5 CNPJs</strong>, mas com funcionalidades muito limitadas (sem robô de lances, sem IA avançada). Preço agressivo de R$103-180/mês.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent font-bold shrink-0">3.</span>
                <span><strong className="text-foreground">Faixa de preço por CNPJ no mercado: R$264 a R$515/mês</strong> para planos completos com robô de lances (referência ConLicitação).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent font-bold shrink-0">4.</span>
                <span><strong className="text-foreground">Ninguém oferece "CNPJ adicional" com desconto.</strong> A PRAEFECTUS pode se diferenciar com um modelo mais acessível.</span>
              </div>
            </div>
          </div>

          {/* 3. Modelo Proposto PRAEFECTUS */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Modelo Proposto: CNPJ Adicional a {fmt(CNPJ_ADDON_PRICE)}/mês
            </h3>
            <div className="space-y-2">
              {PLANS.map((p, i) => (
                <div key={p.nome} className={cn(
                  'p-3.5 rounded-lg border',
                  i === 1 ? 'border-accent/40 bg-accent/5' : 'border-border/40 bg-muted/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-bold text-foreground">{p.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">{fmt(p.mensal)}/mês</span>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', i === 1 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground')}>
                      {p.cnpjsInclusos} CNPJ{p.cnpjsInclusos > 1 ? 's' : ''} incluso{p.cnpjsInclusos > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-background/60">
                      <p className="text-xs text-muted-foreground">Inclusos</p>
                      <p className="text-xs font-bold">{p.cnpjsInclusos} CNPJ{p.cnpjsInclusos > 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-2 rounded bg-background/60">
                      <p className="text-xs text-muted-foreground">Máximo</p>
                      <p className="text-xs font-bold">{p.maxCnpjs} CNPJs</p>
                    </div>
                    <div className="p-2 rounded bg-background/60">
                      <p className="text-xs text-muted-foreground">Custo c/ máximo</p>
                      <p className="text-xs font-bold text-accent">
                        {fmt(p.mensal + (p.maxCnpjs - p.cnpjsInclusos) * CNPJ_ADDON_PRICE)}/mês
                      </p>
                    </div>
                  </div>
                  {/* Comparativo vs. mercado */}
                  <div className="mt-2 p-2 rounded bg-success/5 border border-success/20">
                    <p className="text-xs text-success">
                      <strong>vs. mercado:</strong> Com {p.maxCnpjs} CNPJs na PRAEFECTUS = {fmt(p.mensal + (p.maxCnpjs - p.cnpjsInclusos) * CNPJ_ADDON_PRICE)}/mês. 
                      Na ConLicitação = {fmt(p.maxCnpjs * 335)}/mês ({p.maxCnpjs} planos Premium).
                      <strong> Economia de {((1 - (p.mensal + (p.maxCnpjs - p.cnpjsInclusos) * CNPJ_ADDON_PRICE) / (p.maxCnpjs * 335)) * 100).toFixed(0)}%.</strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Custo incremental real por CNPJ */}
          <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
            <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-warning" /> Custo Real por CNPJ Adicional (para a PRAEFECTUS)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {Object.entries(COST_PER_CNPJ).filter(([k]) => k !== 'total').map(([key, val]) => (
                <div key={key} className="p-2 rounded bg-background/60 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-xs font-bold">{fmt(val)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-xs font-bold text-warning">Custo real por CNPJ adicional</span>
              <span className="text-sm font-extrabold text-warning">{fmt(COST_PER_CNPJ.total)}/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Margem líquida por CNPJ adicional:</strong> {fmt(CNPJ_ADDON_PRICE)} - {fmt(COST_PER_CNPJ.total)} = <strong className="text-success">{fmt(CNPJ_ADDON_PRICE - COST_PER_CNPJ.total)} de lucro por CNPJ/mês</strong> ({((1 - COST_PER_CNPJ.total / CNPJ_ADDON_PRICE) * 100).toFixed(0)}% de margem).
            </p>
          </div>

          {/* 5. Projeções de receita com CNPJ adicional */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Projeção de Receita com CNPJs Adicionais
            </h3>

            <div className="flex gap-1.5 mb-3">
              {scenarios.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedScenario(i)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                    selectedScenario === i ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
              {/* Breakdown por plano */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {sc.clients.map(({ plan, count, extraCnpjs }) => (
                  <div key={plan} className="p-2.5 rounded bg-background/60 text-center">
                    <p className="text-xs text-muted-foreground">{PLANS[plan].nome}</p>
                    <p className="text-xs font-bold">{count} clientes</p>
                    <p className="text-xs text-muted-foreground">+{extraCnpjs} CNPJs extras/cada</p>
                    <div className="mt-1 border-t border-border/30 pt-1">
                      <p className="text-xs text-accent font-medium">
                        {fmt(PLANS[plan].mensal * count)} base
                      </p>
                      <p className="text-xs text-success font-medium">
                        +{fmt(CNPJ_ADDON_PRICE * extraCnpjs * count)} add-ons
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="p-2 rounded bg-background/60 text-center">
                  <p className="text-xs text-muted-foreground">Receita Base</p>
                  <p className="text-xs font-bold">{fmt(sc.revBase)}</p>
                </div>
                <div className="p-2 rounded bg-success/10 text-center">
                  <p className="text-xs text-success">Receita CNPJs</p>
                  <p className="text-xs font-bold text-success">{fmt(sc.revAddon)}</p>
                </div>
                <div className="p-2 rounded bg-accent/10 text-center">
                  <p className="text-xs text-accent">Total Receita</p>
                  <p className="text-xs font-bold text-accent">{fmt(sc.totalRev)}</p>
                </div>
                <div className="p-2 rounded bg-background/60 text-center">
                  <p className="text-xs text-muted-foreground">CNPJs Ativos</p>
                  <p className="text-xs font-bold">{sc.totalCnpjs}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                    <p className="text-xs font-bold text-foreground">{fmt(sc.totalRev)}</p>
                  </div>
                  <span className="text-muted-foreground">−</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Custos Totais</p>
                    <p className="text-xs font-bold text-destructive">{fmt(sc.totalCostAll)}</p>
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro</p>
                    <p className="text-xs font-bold text-success">{fmt(sc.profit)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-success/15 text-success">
                    Margem {sc.margin.toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add-ons = {sc.addonShare.toFixed(0)}% da receita
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Vantagem competitiva */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <h3 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Vantagem Competitiva: "Produto Completo, Sem Instalação"
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Zero fricção técnica:</strong> O cliente não instala VPS, não configura servidor, não compra hospedagem. Tudo roda na nuvem gerenciada pela PRAEFECTUS.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">CNPJ adicional = 1 clique:</strong> O cliente adiciona uma nova empresa no painel e automaticamente tem boletins, monitoramento e robô de lances para o novo CNPJ.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Custo previsível:</strong> {fmt(CNPJ_ADDON_PRICE)}/mês por CNPJ adicional vs. R$264-515 por um novo plano nos concorrentes. O cliente economiza {((1 - CNPJ_ADDON_PRICE / 335) * 100).toFixed(0)}% por empresa adicional.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Escalabilidade de receita:</strong> Com {fmt(CNPJ_ADDON_PRICE - COST_PER_CNPJ.total)} de margem por CNPJ extra, cada novo CNPJ é receita recorrente de alta margem ({((1 - COST_PER_CNPJ.total / CNPJ_ADDON_PRICE) * 100).toFixed(0)}%).</span>
              </div>
            </div>
          </div>

          {/* 7. Tabela comparativa final */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Comparativo: Custo para 5 CNPJs (Empresas)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-muted-foreground font-semibold">Plataforma</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Custo 5 CNPJs/mês</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-semibold">Por CNPJ</th>
                    <th className="text-center py-2 px-2 text-muted-foreground font-semibold">Robô</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-success/30 bg-success/5">
                    <td className="py-2.5 px-2 font-bold text-success">PRAEFECTUS (Enterprise)</td>
                    <td className="py-2.5 px-2 text-right font-bold text-success">{fmt(997)}</td>
                    <td className="py-2.5 px-2 text-right text-success">{fmt(997 / 5)}</td>
                    <td className="py-2.5 px-2 text-center text-success">✅</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-2 font-medium">ConLicitação (5× Premium)</td>
                    <td className="py-2.5 px-2 text-right font-medium">{fmt(5 * 335)}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{fmt(335)}</td>
                    <td className="py-2.5 px-2 text-center text-muted-foreground">❌</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-2 font-medium">ConLicitação (5× Super)</td>
                    <td className="py-2.5 px-2 text-right font-medium">{fmt(5 * 264)}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{fmt(264)}</td>
                    <td className="py-2.5 px-2 text-center">✅</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-2 font-medium">Licitei (Multiempresas)</td>
                    <td className="py-2.5 px-2 text-right font-medium">{fmt(1179 + 2 * 393)}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{fmt((1179 + 2 * 393) / 5)}</td>
                    <td className="py-2.5 px-2 text-center">✅</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 px-2 font-medium">Licitante Prime (incluso)</td>
                    <td className="py-2.5 px-2 text-right font-medium">{fmt(180)}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{fmt(36)}</td>
                    <td className="py-2.5 px-2 text-center text-muted-foreground">❌</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 8. Veredicto */}
          <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-center">
            <p className="text-sm font-bold text-success mb-1">✅ Modelo Validado pelo Mercado</p>
            <p className="text-xs text-muted-foreground">
              O modelo de <strong className="text-foreground">{fmt(CNPJ_ADDON_PRICE)}/CNPJ adicional</strong> é 
              <strong className="text-success"> 71% mais barato</strong> que a média do mercado (R$335/CNPJ na ConLicitação), 
              mantém <strong className="text-foreground">69% de margem líquida</strong> por add-on, 
              e posiciona a PRAEFECTUS como a <strong className="text-foreground">única plataforma completa sem fricção técnica</strong> — 
              o cliente adiciona empresas com 1 clique, sem instalar nada.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
