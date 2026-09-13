import { useEffect, useState } from 'react';

/**
 * Há um mouse de verdade? `hover: hover` sozinho mente em alguns Android;
 * junto com `pointer: fine` separa mouse/trackpad de dedo/caneta.
 *
 * Vivia dentro do AppSidebar; subiu para hook porque o AppLayout também
 * precisa saber (é ele quem decide mostrar o símbolo da marca na barra do
 * topo quando o trilho auto-escondido tira a logo da tela).
 */
export function useTemMouse() {
  const consulta = '(hover: hover) and (pointer: fine)';
  const [tem, setTem] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(consulta).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(consulta);
    const aoMudar = (e: MediaQueryListEvent) => setTem(e.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);
  return tem;
}
