import { useNavigate } from 'react-router-dom';
import { ChevronRight, Shield, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import heroCorporate from '@/assets/landing/hero-corporate.jpg';

const highlights = [
  'Monitoramento automático em 38 portais de compras',
  'Robô de lances para pregão eletrônico',
  'Propostas técnicas e comerciais padrão ABNT',
  'Apoio jurídico baseado na Lei 14.133/2021',
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-primary">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img src={heroCorporate} alt="" className="w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/60" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-28 lg:py-0 w-full relative z-10">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-white/15 bg-white/8 text-white/80 text-[12px] font-semibold mb-8 tracking-wide uppercase">
              <Shield className="w-3.5 h-3.5" />
              Plataforma de Gestão de Licitações
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-[3.6rem] font-extrabold tracking-tight leading-[1.06] mb-6 text-white">
              Gestão inteligente de{' '}
              <span className="text-accent">licitações públicas</span>
            </h1>

            <p className="text-base md:text-lg text-white/55 max-w-xl mb-8 leading-relaxed">
              Monitore editais, automatize processos e gere propostas formatadas com segurança e conformidade legal.
            </p>

            <ul className="space-y-2.5 mb-10">
              {highlights.map((h, i) => (
                <motion.li
                  key={h}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-2.5 text-sm text-white/65"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{h}</span>
                </motion.li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 mb-14">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8 py-6 rounded-md font-bold"
                onClick={() => navigate('/auth')}
              >
                Começar Gratuitamente <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-md border-white/20 text-white hover:bg-white/10 hover:border-white/30 bg-transparent"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Ver Funcionalidades
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom trust bar */}
      <div className="absolute bottom-0 inset-x-0 bg-white/[0.04] backdrop-blur-sm border-t border-white/8">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-10 text-[12px] text-white/35 font-medium tracking-wide">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> Criptografia AES-256</div>
          <div className="flex items-center gap-2"><Award className="w-4 h-4" /> Conforme Lei 14.133/2021</div>
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Cobertura nacional — 27 UFs</div>
        </div>
      </div>
    </section>
  );
}
