import { useState } from 'react';
import { ChevronDown, ChevronUp, Database, Code2, Clock, Tag, BarChart3, Rocket, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PASSOS = [
  {
    id: 1,
    title: 'Estrutura do Banco de Dados',
    icon: Database,
    description: 'Adaptação das tabelas para suportar múltiplas fontes de editais (PNCP + Compras.gov).',
    details: [
      'Coluna "fonte" identifica a origem: pncp ou comprasnet',
      'Coluna "fonte_id" armazena o identificador único da fonte original',
      'Campos exclusivos: uasg_codigo, uasg_nome, lei_base e link_comprasnet',
      'Índice único (fonte, fonte_id) garante deduplicação automática',
      'View vw_editais_por_fonte fornece métricas de cobertura por fonte',
    ],
  },
  {
    id: 2,
    title: 'Sincronização Automática',
    icon: Code2,
    description: 'Função backend que consulta a API oficial do Compras.gov.br e importa editais automaticamente.',
    details: [
      'Consulta o endpoint /modulo-legado/1_consultarLicitacao (API v2.0)',
      'Cobre 4 modalidades: Pregão Eletrônico, Dispensa, Concorrência e RDC',
      'Também busca editais da Lei 14.133 em transição (parâmetro pertence14133)',
      'Suporta até 500 registros por página (10x mais eficiente que o PNCP)',
      'Tratamento de rate-limit (HTTP 429) com retry automático',
      'Normaliza e unifica os dados no mesmo formato dos editais PNCP',
    ],
  },
  {
    id: 3,
    title: 'Agendamento (CRON)',
    icon: Clock,
    description: 'Execução periódica a cada 20 minutos, com offset de 5 min em relação ao PNCP.',
    details: [
      'Intervalo: a cada 20 minutos (minutos 5, 25 e 45 de cada hora)',
      'Modo incremental: busca os últimos 2 dias (padrão)',
      'Modo histórico: carga inicial dos últimos 30 dias (execução única)',
      'Offset de 5 min evita sobrecarga simultânea com o sync do PNCP',
      'Logs de cada execução registrados na tabela pncp_sync_log',
    ],
  },
  {
    id: 4,
    title: 'Identificação Visual de Fonte',
    icon: Tag,
    description: 'Badges coloridos nos cards de edital indicam a origem: PNCP (azul) ou Compras.gov (verde).',
    details: [
      'Badge "PNCP" em azul para editais vindos do Portal Nacional',
      'Badge "Compras.gov" em verde (emerald) para editais do sistema federal',
      'Tag especial "Lei 8.666" para processos sob legislação legada',
      'Link direto "Acompanhar no ComprasNet" quando disponível',
      'Indicador visual de lei base (8.666 vs 14.133) no card do edital',
    ],
  },
  {
    id: 5,
    title: 'Dashboard de Cobertura',
    icon: BarChart3,
    description: 'Métricas de cobertura multi-fonte exibidas no painel principal.',
    details: [
      'Contadores separados: editais PNCP vs Compras.gov',
      'Total consolidado de editais de ambas as fontes',
      'Indicador de novos editais hoje por fonte',
      'Data da última publicação por fonte',
      'Percentual de cobertura federal estimado (~100% com ambas as fontes)',
    ],
  },
  {
    id: 6,
    title: 'Carga Histórica Inicial',
    icon: Rocket,
    description: 'Importação única dos últimos 30 dias para popular a base com editais federais.',
    details: [
      'Executada automaticamente no primeiro deploy',
      'Modo "historico" busca 30 dias retroativos de todas as modalidades',
      'Pode ser disparada manualmente quando necessário',
      'Editais duplicados são ignorados pelo índice único',
      'Tempo estimado: 2 a 5 minutos para carga completa',
    ],
  },
  {
    id: 7,
    title: 'Verificação e Monitoramento',
    icon: CheckCircle2,
    description: 'Consultas de verificação para garantir que os dados estão sendo importados corretamente.',
    details: [
      'Verificar contagem de editais por fonte (pncp vs comprasnet)',
      'Consultar últimas 20 sincronizações no log',
      'Confirmar zero duplicatas dentro da mesma fonte',
      'Monitorar data do edital mais antigo importado',
      'Alertas automáticos em caso de falha de sincronização',
    ],
  },
];

export default function GuiaComprasGov() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-card rounded-xl border border-accent/20 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold">Integração Compras.gov.br — Passo a Passo</h3>
          <Badge variant="outline" className="text-xs">Tier 1</Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          Ocultar guia
        </Button>
      </div>

      <div className="bg-accent/5 border border-accent/10 rounded-lg p-3 mb-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">API pública, sem autenticação, custo zero.</strong>{' '}
          O Compras.gov.br cobre toda a administração federal desde 2013, incluindo contratos sob Lei 8.666/93 ainda vigentes.
          Combinado com o PNCP, a cobertura de editais federais sobe de ~60% para ~100%.
        </p>
      </div>

      <div className="space-y-2">
        {PASSOS.map((step) => {
          const isExpanded = expanded === step.id;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className="border border-border/50 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : step.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent shrink-0">
                  <span className="text-xs font-bold">{step.id}</span>
                </div>
                <StepIcon className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-border/30">
                  <ul className="space-y-1.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-accent" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-lg font-bold text-accent">7</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Passos</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-lg font-bold text-accent">~100%</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cobertura Federal</p>
        </div>
      </div>
    </div>
  );
}
