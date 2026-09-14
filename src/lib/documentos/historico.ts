import type { TomSituacao } from '@/components/gestao/SeloSituacao';

/**
 * Histórico de alterações de documentos — o vocabulário e as leituras da
 * trilha, fora da tela.
 *
 * O registro NASCE NO BANCO, em gatilho (`registrar_alteracao_documento`,
 * migration `20260903000006`): envio, compartilhamento, substituição, mudança
 * de validade, edição e remoção deixam rastro por QUALQUER caminho, não só
 * pela tela. Nada aqui escreve; a trilha é imutável e só se lê.
 */

/** As ações que o gatilho sabe gravar — a lista não é livre. */
export const ACOES_DO_HISTORICO = [
  'enviado',
  'compartilhado',
  'substituído',
  'validade alterada',
  'editado',
  'removido',
] as const;

export type AcaoDoHistorico = (typeof ACOES_DO_HISTORICO)[number];

/**
 * Cor por ação. `removido` é o único destrutivo; `substituído` e
 * `validade alterada` pedem atenção porque mudam o que vale hoje. Ação
 * desconhecida cai em `neutro` — inventar um tom para o que não se conhece
 * seria afirmar gravidade sem base.
 */
export const TOM_DA_ACAO: Record<string, TomSituacao> = {
  enviado: 'sucesso',
  compartilhado: 'ativo',
  'substituído': 'atencao',
  'validade alterada': 'atencao',
  editado: 'neutro',
  removido: 'critico',
};

export type LinhaDoHistorico = {
  id: string;
  documento_nome: string;
  acao: string;
  autor: string | null;
  validade_anterior: string | null;
  validade_nova: string | null;
  arquivo_anterior: string | null;
  arquivo_novo: string | null;
  criado_em: string;
};

/** Quantas linhas por carga. 25 cabe numa tela sem paginar o dia inteiro. */
export const TAMANHO_DA_PAGINA = 25;

/**
 * `date` do Postgres como dia local. `new Date('2026-09-13')` é meia-noite UTC
 * e, em Belém (UTC−3), imprime 12/09 — o dia anterior ao gravado. Mesmo
 * cuidado de `situacao.ts`.
 */
export function dataBr(valor: string | null): string {
  if (!valor) return '—';
  const m = String(valor).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor);
}

/** Só o nome do arquivo: o caminho do storage é ruído numa linha de tabela. */
export function nomeDoArquivo(caminho: string | null): string | null {
  if (!caminho) return null;
  const partes = String(caminho).split('/');
  return partes[partes.length - 1] || String(caminho);
}

/**
 * O que a linha tem de concreto além do rótulo da ação — SÓ o que as colunas
 * do gatilho realmente trazem. Sem nada para mostrar devolve lista vazia, e a
 * célula exibe "—": versão, responsável ou registro retroativo inventado seria
 * pior do que a ausência, porque a trilha é o que se lê quando há dúvida.
 */
export function detalhesDaLinha(linha: LinhaDoHistorico): string[] {
  const partes: string[] = [];

  const validadeMudou = (linha.validade_anterior ?? null) !== (linha.validade_nova ?? null);
  if (validadeMudou && (linha.validade_anterior || linha.validade_nova)) {
    partes.push(`validade ${dataBr(linha.validade_anterior)} → ${dataBr(linha.validade_nova)}`);
  }

  const antes = nomeDoArquivo(linha.arquivo_anterior);
  const depois = nomeDoArquivo(linha.arquivo_novo);
  if (antes && depois && antes !== depois) partes.push(`arquivo ${antes} → ${depois}`);
  else if (!antes && depois) partes.push(`arquivo ${depois}`);
  else if (antes && !depois) partes.push(`arquivo removido: ${antes}`);

  return partes;
}

/** O intervalo de um dia LOCAL como instantes, para filtrar `timestamptz`. */
export function limitesDoDia(iso: string, fim = false): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Componentes LOCAIS: converter direto para UTC perderia (ou ganharia) o dia
  // da borda para quem não está em UTC — e o filtro é do dia de quem lê.
  return fim
    ? new Date(a, mes - 1, d, 23, 59, 59, 999).toISOString()
    : new Date(a, mes - 1, d, 0, 0, 0, 0).toISOString();
}
