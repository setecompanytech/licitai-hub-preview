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
  info: 'bg-primary-tint text-primary',
} as const;

/**
 * Régua de números do topo de uma tela — o `.crt-kpi` do protótipo, na
 * identidade 12/09: valor 32/40 em negrito com dígitos tabulares, rótulo
 * 14/20 secundário, ladrilho do ícone em tinta suave.
 *
 * A grade é `auto-fit` com mínimo em `min(240px, 100%)`: acomoda três, quatro
 * ou seis cartões sem nenhum ponto de quebra declarado, e o `min()` impede que
 * o mínimo estoure a largura em tela estreita.
 */
export default function LinhaKpis({ itens }: { itens: ItemKpi[] }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))] [&>*]:min-w-0">
      {itens.map((k) => {
        const Icone = k.icone;
        const clicavel = Boolean(k.aoClicar);
        const Elemento = clicavel ? 'button' : 'div';
        return (
          <Elemento
            key={k.rotulo}
            {...(clicavel ? { type: 'button' as const, onClick: k.aoClicar, 'aria-pressed': k.ativo } : {})}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center shadow-sm transition-colors',
              clicavel && 'hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              k.ativo ? 'border-primary' : 'border-border',
            )}
          >
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-md', TOM[k.tom ?? 'neutro'])}>
              <Icone className="h-5 w-5" aria-hidden="true" />
            </span>
            {/* Valor 32/40 em toda largura — o número é o que se lê primeiro.
                `break-normal` (e não `break-words`): valor de dinheiro só pode
                quebrar no espaço depois do "R$", nunca no meio do número —
                "R$ 25.664.097,89" chegou a virar dois números quando o
                contêiner permitia quebra em qualquer ponto. */}
            <span className="max-w-full break-normal font-bold tabular-nums text-[2rem] leading-10">
              {k.valor}
            </span>
            <span className="text-sm leading-5 text-muted-foreground">{k.rotulo}</span>
          </Elemento>
        );
      })}
    </div>
  );
}
