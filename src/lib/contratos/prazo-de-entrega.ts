import { dataLocal, deDataLocal, hojeLocal } from '@/lib/financeiro/data-local';

/**
 * Quando o pedido vence, e o quanto falta.
 *
 * Um pedido lançado no sistema dispara uma obrigação com prazo: entregar em
 * N dias contados da ordem de fornecimento. Estourar isso é inadimplemento
 * contratual (Lei 14.133/2021, art. 137, II) e abre caminho para as sanções do
 * art. 156 — inclusive impedimento de licitar, que trava a empresa nos
 * próximos certames.
 *
 * Até aqui a tela de Pedidos mostrava a data do pedido e mais nada. O prazo
 * corria sem ninguém ver.
 */

export type UnidadeDePrazo = 'uteis' | 'corridos';

export type PrazoDoContrato = {
  dias: number | null;
  unidade: UnidadeDePrazo | null;
};

/** Sábado ou domingo. Feriado não entra: ver `contarDiasUteis`. */
const ehFimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Soma dias corridos a uma data ISO (AAAA-MM-DD), devolvendo ISO.
 *
 * Usa `dataLocal` porque `new Date('2026-08-29')` é interpretado como UTC e,
 * no fuso do Brasil, volta um dia — o erro que já custou 25 chamadas erradas
 * no Financeiro.
 */
export function somarDiasCorridos(iso: string, dias: number): string {
  const d = deDataLocal(iso);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

/**
 * Soma dias ÚTEIS, pulando sábado e domingo.
 *
 * `feriados` é opcional e recebe datas ISO. Feriado municipal muda de cidade
 * para cidade e o sistema não os conhece todos: quando a lista não vem, o
 * cálculo conta só os fins de semana e **erra para menos** — a data-limite sai
 * mais cedo do que a real. É o lado seguro: avisar antes é incômodo, avisar
 * depois é perder o prazo.
 */
export function somarDiasUteis(iso: string, dias: number, feriados: string[] = []): string {
  const feriado = new Set(feriados);
  const d = deDataLocal(iso);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (!ehFimDeSemana(d) && !feriado.has(dataLocal(d))) restantes -= 1;
  }
  return dataLocal(d);
}

/**
 * A data-limite de entrega de um pedido.
 *
 * Devolve `null` quando o contrato não registra prazo — e é deliberado:
 * inventar 30 dias porque "é o usual" produz um aviso que parece obrigação
 * contratual e não é nenhuma. Quem vê `null` sabe que falta cadastrar; quem vê
 * uma data inventada não sabe de nada.
 */
export function limiteDeEntrega(
  dataDoPedido: string | null | undefined,
  prazo: PrazoDoContrato,
  feriados: string[] = [],
): string | null {
  if (!dataDoPedido || !prazo.dias || prazo.dias <= 0) return null;
  return prazo.unidade === 'uteis'
    ? somarDiasUteis(dataDoPedido, prazo.dias, feriados)
    : somarDiasCorridos(dataDoPedido, prazo.dias);
}

/** Dias corridos entre hoje e a data-limite. Negativo = já passou. */
export function diasAte(limiteIso: string, hoje = hojeLocal()): number {
  const ms = deDataLocal(limiteIso).getTime() - deDataLocal(hoje).getTime();
  return Math.round(ms / 86_400_000);
}

export type SituacaoDoPrazo = {
  /** 'sem_prazo' quando o contrato não registra — não é o mesmo que "no prazo". */
  estado: 'sem_prazo' | 'entregue' | 'vencido' | 'vence_hoje' | 'apertado' | 'no_prazo';
  limite: string | null;
  dias: number | null;
  frase: string;
};

/**
 * O estado do prazo de um pedido, pronto para a tela.
 *
 * A fronteira do "apertado" é 1/3 do prazo restante, com piso de 2 e teto de
 * 7 dias: num prazo de 5 dias, avisar com 7 de antecedência seria avisar antes
 * de o pedido existir; num de 90, avisar só nos últimos 2 não dá tempo de
 * separar mercadoria.
 */
export function situacaoDoPrazo(
  dataDoPedido: string | null | undefined,
  prazo: PrazoDoContrato,
  opcoes: { entregueEm?: string | null; feriados?: string[]; hoje?: string } = {},
): SituacaoDoPrazo {
  const { entregueEm, feriados = [], hoje = hojeLocal() } = opcoes;
  const limite = limiteDeEntrega(dataDoPedido, prazo, feriados);

  if (!limite) {
    return {
      estado: 'sem_prazo',
      limite: null,
      dias: null,
      frase: 'Prazo de entrega não registrado no contrato',
    };
  }

  const formatado = deDataLocal(limite).toLocaleDateString('pt-BR');

  // Entrega feita encerra a contagem — inclusive quando saiu atrasada, porque
  // aí o que importa é o registro do atraso, não uma contagem que segue.
  if (entregueEm) {
    const atraso = diasAte(limite, entregueEm);
    return {
      estado: 'entregue',
      limite,
      dias: atraso,
      frase: atraso < 0
        ? `Entregue com ${Math.abs(atraso)} dia(s) de atraso (limite era ${formatado})`
        : `Entregue dentro do prazo (limite ${formatado})`,
    };
  }

  const dias = diasAte(limite, hoje);
  if (dias < 0) {
    return { estado: 'vencido', limite, dias, frase: `Prazo vencido há ${Math.abs(dias)} dia(s) — limite era ${formatado}` };
  }
  if (dias === 0) {
    return { estado: 'vence_hoje', limite, dias, frase: `Entrega vence HOJE (${formatado})` };
  }

  const total = prazo.dias ?? 0;
  const janela = Math.min(7, Math.max(2, Math.ceil(total / 3)));
  if (dias <= janela) {
    return { estado: 'apertado', limite, dias, frase: `Faltam ${dias} dia(s) para entregar — limite ${formatado}` };
  }
  return { estado: 'no_prazo', limite, dias, frase: `Entregar até ${formatado} (${dias} dias)` };
}

/**
 * Quando o órgão deve concluir o recebimento, contado da entrega.
 *
 * É o art. 140 da Lei 14.133/2021 e governa quando a nota pode ser apresentada
 * e paga. Sem isso, o contas a receber projeta entrada para uma data que o
 * contrato não autoriza.
 */
export function limiteDeRecebimento(
  dataDaEntrega: string | null | undefined,
  prazo: PrazoDoContrato,
  feriados: string[] = [],
): string | null {
  return limiteDeEntrega(dataDaEntrega, prazo, feriados);
}
