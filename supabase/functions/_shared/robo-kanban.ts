/**
 * O robô move o processo no Kanban — só com o que ele VÊ (16/09/2026).
 *
 * Pedido do Ian ("e o kanban, por que ainda não foi feito?"). O robô não sabe
 * quem venceu: arrematar na sala não é "Vencida" (vem aceitação e
 * habilitação), e "Perdida" exige motivo registrado (`comercial_perdas`, o
 * banco recusa sem ele). O que ele sabe é fato de tela:
 *
 * - **a proposta da empresa está na sala da compra** → o processo está em
 *   disputa. Sai de Monitorando, Em Análise ou Proposta Enviada para Em
 *   Disputa; nunca anda para trás, nunca mexe em Vencida, Homologada,
 *   Perdida ou Arquivada. (O gatilho `comercial_marcar_proposta_enviada` marca
 *   a data da proposta enviada — e ela foi, o portal está mostrando.)
 * - **no fim da sessão**, a última posição lida de cada item vai no aviso e no
 *   mural, para quem registra o resultado decidir com o número na mão.
 *
 * Grafia dos status: a de `_shared/licitacao-status.ts` (espelho de
 * `src/lib/licitacao/status.ts`), que é a que as triggers do banco comparam.
 */
import type { EstadoGravado, EstadoDaSala } from "./robo-estado-da-sala.ts";

export const STATUS_QUE_ENTRAM_EM_DISPUTA = ["Monitorando", "Em Análise", "Proposta Enviada"] as const;
export const STATUS_EM_DISPUTA = "Em Disputa";

export function processoEntraEmDisputa(statusAtual: string | null | undefined, temProposta: boolean | null | undefined): boolean {
  return temProposta === true && (STATUS_QUE_ENTRAM_EM_DISPUTA as readonly string[]).includes(String(statusAtual ?? ""));
}

export function textoDoProcessoEmDisputa(edital: string, de: string, portal?: string | null): string {
  return `🤖 **Processo movido para Em Disputa** — o robô viu a proposta da empresa na sala da compra ${edital}` +
    `${portal ? ` (${portal})` : ""}. Estava em ${de}.`;
}

/**
 * "Última leitura da sala — item 1: 8º lugar (nosso R$ 4.999,70, melhor R$ 3.100,00); item 5: proposta desclassificada".
 * Nulo quando não houve leitura de item nenhum.
 */
export function posicoesFinais(
  estado: EstadoGravado | null | undefined,
  formatar: (n: unknown) => string,
): string | null {
  if (!estado) return null;
  const porItem: EstadoDaSala[] = estado.por_item
    ? Object.values(estado.por_item)
    : [estado];
  const linhas = porItem
    .filter((e) => Number.isFinite(e.item as number))
    .sort((a, b) => Number(a.item) - Number(b.item))
    .map((e) => {
      const rotulo = `item ${e.item}`;
      if (e.nossa_desclassificada) return `${rotulo}: proposta desclassificada`;
      if (e.tem_proposta === false) return `${rotulo}: sem proposta da empresa`;
      if (Number.isFinite(e.posicao as number)) {
        const valores = [
          Number.isFinite(e.nosso_lance as number) ? `nosso R$ ${formatar(e.nosso_lance)}` : null,
          Number.isFinite(e.melhor_lance as number) ? `melhor R$ ${formatar(e.melhor_lance)}` : null,
        ].filter(Boolean).join(", ");
        return `${rotulo}: ${e.posicao}º lugar${valores ? ` (${valores})` : ""}`;
      }
      return `${rotulo}: posição não lida`;
    });
  return linhas.length ? `Última leitura da sala — ${linhas.join("; ")}` : null;
}
