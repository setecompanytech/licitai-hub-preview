import { supabase } from '@/integrations/supabase/client';
import { acharChaveNoTexto, dadosDaChave, type DadosDaChave } from './danfe';
import type { NFeLida } from './nfe-para-lancamento';

/**
 * Ler um DANFE em PDF, em dois passos que se complementam.
 *
 *   1. A CHAVE DE ACESSO, local e instantânea. Tem dígito verificador — ou
 *      está certa, ou não é chave — e codifica número, série e a competência.
 *      Custa nada e não erra.
 *
 *   2. `extrair-dados-nfe-pdf`, a leitura por IA que já existia no sistema
 *      desde antes, usada em Gestão de Compras. Custa uma chamada e alguns
 *      segundos, mas traz o que a chave NÃO codifica: o dia da emissão, o
 *      valor, e sobretudo os ITENS com quantidade.
 *
 * Os itens são a razão de o segundo passo valer a pena. Sem eles, vincular a
 * nota a um contrato exige calcular a quantidade de cabeça — R$ 30.960,00 a
 * R$ 0,43 são 72.000 unidades —, e essa divisão não deveria ser de quem
 * cadastra.
 *
 * ── Por que os dois, e não só o segundo ─────────────────────────────────────
 *
 * A IA pode falhar, demorar ou ler errado. A chave, não: 44 dígitos que fecham
 * o DV são o número da nota, ponto. Rodar o passo 1 primeiro dá resposta
 * imediata e um piso de verdade — e, quando a IA discorda dele, é a IA que
 * está errada.
 */

export type LeituraDoDanfe = {
  /** O que a chave garante. Nulo quando ela não foi achada no papel. */
  daChave: DadosDaChave | null;
  chave: string | null;
  /** O que a IA leu, na mesma forma do parser de XML. Nulo se ela falhou. */
  daIa: NFeLida | null;
  /** Campos em que a IA contradiz a chave — a chave manda. */
  contradicoes: string[];
};

function paraBase64(bytes: Uint8Array): string {
  const partes: string[] = [];
  // Em blocos: `String.fromCharCode(...)` com um array grande estoura a pilha
  // de argumentos, e o PDF de um DANFE escaneado passa fácil de 1 MB.
  for (let i = 0; i < bytes.length; i += 8192) {
    partes.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(partes.join(''));
}

/**
 * @param aoProgredir recebe onde a leitura está — o passo 2 leva segundos, e
 *   espera sem aviso é indistinguível de travamento.
 */
export async function lerDanfeEmPdf(
  pdf: File,
  aoProgredir?: (msg: string) => void,
): Promise<LeituraDoDanfe> {
  const resultado: LeituraDoDanfe = { daChave: null, chave: null, daIa: null, contradicoes: [] };

  // ── Passo 1: a chave ──────────────────────────────────────────────────────
  try {
    aoProgredir?.('Procurando a chave de acesso…');
    const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
    // DANFE tem uma ou duas páginas, e escaneado é o caso comum: o OCR precisa
    // estar ligado, com orçamento curto.
    const texto = await extractTextFromFile(pdf, 3, false, 2);
    const chave = acharChaveNoTexto(texto);
    if (chave) {
      resultado.chave = chave;
      resultado.daChave = dadosDaChave(chave);
    }
  } catch { /* sem a chave, o passo 2 ainda pode salvar a leitura */ }

  // ── Passo 2: o resto do papel ─────────────────────────────────────────────
  try {
    aoProgredir?.('Lendo o DANFE…');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const { data, error } = await supabase.functions.invoke('extrair-dados-nfe-pdf', {
      body: { pdf_base64: paraBase64(bytes) },
    });
    if (error || !data || (data as { error?: string }).error) return resultado;
    const lida = data as NFeLida & { numero_nf?: number };
    // Devolveu um objeto vazio é o mesmo que não ter lido.
    if (!lida.numero_nf && !lida.v_nf) return resultado;
    resultado.daIa = lida;
  } catch { /* a chave, se veio, continua valendo */ }

  // ── Onde os dois discordam, a chave manda ─────────────────────────────────
  const c = resultado.daChave;
  const ia = resultado.daIa;
  if (c && ia) {
    if (ia.numero_nf != null && String(ia.numero_nf) !== c.numero) {
      resultado.contradicoes.push('número');
    }
    if (ia.serie != null && String(ia.serie) !== c.serie) {
      resultado.contradicoes.push('série');
    }
    if (ia.data_emissao && !String(ia.data_emissao).startsWith(c.competencia)) {
      resultado.contradicoes.push('mês da emissão');
    }
  }

  return resultado;
}

/**
 * O melhor de cada passo, reunido.
 *
 * A chave vence onde ela sabe — número, série, competência — porque é fato
 * aritmético; a IA entra onde a chave não alcança: o dia da emissão, o valor e
 * os itens. Deixar a IA sobrescrever o que a chave já disse trocaria certeza
 * por leitura.
 */
export function consolidar(leitura: LeituraDoDanfe): NFeLida | null {
  const { daChave, daIa, chave } = leitura;
  if (!daChave && !daIa) return null;
  return {
    chave_acesso: chave ?? daIa?.chave_acesso ?? null,
    numero_nf: daChave ? Number(daChave.numero) : (daIa?.numero_nf ?? null),
    serie: daChave ? Number(daChave.serie) : (daIa?.serie ?? null),
    // A chave só guarda ano e mês. O dia vem da IA quando ela concorda com o
    // mês; discordando, fica só a competência, que é o que se pode afirmar.
    data_emissao: daIa?.data_emissao
      && (!daChave || String(daIa.data_emissao).startsWith(daChave.competencia))
      ? daIa.data_emissao
      : (daChave ? `${daChave.competencia}-01` : null),
    v_nf: daIa?.v_nf ?? null,
    tipo_nf: daIa?.tipo_nf ?? null,
    nome_dest: daIa?.nome_dest ?? null,
    itens: daIa?.itens ?? [],
  };
}
