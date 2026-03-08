import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Carlos M.',
    role: 'Diretor Comercial',
    company: 'Empresa de TI — SP',
    avatar: 'CM',
    text: 'O monitoramento automático nos ajudou a identificar editais em portais estaduais que antes não acompanhávamos. Muito prático.',
    rating: 5,
  },
  {
    name: 'Ana Paula R.',
    role: 'Gerente de Licitações',
    company: 'Construção Civil — MG',
    avatar: 'AR',
    text: 'A geração de propostas formatadas economiza bastante tempo da equipe. O checklist de documentos também é muito útil.',
    rating: 5,
  },
  {
    name: 'Roberto A.',
    role: 'Sócio-Diretor',
    company: 'Distribuidora — PR',
    avatar: 'RA',
    text: 'Usamos o módulo de precificação para compor custos com BDI. A integração com o Painel de Preços do Governo facilita muito.',
    rating: 4,
  },
  {
    name: 'Fernanda C.',
    role: 'Advogada',
    company: 'Consultoria Jurídica — RJ',
    avatar: 'FC',
    text: 'O assistente jurídico com base na Lei 14.133 agiliza a elaboração de impugnações. Boa ferramenta de apoio.',
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
              O que dizem <span className="gradient-text">nossos usuários</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Relatos de profissionais que utilizam a plataforma no dia a dia.
            </p>
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
              className="group bg-card rounded-2xl border border-border/40 p-6 hover:shadow-lg hover:border-accent/20 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-accent/20 mb-3" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${j < t.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[80px]">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <p className="text-xs text-muted-foreground/70">{t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
