import { cn } from '@/lib/utils';

export interface ItemKpi {
  rotulo: string;
  valor: string;
  icone: React.ElementType;
  /**
   * Cor do ladrilho do ícone. `neutro` é o padrão — semântica só onde há
   * estado real. `critico` é o vermelho de "vencido/expirado": o mesmo tom
   * do selo do cartão, para o KPI não dizer âmbar quando a lista diz vermelho.
   */
  tom?: 'neutro' | 'ok' | 'aviso' | 'info' | 'critico';
  /** Passando isto, o cartão vira botão de filtro. */
  aoClicar?: () => void;
  /** Destaca o cartão quando o filtro dele está ligado. */
  ativo?: boolean;
}

const TOM = {
  neutro: 'bg-muted text-muted-foreground',
  ok: 'bg-success-tint text-success-ink',
  aviso: 'bg-warning-tint text-warning-ink',
  info: 'bg-info-tint text-info-ink',
  critico: 'bg-destructive-tint text-destructive-ink',
} as const;

/**
 * Régua de números do topo de uma tela — o cartão KPI do Design System v3:
 * rótulo em cima, valor 28/36 em peso 600 com dígitos tabulares, ícone
 * discreto no canto. 112px de altura, alinhado à esquerda como um cartão de
 * software financeiro, não centralizado como um painel de marketing.
 *
 * A grade é `auto-fit` com mínimo em `min(200px, 100%)`: acomoda três, quatro
 * ou seis cartões sem ponto de quebra declarado.
 */
export default function LinhaKpis({ itens }: { itens: ItemKpi[] }) {
  return (
    <div className="grade-kpi grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))] [&>*]:min-w-0">
      {itens.map((k) => {
        const Icone = k.icone;
        const clicavel = Boolean(k.aoClicar);
        const Elemento = clicavel ? 'button' : 'div';
        return (
          <Elemento
            key={k.rotulo}
            {...(clicavel ? { type: 'button' as const, onClick: k.aoClicar, 'aria-pressed': k.ativo } : {})}
            className={cn(
              'flex min-h-[112px] flex-col justify-between gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-150',
              clicavel && 'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              k.ativo ? 'border-primary ring-1 ring-primary/30' : 'border-border',
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{k.rotulo}</span>
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', TOM[k.tom ?? 'neutro'])}>
                <Icone className="h-4 w-4" aria-hidden="true" />
              </span>
            </span>
            {/* Valor de dinheiro só quebra no espaço depois do "R$", nunca no
                meio do número — daí `break-normal`. */}
            <span className="valor-kpi max-w-full break-normal text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
              {k.valor}
            </span>
          </Elemento>
        );
      })}
    </div>
  );
}
