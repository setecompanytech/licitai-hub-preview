/**
 * A chamada para a tela remota do robô — o toast grande, embaixo, que leva a
 * Configurações do Robô de Lances › Sessões e tela remota (17/09/2026, pedido
 * do Ian).
 *
 * O que ele pediu, e o que a regra daqui cumpre:
 * - "quando o botão pra rodar for clicado não pode demorar pra aparecer,
 *   independentemente se vai ter que passar pelo recaptcha ou não" → a página
 *   da disputa chama no clique de "Entrar agora", antes de o robô responder;
 * - "também não é pra esse toast ficar muito tempo no ar, ele tem que sumir
 *   após o robô parar" → some quando a sessão acaba, depois de
 *   `SEGUNDOS_DA_CHAMADA` na tela, ou no botão de fechar;
 * - o pedido de captcha e o "assistir ao vivo" que chegam depois viram a mesma
 *   chamada, de novo.
 *
 * SÓ PARA A EQUIPE PRAEFECTUS. A tela remota é compartilhada entre todas as
 * empresas e nunca é mostrada a cliente: o componente não desenha nada para
 * quem não é admin da plataforma, e os avisos que viram chamada só chegam a
 * esses admins.
 *
 * Uma chamada por vez, guardada fora do React: a página que chama e o layout
 * que desenha não se conhecem.
 */
import { useSyncExternalStore } from 'react';

/** Onde a tela remota abre direto: aba de sessões do admin, já pedindo a tela. */
export const LINK_DA_TELA_REMOTA = '/admin/robo-lances?aba=sessoes&tela=abrir';

/** Tempo na tela, sem contar o mouse em cima e a aba escondida. */
export const SEGUNDOS_DA_CHAMADA = 45;

/** Aviso mais velho que isto, ao abrir o sistema, não vira chamada: o captcha já expirou. */
export const MINUTOS_DA_CHAMADA_NA_ABERTURA = 15;

export type MotivoDaChamada = 'entrando' | 'captcha' | 'ao-vivo';

export interface ChamadaDaTelaRemota {
  id: string;
  motivo: MotivoDaChamada;
  titulo: string;
  mensagem: string;
  /** A disputa, para a chamada sumir quando a sessão dela acabar. Nula quando o aviso não diz. */
  disputaId: string | null;
  /** Só sessões criadas a partir daqui contam (ISO): sessão antiga encerrada não fecha a chamada nova. */
  sessaoDesde: string | null;
}

let atual: ChamadaDaTelaRemota | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function chamarTelaRemota(c: Omit<ChamadaDaTelaRemota, 'id'> & { id?: string }): string {
  const id = c.id ?? `chamada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  atual = { ...c, id };
  avisar();
  return id;
}

/** Fecha a chamada; com `id`, só se ainda for aquela (outra pode ter chegado). */
export function fecharChamadaDaTelaRemota(id?: string): void {
  if (!atual || (id && atual.id !== id)) return;
  atual = null;
  avisar();
}

/** A chamada de agora, fora do React (testes e quem só precisa ler). */
export function chamadaAtual(): ChamadaDaTelaRemota | null {
  return atual;
}

export function useChamadaDaTelaRemota(): ChamadaDaTelaRemota | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
    () => null,
  );
}

/** A chamada do clique em "Entrar agora". */
export function chamadaDaEntrada(e: { disputaId: string; edital: string | null | undefined; portal: string | null | undefined; agora: Date }): Omit<ChamadaDaTelaRemota, 'id'> {
  const edital = String(e.edital || '').trim() || 'disputa sem número';
  const portal = String(e.portal || '').trim();
  return {
    motivo: 'entrando',
    titulo: `Robô entrando — ${edital}`,
    mensagem: `O robô está entrando${portal ? ` no ${portal}` : ''}. Acompanhe pela tela remota: se o gov.br pedir o captcha, é lá que se clica.`,
    disputaId: e.disputaId,
    // Folga para relógio: a sessão nasce no servidor segundos depois do clique.
    sessaoDesde: new Date(e.agora.getTime() - 5_000).toISOString(),
  };
}

/** Aviso do robô que é chamada para a tela remota: o que leva ao admin do robô. */
export function ehChamadaDaTelaRemota(aviso: { link?: string | null } | null | undefined): boolean {
  return String(aviso?.link || '').startsWith('/admin/robo-lances');
}

/**
 * A mensagem do aviso, sem o endereço da tela remota (o botão leva até ela) e
 * sem as frases que o botão e a legenda já dizem.
 */
export function mensagemSemEndereco(mensagem: string | null | undefined): string {
  return String(mensagem || '')
    .replace(/\s*Tela remota:\s*\S+/gi, '')
    .replace(/\s*Abra a tela remota na área admin do Robô de Lances\.?/gi, '')
    .replace(/\s*Aviso só da equipe Praefectus:[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O aviso do robô como chamada: "robô entrando" (o servidor avisa quem opera
 * no envio da sessão, 19/09/2026), pedido de captcha ou "assistir ao vivo".
 */
export function chamadaDoAviso(aviso: { id: string; titulo: string | null; mensagem: string | null; created_at: string }): Omit<ChamadaDaTelaRemota, 'id'> & { id: string } {
  const titulo = String(aviso.titulo || 'Tela remota do robô').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return {
    id: `aviso-${aviso.id}`,
    motivo: /ao vivo/i.test(titulo) ? 'ao-vivo' : /entrando/i.test(titulo) ? 'entrando' : 'captcha',
    titulo,
    mensagem: mensagemSemEndereco(aviso.mensagem),
    disputaId: null,
    sessaoDesde: null,
  };
}

/** A sessão parou? Encerrada, com erro, ou com a parada confirmada. */
export function sessaoParou(s: { status?: string | null; parada_confirmada_em?: string | null } | null | undefined): boolean {
  if (!s) return false;
  return s.status === 'encerrado' || s.status === 'erro' || !!s.parada_confirmada_em;
}
