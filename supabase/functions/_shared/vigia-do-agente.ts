/**
 * O AGENTE CAIU E NINGUÉM SOUBE (02/10/2026).
 *
 * O `ultimo_heartbeat` era gravado e mostrado numa tela que só a conta de
 * engenharia abre. Se o agente caísse às 8h50 de um dia de pregão, só se
 * descobria olhando — e quem avisaria é justamente ele.
 *
 * A regra fica aqui, fora da edge function, por um motivo prático: a vigia roda
 * por cron, dentro de um `try/catch` que não pode derrubar o disparo das
 * disputas. Um defeito ali falharia **em silêncio**, que é a pior forma de
 * falhar num vigia. Aqui ela é função pura, e testada.
 *
 * Sem `Deno.*` de propósito — o vitest roda este arquivo.
 */

export interface AgenteParaVigiar {
  id: string;
  user_id: string;
  nome: string | null;
  status: string | null;
  ultimo_heartbeat: string | null;
}

export interface AvisoDeAgenteMudo {
  agenteId: string;
  userId: string;
  /** Identifica ESTE silêncio: enquanto for o mesmo, não se avisa de novo. */
  chave: string;
  minutos: number;
  titulo: string;
  mensagem: string;
}

/** O agente manda heartbeat a cada 30 s; 12 minutos é silêncio, não rede ruim. */
export const MINUTOS_SEM_HEARTBEAT_PADRAO = 12;

/**
 * Quais agentes estão mudos agora — e o texto do aviso de cada um.
 *
 * Decisões embutidas, e por que:
 *
 * - **só agente ativo.** Agente desligado de propósito não é notícia;
 * - **sem heartbeat NENHUM não conta.** É agente recém-cadastrado que nunca
 *   subiu: avisar "parou de responder" sobre quem nunca respondeu confundiria
 *   quem está instalando;
 * - **a chave carrega o último heartbeat.** Enquanto for o mesmo silêncio, o
 *   aviso não se repete; o agente volta, o heartbeat muda, e o próximo silêncio
 *   é outro aviso. Alerta que se repete a cada passada do cron treina a pessoa
 *   a ignorá-lo — e um alerta ignorado é pior que nenhum, porque dá a impressão
 *   de que alguém está vigiando.
 */
export function agentesMudos(
  agentes: AgenteParaVigiar[],
  agora: Date = new Date(),
  minutosDeSilencio: number = MINUTOS_SEM_HEARTBEAT_PADRAO,
): AvisoDeAgenteMudo[] {
  const lista = Array.isArray(agentes) ? agentes : [];
  const avisos: AvisoDeAgenteMudo[] = [];

  for (const a of lista) {
    if (!a || a.status !== "ativo") continue;
    if (!a.ultimo_heartbeat) continue;

    const em = new Date(a.ultimo_heartbeat).getTime();
    if (!Number.isFinite(em)) continue;

    const minutos = Math.floor((agora.getTime() - em) / 60_000);
    if (minutos < minutosDeSilencio) continue;

    const nome = a.nome || "sem nome";
    avisos.push({
      agenteId: a.id,
      userId: a.user_id,
      chave: `agente-mudo:${a.id}:${a.ultimo_heartbeat}`,
      minutos,
      titulo: `🔌 Robô sem sinal — ${nome}`,
      // O texto diz a CONSEQUÊNCIA, não o sintoma: quem lê precisa saber o que
      // está deixando de acontecer, não que um heartbeat atrasou.
      mensagem:
        `O robô "${nome}" não dá sinal há ${minutos} minutos. ` +
        `Enquanto ele estiver fora, nenhuma disputa entra e nenhum lance é dado.`,
    });
  }

  return avisos;
}
