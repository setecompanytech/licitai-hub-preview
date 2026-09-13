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
        // auto-fit com mínimo em min(160px,100%): a grade se acomoda sem
        // nenhum ponto de quebra declarado, e o número vem de medir as duas
        // pontas, não de gosto.
        //
        // Em cima: 1440px menos a coluna de 240 e o respiro deixam ~1.200px.
        // Com mínimo de 200 cabiam cinco, e o sexto indicador descia sozinho
        // para a segunda linha — a órfã que denuncia grade mal medida.
        // Embaixo: 390px menos 32 de respiro deixam 358, e duas colunas de 176
        // mais o vão pediam 364. Faltavam seis pixels para a seção MOBILE
        // ("indicadores em uma ou duas colunas") valer, e a tela empilhava seis
        // cartões antes de mostrar a tabela.
        'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))] [&>*]:min-w-0',
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
                  // Some no celular: com dois cartões por linha em 390px, os
                  // 48px que o ícone e o vão custam são a diferença entre ler
                  // "Taxa de sucesso" e ler "Taxa de suce…". O ícone repete o
                  // que o rótulo já diz; o rótulo, não.
                  'hidden h-9 w-9 shrink-0 items-center justify-center rounded-[var(--g-raio)] sm:flex',
                  TOM[item.tom ?? 'neutro'],
                )}
              >
                <Icone className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="g-meta block truncate text-muted-foreground">{item.rotulo}</span>
              {/* Valor ausente: o travessão fica na linha do número e a RAZÃO
                  desce para a linha de baixo. Lado a lado, "Nenhum processo
                  decidido" era cortado no meio pelo `truncate` do valor — e
                  razão cortada não explica nada, que é o oposto do motivo de
                  ela existir. */}
              {item.valor === null ? (
                <>
                  <span className="block text-xl font-bold leading-7 text-muted-foreground">—</span>
                  <span className="g-meta line-clamp-2 block text-warning-ink">
                    {item.razaoIndisponivel ?? 'Apuração a validar'}
                  </span>
                </>
              ) : (
                <span className="block truncate text-xl font-bold leading-7 tabular-nums text-foreground">
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
