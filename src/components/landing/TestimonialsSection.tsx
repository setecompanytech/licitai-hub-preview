import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Carlos Mendes',
    role: 'Diretor Comercial',
    company: 'TechSolutions LTDA',
    avatar: 'CM',
    text: 'Com o LicitIA, triplicamos nossas vitórias em pregões eletrônicos. O robô de lances é simplesmente revolucionário.',
    rating: 5,
  },
  {
    name: 'Ana Paula Ribeiro',
    role: 'Gerente de Licitações',
    company: 'Grupo Construir',
    avatar: 'AR',
    text: 'A geração automática de propostas ABNT economiza 80% do nosso tempo. Nunca mais perdemos prazo por documentação.',
    rating: 5,
  },
  {
    name: 'Roberto Alves',
    role: 'CEO',
    company: 'Alves Suprimentos',
    avatar: 'RA',
    text: 'O monitoramento inteligente identificou editais que nunca teríamos encontrado manualmente. ROI se pagou no primeiro mês.',
    rating: 5,
  },
  {
    name: 'Fernanda Costa',
    role: 'Advogada',
    company: 'Costa & Associados',
    avatar: 'FC',
    text: 'O módulo de apoio jurídico com IA gera impugnações e recursos de qualidade impressionante. Meus clientes adoram.',
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-3">Depoimentos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Quem usa, <span className="gradient-text">recomenda</span>
            </h2>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border/40 p-6 hover:shadow-lg transition-all"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
