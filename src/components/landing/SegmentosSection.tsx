import { Building2, Stethoscope, Monitor, HardHat, Wrench, Scale, Users, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

const segmentos = [
  { icon: Building2, title: 'Fornecedores', desc: 'Empresas que fornecem materiais, equipamentos e insumos para órgãos públicos em todas as esferas.' },
  { icon: Stethoscope, title: 'Saúde e Hospitalar', desc: 'Distribuidoras farmacêuticas, equipamentos médicos, insumos hospitalares e serviços correlatos.' },
  { icon: Monitor, title: 'Tecnologia', desc: 'Empresas de TI, telecomunicações, desenvolvimento de software e infraestrutura digital.' },
  { icon: HardHat, title: 'Engenharia e Obras', desc: 'Construtoras, projetistas, serviços de manutenção predial e infraestrutura civil.' },
  { icon: Wrench, title: 'Serviços', desc: 'Prestadores de serviços continuados — limpeza, segurança, manutenção, consultoria.' },
  { icon: Scale, title: 'Consultorias Licitatórias', desc: 'Assessorias especializadas que gerenciam processos para múltiplos clientes simultaneamente.' },
  { icon: Users, title: 'Equipes Comerciais', desc: 'Times de vendas que precisam identificar e priorizar oportunidades com velocidade e precisão.' },
  { icon: Briefcase, title: 'Times Jurídicos', desc: 'Advogados e departamentos jurídicos que atuam em impugnações, recursos e compliance.' },
];

export default function SegmentosSection() {
  return (
    <section id="segmentos" className="py-20 md:py-28 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Segmentos Atendidos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Projetado para quem atua em <span className="text-accent">contratações públicas</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mt-4">
              Ferramentas especializadas por perfil de atuação — do fornecedor individual à consultoria com dezenas de clientes.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {segmentos.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border border-border/50 p-6 hover:border-accent/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-sm font-bold mb-1.5">{s.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
