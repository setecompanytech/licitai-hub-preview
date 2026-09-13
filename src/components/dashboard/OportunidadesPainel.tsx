import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Oportunidade {
  rotulo: string;
  valor: string;
  /** Para onde o "Visualizar" leva. */
  para: string;
  /** Fundo tingido em vez de branco — o realce do protótipo. */
  destaque?: boolean;
}

interface Props {
  itens: Oportunidade[];
}

/**
 * Bloco "Oportunidades" — número grande, rótulo em cima e um "Visualizar" que
 * leva ao módulo correspondente.
 *
 * O primeiro item de cada coluna vem tingido, como no protótipo: é o que separa
 * o número que puxa a atenção dos que apenas acompanham. Não é decoração — se
 * todos fossem brancos, a grade viraria seis retângulos sem hierarquia.
 */
export default function OportunidadesPainel({ itens }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
      {itens.map((o) => (
        /* O cartão inteiro é o alvo. O "Visualizar" continua ali como pista do
           que acontece ao clicar, mas quem mira um número de 2rem não mira a
           legenda de 0,875rem embaixo dele: o link cobre o cartão por inteiro
           (`after:absolute after:inset-0`), então o clique funciona em qualquer
           ponto — sem aninhar um link dentro de outro nem trocar o cartão por
           um <div> com onClick, que ficaria de fora da navegação por teclado. */
        <Card
          key={o.rotulo}
          className={cn(
            'relative p-6 transition-shadow hover:shadow-md',
            o.destaque && 'border-primary/20 bg-primary-tint',
          )}
        >
          <p className="text-sm text-muted-foreground">{o.rotulo}</p>
          <p className="text-[2rem] leading-10 font-bold tabular-nums mt-1">{o.valor}</p>
          <Link
            to={o.para}
            className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group/link"
          >
            <span className="group-hover/link:underline">Visualizar</span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-200 group-hover/link:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
          </Link>
        </Card>
      ))}
    </div>
  );
}
