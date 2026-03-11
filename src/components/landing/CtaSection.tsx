import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, CheckCircle2 } from 'lucide-react';
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
        <div className="rounded-xl p-12 md:p-20 text-center bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }} />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-5 tracking-tight">
              Pronto para vencer mais licitações?
            </h2>
            <p className="text-base text-white/50 mb-10 max-w-lg mx-auto">
              Crie sua conta gratuitamente e comece a monitorar editais em minutos.
            </p>

            <ul className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-10">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-white/55">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-10 py-6 rounded-md font-bold"
                onClick={() => navigate('/auth')}
              >
                Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 rounded-md border-white/20 text-white hover:bg-white/10 bg-transparent"
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
