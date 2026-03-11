import { useState } from 'react';
import {
  Search, Bot, Shield, Users, BarChart3, FileText, Bell, Scale,
  TrendingUp, Brain, Kanban, Crosshair, CalendarDays, ListChecks,
  ClipboardCheck, Calculator, MessageSquare, DollarSign,
  Download, Target, Archive, Workflow, FileBarChart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['Todos', 'Monitoramento', 'Gestão', 'Inteligência', 'Jurídico', 'Automação'];

const features = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automática em 38+ portais — PNCP, BLL, BNC, BEC/SP, Licitações-e, ComprasNet e sistemas estaduais.', tag: 'Monitoramento' },
  { icon: Bell, title: 'Boletins & Alertas', desc: 'Notificações por e-mail, push e WhatsApp ao detectar editais compatíveis com o perfil da empresa.', tag: 'Monitoramento' },
  { icon: Brain, title: 'Busca Inteligente IA', desc: 'Motor de busca com IA que identifica editais relevantes baseado no perfil, CNAE e histórico.', tag: 'Monitoramento' },
  { icon: Download, title: 'Download de Editais', desc: 'Download consolidado de anexos oficiais com resumos executivos gerados por IA.', tag: 'Monitoramento' },
  { icon: Target, title: 'Licitações Estratégicas', desc: 'Gestão de oportunidades com score de viabilidade, cronômetros e alertas automáticos.', tag: 'Gestão' },
  { icon: Kanban, title: 'Kanban de Processos', desc: 'Quadro visual com 8 etapas: Monitorando, Analisando, Proposta, Em Disputa, Vencida e mais.', tag: 'Gestão' },
  { icon: CalendarDays, title: 'Calendário Unificado', desc: 'Datas de abertura, vencimentos de documentos e credenciais em uma única visão.', tag: 'Gestão' },
  { icon: ListChecks, title: 'Compromissos & Prazos', desc: 'Controle de compromissos com cronômetros regressivos para múltiplas empresas.', tag: 'Gestão' },
  { icon: FileText, title: 'Gestão de Contratos', desc: 'Contratos com aditivos, fiscais, consumo de saldo e alertas de vigência.', tag: 'Gestão' },
  { icon: Archive, title: 'Histórico Completo', desc: 'Registro de todos os processos participados com métricas de desempenho.', tag: 'Gestão' },
  { icon: DollarSign, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, pesquisa em 30+ fontes e calculadora tributária.', tag: 'Inteligência' },
  { icon: FileBarChart, title: 'Proposta Comercial', desc: 'Propostas ABNT com planilha de preços, declarações e papel timbrado personalizado.', tag: 'Inteligência' },
  { icon: TrendingUp, title: 'Análise de Mercado', desc: 'Dados de contratos governamentais e benchmarking competitivo para decisões estratégicas.', tag: 'Inteligência' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulta CNPJ, Sintegra, certidões negativas e análise documental de competidores.', tag: 'Inteligência' },
  { icon: Scale, title: 'Apoio Jurídico IA', desc: '24 modelos de peças jurídicas fundamentados na Lei 14.133/21 e jurisprudência do TCU.', tag: 'Jurídico' },
  { icon: Calculator, title: 'Apoio Contábil', desc: 'Diagnóstico de balanços patrimoniais e DREs via IA com análise NBC TSP e LRF.', tag: 'Jurídico' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Certidões, atestados e habilitações com alertas de vencimento e merge de PDFs.', tag: 'Jurídico' },
  { icon: ClipboardCheck, title: 'Assessoria Cadastral', desc: 'Apoio no cadastro e manutenção de registros junto a órgãos e portais.', tag: 'Jurídico' },
  { icon: BarChart3, title: 'Índices & Repactuação', desc: 'Consulta a IPCA, INPC, IGP-M e cálculo automatizado de reajustes contratuais.', tag: 'Jurídico' },
  { icon: Crosshair, title: 'Robô de Lances', desc: 'Estratégias automatizadas para pregão eletrônico com agente externo via webhook.', tag: 'Automação' },
  { icon: Workflow, title: 'Workflow IA', desc: 'Orquestração autônoma de 8 etapas: Pesquisa → Seleção → Proposta → Lances.', tag: 'Automação' },
  { icon: Bot, title: 'Assistente IA', desc: 'Chat inteligente para dúvidas sobre editais, legislação e geração de documentos.', tag: 'Automação' },
  { icon: MessageSquare, title: 'WhatsApp CRM', desc: 'Comunicação com fornecedores via WhatsApp com templates, broadcasts e pipeline.', tag: 'Automação' },
];

const tagColors: Record<string, string> = {
  'Monitoramento': 'bg-primary/8 text-primary border-primary/15',
  'Gestão': 'bg-accent/8 text-accent border-accent/15',
  'Inteligência': 'bg-info/8 text-info border-info/15',
  'Jurídico': 'bg-warning/8 text-warning border-warning/15',
  'Automação': 'bg-success/8 text-success border-success/15',
};

export default function FeaturesSection() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const filtered = activeCategory === 'Todos' ? features : features.filter(f => f.tag === activeCategory);

  return (
    <section id="features" className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4">Funcionalidades</p>
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
              className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-all border ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((f) => (
              <motion.div
                key={f.title}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="group bg-card rounded-lg border border-border/50 p-6 hover:border-accent/30 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                    <f.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagColors[f.tag] || 'bg-muted text-muted-foreground border-border'}`}>
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-sm font-bold mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
