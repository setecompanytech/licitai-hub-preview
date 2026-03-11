import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bot, Shield, Users, BarChart3, FileText, Bell, Scale,
  TrendingUp, Brain, Kanban, Crosshair, CalendarDays, ListChecks,
  ClipboardCheck, Calculator, MessageSquare, DollarSign,
  Download, Target, Archive, Workflow, FileBarChart,
  ArrowRight, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const categories = ['Todos', 'Monitoramento', 'Gestão', 'Inteligência', 'Jurídico', 'Automação'];

type Feature = {
  icon: typeof Search;
  title: string;
  desc: string;
  tag: string;
  route: string;
  actions: { label: string; route: string }[];
};

const features: Feature[] = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automática em 38+ portais — PNCP, BLL, BNC, BEC/SP, Licitações-e, ComprasNet e sistemas estaduais.', tag: 'Monitoramento', route: '/monitoramento', actions: [
    { label: 'Buscar Editais', route: '/monitoramento' },
    { label: 'Busca Inteligente', route: '/busca-inteligente-ia' },
    { label: 'Dispensas Eletrônicas', route: '/monitoramento' },
  ]},
  { icon: Bell, title: 'Boletins & Alertas', desc: 'Notificações por e-mail, push e WhatsApp ao detectar editais compatíveis com o perfil da empresa.', tag: 'Monitoramento', route: '/boletins', actions: [
    { label: 'Configurar Alertas', route: '/boletins' },
    { label: 'Preferências', route: '/configuracoes' },
  ]},
  { icon: Brain, title: 'Busca Inteligente IA', desc: 'Motor de busca com IA que identifica editais relevantes baseado no perfil, CNAE e histórico.', tag: 'Monitoramento', route: '/busca-inteligente-ia', actions: [
    { label: 'Pesquisar com IA', route: '/busca-inteligente-ia' },
    { label: 'Configurar Perfil', route: '/configuracoes' },
  ]},
  { icon: Download, title: 'Download de Editais', desc: 'Download consolidado de anexos oficiais com resumos executivos gerados por IA.', tag: 'Monitoramento', route: '/monitoramento', actions: [
    { label: 'Acessar Downloads', route: '/monitoramento' },
  ]},
  { icon: Target, title: 'Licitações Estratégicas', desc: 'Gestão de oportunidades com score de viabilidade, cronômetros e alertas automáticos.', tag: 'Gestão', route: '/licitacoes-estrategicas', actions: [
    { label: 'Ver Oportunidades', route: '/licitacoes-estrategicas' },
    { label: 'Novo Acompanhamento', route: '/licitacoes-estrategicas' },
  ]},
  { icon: Kanban, title: 'Kanban de Processos', desc: 'Quadro visual com 8 etapas: Monitorando, Analisando, Proposta, Em Disputa, Vencida e mais.', tag: 'Gestão', route: '/kanban', actions: [
    { label: 'Abrir Kanban', route: '/kanban' },
    { label: 'Meus Compromissos', route: '/meus-compromissos' },
  ]},
  { icon: CalendarDays, title: 'Calendário Unificado', desc: 'Datas de abertura, vencimentos de documentos e credenciais em uma única visão.', tag: 'Gestão', route: '/calendario', actions: [
    { label: 'Ver Calendário', route: '/calendario' },
  ]},
  { icon: ListChecks, title: 'Compromissos & Prazos', desc: 'Controle de compromissos com cronômetros regressivos para múltiplas empresas.', tag: 'Gestão', route: '/meus-compromissos', actions: [
    { label: 'Ver Compromissos', route: '/meus-compromissos' },
  ]},
  { icon: FileText, title: 'Gestão de Contratos', desc: 'Contratos com aditivos, fiscais, consumo de saldo e alertas de vigência.', tag: 'Gestão', route: '/gestao-contratos', actions: [
    { label: 'Gerenciar Contratos', route: '/gestao-contratos' },
    { label: 'Índices de Reajuste', route: '/indices-repactuacao' },
  ]},
  { icon: Archive, title: 'Histórico Completo', desc: 'Registro de todos os processos participados com métricas de desempenho.', tag: 'Gestão', route: '/historico', actions: [
    { label: 'Ver Histórico', route: '/historico' },
  ]},
  { icon: DollarSign, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, pesquisa em 30+ fontes e calculadora tributária.', tag: 'Inteligência', route: '/precificacao', actions: [
    { label: 'Compor Preços', route: '/precificacao' },
    { label: 'Catálogo de Itens', route: '/precificacao' },
    { label: 'Calculadora Tributária', route: '/precificacao' },
  ]},
  { icon: FileBarChart, title: 'Proposta Comercial', desc: 'Propostas ABNT com planilha de preços, declarações e papel timbrado personalizado.', tag: 'Inteligência', route: '/proposta-tecnica', actions: [
    { label: 'Criar Proposta', route: '/proposta-tecnica' },
    { label: 'Templates', route: '/proposta-tecnica' },
  ]},
  { icon: TrendingUp, title: 'Análise de Mercado', desc: 'Dados de contratos governamentais e benchmarking competitivo para decisões estratégicas.', tag: 'Inteligência', route: '/analise-mercado', actions: [
    { label: 'Ver Análise', route: '/analise-mercado' },
  ]},
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulta CNPJ, Sintegra, certidões negativas e análise documental de competidores.', tag: 'Inteligência', route: '/concorrentes', actions: [
    { label: 'Consultar CNPJ', route: '/concorrentes' },
    { label: 'Certidões Negativas', route: '/concorrentes' },
  ]},
  { icon: Scale, title: 'Apoio Jurídico IA', desc: '24 modelos de peças jurídicas fundamentados na Lei 14.133/21 e jurisprudência do TCU.', tag: 'Jurídico', route: '/apoio-juridico', actions: [
    { label: 'Gerar Peça Jurídica', route: '/apoio-juridico' },
    { label: 'Base Jurisprudencial', route: '/apoio-juridico' },
  ]},
  { icon: Calculator, title: 'Apoio Contábil', desc: 'Diagnóstico de balanços patrimoniais e DREs via IA com análise NBC TSP e LRF.', tag: 'Jurídico', route: '/apoio-contabil', actions: [
    { label: 'Analisar Balanço', route: '/apoio-contabil' },
  ]},
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Certidões, atestados e habilitações com alertas de vencimento e merge de PDFs.', tag: 'Jurídico', route: '/documentos', actions: [
    { label: 'Meus Documentos', route: '/documentos' },
    { label: 'Merge de PDFs', route: '/documentos' },
  ]},
  { icon: ClipboardCheck, title: 'Assessoria Cadastral', desc: 'Apoio no cadastro e manutenção de registros junto a órgãos e portais.', tag: 'Jurídico', route: '/assessoria-cadastral', actions: [
    { label: 'Acessar Assessoria', route: '/assessoria-cadastral' },
  ]},
  { icon: BarChart3, title: 'Índices & Repactuação', desc: 'Consulta a IPCA, INPC, IGP-M e cálculo automatizado de reajustes contratuais.', tag: 'Jurídico', route: '/indices-repactuacao', actions: [
    { label: 'Consultar Índices', route: '/indices-repactuacao' },
  ]},
  { icon: Crosshair, title: 'Robô de Lances', desc: 'Estratégias automatizadas para pregão eletrônico com agente externo via webhook.', tag: 'Automação', route: '/robo-lances', actions: [
    { label: 'Configurar Robô', route: '/robo-lances' },
    { label: 'Simular Disputa', route: '/robo-lances' },
  ]},
  { icon: Workflow, title: 'Workflow IA', desc: 'Orquestração autônoma de 8 etapas: Pesquisa → Seleção → Proposta → Lances.', tag: 'Automação', route: '/workflow-ia', actions: [
    { label: 'Criar Workflow', route: '/workflow-ia' },
  ]},
  { icon: Bot, title: 'Assistente IA', desc: 'Chat inteligente para dúvidas sobre editais, legislação e geração de documentos.', tag: 'Automação', route: '/assistente', actions: [
    { label: 'Abrir Assistente', route: '/assistente' },
  ]},
  { icon: MessageSquare, title: 'WhatsApp CRM', desc: 'Comunicação com fornecedores via WhatsApp com templates, broadcasts e pipeline.', tag: 'Automação', route: '/whatsapp-crm', actions: [
    { label: 'Abrir CRM', route: '/whatsapp-crm' },
    { label: 'Templates', route: '/whatsapp-crm' },
  ]},
];

const tagColors: Record<string, string> = {
  'Monitoramento': 'bg-primary/8 text-primary border-primary/15',
  'Gestão': 'bg-accent/8 text-accent border-accent/15',
  'Inteligência': 'bg-info/8 text-info border-info/15',
  'Jurídico': 'bg-warning/8 text-warning border-warning/15',
  'Automação': 'bg-success/8 text-success border-success/15',
};

export default function FeaturesSection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const filtered = activeCategory === 'Todos' ? features : features.filter(f => f.tag === activeCategory);

  return (
    <section id="features" className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12]">
              Tudo que você precisa para <span className="text-accent">licitar e vencer</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed mt-4 mx-auto">
              40+ módulos integrados para monitoramento, gestão, precificação e apoio jurídico-contábil.
            </p>
          </motion.div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all border ${
                activeCategory === cat
                  ? 'bg-accent text-accent-foreground border-accent shadow-md'
                  : 'bg-card text-muted-foreground border-border hover:border-accent/30 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((f) => {
              const isHovered = hoveredFeature === f.title;

              return (
                <motion.div
                  key={f.title}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="group relative bg-card rounded-xl border border-border/50 p-6 hover:border-accent/40 hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredFeature(f.title)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  onClick={() => navigate('/auth')}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      isHovered ? 'bg-accent/15' : 'bg-muted'
                    }`}>
                      <f.icon className={`w-5 h-5 transition-colors ${isHovered ? 'text-accent' : 'text-accent/70'}`} />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagColors[f.tag] || 'bg-muted text-muted-foreground border-border'}`}>
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>

                  {/* Hover actions overlay */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card via-card/98 to-card/80 rounded-b-xl p-4 pt-8 border-t border-accent/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {f.actions.map((action) => (
                            <Button
                              key={action.label}
                              size="sm"
                              variant="outline"
                              className="text-[11px] h-7 px-2.5 rounded-md border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all font-semibold"
                              onClick={() => navigate('/auth')}
                            >
                              {action.label}
                              <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
