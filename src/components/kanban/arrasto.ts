/**
 * Geometria do arrasto no quadro de licitações.
 *
 * Em 14/09/2026 o dono do produto relatou dificuldade para arrastar processos
 * até a última coluna (Arquivada). Eram três causas somadas, e as duas que
 * moram aqui são as de geometria:
 *
 *  1. O destino era descoberto por `document.elementFromPoint`: o que estivesse
 *     desenhado POR CIMA da coluna ganhava. O botão flutuante do chat (`fixed`,
 *     canto inferior direito) fica justamente sobre a Arquivada — soltar ali
 *     achava o botão, nenhuma coluna, e o cartão voltava para a origem. Agora a
 *     coluna é achada pelo retângulo dela, e sobreposição não interfere.
 *  2. O quadro rola na horizontal, mas não rolava sozinho durante o arrasto: com
 *     a última coluna fora da área visível, não havia como alcançá-la sem soltar
 *     o cartão. Agora a borda do quadro rola, mais rápido quanto mais perto.
 *
 * A terceira (as colunas vazias se abrindo no início do arrasto e empurrando a
 * Arquivada para fora da tela) é de apresentação e está em `KanbanPage`.
 *
 * Funções puras: recebem retângulos, não elementos — o jsdom não tem layout, e
 * assim a regra é testável sem navegador.
 */

export type Retangulo = { left: number; right: number; top: number; bottom: number };

/** Largura, junto a cada borda do quadro, em que o cartão arrastado faz o quadro rolar. */
export const FAIXA_DE_ROLAGEM_PX = 72;

/** Deslocamento máximo por quadro de animação (~60 por segundo). */
export const ROLAGEM_MAXIMA_PX = 22;

/**
 * Tolerância para o vão entre colunas (`gap-3` = 12 px). Soltar no vão caía em
 * "nenhuma coluna" e o cartão voltava — aqui ele vai para a coluna mais próxima.
 */
const TOLERANCIA_DO_VAO_PX = 16;

const contem = (r: Retangulo, x: number, y: number) =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/**
 * Qual coluna está sob o ponteiro.
 *
 * `areaVisivel` é o retângulo do quadro (a caixa que rola). Uma coluna rolada
 * para fora dele continua tendo retângulo — só que invisível, atrás da borda.
 *
 * Ponteiro além da borda LATERAL conta como a própria borda. É o gesto de quem
 * "empurra" o cartão para fora do quadro rumo à última coluna: a rolagem
 * automática anda, e a coluna junto à borda é justamente a que a pessoa mira.
 * Uma coluna ainda inteira atrás da borda nunca é escolhida — o ponto usado
 * nunca passa da borda. Acima ou abaixo do quadro não há destino.
 */
export function colunaSobOPonteiro(
  x: number,
  y: number,
  colunas: ReadonlyArray<{ id: string; rect: Retangulo }>,
  areaVisivel: Retangulo | null,
): string | null {
  if (areaVisivel && (y < areaVisivel.top || y > areaVisivel.bottom)) return null;
  const px = areaVisivel ? Math.min(Math.max(x, areaVisivel.left), areaVisivel.right) : x;

  const direta = colunas.find((c) => contem(c.rect, px, y));
  if (direta) return direta.id;

  // No vão entre duas colunas: a mais próxima na horizontal, se estiver perto.
  let maisProxima: { id: string; distancia: number } | null = null;
  for (const c of colunas) {
    if (y < c.rect.top || y > c.rect.bottom) continue;
    const distancia = px < c.rect.left ? c.rect.left - px : px - c.rect.right;
    if (distancia <= TOLERANCIA_DO_VAO_PX && (!maisProxima || distancia < maisProxima.distancia)) {
      maisProxima = { id: c.id, distancia };
    }
  }
  return maisProxima?.id ?? null;
}

/**
 * Quantos px o quadro deve rolar neste quadro de animação. Negativo rola para a
 * esquerda, positivo para a direita, zero não rola.
 *
 * Proporcional à proximidade da borda: encostar devagar rola devagar, e passar
 * da borda (o ponteiro fora do quadro, à direita) rola na velocidade máxima —
 * que é o gesto natural de quem "empurra" o cartão para uma coluna escondida.
 * Fora da faixa vertical do quadro não rola: arrastar sobre o cabeçalho da
 * página não pode sair deslocando o quadro.
 */
export function velocidadeDeRolagem(
  x: number,
  y: number,
  area: Retangulo,
  faixa = FAIXA_DE_ROLAGEM_PX,
  maxima = ROLAGEM_MAXIMA_PX,
): number {
  if (y < area.top || y > area.bottom) return 0;
  // Quadro estreito: a faixa não pode tomar o quadro inteiro, senão todo ponto
  // seria "borda" e ele rolaria sem parar.
  const f = Math.min(faixa, (area.right - area.left) / 4);
  if (f <= 0) return 0;

  if (x < area.left + f) {
    const proporcao = Math.min(1, (area.left + f - x) / f);
    return -Math.ceil(maxima * proporcao);
  }
  if (x > area.right - f) {
    const proporcao = Math.min(1, (x - (area.right - f)) / f);
    return Math.ceil(maxima * proporcao);
  }
  return 0;
}
