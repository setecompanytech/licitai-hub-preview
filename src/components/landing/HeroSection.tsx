import { useNavigate } from 'react-router-dom';
import { ChevronRight, Play, Shield, Award, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import heroDashboard from '@/assets/landing/hero-dashboard.png';

const trustBadges = [
  { icon: Shield, label: 'Dados 100% seguros' },
  { icon: Award, label: 'Lei 14.133/2021' },
  { icon: TrendingUp, label: '+3x taxa de vitória' },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-28 pb-8 lg:pt-36 lg:pb-16 px-6 overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: 'hsl(174 72% 40%)' }} />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]" style={{ background: 'hsl(210 100% 40%)' }} />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Plataforma #1 em Licitações com IA
            </div>

            <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Domine licitações
              <br />
              com{' '}
              <span className="gradient-text">Inteligência Artificial</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              Monitore editais em tempo real, automatize lances, gere propostas ABNT e analise concorrentes — tudo em uma plataforma única potencializada por IA de última geração.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8 py-6 rounded-xl shadow-lg"
                style={{ boxShadow: 'var(--shadow-glow)' }}
                onClick={() => navigate('/auth')}
              >
                Começar Teste Grátis — 14 dias <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-xl"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Play className="w-4 h-4 mr-2" /> Ver como funciona
              </Button>
            </div>

            <div className="flex flex-wrap gap-6">
              {trustBadges.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <b.icon className="w-4 h-4 text-accent" />
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-border/30 shadow-2xl">
              <img
                src={heroDashboard}
                alt="Painel do LicitIA mostrando dashboard de licitações com gráficos e assistente IA"
                className="w-full h-auto"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
            {/* Floating stat card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="absolute -bottom-4 -left-4 bg-card rounded-xl border border-border/50 p-4 shadow-lg"
            >
              <p className="text-2xl font-extrabold gradient-text">R$ 2.4M</p>
              <p className="text-xs text-muted-foreground">Economizados este mês</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 }}
              className="absolute -top-4 -right-4 bg-card rounded-xl border border-border/50 p-4 shadow-lg"
            >
              <p className="text-2xl font-extrabold text-accent">98.7%</p>
              <p className="text-xs text-muted-foreground">Uptime garantido</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
