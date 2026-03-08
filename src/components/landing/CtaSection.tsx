import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const ctaBenefits = [
  'Acesso a 31 portais de licitação',
  'Assistente IA incluso em todos os planos',
  'Sem necessidade de cartão de crédito',
];

export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="max-w-5xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
        style={{ background: 'var(--gradient-dark)' }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-10 blur-[80px]" style={{ background: 'hsl(174 72% 40%)' }} />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full opacity-10 blur-[60px]" style={{ background: 'hsl(210 100% 50%)' }} />

        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-primary-foreground mb-4 tracking-tight">
            Comece a gerenciar suas licitações
          </h2>
          <p className="text-lg text-primary-foreground/60 mb-8 max-w-2xl mx-auto">
            Crie sua conta e explore as funcionalidades da plataforma. Configure seus filtros de busca e comece a monitorar editais em minutos.
          </p>

          <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            {ctaBenefits.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-10 py-6 rounded-xl shadow-lg"
              style={{ boxShadow: 'var(--shadow-glow)' }}
              onClick={() => navigate('/auth')}
            >
              Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 rounded-xl border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/suporte')}
            >
              <MessageCircle className="w-4 h-4 mr-2" /> Falar com Suporte
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
