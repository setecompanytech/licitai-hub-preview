import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ValorIndisponivel } from './SeloSituacao';

/**
 * FaixaIndicadores — os números do topo das telas de Gestão, em versão baixa.
 *
 * O comando de 13/09 é explícito: "indicadores compactos, sem dominar a
 * página". A régua que o app já tinha (`LinhaKpis`) põe o valor em 32px num
 * cartão centralizado de 100px de altura — desenho de painel, onde o número É
 * a tela. Aqui o número é a legenda da tabela que vem logo abaixo, então o
 * cartão é uma tira: rótulo em cima, valor em 20px, ícone pequeno ao lado.
 *
 * Clicar num indicador filtra a tabela quando `aoClicar` é passado — é assim
 * que as referências ligam o número à linha que o produziu. Sem `aoClicar` o
 * cartão é um `div`, não um botão morto.
 *
 * `valor: null` não vira zero: vira "—" com a razão. A distinção entre "não
 * apurado" e "apurado e deu zero" é regra do comando, não preferência visual.
 */
export interface Indicador {
  rotulo: string;
  /** `null` significa não apurado — vira "—", nunca 0. */
  valor: ReactNode | null;
  /** Por que o valor não veio. Só aparece quando `valor` é `null`. */
  razaoIndisponivel?: string;
  /** Linha fina abaixo do valor: base de cálculo, período, comparação. */
  detalhe?: ReactNode;
  icone?: ElementType;
  tom?: 'neutro' | 'ok' | 'aviso' | 'critico';
  aoClicar?: () => void;
  ativo?: boolean;
}

const TOM = {
  neutro: 'bg-muted text-muted-foreground',
  ok: 'bg-success-tint text-success-ink',
  aviso: 'bg-warning-tint text-warning-ink',
  critico: 'bg-destructive-tint text-destructive-ink',
} as const;

export default function FaixaIndicadores({
  itens,
  className,
}: {
  itens: Indicador[];
  className?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <div
      className={cn(
        // auto-fit com mínimo em min(200px,100%): três, quatro ou seis
        // indicadores se acomodam sem ponto de quebra declarado, e no celular
        // caem para uma ou duas colunas sozinhos, como pede a seção MOBILE.
        'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))] [&>*]:min-w-0',
        className,
      )}
    >
      {itens.map((item) => {
        const Icone = item.icone;
        const clicavel = Boolean(item.aoClicar);
        const Elemento = clicavel ? 'button' : 'div';
        return (
          <Elemento
            key={item.rotulo}
            {...(clicavel
              ? { type: 'button' as const, onClick: item.aoClicar, 'aria-pressed': item.ativo }
              : {})}
            className={cn(
              'g-cartao flex items-center gap-3 px-4 py-3 text-left transition-colors',
              clicavel &&
                'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              item.ativo && 'border-primary ring-1 ring-primary/30',
            )}
          >
            {Icone && (
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--g-raio)]',
                  TOM[item.tom ?? 'neutro'],
                )}
              >
                <Icone className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="g-meta block truncate text-muted-foreground">{item.rotulo}</span>
              <span className="block truncate text-xl font-bold leading-7 tabular-nums text-foreground">
                {item.valor === null ? (
                  <ValorIndisponivel razao={item.razaoIndisponivel} />
                ) : (
                  item.valor
                )}
              </span>
              {item.detalhe && (
                <span className="g-meta block truncate text-muted-foreground">{item.detalhe}</span>
              )}
            </span>
          </Elemento>
        );
      })}
    </div>
  );
}
