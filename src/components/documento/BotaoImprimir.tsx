import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

type Props = {
  /** Texto do botão. O padrão serve para a maioria das telas. */
  rotulo?: string;
  className?: string;
};

/**
 * Chama a impressão da tela atual.
 *
 * `window.print()` em vez de gerar PDF no cliente: o diálogo do navegador já
 * oferece "Salvar como PDF" em todos os sistemas, respeita a impressora que a
 * pessoa realmente tem e não carrega uma biblioteca de 500 kB para produzir um
 * PDF de qualidade pior. Quem manda no resultado é o `@media print` do
 * `index.css`.
 *
 * O próprio botão carrega `.nao-imprime` — sem isso ele apareceria no papel,
 * que é o erro mais comum ao imprimir uma tela.
 */
export default function BotaoImprimir({ rotulo = 'Imprimir / PDF', className }: Props) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`nao-imprime ${className ?? ''}`}
      onClick={() => window.print()}
    >
      <Printer className="w-3.5 h-3.5 mr-1.5" />
      {rotulo}
    </Button>
  );
}
