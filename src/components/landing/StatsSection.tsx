import { motion } from 'framer-motion';
import { Globe, MapPin, Cpu, FileText } from 'lucide-react';

const stats = [
  { value: '31', label: 'Portais integrados', desc: 'PNCP, BLL, BNC, BEC e estaduais', icon: Globe },
  { value: '27', label: 'Estados cobertos', desc: 'Cobertura em todos os estados do Brasil', icon: MapPin },
  { value: '12+', label: 'Módulos com IA', desc: 'Assistente, lances, propostas e mais', icon: Cpu },
  { value: '26+', label: 'Funcionalidades', desc: 'Gestão completa de licitações', icon: FileText },
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
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <s.icon className="w-6 h-6 text-accent" />
              </div>
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
