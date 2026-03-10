import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check, ArrowRight, Sparkles, X, Shield, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Plano = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco_mensal: number;
  preco_semestral: number | null;
  preco_anual: number | null;
  preco_bienal: number | null;
  recursos: string[];
  destaque: boolean;
};

type Periodo = 'semestral' | 'anual' | 'bienal';

const PERIODOS: { key: Periodo; label: string; meses: number; badge?: string }[] = [
  { key: 'semestral', label: 'Semestral', meses: 6 },
  { key: 'anual', label: 'Anual', meses: 12, badge: '-17%' },
  { key: 'bienal', label: 'Bienal', meses: 24, badge: '-30%' },
];

const PLAN_ICONS = [
  <Zap className="w-5 h-5" />,
  <Sparkles className="w-5 h-5" />,
  <Crown className="w-5 h-5" />,
];

function getPreco(p: Plano, periodo: Periodo): { mensal: number; total: number } {
  switch (periodo) {
    case 'semestral': {
      const total = p.preco_semestral ?? p.preco_mensal * 6;
      return { mensal: Math.round(total / 6), total };
    }
    case 'anual': {
      const total = p.preco_anual ?? p.preco_mensal * 12;
      return { mensal: Math.round(total / 12), total };
    }
    case 'bienal': {
      const total = p.preco_bienal ?? p.preco_mensal * 24;
      return { mensal: Math.round(total / 24), total };
    }
  }
}

// Feature categories for comparison table
const FEATURE_CATEGORIES = [
  {
    title: 'Monitoramento',
    features: ['Boletins diários', 'Monitoramento de editais', 'Diários oficiais', 'Alertas inteligentes'],
  },
  {
    title: 'Gestão',
    features: ['Kanban de processos', 'Gestão de documentos', 'Calendário de licitações', 'Gestão de contratos'],
  },
  {
    title: 'Inteligência Artificial',
    features: ['Assistente IA', 'Apoio jurídico IA', 'Apoio contábil IA', 'Precificação inteligente'],
  },
  {
    title: 'Avançado',
    features: ['Robô de lances', 'Análise de concorrentes', 'Multi-empresa', 'API de integração'],
  },
];

// Which features are included per plan tier (0=basic,1=pro,2=enterprise)
const FEATURE_TIERS: Record<string, number> = {
  'Boletins diários': 0,
  'Monitoramento de editais': 0,
  'Diários oficiais': 0,
  'Alertas inteligentes': 1,
  'Kanban de processos': 0,
  'Gestão de documentos': 0,
  'Calendário de licitações': 0,
  'Gestão de contratos': 1,
  'Assistente IA': 0,
  'Apoio jurídico IA': 1,
  'Apoio contábil IA': 1,
  'Precificação inteligente': 1,
  'Robô de lances': 2,
  'Análise de concorrentes': 1,
  'Multi-empresa': 2,
  'API de integração': 2,
};

export default function PlanosSection() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    supabase.from('planos').select('*').eq('ativo', true).order('preco_mensal').then(({ data }) => {
      if (data) setPlanos(data.map(p => ({ ...p, recursos: (p.recursos as any) || [] })) as any);
    });
  }, []);

  const periodoInfo = PERIODOS.find(p => p.key === periodo)!;

  return (
    <section id="planos" className="landing-section relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--accent)) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="landing-container relative">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="section-label">Planos & Preços</span>
            <h2 className="section-title">
              Encontre o plano <span className="gradient-text">ideal para sua empresa</span>
            </h2>
            <p className="section-subtitle mx-auto max-w-xl">
              São três planos, com assinatura semestral, anual ou bienal, para você escolher
            </p>

            {/* Period toggle */}
            <div className="inline-flex items-center gap-1 bg-card rounded-2xl p-1.5 border border-border/50 mt-10 shadow-sm">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={`relative px-6 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                    periodo === p.key
                      ? 'bg-accent text-accent-foreground shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  style={periodo === p.key ? { boxShadow: 'var(--shadow-glow-sm)' } : undefined}
                >
                  {p.label}
                  {p.badge && (
                    <span className={`ml-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      periodo === p.key
                        ? 'bg-accent-foreground/20 text-accent-foreground'
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {p.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto mb-12">
          {planos.map((p, i) => {
            const preco = getPreco(p, periodo);
            const isPopular = p.destaque;
            const Icon = PLAN_ICONS[i] || PLAN_ICONS[0];

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  isPopular
                    ? 'bg-card border-2 border-accent shadow-2xl scale-[1.03] z-10'
                    : 'bg-card border border-border/40 hover:shadow-xl hover:border-border/60'
                }`}
                style={isPopular ? { boxShadow: 'var(--shadow-glow)' } : undefined}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider flex items-center gap-1.5 bg-accent text-accent-foreground shadow-lg"
                    style={{ boxShadow: 'var(--shadow-glow-sm)' }}>
                    <Sparkles className="w-3 h-3" /> MAIS POPULAR
                  </div>
                )}

                {/* Card header */}
                <div className={`p-8 pb-6 ${isPopular ? 'pt-10' : ''}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                    isPopular
                      ? 'bg-accent/15 text-accent'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {Icon}
                  </div>
                  <h3 className="text-xl font-extrabold mb-1 text-foreground">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.descricao}</p>
                </div>

                {/* Price */}
                <div className="px-8 pb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-sm text-muted-foreground font-medium">R$</span>
                    <span className="text-5xl font-extrabold tracking-tight text-foreground leading-none">
                      {preco.mensal}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cobrado R$ {preco.total.toLocaleString('pt-BR')}/{periodoInfo.meses === 6 ? 'semestre' : periodoInfo.meses === 12 ? 'ano' : 'biênio'}
                  </p>
                  {periodo !== 'semestral' && (
                    <p className="text-xs text-accent font-semibold mt-1">
                      Economia de R$ {((p.preco_mensal * periodoInfo.meses) - preco.total).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="mx-8 border-t border-border/50" />

                {/* Features */}
                <div className="p-8 pt-6 flex-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    {i === 0 ? 'Inclui:' : i === 1 ? 'Tudo do anterior, mais:' : 'Tudo do anterior, mais:'}
                  </p>
                  <ul className="space-y-3">
                    {p.recursos.map((r: string) => (
                      <li key={r} className="flex items-start gap-2.5 text-sm">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isPopular ? 'bg-accent/15' : 'bg-muted'
                        }`}>
                          <Check className={`w-3 h-3 ${isPopular ? 'text-accent' : 'text-foreground'}`} />
                        </div>
                        <span className="text-foreground/80">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-8 pt-4">
                  <Button
                    className={`w-full rounded-xl font-bold h-12 text-sm transition-all ${
                      isPopular
                        ? 'bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl'
                        : ''
                    }`}
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => navigate('/auth')}
                    style={isPopular ? { boxShadow: 'var(--shadow-glow-sm)' } : undefined}
                  >
                    Começar Teste Grátis <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-3">
                    7 dias grátis · Sem cartão de crédito
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison toggle */}
        <div className="text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors underline underline-offset-4"
          >
            {showComparison ? 'Ocultar comparativo detalhado' : 'Ver comparativo detalhado dos planos'}
          </button>
        </div>

        {/* Comparison table */}
        {showComparison && planos.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-12 max-w-6xl mx-auto"
          >
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
              {/* Table header */}
              <div className="grid grid-cols-4 border-b border-border/50">
                <div className="p-6 flex items-center">
                  <span className="text-sm font-bold text-foreground">Funcionalidades</span>
                </div>
                {planos.slice(0, 3).map((p, i) => (
                  <div key={p.id} className={`p-6 text-center ${
                    p.destaque ? 'bg-accent/5' : ''
                  }`}>
                    <p className="font-extrabold text-foreground">{p.nome}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      R$ {getPreco(p, periodo).mensal}/mês
                    </p>
                  </div>
                ))}
              </div>

              {/* Feature rows by category */}
              {FEATURE_CATEGORIES.map((cat, catIdx) => (
                <div key={cat.title}>
                  <div className="grid grid-cols-4 bg-muted/30">
                    <div className="px-6 py-3 col-span-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {cat.title}
                      </span>
                    </div>
                  </div>
                  {cat.features.map((feature, fIdx) => {
                    const minTier = FEATURE_TIERS[feature] ?? 0;
                    return (
                      <div
                        key={feature}
                        className={`grid grid-cols-4 ${
                          fIdx < cat.features.length - 1 ? 'border-b border-border/30' : ''
                        } ${catIdx < FEATURE_CATEGORIES.length - 1 && fIdx === cat.features.length - 1 ? 'border-b border-border/50' : ''}`}
                      >
                        <div className="px-6 py-3.5 text-sm text-foreground/70">{feature}</div>
                        {[0, 1, 2].map((tierIdx) => {
                          const included = tierIdx >= minTier;
                          const isPopularCol = planos[tierIdx]?.destaque;
                          return (
                            <div
                              key={tierIdx}
                              className={`px-6 py-3.5 text-center ${isPopularCol ? 'bg-accent/5' : ''}`}
                            >
                              {included ? (
                                <Check className="w-4 h-4 text-accent mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Table footer CTAs */}
              <div className="grid grid-cols-4 border-t border-border/50">
                <div className="p-6" />
                {planos.slice(0, 3).map((p) => (
                  <div key={p.id} className={`p-6 text-center ${p.destaque ? 'bg-accent/5' : ''}`}>
                    <Button
                      size="sm"
                      className={`rounded-xl font-bold ${
                        p.destaque ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''
                      }`}
                      variant={p.destaque ? 'default' : 'outline'}
                      onClick={() => navigate('/auth')}
                    >
                      Escolher {p.nome}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-muted-foreground"
        >
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-accent" />
            <span>Pagamento seguro via Pix, boleto ou cartão</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-accent" />
            <span>Cancele quando quiser</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-accent" />
            <span>Suporte prioritário incluso</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
