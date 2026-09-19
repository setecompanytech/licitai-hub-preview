import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * SeloPraefectusIA — o selo dos módulos e recursos de IA (Design System v3, §5 "IA").
 *
 * Badge na variante `ia` (tinta da ação, discreta) com o Sparkles em teal: é o
 * único lugar em que o teal aparece nestas telas, e sempre como ícone — nunca
 * como texto sobre branco. O texto é fixo de propósito: "IA Jurídica", "IA
 * Contábil" e afins viravam três selos para o mesmo conceito.
 */
export default function SeloPraefectusIA({ className }: { className?: string }) {
  return (
    <Badge variant="ia" className={cn('gap-1', className)}>
      <Sparkles aria-hidden="true" className="h-3 w-3 text-teal" />
      Praefectus IA
    </Badge>
  );
}
