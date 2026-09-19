import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * O número grande de um cartão do Financeiro — que NUNCA quebra nem é cortado.
 *
 * Em 19/09 os cartões da ETHOS mostravam "R$ 11.136.16 / 5,18" (Entradas,
 * quebrado em duas linhas no meio dos centavos) e "−R$ 158.17…" (EBITDA,
 * cortado com reticências pelo `truncate`). Valor de dinheiro partido ou
 * cortado é o pior estado possível de um indicador: parece outro número.
 *
 * A saída é ajustar o TAMANHO da fonte ao comprimento do texto — o cartão tem
 * largura fixa, o número não — e manter tudo numa linha só. O título do
 * elemento repete o valor inteiro para quem passar o mouse.
 */
export function classeDoTamanho(texto: string, compacto = false): string {
  const n = texto.replace(/\s/g, '').length;
  if (compacto) {
    // Faixa de KPIs em uma célula (Lançamentos, redesenho de 19/09): parte do
    // text-2xl do desenho e encolhe da mesma forma.
    if (n <= 12) return 'text-2xl leading-8';
    if (n <= 15) return 'text-xl leading-7';
    if (n <= 18) return 'text-lg leading-7';
    return 'text-base leading-6';
  }
  if (n <= 12) return 'text-[2rem] leading-10';
  if (n <= 15) return 'text-[1.625rem] leading-9';
  if (n <= 18) return 'text-[1.375rem] leading-8';
  return 'text-[1.125rem] leading-7';
}

export default function ValorDeCartao({
  valor,
  sufixo,
  className,
  title,
  compacto = false,
}: {
  valor: string;
  /** Unidade pequena ao lado ("%", "meses"), quando o valor não a traz. */
  sufixo?: ReactNode;
  className?: string;
  title?: string;
  /** Célula de faixa (menor); o padrão é o cartão isolado. */
  compacto?: boolean;
}) {
  return (
    <p
      title={title ?? valor}
      className={cn('mt-1 whitespace-nowrap font-bold tabular-nums', classeDoTamanho(valor, compacto), className)}
    >
      {valor}
      {sufixo && <span className="ml-1 text-base font-medium text-muted-foreground">{sufixo}</span>}
    </p>
  );
}
