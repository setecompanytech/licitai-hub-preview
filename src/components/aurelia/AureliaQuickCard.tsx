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
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary [&>svg]:h-4 [&>svg]:w-4"
        >
          {icon}
        </span>
        <h4 className="text-lg font-semibold leading-6 text-foreground">{title}</h4>
      </div>

      {isLoading && (
        <div className="space-y-2" role="status">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> AURÉLIA está analisando…
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
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && content && (
        <p className="whitespace-pre-wrap text-base leading-6 text-foreground">{content}</p>
      )}
    </div>
  );
}
