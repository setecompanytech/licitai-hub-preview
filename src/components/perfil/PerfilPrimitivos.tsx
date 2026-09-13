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
  return <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
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
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {rotulo}
      </span>
      {children}
      {dica && (
        <p className="mt-2 text-xs leading-4 text-muted-foreground">{dica}</p>
      )}
    </label>
  );
}

export function RodapeHub({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6">
      {children}
    </div>
  );
}

/** Cabeçalho de seção — título e a linha que diz para que serve. */
export function TituloHub({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}
