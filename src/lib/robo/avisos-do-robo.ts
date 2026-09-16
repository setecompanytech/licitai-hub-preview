/**
 * Os avisos do robô como caixinha no canto da tela (Fase 8, 16/09/2026).
 *
 * O robô já avisava pelo sininho (`notificacoes`), e a notificação que chega
 * com a tela aberta vira um toast simples que some em segundos. Pedido do Ian:
 * além do sininho — sem substituí-lo —, o aviso do robô fica no canto, no mesmo
 * desenho dos lembretes de certidão e de convocação, até a pessoa dispensar.
 * Também aparece para quem abre o sistema depois: o lembrete de "pregão em 1
 * hora" não pode depender de a pessoa estar olhando no minuto em que saiu.
 *
 * Dispensar a caixinha NÃO marca a notificação como lida: o sininho continua
 * sendo o registro.
 */

export type NotificacaoDoRobo = {
  id: string;
  titulo: string | null;
  mensagem: string | null;
  tipo: string | null;
  link: string | null;
  lida: boolean | null;
  created_at: string;
};

export type GravidadeDoAviso = 'urgente' | 'atencao' | 'informativo';

/** Só o recente vira caixinha; o histórico mora no sininho. */
export const JANELA_DOS_AVISOS_HORAS = 24;

/** Aviso do robô = notificação que leva para uma tela do robô. */
export function ehAvisoDoRobo(n: { link?: string | null } | null | undefined): boolean {
  const link = String(n?.link || '');
  return link.startsWith('/robo-lances') || link.startsWith('/admin/robo-lances');
}

export function gravidadeDoAviso(tipo: string | null | undefined): GravidadeDoAviso {
  if (tipo === 'urgente' || tipo === 'alerta' || tipo === 'erro') return 'urgente';
  if (tipo === 'lembrete' || tipo === 'prazo') return 'atencao';
  return 'informativo';
}

export function acaoDoAviso(link: string | null | undefined): string {
  const l = String(link || '');
  if (l.startsWith('/admin/robo-lances')) return 'Abrir a tela remota do robô';
  if (l.startsWith('/robo-lances/disputa/')) return 'Abrir a disputa';
  return 'Ver no Robô de Lances';
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DIA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** "agora", "há 5 min", "às 15:43" (hoje) ou "16/09 às 15:43". */
export function quandoDoAviso(criadoEm: string, agora: Date): string {
  const d = new Date(criadoEm);
  if (Number.isNaN(d.getTime())) return '';
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  return DIA.format(d) === DIA.format(agora) ? `às ${HORA.format(d)}` : `${DIA.format(d)} às ${HORA.format(d)}`;
}

/** Os avisos que cabem no canto: do robô, não lidos, não dispensados, recentes — o mais novo primeiro. */
export function avisosParaMostrar(
  lista: ReadonlyArray<NotificacaoDoRobo>,
  dispensados: ReadonlySet<string>,
  agora: Date,
): NotificacaoDoRobo[] {
  const desde = agora.getTime() - JANELA_DOS_AVISOS_HORAS * 3600_000;
  return lista
    .filter((n) => ehAvisoDoRobo(n) && !n.lida && !dispensados.has(n.id) && new Date(n.created_at).getTime() >= desde)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * O sininho chama (treme e brilha) enquanto houver aviso do robô não lido que
 * chegou DEPOIS da última vez que a pessoa abriu o painel. Abrir o painel é o
 * "vi": o sininho para, mesmo que ela não marque nada como lido — senão ele
 * tremeria para sempre para quem lê e não clica em "Marcar todas".
 */
export function sininhoDeveChamar(
  lista: ReadonlyArray<Pick<NotificacaoDoRobo, 'link' | 'lida' | 'created_at'>>,
  abertoPorUltimoEm: string | null | undefined,
): boolean {
  const desde = abertoPorUltimoEm ? new Date(abertoPorUltimoEm).getTime() : Number.NEGATIVE_INFINITY;
  return lista.some((n) => ehAvisoDoRobo(n) && !n.lida && new Date(n.created_at).getTime() > (Number.isNaN(desde) ? Number.NEGATIVE_INFINITY : desde));
}

const chaveDoSininho = (userId: string) => `praefectus:sininho-aberto-em:${userId}`;

export function lerSininhoAbertoEm(userId: string): string | null {
  try {
    return localStorage.getItem(chaveDoSininho(userId));
  } catch {
    return null;
  }
}

export function gravarSininhoAbertoEm(userId: string, quando: Date) {
  try {
    localStorage.setItem(chaveDoSininho(userId), quando.toISOString());
  } catch {
    /* sem storage: o sininho volta a chamar na próxima sessão, o que é tolerável */
  }
}
