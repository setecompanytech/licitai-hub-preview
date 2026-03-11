import { useState } from 'react';
import {
  Search, Bot, Shield, Users, BarChart3, FileText, Bell, Scale,
  TrendingUp, Brain, Kanban, Crosshair, CalendarDays, ListChecks,
  ClipboardCheck, Calculator, MessageSquare, DollarSign,
  Download, Target, Archive, Workflow, FileBarChart, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const categories = ['Todos', 'Monitoramento', 'Gestão', 'Inteligência', 'Jurídico', 'Automação'];

type Feature = {
  icon: typeof Search;
  title: string;
  desc: string;
  tag: string;
  details: string;
};

const features: Feature[] = [
  { icon: Search, title: 'Monitoramento 24/7', desc: 'Busca automática em 38+ portais — PNCP, BLL, BNC, BEC/SP, Licitações-e, ComprasNet e sistemas estaduais.', tag: 'Monitoramento',
    details: 'O módulo de Monitoramento 24/7 realiza buscas automáticas e contínuas em mais de 38 portais de compras públicas, incluindo PNCP, BLL, BNC, BEC/SP, Licitações-e, ComprasNet e diversos sistemas estaduais. Você recebe alertas em tempo real sempre que um edital compatível com o perfil da sua empresa é publicado, garantindo que nenhuma oportunidade passe despercebida.' },
  { icon: Bell, title: 'Boletins & Alertas', desc: 'Notificações por e-mail, push e WhatsApp ao detectar editais compatíveis com o perfil da empresa.', tag: 'Monitoramento',
    details: 'Configure notificações personalizadas por e-mail, push e WhatsApp. O sistema detecta automaticamente editais compatíveis com o CNAE, palavras-chave e região da sua empresa, enviando boletins nos horários de sua preferência (manhã, meio-dia e tarde).' },
  { icon: Brain, title: 'Busca Inteligente IA', desc: 'Motor de busca com IA que identifica editais relevantes baseado no perfil, CNAE e histórico.', tag: 'Monitoramento',
    details: 'Utilize inteligência artificial para encontrar editais com alta relevância para o seu negócio. O motor analisa o perfil da empresa, CNAEs, histórico de participações e palavras-chave para ranquear oportunidades por score de viabilidade, economizando horas de pesquisa manual.' },
  { icon: Download, title: 'Download de Editais', desc: 'Download consolidado de anexos oficiais com resumos executivos gerados por IA.', tag: 'Monitoramento',
    details: 'Baixe todos os anexos de editais de forma consolidada em um único clique. A IA gera resumos executivos automaticamente, destacando pontos críticos como prazos, exigências de habilitação e critérios de julgamento.' },
  { icon: Target, title: 'Licitações Estratégicas', desc: 'Gestão de oportunidades com score de viabilidade, cronômetros e alertas automáticos.', tag: 'Gestão',
    details: 'Gerencie suas oportunidades com um painel estratégico que calcula o score de viabilidade de cada licitação. Cronômetros regressivos alertam sobre prazos importantes e o sistema sugere quais processos priorizar com base no histórico de sucesso.' },
  { icon: Kanban, title: 'Kanban de Processos', desc: 'Quadro visual com 8 etapas: Monitorando, Analisando, Proposta, Em Disputa, Vencida e mais.', tag: 'Gestão',
    details: 'Acompanhe cada licitação através de um quadro Kanban visual com 8 etapas: Monitorando, Analisando, Elaborando Proposta, Proposta Enviada, Em Disputa, Vencida, Perdida e Arquivada. Arraste e solte para atualizar o status e mantenha toda a equipe alinhada.' },
  { icon: CalendarDays, title: 'Calendário Unificado', desc: 'Datas de abertura, vencimentos de documentos e credenciais em uma única visão.', tag: 'Gestão',
    details: 'Visualize em um único calendário todas as datas relevantes: aberturas de licitações, vencimentos de certidões, credenciais de portais e compromissos da equipe. Sincronize com Google Calendar e receba lembretes automáticos.' },
  { icon: ListChecks, title: 'Compromissos & Prazos', desc: 'Controle de compromissos com cronômetros regressivos para múltiplas empresas.', tag: 'Gestão',
    details: 'Gerencie compromissos e prazos de múltiplas empresas em um único painel. Cronômetros regressivos indicam a urgência de cada item e alertas automáticos garantem que nenhum prazo seja perdido.' },
  { icon: FileText, title: 'Gestão de Contratos', desc: 'Contratos com aditivos, fiscais, consumo de saldo e alertas de vigência.', tag: 'Gestão',
    details: 'Controle completo de contratos ativos: registre aditivos, defina fiscais responsáveis, acompanhe o consumo de saldo e receba alertas antes do vencimento da vigência. Relatórios gerenciais ajudam na tomada de decisão sobre renovações e repactuações.' },
  { icon: Archive, title: 'Histórico Completo', desc: 'Registro de todos os processos participados com métricas de desempenho.', tag: 'Gestão',
    details: 'Mantenha um registro histórico de todos os processos licitatórios participados. Analise métricas de desempenho como taxa de vitória, valor médio por licitação e evolução ao longo do tempo para refinar sua estratégia competitiva.' },
  { icon: DollarSign, title: 'Precificação Inteligente', desc: 'Composição de custos com BDI, pesquisa em 30+ fontes e calculadora tributária.', tag: 'Inteligência',
    details: 'Monte composições de custos completas com BDI diferenciado por regime tributário. Pesquise preços em mais de 30 fontes oficiais, utilize a calculadora tributária integrada e gere planilhas de preços prontas para envio.' },
  { icon: FileBarChart, title: 'Proposta Comercial', desc: 'Propostas ABNT com planilha de preços, declarações e papel timbrado personalizado.', tag: 'Inteligência',
    details: 'Gere propostas comerciais em conformidade com a ABNT, incluindo planilha de preços, declarações obrigatórias e papel timbrado personalizado da empresa. Exporte em PDF pronto para envio nos portais de compras.' },
  { icon: TrendingUp, title: 'Análise de Mercado', desc: 'Dados de contratos governamentais e benchmarking competitivo para decisões estratégicas.', tag: 'Inteligência',
    details: 'Acesse dados de contratos governamentais para realizar benchmarking competitivo. Analise preços praticados, identifique tendências de mercado e tome decisões estratégicas fundamentadas em dados reais.' },
  { icon: Users, title: 'Análise de Concorrentes', desc: 'Consulta CNPJ, Sintegra, certidões negativas e análise documental de competidores.', tag: 'Inteligência',
    details: 'Consulte dados de concorrentes via CNPJ, Sintegra e certidões negativas. Analise o perfil documental de competidores para identificar pontos fortes e fracos, ajustando sua estratégia de participação.' },
  { icon: Scale, title: 'Apoio Jurídico IA', desc: '24 modelos de peças jurídicas fundamentados na Lei 14.133/21 e jurisprudência do TCU.', tag: 'Jurídico',
    details: 'Acesse 24 modelos de peças jurídicas (impugnações, recursos, contrarrazões, mandados de segurança e mais) fundamentados na Lei 14.133/21 e jurisprudência atualizada do TCU. A IA personaliza cada documento com os dados do seu caso.' },
  { icon: Calculator, title: 'Apoio Contábil', desc: 'Diagnóstico de balanços patrimoniais e DREs via IA com análise NBC TSP e LRF.', tag: 'Jurídico',
    details: 'Faça o upload de balanços patrimoniais e demonstrativos de resultados para obter diagnósticos automáticos via IA. A análise segue as normas NBC TSP e LRF, identificando pontos de atenção para habilitação em licitações.' },
  { icon: Shield, title: 'Gestão de Documentos', desc: 'Certidões, atestados e habilitações com alertas de vencimento e merge de PDFs.', tag: 'Jurídico',
    details: 'Organize todas as certidões, atestados de capacidade técnica e documentos de habilitação em um único local. Receba alertas antes do vencimento e utilize o merge de PDFs para consolidar documentos para envio.' },
  { icon: ClipboardCheck, title: 'Assessoria Cadastral', desc: 'Apoio no cadastro e manutenção de registros junto a órgãos e portais.', tag: 'Jurídico',
    details: 'Receba apoio especializado no cadastro e manutenção de registros junto a órgãos públicos e portais de compras. O módulo orienta sobre documentação necessária e prazos de renovação.' },
  { icon: BarChart3, title: 'Índices & Repactuação', desc: 'Consulta a IPCA, INPC, IGP-M e cálculo automatizado de reajustes contratuais.', tag: 'Jurídico',
    details: 'Consulte índices econômicos atualizados (IPCA, INPC, IGP-M, SINAPI) e calcule automaticamente reajustes e repactuações contratuais. Gere memórias de cálculo prontas para fundamentar pedidos de reequilíbrio.' },
  { icon: Crosshair, title: 'Robô de Lances', desc: 'Estratégias automatizadas para pregão eletrônico com agente externo via webhook.', tag: 'Automação',
    details: 'Configure estratégias automatizadas de lances para pregões eletrônicos. O robô pode operar via agente externo com webhook, aplicando regras como lance mínimo, decrementos programados e limites de preço para maximizar suas chances de vitória.' },
  { icon: Workflow, title: 'Workflow IA', desc: 'Orquestração autônoma de 8 etapas: Pesquisa → Seleção → Proposta → Lances.', tag: 'Automação',
    details: 'Automatize todo o fluxo licitatório com orquestração inteligente em 8 etapas: Pesquisa de editais, Triagem, Análise de viabilidade, Seleção, Elaboração de proposta, Precificação, Envio e Acompanhamento de disputa.' },
  { icon: Bot, title: 'Assistente IA', desc: 'Chat inteligente para dúvidas sobre editais, legislação e geração de documentos.', tag: 'Automação',
    details: 'Converse com um assistente de IA especializado em licitações públicas. Tire dúvidas sobre editais, legislação (Lei 14.133/21, Lei 8.666/93), gere documentos e obtenha orientações estratégicas em tempo real.' },
  { icon: MessageSquare, title: 'WhatsApp CRM', desc: 'Comunicação com fornecedores via WhatsApp com templates, broadcasts e pipeline.', tag: 'Automação',
    details: 'Gerencie a comunicação com fornecedores e equipe via WhatsApp integrado. Utilize templates pré-aprovados, envie broadcasts segmentados e acompanhe negociações em um pipeline visual.' },
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
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const filtered = activeCategory === 'Todos' ? features : features.filter(f => f.tag === activeCategory);

  return (
    <section id="features" className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-label">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12]">
              Tudo que você precisa para <span className="text-accent">licitar com tranquilidade</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed mt-4 mx-auto">
              40+ módulos integrados para simplificar seu dia a dia, desde o monitoramento até a gestão completa de processos.
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
            {filtered.map((f) => (
              <motion.div
                key={f.title}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="group relative bg-card rounded-xl border border-border/50 p-6 hover:border-accent/40 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted group-hover:bg-accent/15 transition-colors">
                    <f.icon className="w-5 h-5 text-accent/70 group-hover:text-accent transition-colors" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagColors[f.tag] || 'bg-muted text-muted-foreground border-border'}`}>
                    {f.tag}
                  </span>
                </div>
                <h3
                  className="text-sm font-bold mb-1.5 cursor-pointer hover:text-accent transition-colors"
                  onClick={() => setSelectedFeature(f)}
                >
                  {f.title}
                </h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Feature detail dialog */}
      <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
        <DialogContent className="max-w-lg">
          {selectedFeature && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/10">
                    <selectedFeature.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">{selectedFeature.title}</DialogTitle>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagColors[selectedFeature.tag] || ''}`}>
                      {selectedFeature.tag}
                    </span>
                  </div>
                </div>
              </DialogHeader>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
                {selectedFeature.details}
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
