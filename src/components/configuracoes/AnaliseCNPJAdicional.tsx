import { useState } from 'react';
import { Building2, TrendingUp, ChevronDown, ChevronUp, BarChart3, Target, Scale, Users, Plus, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    obs: 'Modelo de consultoria (R$790-1.190/mês + taxa de R$2.500). Cobra 3-5% de bonificação sobre contratos.',
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

/* Título de subseção — legenda em caixa alta. */
const H3 = 'mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground';

/* Comparativo final: com/sem robô, com texto — cor sozinha não é status. */
const Robo = ({ tem }: { tem: boolean }) => (
  <Badge variant={tem ? 'success' : 'muted'}>{tem ? 'Sim' : 'Não'}</Badge>
);

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
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Análise: Modelo CNPJ Adicional (Benchmark de Mercado)</h2>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="mt-6 space-y-6">
          {/* 1. Benchmark do Mercado */}
          <div>
            <h3 className={H3}>
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> Benchmark: Como o Mercado Cobra por CNPJ
            </h3>
            <div className="space-y-2">
              {BENCHMARKS.map((b) => (
                <div key={b.nome} className="rounded-lg border border-border bg-muted p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{b.nome}</span>
                    <Badge variant="muted">{b.modelo}</Badge>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {b.planos.filter(p => p.mensal > 0).map((p) => (
                      <Badge key={p.nome} variant="info" className="font-medium">
                        {p.nome}: {fmt(p.mensal)}/mês ({p.ciclo})
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>CNPJ adicional:</strong> {b.cnpjAdicional}
                  </p>
                  <p className="mt-1 text-xs italic text-muted-foreground">{b.obs}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Conclusões do Benchmark */}
          <div className="rounded-lg border border-border bg-muted p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <Target className="h-4 w-4" aria-hidden="true" /> Conclusões do Benchmark
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-foreground">1.</span>
                <span><strong className="text-foreground">Padrão do mercado: 1 CNPJ = 1 assinatura.</strong> ConLicitação, Effecti e a maioria cobram um plano completo por empresa. A Licitei cobra 3x pelo multi-empresa (sem desconto).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-foreground">2.</span>
                <span><strong className="text-foreground">Exceção: Licitante Prime inclui 5 CNPJs</strong>, mas com funcionalidades muito limitadas (sem robô de lances, sem IA avançada). Preço agressivo de R$103-180/mês.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-foreground">3.</span>
                <span><strong className="text-foreground">Faixa de preço por CNPJ no mercado: R$264 a R$515/mês</strong> para planos completos com robô de lances (referência ConLicitação).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-foreground">4.</span>
                <span><strong className="text-foreground">Ninguém oferece "CNPJ adicional" com desconto.</strong> A PRAEFECTUS pode se diferenciar com um modelo mais acessível.</span>
              </div>
            </div>
          </div>

          {/* 3. Modelo Proposto PRAEFECTUS */}
          <div>
            <h3 className={H3}>
              <Scale className="h-4 w-4" aria-hidden="true" /> Modelo Proposto: CNPJ Adicional a {fmt(CNPJ_ADDON_PRICE)}/mês
            </h3>
            <div className="space-y-2">
              {PLANS.map((p, i) => (
                <div key={p.nome} className={cn(
                  'rounded-lg border p-4',
                  i === 1 ? 'border-primary bg-primary-tint' : 'border-border bg-muted'
                )}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-foreground">{p.nome}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{fmt(p.mensal)}/mês</span>
                    </div>
                    <Badge variant={i === 1 ? 'success' : 'muted'}>
                      {p.cnpjsInclusos} CNPJ{p.cnpjsInclusos > 1 ? 's' : ''} incluso{p.cnpjsInclusos > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                    <div className="rounded-md bg-card p-2">
                      <p className="text-xs text-muted-foreground">Inclusos</p>
                      <p className="text-sm font-bold tabular-nums">{p.cnpjsInclusos} CNPJ{p.cnpjsInclusos > 1 ? 's' : ''}</p>
                    </div>
                    <div className="rounded-md bg-card p-2">
                      <p className="text-xs text-muted-foreground">Máximo</p>
                      <p className="text-sm font-bold tabular-nums">{p.maxCnpjs} CNPJs</p>
                    </div>
                    <div className="rounded-md bg-card p-2">
                      <p className="text-xs text-muted-foreground">Custo c/ máximo</p>
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {fmt(p.mensal + (p.maxCnpjs - p.cnpjsInclusos) * CNPJ_ADDON_PRICE)}/mês
                      </p>
                    </div>
                  </div>
                  {/* Comparativo vs. mercado */}
                  <div className="mt-2 rounded-md border border-success-line bg-success-tint p-3">
                    <p className="text-sm text-success-ink">
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
          <div className="rounded-lg border border-border bg-muted p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <DollarSign className="h-4 w-4 text-warning" aria-hidden="true" /> Custo Real por CNPJ Adicional (para a PRAEFECTUS)
            </h3>
            <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(COST_PER_CNPJ).filter(([k]) => k !== 'total').map(([key, val]) => (
                <div key={key} className="rounded-md bg-card p-2 text-center">
                  <p className="text-xs capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-sm font-bold tabular-nums">{fmt(val)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-warning-line bg-warning-tint p-3 text-warning-ink">
              <span className="text-sm font-bold">Custo real por CNPJ adicional</span>
              <span className="text-base font-bold tabular-nums">{fmt(COST_PER_CNPJ.total)}/mês</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Margem líquida por CNPJ adicional:</strong> {fmt(CNPJ_ADDON_PRICE)} - {fmt(COST_PER_CNPJ.total)} = <strong className="text-success">{fmt(CNPJ_ADDON_PRICE - COST_PER_CNPJ.total)} de lucro por CNPJ/mês</strong> ({((1 - COST_PER_CNPJ.total / CNPJ_ADDON_PRICE) * 100).toFixed(0)}% de margem).
            </p>
          </div>

          {/* 5. Projeções de receita com CNPJ adicional */}
          <div>
            <h3 className={H3}>
              <TrendingUp className="h-4 w-4" aria-hidden="true" /> Projeção de Receita com CNPJs Adicionais
            </h3>

            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Cenário">
              {scenarios.map((s, i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant={selectedScenario === i ? 'default' : 'outline'}
                  aria-pressed={selectedScenario === i}
                  onClick={() => setSelectedScenario(i)}
                >
                  {s.label}
                </Button>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              {/* Breakdown por plano */}
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {sc.clients.map(({ plan, count, extraCnpjs }) => (
                  <div key={plan} className="rounded-md bg-card p-3 text-center">
                    <p className="text-xs text-muted-foreground">{PLANS[plan].nome}</p>
                    <p className="text-sm font-bold tabular-nums">{count} clientes</p>
                    <p className="text-xs text-muted-foreground">+{extraCnpjs} CNPJs extras/cada</p>
                    <div className="mt-1 border-t border-border pt-1">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {fmt(PLANS[plan].mensal * count)} base
                      </p>
                      <p className="text-sm font-medium tabular-nums text-success">
                        +{fmt(CNPJ_ADDON_PRICE * extraCnpjs * count)} add-ons
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md bg-card p-2 text-center">
                  <p className="text-xs text-muted-foreground">Receita Base</p>
                  <p className="text-sm font-bold tabular-nums">{fmt(sc.revBase)}</p>
                </div>
                <div className="rounded-md border border-success-line bg-success-tint p-2 text-center text-success-ink">
                  <p className="text-xs">Receita CNPJs</p>
                  <p className="text-sm font-bold tabular-nums">{fmt(sc.revAddon)}</p>
                </div>
                <div className="rounded-md bg-card p-2 text-center">
                  <p className="text-xs text-muted-foreground">Total Receita</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">{fmt(sc.totalRev)}</p>
                </div>
                <div className="rounded-md bg-card p-2 text-center">
                  <p className="text-xs text-muted-foreground">CNPJs Ativos</p>
                  <p className="text-sm font-bold tabular-nums">{sc.totalCnpjs}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-line bg-success-tint p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                    <p className="text-sm font-bold tabular-nums text-foreground">{fmt(sc.totalRev)}</p>
                  </div>
                  <span className="text-muted-foreground">−</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Custos Totais</p>
                    <p className="text-sm font-bold tabular-nums text-destructive">{fmt(sc.totalCostAll)}</p>
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro</p>
                    <p className="text-sm font-bold tabular-nums text-success-ink">{fmt(sc.profit)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="success">Margem {sc.margin.toFixed(0)}%</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add-ons = {sc.addonShare.toFixed(0)}% da receita
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Vantagem competitiva */}
          <div className="rounded-lg border border-border bg-muted p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <Users className="h-4 w-4" aria-hidden="true" /> Vantagem Competitiva: "Produto Completo, Sem Instalação"
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Plus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span><strong className="text-foreground">Zero fricção técnica:</strong> O cliente não instala VPS, não configura servidor, não compra hospedagem. Tudo roda na nuvem gerenciada pela PRAEFECTUS.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span><strong className="text-foreground">CNPJ adicional = 1 clique:</strong> O cliente adiciona uma nova empresa no painel e automaticamente tem boletins, monitoramento e robô de lances para o novo CNPJ.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span><strong className="text-foreground">Custo previsível:</strong> {fmt(CNPJ_ADDON_PRICE)}/mês por CNPJ adicional vs. R$264-515 por um novo plano nos concorrentes. O cliente economiza {((1 - CNPJ_ADDON_PRICE / 335) * 100).toFixed(0)}% por empresa adicional.</span>
              </div>
              <div className="flex items-start gap-2">
                <Plus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span><strong className="text-foreground">Escalabilidade de receita:</strong> Com {fmt(CNPJ_ADDON_PRICE - COST_PER_CNPJ.total)} de margem por CNPJ extra, cada novo CNPJ é receita recorrente de alta margem ({((1 - COST_PER_CNPJ.total / CNPJ_ADDON_PRICE) * 100).toFixed(0)}%).</span>
              </div>
            </div>
          </div>

          {/* 7. Tabela comparativa final */}
          <div>
            <h3 className={H3}>
              Comparativo: Custo para 5 CNPJs (Empresas)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-3 py-3 text-left text-sm font-semibold text-foreground">Plataforma</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Custo 5 CNPJs/mês</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">Por CNPJ</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-foreground">Robô</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-success-line bg-success-tint text-success-ink">
                    <td className="px-3 py-3 font-bold">PRAEFECTUS (Enterprise)</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{fmt(997)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(997 / 5)}</td>
                    <td className="px-3 py-3 text-center"><Robo tem /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-3 font-medium">ConLicitação (5× Premium)</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(5 * 335)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(335)}</td>
                    <td className="px-3 py-3 text-center"><Robo tem={false} /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-3 font-medium">ConLicitação (5× Super)</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(5 * 264)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(264)}</td>
                    <td className="px-3 py-3 text-center"><Robo tem /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-3 font-medium">Licitei (Multiempresas)</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(1179 + 2 * 393)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt((1179 + 2 * 393) / 5)}</td>
                    <td className="px-3 py-3 text-center"><Robo tem /></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-3 font-medium">Licitante Prime (incluso)</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(180)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(36)}</td>
                    <td className="px-3 py-3 text-center"><Robo tem={false} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 8. Veredicto */}
          <div className="rounded-lg border border-success-line bg-success-tint p-4 text-center">
            <p className="mb-1 text-base font-bold text-success-ink">Modelo Validado pelo Mercado</p>
            <p className="text-sm text-muted-foreground">
              O modelo de <strong className="text-foreground">{fmt(CNPJ_ADDON_PRICE)}/CNPJ adicional</strong> é
              <strong className="text-success-ink"> 71% mais barato</strong> que a média do mercado (R$335/CNPJ na ConLicitação),
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
