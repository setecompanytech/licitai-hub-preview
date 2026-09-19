/**
 * O que a situação do espelho PNCP pede ao processo.
 *
 * `pncp_editais_cache.situacao` em produção (medido em 19/09) traz quatro
 * valores: "Divulgada no PNCP" (o normal) e três que o órgão publica quando a
 * compra sai do ar — "Revogada", "Anulada", "Suspensa". Não existe
 * "Homologada" nem "Encerrada" no espelho: o PNCP não publica o desfecho da
 * disputa nesse campo, só o ato do órgão sobre a compra.
 *
 * Por isso o espelho NÃO decide o desfecho do processo. Revogada e anulada
 * pedem que a pessoa registre o desfecho (o vocabulário do Kanban põe esses
 * casos em "Perdida", com a ressalva escrita em `status.ts`); suspensa pede
 * conferência — a compra pode voltar. A agenda mostra isso como pendência do
 * processo, no lugar das datas: o prazo de uma compra revogada não é atraso
 * nem andamento.
 */
export interface PendenciaDoEspelho {
  /** Selo da linha: "Revogada no PNCP". */
  selo: string;
  /** O que a pessoa precisa fazer: "Desfecho a registrar". */
  natureza: string;
}

/** Prefixos, para aceitar também o particípio masculino que o PNCP às vezes usa. */
const POR_PREFIXO: Array<[prefixo: string, pendencia: PendenciaDoEspelho]> = [
  ['revogad', { selo: 'Revogada no PNCP', natureza: 'Desfecho a registrar' }],
  ['anulad', { selo: 'Anulada no PNCP', natureza: 'Desfecho a registrar' }],
  ['suspens', { selo: 'Suspensa no PNCP', natureza: 'Suspensão a conferir' }],
];

/** A situação do espelho pede alguma ação da pessoa? `null` para o normal e para o desconhecido. */
export function pendenciaDoEspelho(situacao?: string | null): PendenciaDoEspelho | null {
  const s = (situacao || '').trim().toLowerCase();
  if (!s) return null;
  const achada = POR_PREFIXO.find(([prefixo]) => s.startsWith(prefixo));
  return achada ? achada[1] : null;
}
