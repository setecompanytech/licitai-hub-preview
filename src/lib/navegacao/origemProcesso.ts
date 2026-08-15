/**
 * Origem do trabalho no processo — para onde o "voltar" da pasta deve levar.
 *
 * O botão ← do prontuário usava `navigate(-1)` (histórico do navegador). Como
 * cada "Voltar ao prontuário" dos módulos empilha uma entrada, o histórico
 * virava um pêndulo: quem abriu a pasta pela Gestão de Licitações, foi ao
 * Apoio Jurídico e voltou, ao clicar em ← caía de novo no Apoio Jurídico —
 * "voltas em círculos".
 *
 * Aqui guardamos a última rota FORA do ecossistema do processo (prontuário e
 * os módulos que trabalham dentro dele). É essa a origem: a tela de onde a
 * pasta foi aberta, estável enquanto o usuário circula pelas etapas.
 */

const PADRAO = '/kanban'; // Gestão de Licitações — a casa dos processos
const STORAGE_KEY = 'praefectus.origem-processo';

/** Rotas que fazem parte do trabalho DENTRO do processo — nunca são origem. */
const DO_PROCESSO = /^\/(processo\/|apoio-juridico|precificacao|proposta-tecnica|documentos)/;

let emMemoria: string | null = null;

export function registrarRota(rota: string): void {
  if (!rota || DO_PROCESSO.test(rota)) return;
  emMemoria = rota;
  try { sessionStorage.setItem(STORAGE_KEY, rota); } catch { /* modo privado */ }
}

export function origemDoProcesso(): string {
  if (emMemoria) return emMemoria;
  try { return sessionStorage.getItem(STORAGE_KEY) || PADRAO; } catch { return PADRAO; }
}
