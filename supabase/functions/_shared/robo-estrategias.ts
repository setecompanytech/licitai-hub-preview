/**
 * As estratégias do item, cumulativas (17/09/2026).
 *
 * O Rafael, dono do produto, sobre o cadastro: "são as 3 opções que o usuário
 * escolhe — ele pode escolher as 3 ou somente 2 ou somente 1". O item gravado
 * passa a trazer `estrategias` (lista); `estrategia` (uma só) é o formato de
 * antes, e a disputa cadastrada antes continua valendo.
 *
 * ESPELHO: `src/lib/robo/estrategia-do-item.ts` (`estrategiasDoItem`) no front e
 * `estrategiasDoItem` em `src/lib/agent-template/estrategia.ts` no agente. As
 * três leituras precisam mudar juntas.
 */

export const ESTRATEGIAS = ["melhor_preco", "iminencia", "desempatar_1o"] as const;

/**
 * As estratégias marcadas no item, sem repetição, na ordem de `ESTRATEGIAS`.
 * Sem lista e sem a estratégia antiga = melhor preço, como sempre foi. Lista
 * vazia informada continua vazia: quem desmarcou tudo não escolheu melhor preço.
 */
export function estrategiasDoItem(item: { estrategias?: unknown; estrategia?: unknown } | null | undefined): string[] {
  const lista = item?.estrategias;
  if (Array.isArray(lista)) {
    const marcadas = lista.map((e) => String(e ?? "").trim()).filter(Boolean);
    const unicas = marcadas.filter((e, i) => marcadas.indexOf(e) === i);
    const ordem = (e: string) => {
      const i = (ESTRATEGIAS as readonly string[]).indexOf(e);
      return i === -1 ? 99 : i;
    };
    return unicas.sort((a, b) => ordem(a) - ordem(b));
  }
  const uma = String(item?.estrategia ?? "").trim();
  return [uma || "melhor_preco"];
}

/**
 * A estratégia única que um agente de antes desta versão entende. Ele lê só
 * `estrategia`, e a que mais se aproxima da soma é a mais ampla marcada:
 * melhor preço cobre tudo o que as outras cobririam; iminência, a qualquer
 * distância nos minutos finais. Vazio vai vazio — e o agente novo, que lê a
 * lista, aguarda.
 */
export function estrategiaParaAgenteAntigo(lista: readonly string[]): string | null {
  if (lista.includes("melhor_preco")) return "melhor_preco";
  if (lista.includes("iminencia")) return "iminencia";
  if (lista.includes("desempatar_1o")) return "desempatar_1o";
  return lista[0] ?? null;
}
