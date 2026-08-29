import type { ReactNode } from 'react';

type Props = {
  /** O número da seção — "1", "2.4". É por ele que a seção é citada. */
  numero: string;
  titulo: string;
  children: ReactNode;
  className?: string;
};

/**
 * Uma seção numerada e citável.
 *
 * Abas chamadas "Dashboard" e "Pedidos" não se citam em ofício. "Item 2.4"
 * se cita — e é assim que o órgão devolve uma pendência: apontando o número.
 * Sem numeração, quem responde precisa descrever a tela por escrito para
 * dizer de que trecho está falando.
 *
 * Na tela o número aparece discreto, num quadradinho antes do título. No
 * papel ele vira parte do título, porque é ali que serve de endereço. E a
 * seção inteira ganha `break-inside: avoid`: título numa folha e conteúdo na
 * seguinte destrói justamente a referência que o número existe para dar.
 */
export default function SecaoDoDocumento({ numero, titulo, children, className }: Props) {
  return (
    <section className={`bloco-inteiro ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1
                     rounded bg-muted text-muted-foreground text-[11px] font-bold tabular-nums"
        >
          {numero}
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h3>
      </div>
      {children}
    </section>
  );
}
