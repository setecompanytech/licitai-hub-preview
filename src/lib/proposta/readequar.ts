import type { EditalItem } from '@/components/proposta/EditalUploader';
import type { DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';
import { valorPorExtenso } from '@/lib/numero-extenso';

/**
 * Proposta readequada — os preços da proposta passam a ser os do fim da disputa.
 *
 * Ganho o pregão, o portal exige um documento com os valores NEGOCIADOS, não os
 * da proposta inicial. Antes disso a planilha era refeita à mão, item por item.
 *
 * Isto NÃO é uma importação. Importar do edital e do catálogo acrescentam linhas;
 * aqui os itens já estão na proposta e o que muda é o preço — acrescentar
 * duplicaria a planilha inteira. É um casamento por número de item, e cada linha
 * termina em um de três desfechos, todos declarados no resumo: nenhuma mudança
 * de preço acontece sem aparecer.
 */

export type ResumoReadequacao = {
  itens: EditalItem[];
  /** Números dos itens cujo preço unitário virou o lance final. */
  readequados: string[];
  /** Casaram com a disputa, mas não houve lance nosso — ficaram como estavam. */
  semLance: string[];
  /** Estavam na disputa e não têm par na proposta — não entram sozinhos. */
  semPar: string[];
};

/** Mesma forma que a aba de proposta usa para escrever valor. */
const num = (v: number) => v.toFixed(2).replace('.', ',');

/** Mesma forma que a PlanilhaPrecos usa para ler valor digitado. */
const paraNumero = (s: string) => parseFloat(String(s).replace(',', '.')) || 0;

/**
 * "01", "1" e 1 são o mesmo item: os dois lados nascem de `licitacao_itens`,
 * mas passam por caminhos diferentes e a grafia diverge.
 */
function chave(v: string | number): string {
  const s = String(v).trim();
  if (s === '') return '';
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s.toLowerCase();
}

export function readequarComADisputa(
  itensDaProposta: EditalItem[],
  itensDaDisputa: DisputeItem[],
): ResumoReadequacao {
  const porNumero = new Map<string, DisputeItem>();
  for (const d of itensDaDisputa) {
    const k = chave(d.numero);
    if (k !== '') porNumero.set(k, d);
  }

  const readequados: string[] = [];
  const semLance: string[] = [];
  const casados = new Set<string>();

  const itens = itensDaProposta.map((item) => {
    const k = chave(item.item);
    const disputa = k === '' ? undefined : porNumero.get(k);
    if (!disputa) return item;

    casados.add(k);

    // `seuUltimoLance` é O NOSSO último lance — o preço que negociamos.
    // `melhorLance` é o melhor da sessão e pode ser de um concorrente; usá-lo
    // colocaria o preço do adversário na nossa proposta.
    const lanceFinal = disputa.seuUltimoLance;
    if (lanceFinal == null || lanceFinal <= 0) {
      semLance.push(item.item);
      return item;
    }

    const total = lanceFinal * paraNumero(item.quantidade);
    readequados.push(item.item);
    return {
      ...item,
      valorUnitario: num(lanceFinal),
      valorUnitarioExtenso: valorPorExtenso(lanceFinal),
      valorTotal: num(total),
      valorTotalExtenso: valorPorExtenso(total),
    };
  });

  const semPar = itensDaDisputa
    .filter((d) => !casados.has(chave(d.numero)))
    .map((d) => String(d.numero));

  return { itens, readequados, semLance, semPar };
}
