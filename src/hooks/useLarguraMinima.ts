import { useEffect, useState } from 'react';

/**
 * "A janela tem pelo menos N pixels de largura?" — respondido em JavaScript,
 * para quando a resposta muda o QUE é renderizado, não só como ele parece.
 *
 * O caso que obrigou a existir: o painel de detalhes das telas de Gestão vira
 * gaveta em tela estreita. Resolver isso com duas árvores e `hidden xl:block`
 * renderiza o painel DUAS vezes ao mesmo tempo — dois formulários com os
 * mesmos ids, dois campos disputando o mesmo rótulo, e o que a pessoa digita
 * na cópia visível não existe na outra. Com esta resposta em mão, o painel é
 * montado uma vez, no invólucro certo.
 *
 * Enquanto o efeito não roda (primeiro render, SSR) devolve `false`: o layout
 * estreito é o que cabe em qualquer lugar, então errar para ele é seguro.
 */
export function useLarguraMinima(px: number): boolean {
  const [cabe, setCabe] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(`(min-width: ${px}px)`);
    const aplicar = () => setCabe(consulta.matches);
    aplicar();
    consulta.addEventListener('change', aplicar);
    return () => consulta.removeEventListener('change', aplicar);
  }, [px]);

  return cabe;
}

/** O ponto em que tabela e painel de 384px convivem sem espremer as duas. */
export const LARGURA_PAINEL_LATERAL = 1280;
