import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const ctaBenefits = [
  'Sem necessidade de cartão de crédito',
  'Acesso imediato a 38 portais',
  'Assistente IA incluso',
];

export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="landing-section">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="landing-container"
      >
        <div className="relative rounded-2xl p-12 md:p-20 text-center overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: 'linear-gradient(hsl(174 62% 45%) 1px, transparent 1px), linear-gradient(90deg, hsl(174 62% 45%) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full opacity-12 blur-[100px]" style={{ background: 'hsl(174 62% 45%)' }} />

          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="w-14 h-14 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-8 border border-accent/15"
            >
              <Sparkles className="w-7 h-7 text-accent" />
            </motion.div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-5 tracking-tight leading-tight">
              Pronto para vencer mais licitações?
            </h2>
            <p className="text-base text-white/45 mb-10 max-w-lg mx-auto leading-relaxed">
              Crie sua conta gratuitamente e comece a monitorar editais em minutos.
            </p>

            <ul className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-10">
              {ctaBenefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-white/55">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-10 py-6 rounded-lg font-bold transition-all hover:-translate-y-0.5"
                onClick={() => navigate('/auth')}
              >
                Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-lg border-white/12 text-white/65 hover:bg-white/5 hover:text-white"
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
