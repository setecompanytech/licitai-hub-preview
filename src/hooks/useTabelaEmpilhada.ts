import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  CLASSE_TABELA_EMPILHADA, CONSULTA_DE_CELULAR, precisaEmpilhar, rotularCelulas,
} from '@/lib/ui/tabela-empilhada';

/**
 * Empilha a tabela no celular quando ela não cabe na caixa de rolagem.
 *
 * A caixa recebe a classe `tabela-empilhada` e as células, os rótulos das
 * colunas; a decisão é refeita ao redimensionar e quando o conteúdo muda
 * (linhas que chegam depois de carregar). A medida é feita SEM a classe, na
 * forma de tabela, porque empilhada ela sempre cabe. Fora do celular nada
 * disto acontece, e a tabela que cabe continua tabela.
 *
 * A classe é posta na mão E refletida no estado: só no estado, um novo render
 * a apagaria enquanto a medição a tivesse tirado; só na mão, o React a
 * apagaria no próximo `className`.
 */
export function useTabelaEmpilhada(caixa: RefObject<HTMLElement | null>): boolean {
  const [empilhada, setEmpilhada] = useState(false);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia(CONSULTA_DE_CELULAR);
    let quadro = 0;

    const avaliar = () => {
      const tabela = el.querySelector('table');
      if (!tabela) return;
      el.classList.remove(CLASSE_TABELA_EMPILHADA);
      if (!consulta.matches) {
        setEmpilhada(false);
        return;
      }
      const precisa = precisaEmpilhar(el);
      if (precisa) {
        rotularCelulas(tabela);
        el.classList.add(CLASSE_TABELA_EMPILHADA);
      }
      setEmpilhada(precisa);
    };
    const agendar = () => {
      if (typeof requestAnimationFrame !== 'function') { avaliar(); return; }
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(avaliar);
    };

    avaliar();
    consulta.addEventListener?.('change', agendar);
    window.addEventListener('resize', agendar);
    // Só filhos e texto: os rótulos e a classe que este hook escreve são
    // atributos, e observá-los faria o hook acordar a si mesmo.
    const observador = typeof MutationObserver !== 'undefined' ? new MutationObserver(agendar) : null;
    observador?.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(quadro);
      consulta.removeEventListener?.('change', agendar);
      window.removeEventListener('resize', agendar);
      observador?.disconnect();
    };
  }, [caixa]);

  return empilhada;
}
