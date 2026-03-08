import { Search, Bot, Zap, Shield, Users, BarChart3, FileText, Bell, Scale, TrendingUp, Brain, Truck } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'IA rastreia 31 portais — PNCP, BLL, BNC, BEC/SP e 17 estaduais — em tempo real, filtrando por CNAE e palavras-chave.' },
  { icon: Bot, title: 'Assistente IA Jurídico', desc: 'Tire dúvidas, gere impugnações, recursos e análises com IA treinada na Lei 14.133/2021.' },
  { icon: Zap, title: 'Robô de Lances', desc: 'Configure estratégias automáticas de decremento e deixe o robô competir por você nos pregões.' },
  { icon: FileText, title: 'Propostas ABNT', desc: 'Gere propostas técnicas e comerciais formatadas automaticamente com selo ABNT.' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Organize certidões e atestados com alertas automáticos de vencimento e renovação.' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Monitore CNPJs, histórico de participações e estratégias dos seus competidores.' },
  { icon: BarChart3, title: 'Analytics Avançado', desc: 'Dashboards com métricas de desempenho, taxa de sucesso, ROI e tendências.' },
  { icon: Bell, title: 'Alertas Inteligentes', desc: 'Notificações por e-mail, push e WhatsApp com filtros personalizados.' },
  { icon: Scale, title: 'Apoio Jurídico IA', desc: 'Base jurisprudencial com geração automática de peças e reequilíbrio econômico.' },
  { icon: TrendingUp, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, SINAPI e pesquisa de preços em tempo real.' },
  { icon: Brain, title: 'Busca Inteligente IA', desc: 'Machine learning identifica editais mais relevantes para o seu perfil de empresa.' },
  { icon: Truck, title: 'Cotação de Frete', desc: 'Compare fretes e calcule custos logísticos integrados à sua proposta.' },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Tudo para vencer licitações, <span className="gradient-text">em um só lugar</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              +26 módulos integrados com inteligência artificial para maximizar suas chances de vitória.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group bg-card rounded-2xl border border-border/40 p-6 hover:border-accent/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <f.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
