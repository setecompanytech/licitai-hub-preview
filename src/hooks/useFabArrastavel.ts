import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Arraste do botão flutuante do chat.
 *
 * O botão vive sobre o conteúdo e chega a cobrir controles da página — o caso
 * que originou isto foi o switch "Ativo" da última linha de uma tabela. Em vez
 * de escolher um canto novo (que cobriria outra coisa em outra tela), o botão
 * passa a ser movido pelo usuário.
 *
 * Ao soltar, ele encosta na lateral mais próxima e mantém a altura. Isso evita
 * que fique parado no meio do conteúdo e preserva o canto direito como destino
 * natural, que é de onde ele saiu.
 *
 * A posição é por navegador (localStorage), não por usuário: é preferência de
 * tela, não dado de negócio, e não vale uma ida ao banco.
 */

export type LadoFab = 'esquerda' | 'direita';

/** `y` é a distância do topo da viewport, em px. */
export type PosicaoFab = { lado: LadoFab; y: number };

const CHAVE = 'praefectus:chat-fab-posicao';
/** Diâmetro do botão (w-14 h-14 = 3.5rem). */
const TAMANHO = 56;
/** Respiro até a borda, igual ao bottom-6/right-6 original. */
const MARGEM = 24;
/** Abaixo disso o gesto ainda é um clique, não um arraste. */
const LIMIAR_ARRASTE = 4;

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

function yMaximo(): number {
  return Math.max(MARGEM, window.innerHeight - TAMANHO - MARGEM);
}

function posicaoPadrao(): PosicaoFab {
  return { lado: 'direita', y: yMaximo() };
}

function carregar(): PosicaoFab {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return posicaoPadrao();
    const salvo = JSON.parse(bruto) as Partial<PosicaoFab>;
    if (salvo.lado !== 'esquerda' && salvo.lado !== 'direita') return posicaoPadrao();
    if (typeof salvo.y !== 'number' || Number.isNaN(salvo.y)) return posicaoPadrao();
    // A janela pode ter encolhido desde a última sessão.
    return { lado: salvo.lado, y: limitar(salvo.y, MARGEM, yMaximo()) };
  } catch {
    return posicaoPadrao();
  }
}

/** x em px correspondente ao lado onde o botão está encostado. */
function xDoLado(lado: LadoFab): number {
  return lado === 'esquerda' ? MARGEM : Math.max(MARGEM, window.innerWidth - TAMANHO - MARGEM);
}

export function useFabArrastavel() {
  const [posicao, setPosicao] = useState<PosicaoFab>(carregar);
  /** Coordenadas livres enquanto o dedo/mouse está pressionado. */
  const [arrasto, setArrasto] = useState<{ x: number; y: number } | null>(null);

  const origem = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  /** Passou do limiar? Serve para o clique não abrir o chat ao fim de um arraste. */
  const moveu = useRef(false);

  // A viewport pode encolher com o botão fora dela.
  useEffect(() => {
    const aoRedimensionar = () =>
      setPosicao((p) => ({ ...p, y: limitar(p.y, MARGEM, yMaximo()) }));
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  const aoPressionar = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Só botão principal do mouse; toque e caneta passam direto.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      moveu.current = false;
      origem.current = { px: e.clientX, py: e.clientY, x: xDoLado(posicao.lado), y: posicao.y };
    },
    [posicao],
  );

  const aoMover = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const inicio = origem.current;
    if (!inicio) return;

    const dx = e.clientX - inicio.px;
    const dy = e.clientY - inicio.py;

    if (!moveu.current && Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
    moveu.current = true;

    setArrasto({
      x: limitar(inicio.x + dx, 0, Math.max(0, window.innerWidth - TAMANHO)),
      y: limitar(inicio.y + dy, 0, Math.max(0, window.innerHeight - TAMANHO)),
    });
  }, []);

  const aoSoltar = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      origem.current = null;

      if (arrasto) {
        // Encosta na lateral mais próxima do centro do botão.
        const lado: LadoFab =
          arrasto.x + TAMANHO / 2 < window.innerWidth / 2 ? 'esquerda' : 'direita';
        const destino: PosicaoFab = { lado, y: limitar(arrasto.y, MARGEM, yMaximo()) };
        setPosicao(destino);
        setArrasto(null);
        try {
          localStorage.setItem(CHAVE, JSON.stringify(destino));
        } catch {
          // Modo privativo ou storage cheio: a posição vale só nesta sessão.
        }
      }
    },
    [arrasto],
  );

  /** True entre o passar do limiar e o soltar — o clique deve ser ignorado. */
  const arrastando = arrasto !== null;

  /** O clique veio de um arraste? Consome a marca, para o próximo clique valer. */
  const consumirArraste = useCallback(() => {
    const houve = moveu.current;
    moveu.current = false;
    return houve;
  }, []);

  const estilo: React.CSSProperties = arrasto
    ? { left: arrasto.x, top: arrasto.y, right: 'auto', bottom: 'auto' }
    : posicao.lado === 'esquerda'
      ? { left: MARGEM, top: posicao.y, right: 'auto', bottom: 'auto' }
      : { right: MARGEM, top: posicao.y, left: 'auto', bottom: 'auto' };

  return {
    /** Lado em que o botão está encostado — a janela do chat abre do mesmo lado. */
    lado: posicao.lado,
    estilo,
    arrastando,
    consumirArraste,
    handlers: {
      onPointerDown: aoPressionar,
      onPointerMove: aoMover,
      onPointerUp: aoSoltar,
      onPointerCancel: aoSoltar,
    },
  };
}

export const FAB_MARGEM = MARGEM;
