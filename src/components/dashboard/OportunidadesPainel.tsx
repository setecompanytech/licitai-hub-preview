import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

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
    <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
      {itens.map((o) => (
        <Card
          key={o.rotulo}
          className={
            o.destaque
              ? 'p-5 border-transparent bg-primary-tint/60'
              : 'p-5'
          }
        >
          <p className="text-sm text-muted-foreground">{o.rotulo}</p>
          <p className="text-4xl font-bold tabular-nums leading-none mt-2">{o.valor}</p>
          <Link
            to={o.para}
            className="inline-block mt-3 text-sm font-medium text-accent hover:underline"
          >
            Visualizar
          </Link>
        </Card>
      ))}
    </div>
  );
}
