import { motion } from 'framer-motion';

const stats = [
  { value: '31', label: 'Portais integrados', desc: 'Busca automatizada via IA' },
  { value: '27', label: 'Estados cobertos', desc: 'Cobertura nacional completa' },
  { value: '3x', label: 'Mais vitórias em média', desc: 'vs. processo manual' },
  { value: '500+', label: 'Empresas confiam', desc: 'De todos os portes' },
];

export default function StatsSection() {
  return (
    <section className="py-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{ background: 'var(--gradient-primary)' }} />
      <div className="max-w-6xl mx-auto relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-4xl md:text-5xl font-extrabold gradient-text mb-1">{s.value}</p>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
