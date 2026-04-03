import { ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="rounded-lg border aurelia-border aurelia-surface p-4 transition-all hover:scale-[1.02] duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[hsl(43,60%,54%)]">{icon}</span>
        <h4 className="text-sm font-semibold text-[hsl(215,14%,92%)]">{title}</h4>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <div className="h-3 bg-[hsl(215,25%,18%)] rounded animate-pulse w-full" />
          <div className="h-3 bg-[hsl(215,25%,18%)] rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[hsl(215,25%,18%)] rounded animate-pulse w-3/5" />
          <p className="text-xs text-[hsl(215,12%,55%)] mt-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> AURÉLIA está analisando…
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center gap-2 py-2">
          <AlertTriangle className="w-5 h-5 text-[hsl(0,72%,51%)]" />
          <p className="text-xs text-[hsl(215,12%,55%)]">Erro na análise</p>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="text-[hsl(43,60%,54%)] hover:text-[hsl(43,60%,64%)] text-xs">
              <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && content && (
        <p className="text-xs leading-relaxed text-[hsl(215,14%,82%)] whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
