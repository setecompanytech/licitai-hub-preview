import { motion } from 'framer-motion';

const logos = [
  'Compras.gov.br', 'PNCP', 'BEC/SP', 'TCU', 'Portal de Compras', 'SICAF',
];

export default function LogoCloudSection() {
  return (
    <section className="py-12 border-y border-border/40 bg-muted/20">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-8">
          Integrado com os principais portais de licitação do Brasil
        </p>
        <div className="flex flex-wrap justify-center gap-8 md:gap-14">
          {logos.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-sm font-bold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
