/**
 * Recortes de processos do painel — o vocabulário de agregação que o painel
 * usa HOJE, num lugar só.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE (e por que ele não é a autoridade)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `useAnalyticsData.ts` declarava estas três listas dentro de si:
 *
 *     STATUS_GANHO     = ['Vencida', 'vencida', 'Homologada']
 *     STATUS_PERDIDO   = ['Perdida', 'perdida']
 *     STATUS_ANDAMENTO = ['Monitorando', 'Analisando', 'Proposta Enviada',
 *                         'enviada', 'proposta', 'Em Disputa', 'Publicado']
 *
 * É a redeclaração que o princípio 1 do CLAUDE.md proíbe — a autoridade do
 * vocabulário é `./status.ts` (`normalizarStatus`, `STATUS_DECIDIDOS`).
 *
 * A correção óbvia seria trocar as listas por `normalizarStatus`. A auditoria
 * de 13/09/2026 mediu o efeito disso ANTES de mexer, e ele **não é neutro**:
 * unificar MUDA os números que a tela mostra hoje. Por isso as listas foram
 * MOVIDAS para cá (uma cópia só, auditável, usada tanto pela contagem quanto
 * pelo filtro da listagem) em vez de reescritas — trocar o critério é decisão
 * do dono do produto, não efeito colateral de uma reforma de layout.
 *
 * ── O que a auditoria encontrou ──────────────────────────────────────────
 *
 * Valores que o app de fato grava em `licitacoes.status`:
 *   · os oito canônicos de `STATUS_PROCESSO` — Kanban, PainelLicitacoes,
 *     `EditLicitacaoDialog` e `DesfechoDaDisputa` escrevem a partir dessa lista;
 *   · 'Monitorando', padrão de `useLicitacaoIntegration.iniciarProcesso`;
 *   · 'proposta' (minúsculo), de `useProcessoAtivo.criarProcessoManual`;
 *   · 'Vencida', de `CompromissosResumo`;
 *   · o legado que `normalizarStatus` documenta: 'Publicado', 'monitorando',
 *     'analisando', 'Homologado', 'Vencedor', 'Perdedor'.
 *   (O caminho do monitoramento NÃO injeta o status do PNCP: `EditalSeed` não
 *    tem o campo, então 'aberto'/'homologado' do edital não viram status do
 *    processo. Era o risco de falso-positivo mais grave e ele não existe.)
 *
 * Diferença medida entre estas listas e `normalizarStatus`:
 *
 *   GANHAS    subconta. 'Homologado', 'homologada', 'adjudicada', 'Vencedor',
 *             'ata_registro' e 'contrato assinado' são ganho para a autoridade
 *             e não entram na lista. Unificar só faz o número SUBIR.
 *   PERDIDAS  subconta, mas o acréscimo é discutível: `normalizarStatus`
 *             manda 'cancelado', 'revogado' e 'anulado' para Perdida — uma
 *             divergência que `status.ts` preserva de propósito e que a Onda 2
 *             move para o eixo `desfecho`. Unificar contaria encerramento
 *             neutro do órgão como derrota comercial.
 *   ANDAMENTO subcontava um caso GRAVE, JÁ CORRIGIDO: a lista tinha
 *   'Analisando' e não 'Em Análise'. O trecho abaixo descreve o defeito
 *   original — 'Analisando' é o
 *             RÓTULO de tela, não o valor gravado. O valor canônico é
 *             'Em Análise' — escrito pelo próprio seletor do Kanban e do
 *             painel — e ele não está na lista. Todo processo em análise é
 *             invisível para "Em andamento" hoje.
 *             Unificar também passaria a contar valor desconhecido como
 *             andamento (a autoridade joga o que não reconhece em
 *             'Monitorando'), e o processo ARQUIVADO com status 'Em Disputa'
 *             continuaria contando — `arquivado_em` não entra nesta conta.
 *
 * Some-se a isso que a tela `/historico-licitacoes` conta "Vencidas" por
 * `vencedor === true` e "Perdidas" por `resultado === 'Perdida'` (outras
 * colunas, outro resultado). São TRÊS definições de "ganhou" convivendo no
 * app. Escolher uma é decisão de produto com efeito nas metas do comercial.
 *
 * ⚠ NÃO use estes recortes em código novo. Para classificar um processo, a
 * autoridade é `normalizarStatus`/`faixaDe` de `./status.ts`. Isto aqui é
 * compatibilidade com o número que a tela já mostra, e deve morrer quando a
 * decisão for tomada.
 */

/** Grafias que o painel conta como ganho. Ver o aviso do topo. */
export const STATUS_GANHO = ['Vencida', 'vencida', 'Homologada'];

/** Grafias que o painel conta como perda. Ver o aviso do topo. */
export const STATUS_PERDIDO = ['Perdida', 'perdida'];

/**
 * Grafias que o painel conta como "em andamento". Ver o aviso do topo.
 *
 * `'Em Análise'` ENTROU em 13/09/2026, e não é ampliação de critério: é
 * correção de um nome errado. A lista trazia `'Analisando'`, que é o TÍTULO da
 * coluna no Kanban (`components/kanban/colunas.ts`), não o valor gravado —
 * `licitacoes.status` recebe `'Em Análise'`, o canônico de
 * `STATUS_PROCESSO`. Verificado por varredura: nenhum lugar do app grava
 * `'Analisando'`.
 *
 * Consequência do defeito, enquanto durou: **todo processo em análise ficou
 * fora do indicador**. A lista tinha um valor que nunca casava e faltava o que
 * casa, então o número só subia quando o processo saía da análise.
 *
 * `'Analisando'` fica, sem custo: é grafia que nunca aparece, e removê-la
 * exigiria provar que nenhuma linha antiga a carrega.
 */
export const STATUS_ANDAMENTO = [
  'Monitorando',
  'Em Análise',
  'Analisando',
  'Proposta Enviada',
  'enviada',
  'proposta',
  'Em Disputa',
  'Publicado',
];

export type RecorteId = 'todos' | 'andamento' | 'ganhas' | 'perdidas';

export interface RecorteDeProcessos {
  id: RecorteId;
  /** Como o indicador do painel chama este conjunto. */
  rotulo: string;
  /** O que a listagem anuncia quando o recorte está aplicado. */
  descricaoDoFiltro: string;
  /** O MESMO predicado que conta e que filtra — é o que impede os dois de divergirem. */
  aceita: (status: string | null | undefined) => boolean;
}

/**
 * Os quatro recortes. Contagem (cartão do resumo) e filtro (listagem de
 * processos) leem daqui, e é por isso que o número do cartão e a quantidade de
 * linhas da listagem batem: não são duas contas parecidas, é a mesma função.
 */
export const RECORTES: RecorteDeProcessos[] = [
  {
    id: 'todos',
    rotulo: 'Processos da empresa',
    descricaoDoFiltro: 'Todos os processos da empresa',
    aceita: () => true,
  },
  {
    id: 'andamento',
    rotulo: 'Em andamento',
    descricaoDoFiltro: 'Processos em andamento',
    aceita: (s) => STATUS_ANDAMENTO.includes(s ?? ''),
  },
  {
    id: 'ganhas',
    rotulo: 'Ganhas',
    descricaoDoFiltro: 'Processos ganhos',
    aceita: (s) => STATUS_GANHO.includes(s ?? ''),
  },
  {
    id: 'perdidas',
    rotulo: 'Perdidas',
    descricaoDoFiltro: 'Processos perdidos',
    aceita: (s) => STATUS_PERDIDO.includes(s ?? ''),
  },
];

/** O recorte pedido na URL, ou `null` quando o parâmetro não é um recorte conhecido. */
export function recorteDaUrl(valor: string | null | undefined): RecorteDeProcessos | null {
  if (!valor) return null;
  return RECORTES.find((r) => r.id === valor) ?? null;
}

/** Nome do parâmetro de URL que carrega o recorte até a listagem. */
export const PARAM_RECORTE = 'recorte';

/** Âncora da listagem de processos no painel — o destino do indicador clicável. */
export const ANCORA_LISTAGEM = 'processos-da-empresa';

/**
 * O endereço da listagem já filtrada.
 *
 * Mora aqui, e não na tela, porque quem MONTA o link (o indicador) e quem o
 * LÊ (a listagem) precisam concordar sobre o nome do parâmetro e sobre a
 * âncora. Escrever "?recorte=ganhas#processos-da-empresa" à mão nos dois lados
 * é exatamente como um deles muda sozinho.
 */
export function destinoDoRecorte(recorte: RecorteId): string {
  return `/dashboard?${PARAM_RECORTE}=${recorte}#${ANCORA_LISTAGEM}`;
}
