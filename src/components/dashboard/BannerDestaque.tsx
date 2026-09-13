import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** Pílula acima do título — o assunto, em duas ou três palavras. */
  etiqueta: string;
  titulo: string;
  descricao: string;
  chamada: string;
  para: string;
}

/**
 * Faixa de destaque do painel (identidade 12/09): cartão claro, título navy e
 * a chamada como botão verde. Era o cartão de gradiente azul do protótipo com
 * barra escura embaixo — a linguagem nova é de fundo claro, navy só no texto
 * e verde só na ação.
 *
 * O cartão inteiro continua sendo o link. A chamada é um <span> vestido de
 * botão (buttonVariants), e não um <Button>: botão dentro de link é
 * interativo aninhado, e o teclado pararia duas vezes no mesmo destino.
 */
export default function BannerDestaque({ etiqueta, titulo, descricao, chamada, para }: Props) {
  return (
    <Link
      to={para}
      className="group flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-tint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Badge variant="info">{etiqueta}</Badge>
      {/* Título navy — pelo token de TEXTO, não pelo `text-navy`. No tema claro
          os dois são o mesmo #102A43 (`--foreground` e `--navy` têm o mesmo
          valor); no escuro, `--navy` continua escuro e o título sumiria dentro
          do próprio cartão. `text-foreground` é o token da régua e sobrevive
          aos dois temas. */}
      <h3 className="text-lg font-semibold text-foreground text-balance">{titulo}</h3>
      <p className="text-sm text-muted-foreground max-w-[38ch]">{descricao}</p>
      <span className={cn(buttonVariants(), 'mt-2')} aria-hidden="true">
        {chamada}
        <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" />
      </span>
    </Link>
  );
}
