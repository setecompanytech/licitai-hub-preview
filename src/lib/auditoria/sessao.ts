/**
 * Identificador da sessão de trabalho, para amarrar a cadeia
 * login → ações → logout na trilha de auditoria.
 *
 * Vive em `sessionStorage`: nasce a cada aba/janela e morre quando ela fecha,
 * que é exatamente a granularidade que a pergunta "o que essa pessoa fez desde
 * que entrou?" precisa. Não usa o id do token do Supabase de propósito — o
 * token é renovado sozinho (`TOKEN_REFRESHED`) e trocaria de valor no meio da
 * sessão, quebrando a cadeia justamente nas sessões longas.
 */

const CHAVE = 'praefectus:sessao_id';

export function getSessaoId(): string {
  if (typeof window === 'undefined') return 'sem-janela';
  try {
    const existente = window.sessionStorage.getItem(CHAVE);
    if (existente) return existente;
    const novo =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    // Navegação anônima com storage bloqueado: a trilha continua sendo gravada,
    // só perde o agrupamento por sessão. Melhor do que não registrar a ação.
    return 'sem-storage';
  }
}

/** Encerra a sessão lógica — chamado no logout para o próximo login abrir outra. */
export function limparSessaoId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    /* storage bloqueado — nada a limpar */
  }
}
