/**
 * O quadro de status da disputa, em texto (D13, 16/09/2026).
 *
 * O robô manda o que vê na sala (callback `estado-da-sala`), o webhook guarda
 * em `sessoes_lance_real.estado_sala` com o motivo já em linguagem de cliente,
 * e a aba Acompanhamento mostra numa linha: "Item 1 · Modo aberto · 8º lugar ·
 * Melhor R$ 3.100,00 · Nosso R$ 4.999,70" e, embaixo, o que o robô está
 * fazendo. É o que dispensa abrir a tela remota para saber como a disputa vai.
 */

export type EstadoNoQuadro = {
  item?: number | null;
  melhor_lance?: number | null;
  nosso_lance?: number | null;
  posicao?: number | null;
  sou_lider?: boolean | null;
  tem_proposta?: boolean | null;
  nossa_desclassificada?: boolean | null;
  modo?: string | null;
  fase?: string | null;
  decisao?: { acao?: string | null; motivo?: string | null; motivo_legivel?: string | null } | null;
};

const ROTULO_DA_FASE: Record<string, string> = {
  aguardando: 'Aguardando abrir',
  aberta: 'Etapa aberta',
  encerramento_aleatorio: 'Encerramento aleatório',
  fechada: 'Lance final fechado',
  desempate_me_epp: 'Desempate de ME/EPP',
  suspensa: 'Suspensa',
  encerrada: 'Encerrada',
};

/** Sem notícia do robô por mais que isto, com a sessão de pé, a tela avisa. */
export const MINUTOS_SEM_NOTICIA = 2;

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function posicaoNoQuadro(estado: EstadoNoQuadro): string | null {
  if (estado.nossa_desclassificada) return 'Proposta desclassificada';
  if (estado.tem_proposta === false) return 'Sem proposta da empresa';
  if (estado.sou_lider === true) return '1º lugar';
  if (Number.isFinite(estado.posicao as number)) return `${estado.posicao}º lugar`;
  return null;
}

export function resumoDoQuadro(
  estado: EstadoNoQuadro,
  opcoes: { estadoEm?: string | null; agora?: Date; sessaoViva: boolean },
): { partes: string[]; motivo: string | null; aviso: string | null } {
  const partes = [
    Number.isFinite(estado.item as number) ? `Item ${estado.item}` : null,
    estado.modo ? `Modo ${estado.modo.toLowerCase()}` : null,
    estado.fase ? ROTULO_DA_FASE[estado.fase] ?? estado.fase : null,
    posicaoNoQuadro(estado),
    Number.isFinite(estado.melhor_lance as number) ? `Melhor ${moeda(estado.melhor_lance as number)}` : null,
    Number.isFinite(estado.nosso_lance as number) ? `Nosso ${moeda(estado.nosso_lance as number)}` : null,
  ].filter((p): p is string => !!p);

  const motivo = estado.decisao?.motivo_legivel || estado.decisao?.motivo || null;

  let aviso: string | null = null;
  if (!opcoes.sessaoViva) {
    aviso = 'Última leitura antes de a sessão do robô terminar';
  } else if (opcoes.estadoEm) {
    const em = new Date(opcoes.estadoEm);
    const minutos = Math.floor(((opcoes.agora ?? new Date()).getTime() - em.getTime()) / 60_000);
    if (Number.isFinite(minutos) && minutos >= MINUTOS_SEM_NOTICIA) {
      aviso = `Sem notícia do robô há ${minutos} min — a leitura pode estar desatualizada`;
    }
  }

  return { partes, motivo, aviso };
}
