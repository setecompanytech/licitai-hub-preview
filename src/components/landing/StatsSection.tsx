import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Globe, MapPin, Cpu, Layers } from 'lucide-react';

const stats = [
  { value: 31, suffix: '', label: 'Portais Integrados', desc: 'Federais, estaduais e privados', icon: Globe },
  { value: 27, suffix: '', label: 'Estados Cobertos', desc: 'Cobertura nacional completa', icon: MapPin },
  { value: 12, suffix: '+', label: 'Módulos com IA', desc: 'Assistente, lances, propostas', icon: Cpu },
  { value: 26, suffix: '+', label: 'Funcionalidades', desc: 'Do edital ao resultado', icon: Layers },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function StatsSection() {
  return (
    <section className="py-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'var(--gradient-accent-subtle)' }} />
      <div className="max-w-5xl mx-auto relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/15 transition-colors">
                <s.icon className="w-6 h-6 text-accent" />
              </div>
              <p className="text-4xl md:text-5xl font-extrabold gradient-text mb-1">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-sm font-bold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
