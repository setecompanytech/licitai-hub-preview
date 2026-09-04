import { cn } from '@/lib/utils';

export interface ItemKpi {
  rotulo: string;
  valor: string;
  icone: React.ElementType;
  /** Cor do ladrilho do ícone. `neutro` é o padrão — semântica só onde há estado real. */
  tom?: 'neutro' | 'ok' | 'aviso' | 'info';
  /** Passando isto, o cartão vira botão de filtro, como no protótipo. */
  aoClicar?: () => void;
  /** Destaca o cartão quando o filtro dele está ligado. */
  ativo?: boolean;
}

const TOM = {
  neutro: 'bg-muted text-muted-foreground',
  ok: 'bg-success-tint text-success-ink',
  aviso: 'bg-warning-tint text-warning-ink',
  info: 'bg-primary-tint text-accent',
} as const;

/**
 * Régua de números do topo de uma tela — o `.crt-kpi` do protótipo.
 *
 * A grade é `auto-fit` com mínimo em `min(172px, 100%)`: acomoda três, quatro
 * ou seis cartões sem nenhum ponto de quebra declarado, e o `min()` impede que
 * o mínimo estoure a largura em tela estreita. É o padrão que o protótipo
 * adotou nas duas telas mais novas dele, e o que dispensa mexer em CSS quando
 * a quantidade de números muda.
 */
export default function LinhaKpis({ itens }: { itens: ItemKpi[] }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(172px,100%),1fr))] [&>*]:min-w-0">
      {itens.map((k) => {
        const Icone = k.icone;
        const clicavel = Boolean(k.aoClicar);
        const Elemento = clicavel ? 'button' : 'div';
        return (
          <Elemento
            key={k.rotulo}
            {...(clicavel ? { type: 'button' as const, onClick: k.aoClicar, 'aria-pressed': k.ativo } : {})}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border bg-card px-3 py-4 text-center transition-colors',
              clicavel && 'hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              k.ativo ? 'border-accent' : 'border-border',
            )}
          >
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TOM[k.tom ?? 'neutro'])}>
              <Icone className="h-4 w-4" aria-hidden="true" />
            </span>
            {/* `whitespace-nowrap` porque valor de dinheiro NÃO se parte: sem
                ele, "R$ 25.664.097,89" quebrava entre o 8 e o 9 e virava dois
                números. Se não couber, encolhe — daí o `clamp`, que é o mesmo
                recurso que o protótipo usa nos KPIs mais novos dele. */}
            <span className="font-bold tabular-nums leading-none whitespace-nowrap text-[clamp(1.0625rem,1.7vw,1.5rem)]">
              {k.valor}
            </span>
            <span className="text-sm text-muted-foreground leading-tight">{k.rotulo}</span>
          </Elemento>
        );
      })}
    </div>
  );
}
