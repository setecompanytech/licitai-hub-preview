import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Search, FileText, ArrowRight, GripVertical, Bot, Trophy,
  Check, CheckCircle2, Building2, Settings, Zap, BarChart3,
  Star, RotateCcw, PlayCircle, Circle,
} from 'lucide-react';

/* REBRAND — a cor por passo saiu.
   Cada um dos 9 passos carregava uma cor própria (info, accent, warning,
   destructive…), inclusive um `hsl(210, 80%, 45%)` escrito à mão — a única cor
   crua que sobrava nesta tela. Nove cores decorativas não informam nada: a
   pessoa não aprende que "amarelo é o passo 2". O que importa aqui é o ESTADO,
   e ele tem três valores. Então a cor passou a significar exatamente isso:

     concluído → verde (success)   atual → foreground   pendente → neutro

   O estado "atual" usava `navy` cru. `--navy` e `--foreground` são a MESMA cor
   no tema claro, mas no escuro o navy vira quase preto — texto invisível sobre
   o cartão. `text-foreground` reproduz a intenção nos dois temas.

   Mesma regra que a auditoria aplicou aos KPIs do painel: semântica só onde a
   cor comunica estado real. */

const steps = [
  {
    number: 1,
    title: 'Configure sua Empresa',
    subtitle: 'Pré-requisito',
    description: 'Cadastre os dados da sua empresa (CNPJ, CNAE, UF) para que o sistema personalize as buscas e filtre licitações compatíveis com sua atividade.',
    icon: Building2,
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
    route: '/monitoramento-editais',
    buttonLabel: 'Iniciar um Processo',
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
    route: '/analytics',
    buttonLabel: 'Ver Analytics',
    tips: [
      'O painel mostra processos com encerramento em menos de 3 dias com alerta visual',
      'Acompanhe o valor total estimado em gestão pelo Kanban',
      'Processos vencidos e homologados ficam no histórico para consulta futura',
    ],
  },
];

const TOTAL = steps.length;
const CHAVE = 'praefectus_tutorial_concluidos_v1';

/* O progresso mora no navegador, não no banco.
   É preferência de leitura de UMA pessoa em UM computador — não é dado da
   empresa, ninguém mais precisa ver, e gravar exigiria coluna, RLS e migration
   para registrar que alguém leu um passo de tutorial. Se um dia virar métrica
   de adoção, aí sim vira tabela, com dono e decisão próprios. */
function lerConcluidos(): number[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= TOTAL);
  } catch {
    return [];
  }
}

export default function TutorialPage() {
  const navigate = useNavigate();
  const [concluidos, setConcluidos] = useState<Set<number>>(new Set());
  const refsPassos = useRef<Record<number, HTMLLIElement | null>>({});

  useEffect(() => {
    setConcluidos(new Set(lerConcluidos()));
  }, []);

  const gravar = useCallback((proximo: Set<number>) => {
    setConcluidos(proximo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...proximo].sort((a, b) => a - b)));
    } catch {
      /* Aba anônima ou armazenamento bloqueado: a marcação vale para esta
         sessão e some ao fechar. Perder um check de tutorial não justifica
         interromper a leitura com um erro. */
    }
  }, []);

  const alternar = useCallback((n: number) => {
    const proximo = new Set(concluidos);
    if (proximo.has(n)) proximo.delete(n);
    else proximo.add(n);
    gravar(proximo);
  }, [concluidos, gravar]);

  const feitos = concluidos.size;
  const pct = Math.round((feitos / TOTAL) * 100);
  const completo = feitos === TOTAL;

  /* O passo "atual" é o primeiro que ainda não foi concluído — não o próximo na
     ordem. Quem marcou 1, 2 e 5 volta para o 3, que é o buraco real. */
  const atual = useMemo(() => {
    const pendente = steps.find((s) => !concluidos.has(s.number));
    return pendente?.number ?? null;
  }, [concluidos]);

  const irParaAtual = useCallback(() => {
    if (atual == null) return;
    refsPassos.current[atual]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [atual]);

  // Circunferência do anel: r = 26 → 2πr. O dashoffset é o que falta.
  const CIRC = 2 * Math.PI * 26;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl pb-12">
        {/* `/tutorial` é item de menu: título, descrição, ícone e trilha vêm do
            registro `lib/navegacao/paginas.ts`. */}
        <CabecalhoPagina />

        {/* Barra de progresso — acompanha a rolagem, como no protótipo, para
            que o "onde eu parei" não exija voltar ao topo. */}
        <div className="sticky top-2 z-30 mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-4 shadow-sm">
          <div className="relative h-14 w-14 shrink-0">
            <svg width="56" height="56" viewBox="0 0 56 56" className="block -rotate-90" aria-hidden="true">
              <circle cx="28" cy="28" r="26" fill="none" strokeWidth="4" className="stroke-muted" />
              <circle
                cx="28" cy="28" r="26" fill="none" strokeWidth="4" strokeLinecap="round"
                className={cn(
                  'transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none',
                  completo ? 'stroke-success' : 'stroke-foreground',
                )}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (CIRC * pct) / 100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-foreground">
              {pct}%
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              {completo
                ? 'Trilha concluída'
                : feitos === 0
                  ? 'Comece pelo primeiro passo'
                  : `Você parou no passo ${atual}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {TOTAL} etapas ·{' '}
              {feitos === 0 ? 'nenhuma concluída' : `${feitos} concluída${feitos > 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {feitos > 0 && (
              <Button variant="ghost" size="sm" onClick={() => gravar(new Set())}>
                <RotateCcw aria-hidden="true" />
                Zerar
              </Button>
            )}
            {atual != null && (
              <Button variant="outline" size="sm" onClick={irParaAtual}>
                <PlayCircle aria-hidden="true" />
                {feitos === 0 ? 'Começar' : 'Continuar de onde parei'}
              </Button>
            )}
          </div>
        </div>

        {/* Trilha.
            O trilho não é uma linha só medida em JS: cada passo desenha o
            próprio segmento até o passo seguinte, e ele fica verde quando
            aquele passo é concluído. Assim a linha acompanha os nós sem
            depender de medir altura de card — que muda com o texto, com a
            largura da tela e com a fonte do sistema. */}
        <ol className="m-0 list-none p-0">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const feito = concluidos.has(step.number);
            const ehAtual = atual === step.number;
            const isLast = idx === TOTAL - 1;

            return (
              <li
                key={step.number}
                ref={(el) => { refsPassos.current[step.number] = el; }}
                className={cn('relative flex gap-4', !isLast && 'pb-4')}
              >
                {/* Segmento até o próximo nó */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-7 top-14 bottom-0 hidden w-0.5 rounded-full transition-colors duration-500 motion-reduce:transition-none md:block',
                      feito ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}

                {/* Nó */}
                <div
                  className={cn(
                    'relative z-10 hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 transition-colors motion-reduce:transition-none md:flex',
                    feito && 'border-success bg-success text-success-foreground',
                    ehAtual && !feito && 'border-foreground bg-card text-foreground ring-4 ring-muted',
                    !feito && !ehAtual && 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {feito
                    ? <Check className="h-6 w-6" aria-hidden="true" />
                    : <Icon className="h-6 w-6" aria-hidden="true" />}
                </div>

                {/* Cartão */}
                <div
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border border-border p-6',
                    feito ? 'bg-muted' : ehAtual ? 'bg-card shadow-md' : 'bg-card shadow-sm',
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <Badge variant={feito ? 'success' : 'muted'}>
                      {feito && <Check className="mr-1 h-3 w-3" aria-hidden="true" />}
                      Passo {step.number}
                    </Badge>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {step.subtitle}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => navigate(step.route)}
                    >
                      {step.buttonLabel}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>

                  <h2 className={cn('mb-2 text-lg font-semibold', feito ? 'text-muted-foreground' : 'text-foreground')}>
                    {step.title}
                  </h2>
                  <p className="text-base text-muted-foreground">
                    {step.description}
                  </p>

                  <div className="mt-4 grid gap-2">
                    {step.tips.map((tip) => (
                      <p key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2
                          className={cn('mt-0.5 h-4 w-4 shrink-0', feito ? 'text-success' : 'text-muted-foreground')}
                          aria-hidden="true"
                        />
                        {tip}
                      </p>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    {!isLast ? (
                      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        Próximo: {steps[idx + 1].title}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-success">
                        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                        Fim da trilha
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => alternar(step.number)}
                      aria-pressed={feito}
                      className={cn(
                        'ml-auto',
                        feito && 'border-success-line bg-success-tint text-success-ink hover:bg-success-tint',
                      )}
                    >
                      {feito
                        ? <Check aria-hidden="true" />
                        : <Circle aria-hidden="true" />}
                      {feito ? 'Concluído' : 'Marcar como concluído'}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Fim da trilha */}
        <div
          className={cn(
            'mt-4 rounded-lg border p-8 text-center transition-colors',
            completo ? 'border-success-line bg-success-tint' : 'border-border bg-card shadow-sm',
          )}
        >
          <div
            className={cn(
              'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg transition-colors',
              completo ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className={cn('mb-2 text-lg font-semibold', completo ? 'text-success-ink' : 'text-foreground')}>
            {completo ? 'Você percorreu a trilha inteira' : 'Pronto para começar?'}
          </h2>
          <p className={cn('mx-auto mb-4 max-w-md text-base', completo ? 'text-success-ink' : 'text-muted-foreground')}>
            {completo
              ? 'Da busca do edital ao resultado, você já conhece cada etapa. Agora é operar — e o sistema guarda o histórico de tudo que passar por ele.'
              : 'O primeiro passo é buscar editais no Monitoramento e iniciar um processo.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => navigate('/monitoramento-editais')}>
              <Search aria-hidden="true" />
              Ir para Monitoramento
            </Button>
            <Button variant="outline" onClick={() => navigate('/kanban')}>
              <GripVertical aria-hidden="true" />
              Abrir Kanban
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
