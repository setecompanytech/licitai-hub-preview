import { useState } from 'react';
import { Search, Bot, Zap, Shield, Users, BarChart3, FileText, Bell, Scale, TrendingUp, Brain, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['Todos', 'Core', 'IA', 'Automação', 'Documentos', 'Jurídico'];

const features = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automática em 31 portais — PNCP, BLL, BNC, BEC/SP e 17 sistemas estaduais — com filtros inteligentes por CNAE, UF e palavras-chave.', tag: 'Core' },
  { icon: Bot, title: 'Assistente IA', desc: 'Tire dúvidas sobre editais, gere impugnações e recursos fundamentados na Lei 14.133/2021 e jurisprudência do TCU.', tag: 'IA' },
  { icon: Zap, title: 'Robô de Lances', desc: 'Estratégias de decremento automatizado para pregão eletrônico nos portais ComprasNet, BLL, BNC e Licitações-E.', tag: 'Automação' },
  { icon: FileText, title: 'Propostas ABNT', desc: 'Geração de propostas técnicas e comerciais com capa, sumário, planilha de preços e declarações em padrão ABNT.', tag: 'Documentos' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Organize certidões, atestados e habilitações com alertas automáticos de vencimento e renovação.', tag: 'Documentos' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulte CNPJ, histórico de participação em licitações e situação cadastral de concorrentes.', tag: 'Core' },
  { icon: BarChart3, title: 'Relatórios Gerenciais', desc: 'Dashboards com métricas de participação, taxa de sucesso por modalidade e volume de editais.', tag: 'Core' },
  { icon: Bell, title: 'Alertas Personalizados', desc: 'Notificações por e-mail e push ao detectar editais compatíveis com CNAE e perfil da empresa.', tag: 'Automação' },
  { icon: Scale, title: 'Apoio Jurídico', desc: 'Base de jurisprudência com gerador de peças jurídicas e cálculo de reequilíbrio econômico-financeiro.', tag: 'Jurídico' },
  { icon: TrendingUp, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, consulta ao Painel de Preços do Governo e pesquisa em fontes comerciais.', tag: 'IA' },
  { icon: Brain, title: 'Busca Inteligente', desc: 'Filtro com IA que identifica editais relevantes baseado no perfil e histórico da empresa.', tag: 'IA' },
  { icon: Truck, title: 'Cotação de Frete', desc: 'Cálculo de custos logísticos e comparação de transportadoras para composição de preços.', tag: 'Core' },
];

const tagColors: Record<string, string> = {
  'Core': 'bg-accent/10 text-accent',
  'IA': 'bg-primary/10 text-primary',
  'Automação': 'bg-warning/10 text-warning',
  'Documentos': 'bg-info/10 text-info',
  'Jurídico': 'bg-destructive/10 text-destructive',
};

export default function FeaturesSection() {
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filtered = activeCategory === 'Todos' ? features : features.filter(f => f.tag === activeCategory);

  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <div className="text-center mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="section-label">Funcionalidades</span>
            <h2 className="section-title">
              Tudo que você precisa para <span className="gradient-text">licitar e vencer</span>
            </h2>
            <p className="section-subtitle mx-auto">
              26+ módulos integrados para monitoramento, automação, documentação e análise estratégica de licitações públicas.
            </p>
          </motion.div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-accent text-accent-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((f) => (
              <motion.div
                key={f.title}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="group bg-card rounded-2xl border border-border/30 p-6 hover:border-accent/25 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/8 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                    <f.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tagColors[f.tag] || 'bg-muted text-muted-foreground'}`}>
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-[15px] font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
