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
 *
 * Os degraus seguem a escala do Design System v3: o KPI de cartão parte de
 * 28px (`text-[1.75rem]`, o mesmo do `StatCard`) e desce por 24 → 20 → 16;
 * peso 600, como todo número de indicador do sistema.
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
  if (n <= 12) return 'text-[1.75rem] leading-9';
  if (n <= 15) return 'text-3xl leading-8';
  if (n <= 18) return 'text-2xl leading-7';
  return 'text-lg leading-6';
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
      className={cn('mt-1 whitespace-nowrap font-semibold tabular-nums', classeDoTamanho(valor, compacto), className)}
    >
      {valor}
      {sufixo && <span className="ml-1 text-base font-medium text-muted-foreground">{sufixo}</span>}
    </p>
  );
}
