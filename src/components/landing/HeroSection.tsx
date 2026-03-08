import { useNavigate } from 'react-router-dom';
import { ChevronRight, Play, Shield, Award, TrendingUp, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import heroDashboard from '@/assets/landing/hero-dashboard.png';

const highlights = [
  'Monitoramento automático em 31 portais de compras',
  'Robô de lances para pregão eletrônico',
  'Propostas técnicas e comerciais padrão ABNT',
  'Apoio jurídico baseado na Lei 14.133/2021',
];

const socialProof = [
  { value: '31', label: 'Portais' },
  { value: '27', label: 'Estados' },
  { value: '12+', label: 'Módulos IA' },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(174 72% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(174 72% 50%) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Accent orbs */}
      <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]" style={{ background: 'hsl(174 72% 45%)' }} />
      <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] rounded-full opacity-10 blur-[140px]" style={{ background: 'hsl(210 100% 50%)' }} />

      <div className="max-w-7xl mx-auto px-6 py-28 lg:py-0 w-full relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Copy — 7 cols */}
          <motion.div
            className="lg:col-span-6 xl:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/25 bg-accent/10 text-accent text-[13px] font-semibold mb-8 backdrop-blur-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Plataforma #1 de Licitações com IA
            </motion.div>

            <h1 className="text-4xl sm:text-5xl xl:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] mb-6 text-white">
              Vença licitações
              <br />
              com <span className="gradient-text">Inteligência Artificial</span>
            </h1>

            <p className="text-base md:text-lg text-white/55 max-w-lg mb-8 leading-relaxed">
              Monitore editais em tempo real, automatize lances em pregão eletrônico e gere propostas formatadas — tudo em uma única plataforma.
            </p>

            <ul className="space-y-2.5 mb-10">
              {highlights.map((h) => (
                <motion.li
                  key={h}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2.5 text-sm text-white/65"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{h}</span>
                </motion.li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8 py-6 rounded-xl font-bold shadow-lg transition-all hover:shadow-2xl hover:-translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-glow)' }}
                onClick={() => navigate('/auth')}
              >
                Começar Gratuitamente <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-xl border-white/15 text-white/80 hover:bg-white/5 hover:text-white"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Play className="w-4 h-4 mr-2" /> Ver funcionalidades
              </Button>
            </div>

            {/* Social proof mini */}
            <div className="flex items-center gap-8">
              {socialProof.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-extrabold text-white">{s.value}</p>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dashboard preview — 5 cols */}
          <motion.div
            className="lg:col-span-6 xl:col-span-5"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
          >
            <div className="relative">
              {/* Glow behind image */}
              <div className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl" style={{ background: 'var(--gradient-primary)' }} />

              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-card/5 backdrop-blur-sm">
                <img
                  src={heroDashboard}
                  alt="Dashboard do LicitIA com monitoramento de editais e lances automáticos"
                  className="w-full h-auto"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,25%,7%)]/70 via-transparent to-transparent" />
              </div>

              {/* Floating cards */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                className="absolute -bottom-6 -left-4 bg-card rounded-xl border border-border/40 p-4 shadow-xl backdrop-blur-lg animate-float"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[11px] font-semibold text-success">Online</span>
                </div>
                <p className="text-xl font-extrabold gradient-text">31 Portais</p>
                <p className="text-[10px] text-muted-foreground">Monitorados 24/7</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="absolute -top-4 -right-4 bg-card rounded-xl border border-border/40 p-4 shadow-xl backdrop-blur-lg animate-float-delayed"
              >
                <Shield className="w-5 h-5 text-accent mb-1" />
                <p className="text-[11px] font-bold">Lei 14.133/2021</p>
                <p className="text-[10px] text-muted-foreground">100% Conforme</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trust bar at bottom */}
      <div className="absolute bottom-0 inset-x-0 border-t border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-8 text-[11px] text-white/35 font-medium">
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Criptografia AES-256</div>
          <div className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Conforme Lei 14.133/2021</div>
          <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Cobertura nacional — 27 estados</div>
        </div>
      </div>
    </section>
  );
}
