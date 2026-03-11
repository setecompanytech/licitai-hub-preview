import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

const stats = [
  { value: 500, suffix: '+', label: 'Empresas Ativas', highlight: true },
  { value: 38, suffix: '', label: 'Portais Integrados', highlight: false },
  { value: 27, suffix: '', label: 'Estados Cobertos', highlight: false },
  { value: 98, suffix: '%', label: 'Satisfação dos Clientes', highlight: true },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const duration = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
    <section className="py-16 px-6 border-b border-border/40" style={{ background: 'var(--gradient-warm)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-4xl md:text-5xl font-extrabold mb-1.5 ${s.highlight ? 'text-accent' : 'text-primary'}`}>
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
