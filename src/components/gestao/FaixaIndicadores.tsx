import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * FaixaIndicadores — os números do topo das telas de Gestão (cartão KPI).
 *
 * Anatomia do cartão do Design System v3: rótulo de 12px em cima, valor de
 * 24px em peso 600 com dígitos tabulares, ícone discreto no canto superior
 * direito e a linha de detalhe embaixo. Compacto: 96–110px, porque aqui o
 * número é a legenda da tabela que vem logo abaixo, não o assunto da tela.
 *
 * O texto (rótulo, valor, detalhe) mora num único invólucro, nesta ordem:
 * é o contrato que os testes das telas leem (`rótulo.parentElement` contém o
 * valor e a razão). O ícone fica fora dele, posicionado no canto.
 *
 * Clicar num indicador filtra a tabela quando `aoClicar` é passado. Sem
 * `aoClicar` o cartão é um `div`, não um botão morto.
 *
 * `valor: null` não vira zero: vira "—" com a razão. A distinção entre "não
 * apurado" e "apurado e deu zero" é regra do produto, não preferência visual.
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
  tom?: 'neutro' | 'ok' | 'info' | 'aviso' | 'critico';
  aoClicar?: () => void;
  ativo?: boolean;
}

const TOM = {
  neutro: 'bg-muted text-muted-foreground',
  ok: 'bg-success-tint text-success-ink',
  info: 'bg-info-tint text-info-ink',
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
        // auto-fit com mínimo em min(160px,100%): a grade se acomoda sem ponto
        // de quebra declarado — cinco ou seis cartões no desktop, dois no
        // celular de 390px.
        'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))] [&>*]:min-w-0',
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
              'g-cartao relative flex min-h-[96px] items-start px-4 py-3 text-left transition-[border-color,box-shadow] duration-150',
              clicavel &&
                'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              item.ativo && 'border-primary ring-1 ring-primary/30',
            )}
          >
            {Icone && (
              <span
                aria-hidden="true"
                className={cn(
                  // Some no celular: com dois cartões por linha em 390px, os
                  // 40px do ícone são a diferença entre ler "Taxa de sucesso"
                  // e ler "Taxa de suce…".
                  'absolute right-3 top-3 hidden h-7 w-7 items-center justify-center rounded-md sm:flex',
                  TOM[item.tom ?? 'neutro'],
                )}
              >
                <Icone className="h-4 w-4" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1 sm:pr-9">
              <span className="g-meta block truncate font-medium text-muted-foreground">{item.rotulo}</span>
              {/* Valor ausente: o travessão fica na linha do número e a RAZÃO
                  desce para a linha de baixo, inteira. */}
              {item.valor === null ? (
                <>
                  <span className="block text-2xl font-semibold leading-8 text-muted-foreground">—</span>
                  <span className="g-meta line-clamp-2 block text-warning-ink">
                    {item.razaoIndisponivel ?? 'Apuração a validar'}
                  </span>
                </>
              ) : (
                <span className="block truncate text-2xl font-semibold leading-8 tabular-nums text-foreground">
                  {item.valor}
                </span>
              )}
              {item.detalhe && (
                <span className="g-meta line-clamp-2 block text-muted-foreground">{item.detalhe}</span>
              )}
            </span>
          </Elemento>
        );
      })}
    </div>
  );
}
