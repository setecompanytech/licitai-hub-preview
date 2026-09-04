import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * As três peças que se repetem nas seções do hub de perfil.
 *
 * Existem para que campo, grade e rodapé tenham a MESMA medida em todas as
 * seções. Cada seção repetindo o próprio `space-y` e o próprio tamanho de
 * rótulo é como um formulário passa a parecer cinco formulários diferentes
 * colados — foi por isso que viraram peça, e não classe copiada.
 */

export function GradeHub({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function CampoHub({
  icone: Icone,
  rotulo,
  dica,
  children,
}: {
  icone: LucideIcon;
  rotulo: string;
  dica?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
        <Icone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        {rotulo}
      </span>
      {children}
      {dica && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{dica}</p>
      )}
    </label>
  );
}

export function RodapeHub({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 pt-5 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2">
      {children}
    </div>
  );
}

/** Cabeçalho de seção — título e a linha que diz para que serve. */
export function TituloHub({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold tracking-tight">{titulo}</h2>
      <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
    </div>
  );
}
