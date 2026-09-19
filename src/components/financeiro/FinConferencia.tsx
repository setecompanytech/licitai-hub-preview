import { AlertTriangle, CheckCircle2, Info, ShieldAlert, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/financeiro/formatters';
import { useConferenciaFinanceira, type Achado } from '@/hooks/useConferenciaFinanceira';

/**
 * O painel que diz se o Financeiro fecha.
 *
 * Recolhido por padrão quando não há nada: uma linha verde basta, e ocupar a
 * primeira tela com um relatório de que está tudo bem é o tipo de ruído que
 * ensina a ignorar o painel — e aí ele não serve para o dia em que houver algo.
 *
 * Quando há achado crítico, abre sozinho. Não por alarmismo: saldo que não
 * corresponde aos lançamentos é a diferença entre um número e um palpite, e
 * quem vai decidir preço com base nele precisa saber antes, não depois.
 */

const ESTILO: Record<Achado['severidade'], {
  icone: typeof AlertTriangle;
  borda: string;
  badge: 'danger' | 'warning' | 'info';
  rotulo: string;
}> = {
  critico:     { icone: ShieldAlert,   borda: 'border-l-destructive', badge: 'danger',  rotulo: 'Prioridade alta' },
  atencao:     { icone: AlertTriangle, borda: 'border-l-warning',     badge: 'warning', rotulo: 'Atenção' },
  informativo: { icone: Info,          borda: 'border-l-info',        badge: 'info',    rotulo: 'Informativo' },
};

interface Props {
  /** Navega para a subtela do Financeiro que resolve o achado. Sem ela (uso
   * fora do painel inicial), a linha some e o botão "Revisar" não aparece. */
  onNavigate?: (id: string) => void;
}

export default function FinConferencia({ onNavigate }: Props = {}) {
  const { data: achados, isLoading, error, refetch, isFetching } = useConferenciaFinanceira();

  if (isLoading) return null;

  // Conferência que falha não pode passar por conferência que passou.
  if (error) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-2.5 flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <p className="text-xs text-muted-foreground min-w-0">
          <span className="font-medium text-warning">Não foi possível conferir o Financeiro.</span>{' '}
          Os números abaixo não foram verificados nesta sessão. {(error as Error).message}
        </p>
        <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto shrink-0" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Tentar de novo
        </Button>
      </div>
    );
  }

  const lista = achados ?? [];

  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-2.5 flex items-center gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-success">O Financeiro fecha.</span>{' '}
          Saldos conferem com os lançamentos, transferências têm par e o faturamento bate com a apuração.
        </p>
        <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto shrink-0"
          onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-[15px] font-semibold text-foreground">Central de conferência</h3>
        <span className="text-xs text-muted-foreground">
          {lista.length} ponto{lista.length > 1 ? 's' : ''} exige{lista.length > 1 ? 'm' : ''} revisão
        </span>
      </div>

      <div className="divide-y divide-border">
        {lista.map((a, i) => {
          const e = ESTILO[a.severidade];
          const Icone = e.icone;
          return (
            <div
              key={`${a.categoria}-${a.referencia ?? i}`}
              className={cn('flex flex-wrap items-center gap-3 border-l-4 px-4 py-3', e.borda)}
            >
              <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{a.categoria}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.descricao}
                  {a.valor != null && <span className="font-medium tabular-nums"> · {formatBRL(Number(a.valor))}</span>}
                </p>
              </div>
              <Badge variant={e.badge}>{e.rotulo}</Badge>
              {onNavigate && (
                <Button size="sm" variant="outline" onClick={() => onNavigate('lancamentos')}>
                  Revisar
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        A conferência refaz as derivações e aponta o que não fecha. Ela não corrige nada — corrigir lançamento é decisão de quem conhece o fato.
      </p>
    </div>
  );
}
