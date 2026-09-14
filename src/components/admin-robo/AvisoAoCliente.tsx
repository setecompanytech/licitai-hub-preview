import type { ElementType } from 'react';
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nomeDoPortalDoAviso, type SeveridadeDoAviso } from './avisos';

/**
 * O aviso como o cliente lê — aqui, a prévia do formulário de avisos.
 *
 * Prévia só vale se for a mesma peça que o cliente vê. Em 14/09/2026 a tela
 * do cliente ainda não tinha o banner, então este componente é a
 * especificação dele: quem desenhar o banner do lado do cliente deve importar
 * esta peça (ou movê-la para `robo-lances/`), nunca copiá-la — duas cópias
 * fariam a prévia mentir na primeira mudança de uma delas.
 *
 * Linguagem de negócio: título, mensagem, a que portal se refere e quem
 * escreveu. Nada de código de erro nem de nome técnico da severidade.
 */
const TOM: Record<SeveridadeDoAviso, { classe: string; icone: ElementType; rotulo: string }> = {
  informativo: { classe: 'border-border bg-muted text-foreground', icone: Info, rotulo: 'Informação' },
  atencao: {
    classe: 'border-warning-line bg-warning-tint text-warning-ink',
    icone: AlertTriangle,
    rotulo: 'Atenção',
  },
  critico: {
    classe: 'border-destructive-line bg-destructive-tint text-destructive-ink',
    icone: OctagonAlert,
    rotulo: 'Importante',
  },
};

interface AvisoAoClienteProps {
  severidade: SeveridadeDoAviso;
  titulo: string;
  mensagem: string;
  portalId: string | null;
  /** Na prévia o banner não se anuncia ao leitor de tela a cada tecla. */
  previa?: boolean;
  className?: string;
}

export default function AvisoAoCliente({
  severidade,
  titulo,
  mensagem,
  portalId,
  previa = false,
  className,
}: AvisoAoClienteProps) {
  const { classe, icone: Icone, rotulo } = TOM[severidade] ?? TOM.atencao;
  return (
    <div
      role={previa ? undefined : severidade === 'critico' ? 'alert' : 'status'}
      data-severidade={severidade}
      className={cn('flex items-start gap-3 rounded-[var(--g-raio)] border px-4 py-3', classe, className)}
    >
      <Icone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="g-corpo font-semibold">
          {/* Visível, e não só para leitor de tela: severidade que só aparece
              em cor e ícone não chega a quem não distingue as cores. */}
          <span>{rotulo}: </span>
          {titulo.trim() || <span className="font-normal italic opacity-70">Título do aviso</span>}
        </p>
        <p className="g-corpo whitespace-pre-line break-words">
          {mensagem.trim() || (
            <span className="italic opacity-70">A mensagem para o cliente aparece aqui.</span>
          )}
        </p>
        <p className="g-meta opacity-80">
          {nomeDoPortalDoAviso(portalId)} · Aviso da equipe Praefectus
        </p>
      </div>
    </div>
  );
}
