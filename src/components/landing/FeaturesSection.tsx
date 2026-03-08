import { Search, Bot, Zap, Shield, Users, BarChart3, FileText, Bell, Scale, TrendingUp, Brain, Truck } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automatizada em 31 portais — PNCP, BLL, BNC, BEC/SP e 17 sistemas estaduais — com filtros por CNAE, UF e palavras-chave.', tag: 'Core' },
  { icon: Bot, title: 'Assistente IA', desc: 'Tire dúvidas sobre editais, gere impugnações e recursos com base na Lei 14.133/2021 e jurisprudência do TCU.', tag: 'IA' },
  { icon: Zap, title: 'Robô de Lances', desc: 'Configure estratégias de decremento para pregão eletrônico nos portais ComprasNet, BLL, BNC e Licitações-E.', tag: 'Automação' },
  { icon: FileText, title: 'Propostas ABNT', desc: 'Gere propostas técnicas e comerciais no padrão ABNT com capa, sumário, planilha de preços e declarações.', tag: 'Documentos' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Organize certidões, atestados e documentos habilitatórios com alertas automáticos de vencimento.', tag: 'Gestão' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulte CNPJ, histórico de participações em licitações e situação cadastral de empresas concorrentes.', tag: 'Inteligência' },
  { icon: BarChart3, title: 'Relatórios e Dashboards', desc: 'Acompanhe métricas de participação, taxa de sucesso por modalidade e volume de editais monitorados.', tag: 'Analytics' },
  { icon: Bell, title: 'Alertas Personalizados', desc: 'Receba notificações por e-mail e push quando novos editais compatíveis com seu CNAE forem publicados.', tag: 'Notificações' },
  { icon: Scale, title: 'Apoio Jurídico', desc: 'Base de jurisprudência para licitações com gerador de peças jurídicas e cálculo de reequilíbrio econômico.', tag: 'Jurídico' },
  { icon: TrendingUp, title: 'Precificação', desc: 'Composição de custos com BDI, consulta ao Painel de Preços do Governo e pesquisa em fontes comerciais.', tag: 'Preços' },
  { icon: Brain, title: 'Busca Inteligente', desc: 'Filtragem avançada com IA que identifica editais relevantes com base no perfil e histórico da empresa.', tag: 'IA' },
  { icon: Truck, title: 'Cotação de Frete', desc: 'Calcule custos logísticos e compare transportadoras para incluir na composição de preços da proposta.', tag: 'Logística' },
];

const tagColors: Record<string, string> = {
  'Core': 'bg-accent/10 text-accent',
  'IA': 'bg-primary/10 text-primary',
  'Automação': 'bg-warning/10 text-warning',
  'Documentos': 'bg-info/10 text-info',
  'Gestão': 'bg-success/10 text-success',
  'Inteligência': 'bg-destructive/10 text-destructive',
  'Analytics': 'bg-primary/10 text-primary',
  'Notificações': 'bg-warning/10 text-warning',
  'Jurídico': 'bg-accent/10 text-accent',
  'Preços': 'bg-success/10 text-success',
  'Logística': 'bg-info/10 text-info',
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Todas as ferramentas para licitações, <span className="gradient-text">integradas</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              26+ módulos para monitoramento, automação, documentação e análise — do edital ao resultado.
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
              transition={{ delay: i * 0.04 }}
              className="group bg-card rounded-2xl border border-border/40 p-6 hover:border-accent/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <f.icon className="w-5 h-5 text-accent" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagColors[f.tag] || 'bg-muted text-muted-foreground'}`}>
                  {f.tag}
                </span>
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
