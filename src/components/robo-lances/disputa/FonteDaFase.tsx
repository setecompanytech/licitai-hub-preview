import { AlertTriangle } from 'lucide-react';
import type { FonteDaFase } from '@/lib/robo/situacao-da-participacao';

/**
 * Quem informou a fase do certame: o agente, que está na sala do portal, ou
 * uma marcação manual. A tela mostra a diferença; não a apaga.
 *
 * Morava em `workspace/robo/AbaRoboDoProcesso.tsx`; a página da disputa diz o
 * mesmo com as mesmas palavras.
 */
export default function FonteDaFaseTexto({ fonte }: { fonte: FonteDaFase | null }) {
  if (fonte === 'agente') return <span className="g-meta text-muted-foreground">informada pelo agente</span>;
  if (fonte === 'marcacao_manual') {
    return (
      <span className="g-meta inline-flex items-center gap-1 text-warning-ink">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>marcada manualmente — o portal não confirmou</span>
      </span>
    );
  }
  return <span className="g-meta text-muted-foreground">sem sinal do portal</span>;
}
