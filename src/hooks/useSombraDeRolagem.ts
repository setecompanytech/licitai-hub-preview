import { useCallback, useEffect, useState, type DependencyList, type RefObject } from 'react';

export interface SombraDeRolagem {
  esquerda: boolean;
  direita: boolean;
}

/**
 * Há conteúdo escondido à esquerda ou à direita da caixa de rolagem?
 *
 * A rolagem horizontal fica presa ao contêiner (a página nunca rola de lado),
 * e a barra de rolagem mora no FIM da tabela — numa lista longa, fora da tela.
 * Sem um sinal na borda, coluna escondida parece coluna cortada: foi assim que
 * "Valor" e "Pendência principal" sumiram de duas telas em 14/09/2026 sem que
 * nada indicasse que bastava rolar.
 *
 * Nasceu em `TabelaGestao`; desde 22/09 serve também à `ui/table`, para as
 * oitenta telas que a usam crua. `dependencias` existe porque a tabela só
 * monta depois de carregar: sem reler quando ela aparece, o observador ficaria
 * preso a um contêiner que não existia.
 */
export function useSombraDeRolagem(
  ref: RefObject<HTMLElement | null>,
  dependencias: DependencyList = [],
): SombraDeRolagem {
  const [sombra, setSombra] = useState<SombraDeRolagem>({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const esquerda = el.scrollLeft > 1;
    const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setSombra((s) => (s.esquerda === esquerda && s.direita === direita ? s : { esquerda, direita }));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observador?.observe(el);
    if (el.firstElementChild) observador?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      observador?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medir, ...dependencias]);

  return sombra;
}
