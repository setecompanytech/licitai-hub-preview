import { CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const comparativos = [
  { feature: 'Perfis múltiplos de alerta por cliente', praefectus: true, tradicionais: false },
  { feature: 'Score de aderência com pesos configuráveis', praefectus: true, tradicionais: false },
  { feature: 'Priorização automática (quente, urgente, premium, regional)', praefectus: true, tradicionais: false },
  { feature: 'Filtros positivos e negativos por perfil', praefectus: true, tradicionais: false },
  { feature: 'Versionamento de publicações com detecção de retificações', praefectus: true, tradicionais: false },
  { feature: 'Robô de lances com estratégias configuráveis', praefectus: true, tradicionais: false },
  { feature: 'Gestão de contratos com saldo e aditivos', praefectus: true, tradicionais: false },
  { feature: 'Trilha de auditoria com hash encadeado', praefectus: true, tradicionais: false },
  { feature: 'Motor de precificação com BDI e 30+ fontes', praefectus: true, tradicionais: false },
  { feature: 'Geração de propostas ABNT com timbrado', praefectus: true, tradicionais: false },
  { feature: 'Apoio jurídico e contábil com IA', praefectus: true, tradicionais: false },
  { feature: 'Multi-tenant com RLS e segregação de dados', praefectus: true, tradicionais: false },
];

export default function DiferenciaisSection() {
  return (
    <section className="py-20 md:py-28 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Diferenciais Competitivos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Superioridade operacional <span className="text-accent">mensurável</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mt-4">
              Comparativo objetivo entre o PRAEFECTUS e portais tradicionais de monitoramento.
            </p>
          </motion.div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_120px] border-b border-border/50 bg-muted/40">
            <div className="p-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Funcionalidade</div>
            <div className="p-5 text-center text-xs font-bold uppercase tracking-wider text-accent">PRAEFECTUS</div>
            <div className="p-5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Tradicionais</div>
          </div>
          {/* Rows */}
          {comparativos.map((c, i) => (
            <div key={c.feature} className={`grid grid-cols-[1fr_120px_120px] ${i < comparativos.length - 1 ? 'border-b border-border/30' : ''}`}>
              <div className="px-5 py-3.5 text-sm text-foreground/80">{c.feature}</div>
              <div className="px-5 py-3.5 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-accent" />
              </div>
              <div className="px-5 py-3.5 flex items-center justify-center">
                {c.tradicionais ? (
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/25" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
