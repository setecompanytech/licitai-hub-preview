import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Carlos M.',
    role: 'Diretor Comercial',
    company: 'Empresa de TI — São Paulo',
    avatar: 'CM',
    text: 'O monitoramento automático nos ajudou a identificar editais em portais estaduais que antes não acompanhávamos. Aumentamos em 40% nossa participação em pregões.',
    rating: 5,
  },
  {
    name: 'Ana Paula R.',
    role: 'Gerente de Licitações',
    company: 'Construção Civil — Minas Gerais',
    avatar: 'AR',
    text: 'A geração de propostas formatadas em ABNT economiza um dia inteiro de trabalho por semana. O checklist de documentos previne falhas de habilitação.',
    rating: 5,
  },
  {
    name: 'Roberto A.',
    role: 'Sócio-Diretor',
    company: 'Distribuidora — Paraná',
    avatar: 'RA',
    text: 'Usamos o módulo de precificação para compor custos com BDI e consulta ao Painel de Preços. Reduzimos erros de cotação e melhoramos nossa margem.',
    rating: 5,
  },
  {
    name: 'Fernanda C.',
    role: 'Advogada',
    company: 'Consultoria Jurídica — Rio de Janeiro',
    avatar: 'FC',
    text: 'O assistente jurídico com base na Lei 14.133 agiliza a elaboração de impugnações e recursos. Ferramenta indispensável para escritórios especializados.',
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="landing-section bg-muted/20">
      <div className="landing-container">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="section-label">Depoimentos</span>
            <h2 className="section-title">
              Quem usa, <span className="gradient-text">recomenda</span>
            </h2>
            <p className="section-subtitle mx-auto">
              Relatos de profissionais que transformaram sua gestão de licitações com a plataforma.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative bg-card rounded-2xl border border-border/30 p-8 hover:shadow-lg hover:border-accent/15 transition-all duration-300"
            >
              <Quote className="absolute top-6 right-6 w-10 h-10 text-accent/8" />

              <div className="flex gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${j < t.rating ? 'fill-warning text-warning' : 'text-muted-foreground/20'}`} />
                ))}
              </div>

              <p className="text-[15px] text-foreground/80 leading-relaxed mb-8 italic">"{t.text}"</p>

              <div className="flex items-center gap-4 pt-5 border-t border-border/20">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <p className="text-xs text-muted-foreground/60">{t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
