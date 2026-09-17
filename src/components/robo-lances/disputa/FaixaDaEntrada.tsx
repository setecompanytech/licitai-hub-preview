import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstadoDoRobo } from '@/lib/robo/situacao-da-participacao';
import { faixaDaEntrada } from '@/lib/robo/entrada-do-robo';

/**
 * A faixa "Ligando o robô…" da página da disputa (17/09/2026): do clique ao
 * primeiro retrato da sala a tela reage — o que o robô está fazendo, há quanto
 * tempo, e se parou esperando o captcha. A regra é `faixaDaEntrada`, com teste.
 */
export default function FaixaDaEntrada({
  estado,
  enviando,
  sessaoCriadaEm,
  esperandoPessoa,
  portal,
  aoVerAcompanhamento,
}: {
  estado: EstadoDoRobo;
  enviando: boolean;
  sessaoCriadaEm: string | null;
  esperandoPessoa: boolean;
  portal: string;
  aoVerAcompanhamento: () => void;
}) {
  const [agora, setAgora] = useState(() => new Date());
  const relogioLigado = enviando || estado === 'enviando' || estado === 'operando';
  useEffect(() => {
    if (!relogioLigado) return;
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [relogioLigado]);

  const faixa = faixaDaEntrada({ estado, enviando, sessaoCriadaEm, esperandoPessoa, portal, agora });
  if (!faixa) return null;

  const Icone = faixa.tom === 'atencao' ? AlertTriangle : faixa.tom === 'na-sala' ? Bot : Loader2;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--g-raio)] border px-4 py-3',
        faixa.tom === 'atencao' && 'border-warning-line bg-warning-tint text-warning-ink',
        faixa.tom === 'andamento' && 'border-primary/30 bg-primary-tint text-foreground',
        faixa.tom === 'na-sala' && 'border-success-line bg-success-tint text-success-ink',
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {faixa.tom !== 'atencao' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-20" aria-hidden="true" />
        )}
        <Icone
          className={cn('relative h-5 w-5', faixa.tom === 'andamento' && 'animate-spin text-primary')}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="g-corpo font-semibold">{faixa.titulo}</p>
        <p className="g-meta">{faixa.detalhe}</p>
      </div>
      {faixa.verAcompanhamento && (
        <button
          type="button"
          onClick={aoVerAcompanhamento}
          className="g-meta inline-flex items-center gap-1 rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver acompanhamento <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
