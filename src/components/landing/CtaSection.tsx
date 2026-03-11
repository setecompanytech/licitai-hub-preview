import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, CheckCircle2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const benefits = [
  'Sem cartão de crédito',
  'Acesso imediato a 38 portais',
  'Assistente IA incluso',
];

export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-7xl mx-auto"
      >
        <div className="rounded-2xl p-12 md:p-20 text-center relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }} />

          <div className="relative">
            {/* Urgency badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold mb-6 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Oferta por tempo limitado
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-5 tracking-tight">
              Sua concorrência já está usando.<br />
              <span className="text-accent">E você?</span>
            </h2>
            <p className="text-base text-white/50 mb-10 max-w-lg mx-auto">
              Cada dia sem monitorar editais é um contrato perdido. Comece agora, gratuitamente.
            </p>

            <ul className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-10">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-10 py-6 rounded-lg font-bold shadow-lg animate-pulse-orange"
                onClick={() => navigate('/auth')}
              >
                Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-lg border-white/20 text-white hover:bg-white/10 bg-transparent"
                onClick={() => navigate('/suporte')}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Falar com Suporte
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
