import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Documentos de edital em leque com o check verde — a ilustração da prancha
 * (12/09) em CSS puro, plana, sem moldura. Decorativa: `aria-hidden`, o
 * equivalente ao alt vazio. Escala pela largura do contêiner.
 */
export default function IlustracaoDocumentos({ className }: { className?: string }) {
  const docs = [
    'rotate-[-9deg] -translate-x-[8%] translate-y-[2%] opacity-80',
    'rotate-[-3deg] opacity-95',
    'rotate-[4deg] translate-x-[9%] -translate-y-[2%]',
  ];
  return (
    <div aria-hidden="true" className={cn('relative mx-auto w-full max-w-[360px] aspect-[5/4]', className)}>
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(ellipse_at_50%_60%,hsl(var(--primary)/0.18),hsl(var(--primary)/0.06)_45%,transparent_72%)] blur-xl" />
      <div className="absolute left-[14%] bottom-[8%] w-[46%] aspect-[3/4]">
        {docs.map((pos) => (
          <div
            key={pos}
            className={cn(
              'absolute inset-0 origin-bottom rounded-2xl border border-border bg-card p-[12%] shadow-md grid content-start gap-[9%]',
              pos,
            )}
          >
            <span className="font-heading text-sm font-bold text-muted-foreground">Edital</span>
            <span className="block h-1.5 rounded-full bg-border" />
            <span className="block h-1.5 w-[78%] rounded-full bg-border" />
            <span className="block h-1.5 rounded-full bg-border" />
            <span className="block h-1.5 w-[55%] rounded-full bg-border" />
          </div>
        ))}
        <span className="absolute -right-[16%] bottom-[16%] flex aspect-square w-[26%] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.35),0_0_0_8px_hsl(var(--primary)/0.12)]">
          <Check className="h-[55%] w-[55%]" strokeWidth={3.2} />
        </span>
      </div>
      <div className="absolute inset-x-[10%] bottom-0 h-[10%] rounded-[50%] bg-primary-tint" />
    </div>
  );
}
