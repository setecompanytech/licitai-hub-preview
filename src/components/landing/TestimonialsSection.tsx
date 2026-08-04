import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Carlos M.',
    role: 'Diretor Comercial',
    company: 'Empresa de TI — São Paulo',
    avatar: 'CM',
    text: 'O monitoramento automático nos ajudou a identificar editais em portais estaduais que antes não acompanhávamos. Aumentamos em 40% nossa participação.',
    rating: 5,
    result: '+40% participação',
  },
  {
    name: 'Ana Paula R.',
    role: 'Gerente de Licitações',
    company: 'Construção Civil — Minas Gerais',
    avatar: 'AR',
    text: 'A geração de propostas formatadas em ABNT economiza um dia inteiro de trabalho por semana. O checklist previne falhas de habilitação.',
    rating: 5,
    result: '1 dia economizado/semana',
  },
  {
    name: 'Roberto A.',
    role: 'Sócio-Diretor',
    company: 'Distribuidora — Paraná',
    avatar: 'RA',
    text: 'Usamos o módulo de precificação para compor custos com BDI e consulta ao Painel de Preços. Reduzimos erros e melhoramos a margem.',
    rating: 5,
    result: 'Margem otimizada',
  },
  {
    name: 'Fernanda C.',
    role: 'Advogada',
    company: 'Consultoria Jurídica — Rio de Janeiro',
    avatar: 'FC',
    text: 'O assistente jurídico com base na Lei 14.133 agiliza a elaboração de impugnações e recursos. Ferramenta indispensável.',
    rating: 5,
    result: '3x mais rápido',
  },
];

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-20 md:py-28 px-6" style={{ background: 'var(--gradient-warm)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Resultados Reais</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Empresas que <span className="text-accent">transformaram</span> seus resultados
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto mt-4">
              Veja como profissionais reais estão vencendo mais licitações com o PRAEFECTUS.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl border border-border/50 p-7 hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-4">
                <Quote className="w-8 h-8 text-accent/15" />
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                  {t.result}
                </span>
              </div>

              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-3.5 h-3.5 ${j < t.rating ? 'fill-warning text-warning' : 'text-muted-foreground/20'}`} />
                ))}
              </div>

              <p className="text-[14px] text-foreground leading-relaxed mb-6">"{t.text}"</p>

              <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
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
