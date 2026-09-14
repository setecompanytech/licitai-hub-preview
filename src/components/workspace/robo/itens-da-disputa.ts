/**
 * Itens da disputa × itens da sessão — o casamento que alimenta a tabela da
 * aba "Robô de Lances" do processo.
 *
 * Dois lugares descrevem o mesmo item. `robo_lances_disputas.itens` (jsonb) é
 * a CONFIGURAÇÃO: número, lote, descrição e o limite autorizado. A tabela
 * `sessao_lance_itens` é o que o AGENTE leu na sala do portal: seu último
 * lance, o melhor lance, quem lidera. A linha da tela junta os dois.
 *
 * ── A regra do casamento ─────────────────────────────────────────────────────
 *
 *   1. `licitacao_item_id`, quando os dois lados o têm — identificador estável.
 *   2. Senão, lote + número.
 *   3. NUNCA por descrição, NUNCA por posição na lista.
 *
 * Descrição muda de grafia entre o edital, a extração e o portal ("CANETA
 * AZUL" × "Caneta esferográfica azul"); posição muda quando alguém reordena ou
 * remove um item. Casar por qualquer dos dois põe o lance do item 3 na linha
 * do item 4 — um valor real, com cara de certo, no lugar errado. Sem
 * correspondência inequívoca a célula fica "Não informado", que é a verdade.
 *
 * Pelo mesmo motivo, duas linhas da sessão com o mesmo lote e número não
 * escolhem uma delas: a ambiguidade vira ausência.
 */
import type { TomSituacao } from '@/components/gestao/SeloSituacao';

/** Linha de `sessao_lance_itens` — só as colunas que a aba lê. */
export interface ItemDaSessao {
  sessao_id: string;
  numero: number | null;
  lote: string | null;
  descricao: string | null;
  seu_ultimo_lance: number | null;
  melhor_lance: number | null;
  sou_lider: boolean | null;
  situacao: string | null;
  valor_minimo: number | null;
  licitacao_item_id: string | null;
}

export interface LinhaDoItem {
  /** Chave de renderização — NÃO é critério de casamento. */
  chave: string;
  numero: number | null;
  lote: string | null;
  descricao: string;
  /** Limite autorizado na configuração da disputa. `null` = ninguém definiu. */
  limite: number | null;
  licitacaoItemId: string | null;
  /** O que o agente registrou para este item, quando o casamento é inequívoco. */
  daSessao: ItemDaSessao | null;
}

const numeroOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const textoOuNulo = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

/** Lote comparável: sem caixa nem espaço nas pontas; ausente vira vazio. */
const loteComparavel = (v: unknown): string => String(v ?? '').trim().toLowerCase();

const chaveLoteNumero = (lote: unknown, numero: number): string => `${loteComparavel(lote)}#${numero}`;

function empilhar(mapa: Map<string, ItemDaSessao[]>, chave: string, item: ItemDaSessao) {
  const lista = mapa.get(chave);
  if (lista) lista.push(item);
  else mapa.set(chave, [item]);
}

const unico = (lista: ItemDaSessao[] | undefined): ItemDaSessao | null =>
  lista && lista.length === 1 ? lista[0] : null;

export function linhasDaDisputa(
  itensDaDisputa: unknown,
  itensDaSessao: readonly ItemDaSessao[] | null | undefined,
): LinhaDoItem[] {
  const itens = Array.isArray(itensDaDisputa) ? (itensDaDisputa as Array<Record<string, unknown> | null>) : [];

  const porId = new Map<string, ItemDaSessao[]>();
  const porLoteNumero = new Map<string, ItemDaSessao[]>();
  for (const s of itensDaSessao ?? []) {
    if (s.licitacao_item_id) empilhar(porId, s.licitacao_item_id, s);
    const n = numeroOuNulo(s.numero);
    if (n !== null) empilhar(porLoteNumero, chaveLoteNumero(s.lote, n), s);
  }

  return itens.map((bruto, indice) => {
    const item = bruto ?? {};
    // As duas grafias convivem: a coluna do banco e a do objeto da tela.
    const licitacaoItemId = textoOuNulo(item.licitacao_item_id ?? item.licitacaoItemId);
    const numero = numeroOuNulo(item.numero);
    const limite = numeroOuNulo(item.valorMinimo ?? item.valor_minimo);

    let daSessao: ItemDaSessao | null = null;
    if (licitacaoItemId) daSessao = unico(porId.get(licitacaoItemId));
    if (!daSessao && numero !== null) {
      // Lote + número só entre as linhas compatíveis: se os dois lados têm
      // identificador e eles divergem, são itens diferentes — mesmo com o
      // mesmo número.
      const candidatos = (porLoteNumero.get(chaveLoteNumero(item.lote, numero)) ?? []).filter(
        (s) => !licitacaoItemId || !s.licitacao_item_id || s.licitacao_item_id === licitacaoItemId,
      );
      daSessao = unico(candidatos);
    }

    return {
      // O índice entra só aqui, para dois itens repetidos não colidirem na
      // chave do React. Ele nunca participa do casamento acima.
      chave: `${licitacaoItemId ?? chaveLoteNumero(item.lote, numero ?? -1)}@${indice}`,
      numero,
      lote: textoOuNulo(item.lote),
      descricao: textoOuNulo(item.descricao) ?? '',
      // Piso 0 nunca foi decisão de ninguém (ver RoboLances.linhaParaLance):
      // lido como "sem limite", não como "pode descer até zero".
      limite: limite !== null && limite > 0 ? limite : null,
      licitacaoItemId,
      daSessao,
    };
  });
}

const ROTULO_DA_SITUACAO: Record<string, { rotulo: string; tom: TomSituacao }> = {
  aguardando: { rotulo: 'Aguardando', tom: 'neutro' },
  disputando: { rotulo: 'Em disputa', tom: 'ativo' },
  encerrado: { rotulo: 'Encerrado', tom: 'neutro' },
};

/** Situação do item na sala, em texto — a cor do selo só reforça. */
export function situacaoDoItem(linha: LinhaDoItem, temSessao: boolean): { rotulo: string; tom: TomSituacao } {
  if (!temSessao) return { rotulo: 'Robô não iniciado', tom: 'neutro' };
  const s = linha.daSessao;
  if (!s) return { rotulo: 'Não informado', tom: 'indisponivel' };
  // `sou_lider` nulo é "o portal não informou" — diferente de false.
  if (s.sou_lider === true) return { rotulo: 'Você lidera', tom: 'sucesso' };
  if (s.sou_lider === false) return { rotulo: 'Outro participante lidera', tom: 'atencao' };
  const bruto = (s.situacao ?? '').trim();
  const conhecido = ROTULO_DA_SITUACAO[bruto.toLowerCase()];
  if (conhecido) return conhecido;
  return bruto ? { rotulo: bruto, tom: 'neutro' } : { rotulo: 'Não informado', tom: 'indisponivel' };
}
