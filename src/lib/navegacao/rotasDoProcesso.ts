/**
 * Quais telas dependem do processo ativo — e, por isso, carregam `?lid=` na URL.
 *
 * O `lid` estava em toda parte: aparecia no Financeiro, na Equipe, nas
 * Configurações, telas que não sabem o que fazer com ele. Além de deixar todo
 * endereço com 36 caracteres de identificador no meio, foi o que quebrou o
 * Voltar — o sistema reescreve a URL depois que a tela carrega, e cada
 * navegação virava dois passos.
 *
 * Agora o parâmetro aparece onde significa algo: nas telas que de fato leem o
 * processo ativo (`useProcessoAtivo`). Nas demais ele é removido da URL, sem
 * perder o vínculo — o processo continua guardado em memória local e volta a
 * aparecer assim que a pessoa entra numa tela que o usa.
 *
 * Manter esta lista junto das rotas é proposital: quando uma tela nova passar a
 * usar o processo, é aqui que ela entra, num lugar só.
 */

const PREFIXOS = [
  '/processo/',
  '/precificacao',
  '/proposta-tecnica',
  '/documentos',
  '/apoio-juridico',
  '/robo-lances',
  '/aurelia',
  '/assistente',
  '/comprasgov-envio',
];

export function usaProcessoAtivo(pathname: string): boolean {
  return PREFIXOS.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/')));
}
