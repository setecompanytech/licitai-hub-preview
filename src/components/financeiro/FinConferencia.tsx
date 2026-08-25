import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, ShieldAlert, RefreshCw } from 'lucide-react';
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

const ESTILO: Record<Achado['severidade'], { icone: typeof AlertTriangle; cor: string; fundo: string; rotulo: string }> = {
  critico:     { icone: ShieldAlert,   cor: 'text-destructive', fundo: 'border-destructive/40 bg-destructive/5', rotulo: 'Crítico' },
  atencao:     { icone: AlertTriangle, cor: 'text-warning',     fundo: 'border-warning/40 bg-warning/5',         rotulo: 'Atenção' },
  informativo: { icone: Info,          cor: 'text-info',        fundo: 'border-info/30 bg-info/5',               rotulo: 'Informativo' },
};

export default function FinConferencia() {
  const { data: achados, isLoading, error, refetch, isFetching } = useConferenciaFinanceira();
  const [abertoManual, setAbertoManual] = useState<boolean | null>(null);

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
  const criticos = lista.filter((a) => a.severidade === 'critico').length;
  const aberto = abertoManual ?? criticos > 0;

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
    <div className={cn('rounded-xl border', criticos > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5')}>
      <button
        onClick={() => setAbertoManual(!aberto)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left"
      >
        {criticos > 0
          ? <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-warning shrink-0" />}
        <p className="text-xs text-muted-foreground min-w-0">
          <span className={cn('font-medium', criticos > 0 ? 'text-destructive' : 'text-warning')}>
            {criticos > 0
              ? `${criticos} ponto${criticos > 1 ? 's' : ''} que impede${criticos > 1 ? 'm' : ''} o Financeiro de fechar`
              : `${lista.length} ponto${lista.length > 1 ? 's' : ''} a conferir`}
          </span>
          {criticos > 0 && lista.length > criticos && ` · mais ${lista.length - criticos} a conferir`}
        </p>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="px-4 pb-3 space-y-2">
          {lista.map((a, i) => {
            const e = ESTILO[a.severidade];
            const Icone = e.icone;
            return (
              <div key={`${a.categoria}-${a.referencia ?? i}`} className={cn('rounded-lg border p-2.5 flex gap-2.5', e.fundo)}>
                <Icone className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', e.cor)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {a.categoria}
                  </p>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{a.descricao}</p>
                </div>
                {a.valor != null && (
                  <span className={cn('text-xs font-semibold tabular-nums whitespace-nowrap shrink-0', e.cor)}>
                    {formatBRL(Number(a.valor))}
                  </span>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-1">
            A conferência refaz as derivações e aponta o que não fecha — ela não corrige nada.
            Corrigir lançamento é decisão de quem conhece o fato.
          </p>
        </div>
      )}
    </div>
  );
}
