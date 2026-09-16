/**
 * O resultado da compra volta ao processo — pelo dado oficial (16/09/2026).
 *
 * A outra ponta que o Rafael cobrava ("do cadastramento à homologação"): o
 * robô não sabe quem venceu olhando a sala, mas os dados abertos do Compras.gov
 * publicam, por item, a situação ("Homologado", "Deserto", "Fracassado") e o
 * fornecedor vencedor com o CNPJ (conferido em compras homologadas de junho).
 *
 * O que vira ação:
 * - todos os itens da disputa decididos e a empresa venceu algum → o processo
 *   vai para Homologada (só a partir de Proposta Enviada, Em Disputa ou
 *   Vencida), com o que ganhou e o que perdeu no mural e no aviso;
 * - homologada só para outros fornecedores → aviso com quem venceu cada item;
 *   NÃO move para Perdida, que exige o motivo em `comercial_perdas`;
 * - sem vencedor (deserto, fracassado, cancelado) → aviso para registrar.
 * Com item ainda sem resultado, nada acontece: espera a próxima conferência.
 */
import type { ItemDaCompra } from "./compra-comprasgov.ts";

export type EstadoDoResultado = "pendente" | "vencida" | "perdida" | "sem-vencedor";

export interface ResultadoDaDisputa {
  estado: EstadoDoResultado;
  ganhos: Array<{ numero: number; valor: number | null }>;
  perdidos: Array<{ numero: number; fornecedor: string | null; valor: number | null }>;
  semVencedor: Array<{ numero: number; situacao: string }>;
  pendentes: number[];
}

export const STATUS_QUE_VIRAM_HOMOLOGADA = ["Proposta Enviada", "Em Disputa", "Vencida"] as const;
export const STATUS_HOMOLOGADA = "Homologada";

const SEM_VENCEDOR = /desert|fracass|cancel|anulad|revogad|suspens/i;

/**
 * @param numeros os itens que a empresa disputou (os da disputa); vazio = todos os da compra
 * @param cnpjEmpresa CNPJ da empresa; sem ele não dá para dizer quem ganhou → nulo
 */
export function resultadoDaDisputa(
  numeros: ReadonlyArray<number>,
  itens: ReadonlyArray<ItemDaCompra>,
  cnpjEmpresa: string | null | undefined,
): ResultadoDaDisputa | null {
  const meu = String(cnpjEmpresa ?? "").replace(/\D/g, "");
  if (meu.length !== 14) return null;
  const alvo = new Set(numeros.filter((n) => Number.isFinite(n)));
  const considerados = itens.filter((i) => alvo.size === 0 || alvo.has(i.numero));
  if (considerados.length === 0) return null;

  const r: ResultadoDaDisputa = { estado: "pendente", ganhos: [], perdidos: [], semVencedor: [], pendentes: [] };
  for (const item of considerados) {
    if (item.resultado?.cnpj) {
      if (item.resultado.cnpj === meu) r.ganhos.push({ numero: item.numero, valor: item.resultado.valorUnitario });
      else r.perdidos.push({ numero: item.numero, fornecedor: item.resultado.fornecedor, valor: item.resultado.valorUnitario });
    } else if (item.situacao && SEM_VENCEDOR.test(item.situacao)) {
      r.semVencedor.push({ numero: item.numero, situacao: item.situacao });
    } else {
      r.pendentes.push(item.numero);
    }
  }
  if (r.pendentes.length) r.estado = "pendente";
  else if (r.ganhos.length) r.estado = "vencida";
  else if (r.perdidos.length) r.estado = "perdida";
  else r.estado = "sem-vencedor";
  return r;
}

export function processoViraHomologada(statusAtual: string | null | undefined, r: ResultadoDaDisputa | null): boolean {
  return r?.estado === "vencida" && (STATUS_QUE_VIRAM_HOMOLOGADA as readonly string[]).includes(String(statusAtual ?? ""));
}

export function textoDoResultado(
  edital: string,
  r: ResultadoDaDisputa,
  formatar: (n: unknown) => string,
  movido: boolean,
): { titulo: string; mensagem: string; tipo: "sucesso" | "alerta" | "info" } {
  const valor = (v: number | null) => (Number.isFinite(v as number) ? ` (R$ ${formatar(v)})` : "");
  const partes: string[] = [];
  if (r.ganhos.length) {
    partes.push(`A empresa venceu ${r.ganhos.map((g) => `o item ${g.numero}${valor(g.valor)}`).join(", ")}.`);
  }
  if (r.perdidos.length) {
    partes.push(`${r.perdidos.map((p) => `Item ${p.numero}: ${p.fornecedor ?? "outro fornecedor"}${valor(p.valor)}`).join("; ")}.`);
  }
  if (r.semVencedor.length) {
    partes.push(`${r.semVencedor.map((s) => `Item ${s.numero}: ${s.situacao.toLowerCase()}`).join("; ")}.`);
  }
  const fonte = "O Compras.gov publicou o resultado.";
  if (r.estado === "vencida") {
    return {
      titulo: `🏆 Compra homologada com vitória — ${edital}`,
      mensagem: `${fonte} ${partes.join(" ")}${movido ? " Processo movido para Homologada." : ""}`,
      tipo: "sucesso",
    };
  }
  if (r.estado === "perdida") {
    return {
      titulo: `🏁 Compra homologada para outros fornecedores — ${edital}`,
      mensagem: `${fonte} ${partes.join(" ")} Registre o motivo da perda no processo para concluí-lo.`,
      tipo: "alerta",
    };
  }
  return {
    titulo: `🏁 Compra sem vencedor — ${edital}`,
    mensagem: `${fonte} ${partes.join(" ")} Registre o desfecho no processo.`,
    tipo: "info",
  };
}
