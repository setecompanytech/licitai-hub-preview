/**
 * A disputa do robô como as telas a leem e a gravam — num lugar só.
 *
 * ── Por que este arquivo existe (14/09/2026) ────────────────────────────────
 *
 * Conversão da linha, gravação, fase manual, remoção e o texto do resultado no
 * mural moravam dentro de `pages/RoboLances.tsx`, junto com a lista, a disputa
 * selecionada e a coluna de controle. Quando cada disputa ganhou página própria
 * (`/robo-lances/disputa/:id`), a lista e a página passaram a precisar das
 * mesmas regras. Copiá-las seria o caminho para as duas gravarem a mesma
 * disputa de jeitos diferentes — o defeito que já fez painel e pasta do
 * processo discordarem sobre o que está "em disputa".
 *
 * Nada aqui mostra aviso: cada gravação devolve `{ ok, motivo }` e quem chama
 * decide o que dizer. Nada aqui inicia nem para o robô.
 */
import { supabase } from '@/integrations/supabase/client';
import type { DisputeItem, LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';

/** Resultado de uma gravação. Interface simples: o tsconfig não estreita uniões. */
export interface ResultadoDaGravacao {
  ok: boolean;
  motivo?: string;
}

// `types.ts` está congelado em 16/08 e não conhece `robo_lances_disputas`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const disputas = (): any => (supabase as any).from('robo_lances_disputas');

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Converte a linha do banco para a configuração usada nas telas e no diálogo. */
export function linhaParaLance(r: Record<string, unknown>): LanceConfig {
  return {
    id: String(r.id),
    edital: String(r.edital || ''),
    portal: String(r.portal || ''),
    valorReferencia: Number(r.valor_referencia) || 0,
    valorInicial: Number(r.valor_inicial) || 0,
    valorMinimo: Number(r.valor_minimo) || 0,
    decrementoMin: Number(r.decremento_min) || 0,
    decrementoPercentual: Number(r.decremento_percentual) || 0,
    intervaloSegundos: Number(r.intervalo_segundos) || 30,
    // Nulo é "sem limite" (migration 20260916000003), e não 20: o `|| 20` de
    // antes transformava a escolha de disputar até o piso num teto de 20.
    maxLances: Number(r.max_lances) > 0 ? Number(r.max_lances) : null,
    modoAutomatico: !!r.modo_automatico,
    status: (r.status as LanceConfig['status']) || 'aguardando',
    horario: String(r.horario || ''),
    dataSessao: dataLocalDoTimestamp(r.inicio_sessao),
    meuLance: Number(r.meu_lance) || 0,
    valorAtual: Number(r.valor_atual) || 0,
    // Piso `0` gravado ANTES de 13/09 nunca foi decisão de ninguém: era o valor
    // fixo que todo item importado recebia, e não havia campo na tela para
    // alterá-lo. Lido de volta como zero, ele autorizaria o robô a descer até
    // zero num item que ninguém avaliou. Vira `null` — "ninguém decidiu".
    itens: (Array.isArray(r.itens) ? (r.itens as DisputeItem[]) : []).map((i) => ({
      ...i,
      valorMinimo: i.valorMinimo === 0 ? null : i.valorMinimo ?? null,
    })) as DisputeItem[],
    tipoDisputa: (r.tipo_disputa as 'item' | 'lote') || 'item',
    licitacaoId: (r.licitacao_id as string) || undefined,
    uasg: (r.uasg as string) || undefined,
  };
}

/**
 * O caminho de volta para a lista, na mesma aba e com a mesma busca.
 *
 * A lista guarda aba (`?painel=`) e busca (`?q=`) na URL e entrega essa busca
 * no estado da navegação ao abrir uma disputa. Sem estado (link colado, F5 na
 * página da disputa), a volta é a lista limpa — nunca um endereço inventado.
 */
export function enderecoDaLista(estadoDaNavegacao: unknown): string {
  const daLista = (estadoDaNavegacao as { daLista?: unknown } | null)?.daLista;
  return typeof daLista === 'string' && daLista.startsWith('?') ? `/robo-lances${daLista}` : '/robo-lances';
}

/**
 * A fase que "Marcar como … (manual)" grava. Encerrada não tem próxima: ali o
 * clique não faria nada, e o item de menu some.
 */
export function proximoStatus(atual: LanceConfig['status']): LanceConfig['status'] | null {
  if (atual === 'aguardando') return 'ativo';
  if (atual === 'ativo' || atual === 'vencendo' || atual === 'perdendo') return 'aguardando';
  return null;
}

export interface ContextoDaGravacao {
  empresaId: string;
  userId: string;
  /** Processo aberto no prontuário — a disputa sem vínculo nasce dele. */
  processoId: string | null;
}

/**
 * Grava a disputa (cria ou atualiza). Salvar grava a configuração e mais nada:
 * nenhuma sessão é aberta e o robô não começa.
 */
export async function gravarDisputa(lance: LanceConfig, ctx: ContextoDaGravacao): Promise<ResultadoDaGravacao> {
  const linha = {
    id: lance.id,
    empresa_id: ctx.empresaId,
    user_id: ctx.userId,
    licitacao_id: lance.licitacaoId ?? ctx.processoId ?? null,
    edital: lance.edital,
    portal: lance.portal || null,
    uasg: lance.uasg || null,
    tipo_disputa: lance.tipoDisputa,
    valor_referencia: lance.valorReferencia,
    valor_inicial: lance.valorInicial,
    valor_minimo: lance.valorMinimo,
    decremento_min: lance.decrementoMin,
    decremento_percentual: lance.decrementoPercentual,
    intervalo_segundos: lance.intervaloSegundos,
    max_lances: lance.maxLances,
    modo_automatico: lance.modoAutomatico,
    horario: lance.horario || null,
    inicio_sessao: inicioDaSessao(lance.dataSessao, lance.horario),
    status: lance.status,
    meu_lance: lance.meuLance,
    valor_atual: lance.valorAtual,
    itens: lance.itens,
  };
  const { error } = await disputas().upsert(linha, { onConflict: 'id' });
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

/**
 * Grava a fase na própria disputa. É SÓ a coluna `status`: o robô não é
 * iniciado nem parado por aqui (isso é "Enviar ao robô" e a parada).
 */
export async function gravarFase(id: string, status: LanceConfig['status']): Promise<ResultadoDaGravacao> {
  const { error } = await disputas().update({ status }).eq('id', id);
  return error ? { ok: false, motivo: error.message } : { ok: true };
}

/**
 * Apaga a disputa no banco. O `select()` existe porque a policy de DELETE é de
 * administrador da empresa — sem ele, um não-admin veria "removida" e nada
 * teria acontecido.
 */
export async function removerDisputa(id: string): Promise<ResultadoDaGravacao> {
  const { data, error } = await disputas().delete().eq('id', id).select('id');
  if (error) return { ok: false, motivo: `Disputa não foi removida: ${error.message}` };
  if (!(data as unknown[] | null)?.length) {
    return { ok: false, motivo: 'Disputa não removida: só um administrador da empresa pode apagar.' };
  }
  return { ok: true };
}

/** O texto que o encerramento publica no mural do processo vinculado. */
export function textoDoResultadoNoMural(
  lance: LanceConfig,
  resultado: 'venceu' | 'perdeu',
  valorFinal?: number,
  agora: Date = new Date(),
): string {
  const itensResumo = lance.itens
    .slice(0, 5)
    .map(
      (i) =>
        `  • Item ${i.numero}: ${i.descricao.slice(0, 50)}${i.descricao.length > 50 ? '...' : ''} — ${moeda(i.valorReferencia)} × ${i.quantidade}`,
    )
    .join('\n');
  const maisItens = lance.itens.length > 5 ? `\n  ...e mais ${lance.itens.length - 5} itens` : '';
  const quando = agora.toLocaleString('pt-BR');

  if (resultado === 'venceu') {
    return (
      `🏆 **DISPUTA VENCIDA — ${lance.edital}**\n\n` +
      `📋 Portal: ${lance.portal}\n` +
      `💰 Valor de Referência: ${moeda(lance.valorReferencia)}\n` +
      `✅ Valor Final Adjudicado: ${valorFinal ? moeda(valorFinal) : 'N/I'}\n` +
      `📊 Desconto: ${lance.valorReferencia > 0 && valorFinal ? ((1 - valorFinal / lance.valorReferencia) * 100).toFixed(2) + '%' : 'N/I'}\n\n` +
      `**Itens da disputa (${lance.itens.length}):**\n${itensResumo}${maisItens}\n\n` +
      `⏱️ Encerrado em ${quando}`
    );
  }
  return (
    `❌ **DISPUTA PERDIDA — ${lance.edital}**\n\n` +
    `📋 Portal: ${lance.portal}\n` +
    `💰 Valor de Referência: ${moeda(lance.valorReferencia)}\n` +
    `📊 ${lance.itens.length} itens disputados\n\n` +
    `**Itens:**\n${itensResumo}${maisItens}\n\n` +
    `⏱️ Encerrado em ${quando}`
  );
}

/** Publica o resultado no mural do processo vinculado. Sem processo, não há mural. */
export async function postarResultadoNoMural(
  lance: LanceConfig,
  resultado: 'venceu' | 'perdeu',
  userId: string,
  valorFinal?: number,
): Promise<void> {
  if (!lance.licitacaoId) return;
  try {
    await supabase.from('licitacao_mensagens').insert({
      licitacao_id: lance.licitacaoId,
      user_id: userId,
      conteudo: textoDoResultadoNoMural(lance, resultado, valorFinal),
      tipo: resultado === 'venceu' ? 'sucesso' : 'alerta',
    });
  } catch (err) {
    console.error('Erro ao postar no mural:', err);
  }
}

/**
 * Data e hora da sessão viram UM instante, que é o que o agendador lê.
 *
 * Declarações de função sobem no módulo, então estas duas podem ser usadas
 * acima. A conversão é pelo relógio de quem cadastra: o operador digita
 * "09:00" pensando no horário de Brasília, e é assim que o navegador monta a
 * data — gravar o texto cru deixaria "09:00" sem dia, que é o problema que
 * esta coluna existe para resolver.
 */
function inicioDaSessao(data?: string, hora?: string): string | null {
  // Sem horário, não há instante: gravar a data sozinha virava MEIA-NOITE, e o
  // agendador despacharia o robô às 23:45 da véspera (visto em 16/09/2026).
  if (!data || !hora || hora.length < 4) return null;
  const instante = new Date(`${data}T${hora.slice(0, 5)}:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/**
 * O caminho de volta: instante gravado → "AAAA-MM-DD" no fuso de quem lê.
 *
 * Fatiar o ISO (que é UTC) mostraria o dia seguinte numa sessão da noite.
 */
function dataLocalDoTimestamp(valor: unknown): string {
  if (!valor) return '';
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return '';
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
