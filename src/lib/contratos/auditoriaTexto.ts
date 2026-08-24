/**
 * O que a auditoria gravou, traduzido para gente.
 *
 * O diário guarda o que as rotinas escreveram — JSON de vinculação, motivo de
 * rejeição em JSON, número cru sem pontuação — e DUAS telas o exibem: o painel
 * de Auditoria e o diálogo de detalhes do evento. Cada uma tinha a própria
 * cópia (ou nenhuma) dos tradutores, e o mesmo evento saía legível numa tela e
 * cru na outra. Aqui é a única fonte; as telas só exibem.
 */

/** Rejeição da IA guarda em valor_novo um JSON com o motivo — texto para humano. */
export const motivoDaRejeicao = (v: string): string | null => {
  try {
    const o = JSON.parse(v);
    if (o && typeof o === 'object' && typeof o.motivo === 'string') {
      const recebido = o.valor_recebido;
      return recebido === null || recebido === undefined || recebido === ''
        ? o.motivo
        : `${o.motivo} (a IA leu: ${typeof recebido === 'string' ? recebido : JSON.stringify(recebido)})`;
    }
  } catch { /* não é JSON — segue como texto */ }
  return null;
};

/** O resumo da auto-vinculação, de JSON para frase. */
export const resumoDaVinculacao = (v: string): string | null => {
  try {
    const o = JSON.parse(v);
    if (!o || typeof o !== 'object' || !('total_itens' in o)) return null;
    const partes = [
      `${o.total_itens} item(ns) do contrato`,
      `${o.vinculados ?? 0} vinculado(s) à ata`,
    ];
    if ((o.sem_match ?? 0) > 0) partes.push(`${o.sem_match} sem par`);
    if ((o.quantidades_inferidas ?? 0) > 0) partes.push(`${o.quantidades_inferidas} quantidade(s) inferida(s) do valor global`);
    if (o.estrutura) partes.push(`estrutura: ${o.estrutura}`);
    return `Vinculação automática — ${partes.join(' · ')}`;
  } catch { return null; }
};

/**
 * Registros antigos foram gravados com número cru ("R$ 2123520", "25.00%") —
 * as migrations consertam os futuros, mas diário não se reescreve. Na
 * exibição, o que é reconhecível ganha a pontuação brasileira; o que já está
 * formatado passa intacto.
 */
export const abrasileirar = (t: string): string =>
  t
    .replace(/R\$\s?(\d{4,})(?![\d.,])/g, (_m, n: string) =>
      `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .replace(/(\d+)\.(\d{1,2})%/g, '$1,$2%');

/** A tradução completa de um valor do diário, na ordem certa dos tradutores. */
export function humanizarValorAuditoria(
  campo: string | null | undefined,
  valor: string | null | undefined,
  origem?: string | null,
): string {
  if (valor == null || valor === '') return '—';
  if (campo === 'auto_vinculacao_ata') return resumoDaVinculacao(valor) ?? valor;
  if (origem === 'ia_rejeicao') return motivoDaRejeicao(valor) ?? valor;
  return abrasileirar(valor);
}
