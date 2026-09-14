/**
 * O vocabulário da tela do CLIENTE do Robô de Lances.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE (14/09/2026) ───────────────────────────────
 *
 * Até esta data o cliente via, na própria tela do robô, endereço e versão do
 * agente, RAM, slots, teste do freio e o erro técnico cru do portal. Nada disso
 * é decisão dele. A tela do cliente passou a mostrar só o que é da empresa:
 * robô ligado ou desligado, se ele está disponível, o acesso aos portais e os
 * avisos escritos por gente da Praefectus. O diagnóstico técnico mudou-se para
 * o Admin Praefectus › Robô de Lances.
 *
 * Constantes e funções moram aqui, fora dos componentes, pela mesma razão de
 * `src/lib/robo/portais.ts`: exportar algo que não é componente de dentro de um
 * `.tsx` desliga a atualização instantânea da tela naquele arquivo.
 */
import { idDoPortal } from '@/lib/robo/portais';
import {
  SEVERIDADES,
  situacaoDoAviso,
  type AvisoDoPortal,
  type SeveridadeDoAviso,
} from '@/components/admin-robo/avisos';

/**
 * A tabela ainda não existe no banco?
 *
 * As migrations deste repo são coladas à mão no SQL Editor, então o front pode
 * chegar ao ar antes da `20260914000004`. Nesse intervalo, "tabela ausente" não
 * é falha a denunciar em vermelho: é o comportamento anterior valendo — robô
 * considerado ligado, nenhum aviso. Tratar isso como erro faria toda empresa ver
 * um alarme por uma atualização que é nossa, não dela.
 *
 * 42P01 é o código do Postgres; PGRST205 é o do PostgREST quando a tabela não
 * está no cache de schema. A mensagem cobre o caso em que o código não vem.
 */
export function tabelaAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code === '42P01' || erro.code === 'PGRST205') return true;
  return /does not exist|could not find the table|schema cache/i.test(erro.message ?? '');
}

/** Texto discreto que fica junto do botão enquanto a migration não foi aplicada. */
export const AVISO_MIGRACAO_PENDENTE = 'Liga/desliga disponível após atualização do banco';

/**
 * Data e hora no fuso de Brasília.
 *
 * O fuso vai explícito: quem acompanha pregão federal lê o horário de Brasília,
 * e o navegador de quem está em Manaus ou em viagem mostraria outro relógio —
 * justamente na linha que diz "verificado às…".
 */
export function horaDeBrasilia(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

/* ── Situação do robô (ação `situacao-do-robo`) ───────────────────────────── */

export interface SituacaoDoRobo {
  disponivel: boolean;
  /** Motivo em linguagem de negócio quando não está disponível. */
  motivo: string | null;
  ligado: boolean | null;
  portais_suportados: string[] | null;
  verificado_em: string | null;
}

/**
 * Lê a resposta da ação sem acreditar nela às cegas.
 *
 * Resposta sem `disponivel` booleano vira `null` — "não sei" —, nunca
 * "disponível". Enquanto a ação não estiver implantada, a função devolve 404 ou
 * um corpo de outra rota; tratar isso como "pronto" seria repetir o selo verde
 * falso que o checklist exibiu por meses.
 */
export function lerSituacao(data: unknown): SituacaoDoRobo | null {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || typeof d.disponivel !== 'boolean') return null;
  return {
    disponivel: d.disponivel,
    motivo: typeof d.motivo === 'string' && d.motivo.trim() ? d.motivo : null,
    ligado: typeof d.ligado === 'boolean' ? d.ligado : null,
    portais_suportados: Array.isArray(d.portais_suportados)
      ? (d.portais_suportados as unknown[]).map(String)
      : null,
    verificado_em: typeof d.verificado_em === 'string' ? d.verificado_em : null,
  };
}

/* ── Avisos por portal (`robo_avisos_portal`) ─────────────────────────────── */

// O tipo da linha e a regra de vigência são os do Admin (`admin-robo/avisos`),
// importados e não copiados: a tela de gestão diz "vigente" com
// `situacaoDoAviso`, e se esta tela usasse outra conta, um aviso poderia estar
// "vigente" lá e sumido aqui. Uma regra, dois leitores.
export type { AvisoDoPortal, SeveridadeDoAviso };

/**
 * Só os avisos vigentes AGORA.
 *
 * A RLS já filtra para o cliente — mas o administrador da plataforma lê todos,
 * inclusive os desligados, e a mesma tela não pode mostrar a ele como vigente
 * um aviso que já foi encerrado.
 */
export function avisosVigentes(linhas: unknown[], agora: Date = new Date()): AvisoDoPortal[] {
  return (linhas as Array<Record<string, unknown>>)
    .filter(Boolean)
    .map((l) => ({
      id: String(l.id),
      portal_id: l.portal_id ? String(l.portal_id) : null,
      severidade: ((SEVERIDADES as readonly string[]).includes(String(l.severidade))
        ? l.severidade
        : 'atencao') as SeveridadeDoAviso,
      titulo: String(l.titulo ?? ''),
      mensagem: String(l.mensagem ?? ''),
      ativo: l.ativo !== false,
      inicio_em: String(l.inicio_em ?? ''),
      fim_em: l.fim_em ? String(l.fim_em) : null,
    }))
    .filter((aviso) => situacaoDoAviso(aviso, agora) === 'vigente');
}

/**
 * Os avisos que dizem respeito a ESTA empresa.
 *
 * Aviso geral (sem portal) vale sempre. Aviso de um portal só aparece para quem
 * tem disputa nele: uma faixa amarela sobre o LicitaNet na tela de quem só
 * disputa no Compras.gov ensina a pessoa a ignorar faixas amarelas — e a
 * próxima, que é dela, passa despercebida.
 *
 * As disputas antigas gravaram o NOME do portal e as novas gravam o id; os dois
 * lados passam por `idDoPortal` para se encontrarem.
 */
export function avisosQueSeAplicam(
  avisos: AvisoDoPortal[],
  portaisDasDisputas: Array<string | null | undefined>,
): AvisoDoPortal[] {
  const ids = new Set(
    portaisDasDisputas.map((p) => idDoPortal(p) ?? (p ? p.trim() : '')).filter(Boolean),
  );
  return avisos.filter((a) => {
    if (!a.portal_id) return true;
    return ids.has(idDoPortal(a.portal_id) ?? a.portal_id);
  });
}

/* ── Resposta do freio (`kill-switch`) ────────────────────────────────────── */

/**
 * Quantas sessões o freio alcançou e quantas o agente confirmou.
 *
 * Mesma leitura do `KillSwitchButton`, com os dois contratos da função (o de
 * 14/09 e o anterior, para o caso de o servidor ainda não ter sido reimplantado).
 * Solicitada não é confirmada: `aguardando` maior que zero significa que o robô
 * PODE continuar no portal.
 */
export function lerResultadoDaParada(data: unknown): { alvo: number; confirmadas: number; aguardando: number } {
  const r = (data ?? {}) as {
    sessoes_alvo?: number;
    sessoes_confirmadas?: number;
    sessoes_encerradas?: number;
    agente_parou?: boolean;
  };
  const contratoAntigo = r.sessoes_alvo === undefined;
  const alvo = contratoAntigo ? r.sessoes_encerradas ?? 0 : r.sessoes_alvo ?? 0;
  const confirmadas = contratoAntigo ? (r.agente_parou ? alvo : 0) : r.sessoes_confirmadas ?? 0;
  return { alvo, confirmadas, aguardando: Math.max(alvo - confirmadas, 0) };
}
