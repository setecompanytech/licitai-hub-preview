import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, FileText, ArrowRight, GripVertical, Bot, Trophy,
  CheckCircle2, Building2, Settings, Zap, Brain, Download,
  Star, Send, BarChart3, BookOpen,
} from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Configure sua Empresa',
    subtitle: 'Pré-requisito',
    description: 'Cadastre os dados da sua empresa (CNPJ, CNAE, UF) para que o sistema personalize as buscas e filtre licitações compatíveis com sua atividade.',
    icon: Building2,
    color: 'hsl(var(--muted-foreground))',
    route: '/empresas',
    buttonLabel: 'Ir para Empresas',
    tips: [
      'Preencha o CNAE principal — ele é usado para filtrar editais compatíveis',
      'Adicione CNAEs secundários em Configurações para ampliar o monitoramento',
      'Cadastre os dados do representante legal para agilizar propostas',
    ],
  },
  {
    number: 2,
    title: 'Configure a Pesquisa',
    subtitle: 'Personalização',
    description: 'Defina palavras-chave, UFs de interesse e faixas de valor na aba "Configuração de Pesquisa" do Monitoramento para receber resultados relevantes.',
    icon: Settings,
    color: 'hsl(var(--warning))',
    route: '/monitoramento-editais',
    buttonLabel: 'Configurar Pesquisa',
    tips: [
      'Use palavras-chave específicas do seu segmento (ex: "material hospitalar", "TI")',
      'Selecione as UFs onde sua empresa pode operar',
      'Configure valores mínimo e máximo para filtrar por faixa de preço',
    ],
  },
  {
    number: 3,
    title: 'Busque Editais nos Portais',
    subtitle: 'Monitoramento',
    description: 'Na aba "Licitações" do Monitoramento, digite o que deseja buscar e clique em "Buscar". O sistema pesquisa em até 13 portais simultaneamente com análise de IA.',
    icon: Search,
    color: 'hsl(var(--info))',
    route: '/monitoramento-editais',
    buttonLabel: 'Ir para Monitoramento',
    tips: [
      'Selecione múltiplos portais nos filtros avançados para ampliar a cobertura',
      'Ative a "Análise IA" para receber insights automáticos sobre os resultados',
      'Use as sugestões rápidas para buscas comuns do seu segmento',
    ],
  },
  {
    number: 4,
    title: 'Analise e Favorite Editais',
    subtitle: 'Triagem',
    description: 'Para cada edital encontrado, clique em "Resumo IA do Edital" para obter uma análise completa. Use a ⭐ para salvar os editais mais promissores nos favoritos.',
    icon: Star,
    color: 'hsl(var(--accent))',
    route: '/monitoramento-editais',
    buttonLabel: 'Ver Licitações',
    tips: [
      'O resumo IA identifica riscos, requisitos de habilitação e viabilidade',
      'Baixe o edital completo e os anexos direto pela tabela',
      'Filtre por "Somente favoritos" para revisar sua seleção',
    ],
  },
  {
    number: 5,
    title: 'Inicie o Processo',
    subtitle: 'Conversão',
    description: 'Clique no botão "Iniciar" ao lado do edital desejado. Isso converte o edital monitorado em um processo gerenciado que aparecerá no Kanban.',
    icon: Zap,
    color: 'hsl(var(--primary))',
    route: '/monitoramento-editais',
    buttonLabel: 'Iniciar um Processo',
    highlight: true,
    tips: [
      'O sistema verifica duplicidade — não cria processos repetidos',
      'Uma mensagem é enviada automaticamente ao Mural do processo',
      'Uma notificação é gerada confirmando a criação',
    ],
  },
  {
    number: 6,
    title: 'Gerencie no Kanban',
    subtitle: 'Gestão',
    description: 'O processo aparece na coluna "Monitorando" do Kanban. Arraste entre as colunas conforme o ciclo de vida avança: Analisando → Proposta → Em Disputa → Vencida/Perdida.',
    icon: GripVertical,
    color: 'hsl(var(--success))',
    route: '/kanban',
    buttonLabel: 'Abrir Kanban',
    tips: [
      'Clique no ✏️ para editar detalhes do processo (valor, datas, status)',
      'Cada mudança de status gera uma notificação e registro no mural',
      'O Kanban tem 8 colunas cobrindo todo o ciclo de vida',
    ],
  },
  {
    number: 7,
    title: 'Elabore a Proposta e Precifique',
    subtitle: 'Preparação',
    description: 'Use o módulo de Precificação para calcular custos, tributos e BDI. Monte a proposta técnica com os dados da empresa e do edital já preenchidos.',
    icon: FileText,
    color: 'hsl(var(--accent))',
    route: '/precificacao',
    buttonLabel: 'Ir para Precificação',
    tips: [
      'A Calculadora Tributária calcula automaticamente impostos por regime',
      'Salve itens precificados no Catálogo para reutilizar em futuras licitações',
      'Importe itens do catálogo diretamente na proposta técnica',
    ],
  },
  {
    number: 8,
    title: 'Participe da Disputa',
    subtitle: 'Robô de Lances',
    description: 'No módulo Robô de Lances, configure parâmetros de lance automático (valor mínimo, decremento, estratégia). Simule disputas ou conecte um agente externo para lances reais.',
    icon: Bot,
    color: 'hsl(var(--destructive))',
    route: '/robo-lances',
    buttonLabel: 'Ir para Robô de Lances',
    tips: [
      'Use a simulação para testar estratégias antes da disputa real',
      'Configure o agente externo com seu certificado A1 para lances automatizados',
      'O resultado da disputa atualiza automaticamente o status no Kanban',
    ],
  },
  {
    number: 9,
    title: 'Acompanhe os Resultados',
    subtitle: 'Analytics',
    description: 'Acesse o Dashboard e o módulo Analytics para acompanhar taxa de sucesso, valores adjudicados, processos por status e desempenho geral.',
    icon: BarChart3,
    color: 'hsl(210, 80%, 45%)',
    route: '/analytics',
    buttonLabel: 'Ver Analytics',
    tips: [
      'O painel mostra processos com encerramento em menos de 3 dias com alerta visual',
      'Acompanhe o valor total estimado em gestão pelo Kanban',
      'Processos vencidos e homologados ficam no histórico para consulta futura',
    ],
  },
];

export default function TutorialPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="w-7 h-7 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight">
              Guia: Do Monitoramento à Gestão
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Siga este roteiro passo a passo para aproveitar todo o potencial da plataforma — desde a busca de editais até a gestão completa do processo licitatório.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-xs">
              {steps.length} etapas
            </Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
              Fluxo completo
            </Badge>
          </div>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-info via-accent to-success opacity-30 hidden md:block" />

          <div className="space-y-6">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isLast = idx === steps.length - 1;
              return (
                <div
                  key={step.number}
                  className={`relative flex gap-5 ${step.highlight ? 'animate-fade-in' : ''}`}
                >
                  {/* Step number circle */}
                  <div className="flex-shrink-0 relative z-10">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md border border-border/50"
                      style={{ background: `${step.color}15`, borderColor: `${step.color}40` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: step.color }} />
                    </div>
                  </div>

                  {/* Content card */}
                  <div
                    className={`flex-1 bg-card rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
                      step.highlight
                        ? 'border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]'
                        : 'border-border/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0 font-mono"
                            style={{ color: step.color, borderColor: `${step.color}40`, background: `${step.color}10` }}
                          >
                            Passo {step.number}
                          </Badge>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            {step.subtitle}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold">{step.title}</h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 flex-shrink-0 hover:bg-accent/10 hover:text-accent hover:border-accent/40"
                        onClick={() => navigate(step.route)}
                      >
                        {step.buttonLabel}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {step.description}
                    </p>

                    {/* Tips */}
                    <div className="space-y-1.5">
                      {step.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: step.color }} />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>

                    {/* Arrow to next */}
                    {!isLast && (
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        Próximo: {steps[idx + 1].title}
                      </div>
                    )}

                    {isLast && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30 text-xs text-success font-medium">
                        <Trophy className="w-4 h-4" />
                        Fluxo completo! Agora é gerenciar e vencer licitações.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA bottom */}
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-6 text-center space-y-3">
          <h3 className="text-lg font-semibold">Pronto para começar?</h3>
          <p className="text-sm text-muted-foreground">
            O primeiro passo é buscar editais no Monitoramento e iniciar um processo.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/monitoramento-editais')}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
            >
              <Search className="w-4 h-4" />
              Ir para Monitoramento
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/kanban')}
              className="gap-2"
            >
              <GripVertical className="w-4 h-4" />
              Abrir Kanban
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
