import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check, ArrowRight, Sparkles, X, Shield, Zap, Crown, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Plano = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  recursos: string[];
  destaque: boolean;
};

const PLAN_ICONS: Record<number, React.ReactNode> = {
  0: <Zap className="w-6 h-6" />,
  1: <Sparkles className="w-6 h-6" />,
  2: <Crown className="w-6 h-6" />,
};

const PLAN_COLORS: Record<number, string> = {
  0: 'from-primary/10 to-primary/5 border-primary/20',
  1: 'from-accent/10 to-accent/5 border-accent/30',
  2: 'from-warning/10 to-warning/5 border-warning/20',
};

const PLAN_ICON_COLORS: Record<number, string> = {
  0: 'bg-primary/15 text-primary',
  1: 'bg-accent/15 text-accent',
  2: 'bg-warning/15 text-warning',
};

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
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    supabase.from('planos').select('id,nome,slug,descricao,recursos,destaque').eq('ativo', true).order('preco_mensal').then(({ data }) => {
      if (data) setPlanos(data.map(p => ({ ...p, recursos: (p.recursos as any) || [] })) as any);
    });
  }, []);

  const handleChoosePlan = (slug: string) => {
    navigate(`/cadastro?plano=${slug}`);
  };

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
            <span className="section-label">Planos</span>
            <h2 className="section-title">
              Escolha o plano <span className="gradient-text">ideal para sua jornada</span>
            </h2>
            <p className="section-subtitle mx-auto max-w-xl">
              Três opções flexíveis, com assinatura semestral, anual ou bienal. Escolha o plano que mais combina com seu negócio.
            </p>
          </motion.div>
        </div>

        {/* Plan cards — no prices, only features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-14">
          {planos.map((p, i) => {
            const isPopular = p.destaque;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 bg-gradient-to-b ${PLAN_COLORS[i] || PLAN_COLORS[0]} ${
                  isPopular
                    ? 'border-2 border-accent shadow-2xl scale-[1.03] z-10'
                    : 'border hover:shadow-xl'
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
                <div className={`p-8 pb-4 ${isPopular ? 'pt-10' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${PLAN_ICON_COLORS[i] || PLAN_ICON_COLORS[0]}`}>
                    {PLAN_ICONS[i]}
                  </div>
                  <h3 className="text-2xl font-extrabold mb-2 text-foreground">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.descricao}</p>
                </div>

                {/* Divider */}
                <div className="mx-8 border-t border-border/50 my-2" />

                {/* Features */}
                <div className="p-8 pt-4 flex-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    {i === 0 ? 'Inclui:' : 'Tudo do anterior, mais:'}
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
                    onClick={() => handleChoosePlan(p.slug)}
                    style={isPopular ? { boxShadow: 'var(--shadow-glow-sm)' } : undefined}
                  >
                    <Rocket className="w-4 h-4 mr-1" /> Escolher Plano <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
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
              <div className="grid grid-cols-4 border-b border-border/50">
                <div className="p-6 flex items-center">
                  <span className="text-sm font-bold text-foreground">Funcionalidades</span>
                </div>
                {planos.slice(0, 3).map((p) => (
                  <div key={p.id} className={`p-6 text-center ${p.destaque ? 'bg-accent/5' : ''}`}>
                    <p className="font-extrabold text-foreground">{p.nome}</p>
                  </div>
                ))}
              </div>

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
                            <div key={tierIdx} className={`px-6 py-3.5 text-center ${isPopularCol ? 'bg-accent/5' : ''}`}>
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
                      onClick={() => handleChoosePlan(p.slug)}
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
