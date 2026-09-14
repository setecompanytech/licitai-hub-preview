/**
 * Alertas de vencimento por e-mail — os FATOS do disparo, fora da tela.
 *
 * Existe porque a tela anterior afirmava três coisas que o código não fazia, e
 * afirmação sobre comportamento de cron precisa ficar ao lado da fonte:
 *
 *  1. "Disparo diário (7h)". O cron é `'0 10 * * *'`
 *     (`supabase/migrations/20260910000001_alertas_vencimento_email.sql:88-104`),
 *     ou seja 10:00 **UTC**. Em Belém (UTC−3) dá 07:00 e a frase estava certa
 *     por acidente — o app é multiempresa, e um assinante em UTC−4 recebe às
 *     06:00. A âncora é UTC; a hora local é derivada, nunca escrita à mão.
 *
 *  2. "um e-mail X dias antes". A edge
 *     (`supabase/functions/alertas-documentos/index.ts:66`) dispara nos MARCOS
 *     `antecedencia, 15, 7, 3, 2, 1, 0` — e TODO DIA enquanto houver documento
 *     vencido. Quem esperava um aviso só recebia sete e achava que era defeito.
 *
 *  3. WhatsApp. A coluna `destinatarios.whatsapp` existe e NADA a lê; a função
 *     `whatsapp-envio` é literalmente simulada (`console.log("[SIMULADO]")`,
 *     grava `status:'simulado'`). Não há canal de WhatsApp para anunciar.
 */

/** Espelha o CHECK da coluna: `antecedencia_dias BETWEEN 5 AND 120`. */
export const ANTECEDENCIA_MINIMA = 5;
export const ANTECEDENCIA_MAXIMA = 120;
export const ANTECEDENCIA_PADRAO = 30;

/** A âncora do cron. Guardar o número evita a tela voltar a chutar hora local. */
export const HORA_UTC_DO_DISPARO = 10;

/** Os marcos fixos da edge, sem a antecedência configurável. */
export const MARCOS_FIXOS = [15, 7, 3, 2, 1, 0] as const;

/** O valor que vai ao banco: dentro da faixa do CHECK, sempre. */
export function antecedenciaValida(valor: string | number): number {
  const n = typeof valor === 'number' ? valor : parseInt(valor, 10);
  if (!Number.isFinite(n)) return ANTECEDENCIA_PADRAO;
  return Math.min(ANTECEDENCIA_MAXIMA, Math.max(ANTECEDENCIA_MINIMA, n));
}

/** 10:00 UTC traduzido para o fuso do navegador de quem está lendo. */
export function horarioLocalDoDisparo(agora = new Date()): { hora: string; fuso: string } {
  const alvo = new Date(
    Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate(),
      HORA_UTC_DO_DISPARO,
      0,
      0,
    ),
  );
  let fuso = '';
  try {
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // Ambiente sem Intl completo não pode derrubar a tela por causa do rótulo.
    fuso = '';
  }
  return {
    hora: alvo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    fuso,
  };
}

/** A régua de marcos por extenso, com a antecedência escolhida à frente. */
export function marcosPorExtenso(antecedencia: number): string {
  const todos = [antecedencia, ...MARCOS_FIXOS]
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => b - a);
  return todos.map((d) => (d === 0 ? 'no dia' : String(d))).join(', ');
}
