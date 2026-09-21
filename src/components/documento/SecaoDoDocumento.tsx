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
 * papel ele vira parte do título, porque é ali que serve de endereço.
 *
 * No papel a seção PODE continuar na folha seguinte (21/09): a versão
 * inteira (`break-inside: avoid`) pulava de folha ao não caber e deixava a
 * anterior meio em branco. O que a numeração exige é só que o título não
 * fique sozinho no fim de uma folha — `bloco-cabecalho` prende o título ao
 * primeiro bloco. Quem precisa que um cartão ou gráfico não se parta marca
 * esse bloco com `bloco-inteiro` (o `Card` já vem assim no papel).
 */
export default function SecaoDoDocumento({ numero, titulo, children, className }: Props) {
  return (
    <section className={className}>
      <div className="bloco-cabecalho mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm
                     bg-muted px-1 text-xs font-semibold tabular-nums text-muted-foreground"
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
