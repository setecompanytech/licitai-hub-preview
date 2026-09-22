import type { CSSProperties, ReactNode } from 'react';

/**
 * O valor do KPI recebe o próprio número de caracteres em `--chars`; o CSS de
 * `.valor-kpi` (index.css) encolhe a fonte até o número caber na largura do
 * cartão, em vez de cortá-lo com reticência — "R$ 22.581.888…" num KPI de
 * dinheiro é um número errado, não um número resumido. Valor que não é texto
 * (um nó React) não tem contagem: fica no tamanho cheio, como antes.
 *
 * Fora de `FaixaIndicadores.tsx` porque arquivo de componente só exporta
 * componente (fast refresh).
 */
export function estiloDoValor(valor: ReactNode): CSSProperties | undefined {
  if (typeof valor !== 'string' && typeof valor !== 'number') return undefined;
  const caracteres = String(valor).trim().length;
  if (caracteres === 0) return undefined;
  return { '--chars': caracteres } as CSSProperties;
}
