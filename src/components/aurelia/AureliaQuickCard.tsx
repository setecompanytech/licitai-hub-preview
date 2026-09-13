import { ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AureliaQuickCardProps {
  title: string;
  icon: ReactNode;
  content: string | null;
  isLoading: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export default function AureliaQuickCard({ title, icon, content, isLoading, error, onRetry }: AureliaQuickCardProps) {
  return (
    /* Sem `hover:scale`: o cartão carrega parágrafos inteiros e mora em coluna
       rolável — escalar no hover fazia o texto tremer sob o mouse. */
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span>
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
      </div>

      {isLoading && (
        <div className="space-y-2" role="status">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> AURÉLIA está analisando…
          </p>
        </div>
      )}

      {error && !isLoading && (
        /* Estado de ERRO usa Alert variant="destructive" — tinta, não texto
           cinza com um ícone vermelho solto. O botão de retry vem junto, para
           a falha nunca ficar sem saída (princípio 3 do projeto). */
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>Erro na análise</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="w-4 h-4" /> Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && content && (
        <p className="text-base leading-6 text-foreground whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
