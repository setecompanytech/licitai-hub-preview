/**
 * Cor da barra de progresso das Metas.
 *
 * Até 2026-08-08 a barra era laranja fixa — exceção documentada à régua de cor,
 * com o argumento de que medidor não é ação nem estado. O problema prático é
 * que ela ficava igualmente laranja com 24% e com 98%, contando uma história
 * diferente da do alerta logo ao lado.
 *
 * Agora ela usa a MESMA severidade que o painel já calcula com `avaliarAlerta`,
 * então barra e alerta não podem divergir: são a mesma fonte.
 */

import type { Severidade } from './projecao';

export type EstadoDaBarra = {
  /** Classe Tailwind aplicada ao indicador preenchido. */
  cor: string;
  /** Texto para leitores de tela e `title` — a cor sozinha não comunica. */
  rotulo: string;
};

/**
 * Meta atingida vence a severidade: com a meta batida não há risco a sinalizar,
 * mesmo que restem poucos dias úteis.
 */
export function estadoDaBarra(severidade: Severidade, metaAtingida: boolean): EstadoDaBarra {
  if (metaAtingida) return { cor: 'bg-success', rotulo: 'Meta atingida' };

  switch (severidade) {
    case 'critico':
      return { cor: 'bg-destructive', rotulo: 'Risco crítico de não atingir a meta' };
    case 'risco':
      return { cor: 'bg-destructive/70', rotulo: 'Risco de não atingir a meta' };
    case 'atencao':
      return { cor: 'bg-warning', rotulo: 'Atenção: ritmo abaixo do necessário' };
    default:
      // Fora da janela de alerta ou dentro do esperado: laranja da marca
      return { cor: 'bg-primary', rotulo: 'Dentro do esperado' };
  }
}
