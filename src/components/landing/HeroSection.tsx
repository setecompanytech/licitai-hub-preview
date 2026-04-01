import { useNavigate } from 'react-router-dom';
import { ChevronRight, Shield, Award, TrendingUp, CheckCircle2, Lock, Database, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import heroCorporate from '@/assets/landing/hero-corporate.jpg';

const highlights = [
  'Monitoramento automatizado em 38+ portais de compras públicas',
  'Motor de precificação com BDI, pesquisa em 30+ fontes e calculadora tributária',
  'Geração de propostas técnicas e comerciais em conformidade com ABNT',
  'Robô de lances para pregão eletrônico com estratégias configuráveis',
  'Apoio jurídico e contábil fundamentado na Lei 14.133/2021',
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
      <div className="absolute inset-0">
        <img src={heroCorporate} alt="" className="w-full h-full object-cover opacity-15" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(215,50%,14%)/0.97] via-[hsl(215,48%,18%)/0.93] to-[hsl(215,45%,22%)/0.80]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-32 pb-28 lg:pt-28 lg:pb-24 w-full relative z-10">
        <div className="max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent text-[11px] font-bold mb-8 tracking-wider uppercase">
              <Lock className="w-3.5 h-3.5" />
              Plataforma SaaS de Inteligência Licitatória
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight leading-[1.08] mb-6 text-white">
              Inteligência operacional para{' '}
              <span className="text-accent">contratações públicas.</span>
            </h1>

            <p className="text-base md:text-lg text-white/55 max-w-2xl mb-8 leading-relaxed">
              O PRAEFECTUS centraliza monitoramento, precificação, geração de propostas, automação de lances e gestão de contratos em uma única plataforma — com rastreabilidade, compliance e segurança em cada etapa.
            </p>

            <ul className="space-y-2.5 mb-10">
              {highlights.map((h, i) => (
                <motion.li
                  key={h}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-start gap-2.5 text-sm text-white/65"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>{h}</span>
                </motion.li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 mb-14">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-8 py-6 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all"
                onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Escolher Plano <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-lg border-white/20 text-white hover:bg-white/10 hover:border-white/30 bg-transparent"
                onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Como Funciona
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom trust bar */}
      <div className="absolute bottom-0 inset-x-0 bg-white/[0.04] backdrop-blur-sm border-t border-white/8">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-8 md:gap-12 text-[11px] text-white/35 font-medium tracking-wide">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> Criptografia AES-256-GCM</div>
          <div className="flex items-center gap-2"><Award className="w-4 h-4" /> Conforme Lei 14.133/2021</div>
          <div className="flex items-center gap-2"><Database className="w-4 h-4" /> Multi-tenant com RLS</div>
          <div className="flex items-center gap-2"><Globe className="w-4 h-4" /> Cobertura nacional — 27 UFs</div>
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> +500 empresas ativas</div>
        </div>
      </div>
    </section>
  );
}
