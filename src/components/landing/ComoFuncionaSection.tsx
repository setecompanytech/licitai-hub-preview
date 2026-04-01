import { Search, Filter, Bell, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    icon: Search,
    num: '01',
    title: 'Captura Automatizada',
    desc: 'Conectores dedicados varrem 38+ portais de compras públicas em intervalos configuráveis, coletando editais, avisos, contratações diretas, retificações e republicações.',
  },
  {
    icon: Filter,
    num: '02',
    title: 'Classificação e Matching',
    desc: 'Motor de aderência calcula score ponderado por CNAE, palavra-chave, região, modalidade, faixa de valor e urgência — relacionando cada publicação aos perfis de alerta do cliente.',
  },
  {
    icon: Bell,
    num: '03',
    title: 'Alerta Multicanal',
    desc: 'Oportunidades aderentes são enviadas por e-mail, WhatsApp e notificações do sistema, com prevenção de duplicidade, rastreamento de entrega e janelas de horário configuráveis.',
  },
  {
    icon: BarChart3,
    num: '04',
    title: 'Gestão e Decisão',
    desc: 'Dashboard executivo com priorização automática (quente, urgente, premium, regional), histórico de participações, gestão de contratos e relatórios operacionais.',
  },
];

export default function ComoFuncionaSection() {
  return (
    <section id="como-funciona" className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Como Funciona</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12]">
              Da captura ao <span className="text-accent">resultado</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mt-4 leading-relaxed">
              Fluxo operacional integrado — da ingestão automatizada de oportunidades à gestão completa do ciclo licitatório.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative bg-card rounded-xl border border-border/50 p-7 hover:border-accent/30 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-accent/10">
                  <s.icon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-3xl font-extrabold text-muted-foreground/15">{s.num}</span>
              </div>
              <h3 className="text-sm font-bold mb-2 text-foreground">{s.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-accent/30" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
