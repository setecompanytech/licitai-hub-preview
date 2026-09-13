import { ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
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
        <div className="flex flex-col items-center gap-2 py-2" role="alert">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <p className="text-xs text-muted-foreground">Erro na análise</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && content && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
