import type { SombraDeRolagem } from '@/hooks/useSombraDeRolagem';

/**
 * As sombras nas bordas da caixa de rolagem: dizem "tem mais para este lado"
 * e só aparecem quando tem. O pai precisa ser `relative` e a caixa que rola,
 * irmã destes elementos — dentro dela, a sombra rolaria junto.
 */
export function SombrasDeRolagem({ sombra }: { sombra: SombraDeRolagem }) {
  return (
    <>
      {sombra.esquerda && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent" />
      )}
      {sombra.direita && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/70 to-transparent" />
      )}
    </>
  );
}
