import { useState } from 'react';
import {
  Search, Bot, Zap, Shield, Users, BarChart3, FileText, Bell, Scale,
  TrendingUp, Brain, Truck, Kanban, Crosshair, CalendarDays, ListChecks,
  ClipboardCheck, Calculator, MessageSquare, DollarSign, BookOpen,
  Download, Target, Archive, GraduationCap, Workflow, FileBarChart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['Todos', 'Monitoramento', 'Gestão', 'Inteligência', 'Jurídico', 'Automação'];

const features = [
  // Monitoramento
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automática em 38+ portais — PNCP, BLL, BNC, BEC/SP, Licitações-e, Banparanet, ComprasNet e sistemas estaduais — com filtros por CNAE, UF e palavras-chave.', tag: 'Monitoramento' },
  { icon: Bell, title: 'Boletins & Alertas', desc: 'Notificações por e-mail, push e WhatsApp ao detectar editais compatíveis. Boletins diários configuráveis (manhã, meio-dia e tarde).', tag: 'Monitoramento' },
  { icon: Brain, title: 'Busca Inteligente IA', desc: 'Motor de busca com IA que identifica editais relevantes baseado no perfil, CNAE e histórico de participação da empresa.', tag: 'Monitoramento' },
  { icon: Download, title: 'Download de Editais', desc: 'Download consolidado de anexos oficiais (PDF/ZIP) diretamente dos portais, com resumos executivos gerados por IA.', tag: 'Monitoramento' },

  // Gestão
  { icon: Target, title: 'Licitações Estratégicas', desc: 'Gestão inteligente de oportunidades com score de viabilidade, cronômetros regressivos e alertas automáticos de abertura.', tag: 'Gestão' },
  { icon: Kanban, title: 'Kanban de Processos', desc: 'Quadro visual com 8 etapas normatizadas: Monitorando, Analisando, Proposta, Em Disputa, Vencida, Homologada, Perdida e Arquivada.', tag: 'Gestão' },
  { icon: CalendarDays, title: 'Calendário Unificado', desc: 'Calendário que sincroniza datas de abertura, vencimentos de documentos, certificados e credenciais de portais em uma única visão.', tag: 'Gestão' },
  { icon: ListChecks, title: 'Compromissos & Prazos', desc: 'Controle de compromissos com cronômetros regressivos e marcação de interesse em processos para múltiplas empresas.', tag: 'Gestão' },
  { icon: FileText, title: 'Gestão de Contratos', desc: 'Gestão completa de contratos com aditivos, fiscais, consumo de saldo e alertas de vigência automatizados.', tag: 'Gestão' },
  { icon: Archive, title: 'Histórico de Licitações', desc: 'Registro completo de todos os processos participados com métricas de desempenho e lições aprendidas.', tag: 'Gestão' },

  // Inteligência
  { icon: DollarSign, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, pesquisa em 30+ fontes de mercado, consulta ao PNCP e calculadora tributária por regime e UF.', tag: 'Inteligência' },
  { icon: FileBarChart, title: 'Proposta Comercial', desc: 'Geração de propostas ABNT com planilha de preços, declarações, assinatura digital via A1 e papel timbrado personalizado.', tag: 'Inteligência' },
  { icon: TrendingUp, title: 'Análise de Mercado', desc: 'Dados de contratos governamentais, transparência e benchmarking competitivo para embasar decisões estratégicas.', tag: 'Inteligência' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulta CNPJ, Sintegra, certidões negativas e análise documental de competidores com IA baseada na Lei 14.133/21.', tag: 'Inteligência' },
  { icon: Truck, title: 'Cotação de Frete', desc: 'Cálculo de custos logísticos e comparação de transportadoras para composição de preços em licitações.', tag: 'Inteligência' },

  // Jurídico
  { icon: Scale, title: 'Apoio Jurídico IA', desc: '24 modelos de peças jurídicas: impugnações, recursos, reequilíbrio, mandados de segurança — fundamentados na Lei 14.133/21 e TCU.', tag: 'Jurídico' },
  { icon: Calculator, title: 'Apoio Contábil', desc: 'Diagnóstico de balanços patrimoniais e DREs via IA com análise NBC TSP, LRF e formação de preços estratégicos.', tag: 'Jurídico' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Organize certidões, atestados e habilitações com alertas automáticos de vencimento, renovação e merge de PDFs.', tag: 'Jurídico' },
  { icon: ClipboardCheck, title: 'Assessoria Cadastral', desc: 'Apoio especializado no cadastro e manutenção de registros junto a órgãos e portais de compras públicas.', tag: 'Jurídico' },
  { icon: BarChart3, title: 'Índices & Repactuação', desc: 'Consulta a índices econômicos (IPCA, INPC, IGP-M) e cálculo automatizado de reajustes e repactuações contratuais.', tag: 'Jurídico' },

  // Automação
  { icon: Crosshair, title: 'Robô de Lances', desc: 'Estratégias automatizadas para pregão eletrônico com agente externo via webhook e suporte a certificado A1.', tag: 'Automação' },
  { icon: Workflow, title: 'Workflow IA', desc: 'Orquestração autônoma de 8 etapas: Pesquisa → Seleção → Agendamento → Alertas → Precificação → Documentação → Proposta → Lances.', tag: 'Automação' },
  { icon: Bot, title: 'Assistente IA', desc: 'Chat inteligente para dúvidas sobre editais, legislação, estratégias de lances e geração de documentos em tempo real.', tag: 'Automação' },
  { icon: MessageSquare, title: 'WhatsApp CRM', desc: 'Gerenciamento de comunicação com fornecedores e clientes via WhatsApp com templates, broadcasts e pipeline de vendas.', tag: 'Automação' },
];

const tagColors: Record<string, string> = {
  'Monitoramento': 'bg-primary/10 text-primary',
  'Gestão': 'bg-accent/10 text-accent',
  'Inteligência': 'bg-info/10 text-info',
  'Jurídico': 'bg-destructive/10 text-destructive',
  'Automação': 'bg-warning/10 text-warning',
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
              40+ módulos integrados para monitoramento, gestão de processos, precificação inteligente, automação e apoio jurídico-contábil em licitações públicas.
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
