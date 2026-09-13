import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * ListaDeCampos — rótulo à esquerda, valor à direita, no painel de detalhes.
 *
 * É o miolo de quase todo painel lateral das referências de 13/09: "Vigência",
 * "Responsável", "Valor total". Usa `<dl>` porque é exatamente isso — uma lista
 * de descrições —, e o par rótulo/valor vira relação de verdade para quem
 * navega por leitor de tela, em vez de duas frases soltas na mesma linha.
 *
 * Valor à direita com `tabular-nums` quando é número, para os montantes de uma
 * mesma pilha alinharem a vírgula.
 */
export interface Campo {
  rotulo: ReactNode;
  valor: ReactNode;
  /** Número: alinha à direita com dígitos de largura fixa. */
  numerico?: boolean;
  /** Ocupa a linha inteira — objeto, endereço, chave da NF-e. */
  largo?: boolean;
}

export default function ListaDeCampos({
  campos,
  className,
}: {
  campos: Campo[];
  className?: string;
}) {
  return (
    <dl className={cn('flex flex-col', className)}>
      {campos.map((campo, i) => (
        <div
          key={i}
          className={cn(
            'border-b border-border/70 py-2.5 last:border-0',
            campo.largo ? 'flex flex-col gap-1' : 'flex items-start justify-between gap-4',
          )}
        >
          <dt className="g-corpo shrink-0 text-muted-foreground">{campo.rotulo}</dt>
          <dd
            className={cn(
              'g-corpo min-w-0 font-medium text-foreground',
              !campo.largo && 'text-right',
              campo.numerico && 'tabular-nums',
            )}
          >
            {campo.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Bloco nomeado dentro do painel — "Rastreabilidade e valores" das referências. */
export function BlocoDoPainel({
  titulo,
  acao,
  children,
  className,
}: {
  titulo: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="g-titulo-secao text-foreground">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}
