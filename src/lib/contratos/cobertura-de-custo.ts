/**
 * Cobertura de custo do pedido — a régua do cruzamento entre o custo DECLARADO
 * (Comercial: custo unitário × quantidade, dentro do pedido) e o custo
 * COMPROVADO (Financeiro: contas a pagar rateadas ao pedido).
 *
 * Decisão do dono (22/09/2026): o custo declarado é EXCEÇÃO nomeada. É
 * gerencial, não entra na DRE nem no estoque, e é substituído pelo comprovado
 * à medida que os documentos chegam. Nunca se soma ao comprovado em silêncio:
 * o que o declarado excede o comprovado sai como parcela própria ("declarado
 * sem documento").
 *
 * Esta é a mesma conta de `public.situacao_do_custo` (migration
 * 20260923000001). As duas mudam juntas.
 */

export type SituacaoDoCusto = 'sem_custo' | 'declarado' | 'documentado' | 'parcial' | 'conferido' | 'divergente';

export type ToleranciaDoCusto = {
  /** Percentual 0–100 do declarado (0.5 = 0,5%). */
  pct: number;
  /** Em reais. Vale o MAIOR entre os dois. */
  valor: number;
};

/** Padrão da empresa que ainda não configurou (princípio 7: padrão explícito). */
export const TOLERANCIA_PADRAO: ToleranciaDoCusto = { pct: 0.5, valor: 50 };
export const PRAZO_COBRANCA_PADRAO_DIAS = 15;

export type ComprovadoDoPedido = { declarado: number; pago: number; aberto: number };

const n = (v: number | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function toleranciaEmReais(declarado: number, tol: ToleranciaDoCusto = TOLERANCIA_PADRAO): number {
  return Math.max((n(declarado) * n(tol.pct)) / 100, n(tol.valor));
}

export function situacaoDoCusto(c: ComprovadoDoPedido, tol: ToleranciaDoCusto = TOLERANCIA_PADRAO): SituacaoDoCusto {
  const declarado = n(c.declarado);
  const comprovado = n(c.pago) + n(c.aberto);
  if (declarado <= 0 && comprovado <= 0) return 'sem_custo';
  if (declarado <= 0) return 'documentado';
  if (comprovado <= 0) return 'declarado';
  if (Math.abs(comprovado - declarado) <= toleranciaEmReais(declarado, tol)) return 'conferido';
  return comprovado < declarado ? 'parcial' : 'divergente';
}

/**
 * Quem lançou primeiro: o setor que recebe o aviso de "casou". Sem declaração
 * o Financeiro foi o único a lançar; sem documento, o Comercial.
 */
export function quemLancouPrimeiro(
  declaradoEm: string | Date | null | undefined,
  documentoEm: string | Date | null | undefined,
): 'comercial' | 'financeiro' | null {
  const d = declaradoEm ? new Date(declaradoEm).getTime() : NaN;
  const f = documentoEm ? new Date(documentoEm).getTime() : NaN;
  if (Number.isNaN(d) && Number.isNaN(f)) return null;
  if (Number.isNaN(d)) return 'financeiro';
  if (Number.isNaN(f)) return 'comercial';
  return d <= f ? 'comercial' : 'financeiro';
}

export type TomDaSituacao = 'neutro' | 'info' | 'atencao' | 'sucesso' | 'critico';

export const ROTULO_SITUACAO: Record<SituacaoDoCusto, { rotulo: string; tom: TomDaSituacao; explicacao: string }> = {
  sem_custo: { rotulo: 'Sem custo', tom: 'neutro', explicacao: 'Nenhum custo declarado e nenhuma compra atribuída a este pedido.' },
  declarado: { rotulo: 'Declarado', tom: 'info', explicacao: 'Custo declarado no pedido; ainda sem nota de entrada ou conta a pagar atribuída.' },
  documentado: { rotulo: 'Sem declaração', tom: 'atencao', explicacao: 'O Financeiro atribuiu compra a este pedido e nenhum custo foi declarado nele.' },
  parcial: { rotulo: 'Parcial', tom: 'info', explicacao: 'As contas a pagar atribuídas cobrem menos que o declarado.' },
  conferido: { rotulo: 'Conferido', tom: 'sucesso', explicacao: 'Declarado e comprovado batem dentro da tolerância.' },
  divergente: { rotulo: 'Divergente', tom: 'critico', explicacao: 'As contas a pagar atribuídas passam do declarado além da tolerância.' },
};

export const fmtReais = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n(v));

/** A frase do balão: o que já está comprovado contra o declarado. */
export function fraseDaCobertura(c: ComprovadoDoPedido, situacao: SituacaoDoCusto = situacaoDoCusto(c)): string {
  const declarado = n(c.declarado);
  const comprovado = n(c.pago) + n(c.aberto);
  const base = ROTULO_SITUACAO[situacao].explicacao;
  if (situacao === 'sem_custo') return base;
  const partes: string[] = [];
  if (declarado > 0) partes.push(`declarado ${fmtReais(declarado)}`);
  if (comprovado > 0) {
    partes.push(`comprovado ${fmtReais(comprovado)}${n(c.aberto) > 0 ? ` (${fmtReais(n(c.aberto))} ainda a pagar)` : ''}`);
  }
  if (situacao === 'parcial' && declarado > comprovado) partes.push(`faltam ${fmtReais(declarado - comprovado)}`);
  if (situacao === 'divergente') partes.push(`diferença ${fmtReais(comprovado - declarado)}`);
  return `${base} ${partes.join(' · ')}.`;
}

export type CoberturaDoContrato = {
  declarado: number;
  comprovadoPago: number;
  comprovadoAberto: number;
  doContratoPago: number;
  doContratoAberto: number;
  pedidosTotal: number;
  pedidosSemCusto: number;
};

/**
 * O que o contrato mostra: cobertura em % (contas a pagar do contrato sobre
 * o declarado), o declarado que nenhuma conta a pagar cobre, e se o custo
 * está incompleto — que é o que impede o painel de falar em "economia".
 */
export function coberturaDoContrato(c: CoberturaDoContrato): {
  pct: number | null;
  semDocumento: number;
  aDistribuir: number;
  incompleta: boolean;
} {
  const declarado = n(c.declarado);
  const doContrato = n(c.doContratoPago) + n(c.doContratoAberto);
  const distribuido = n(c.comprovadoPago) + n(c.comprovadoAberto);
  const pct = declarado > 0 ? Math.min(100, Math.round((doContrato / declarado) * 1000) / 10) : null;
  const semDocumento = Math.max(0, declarado - doContrato);
  const incompleta = n(c.pedidosSemCusto) > 0 || (declarado > 0 && doContrato + 0.005 < declarado);
  return { pct, semDocumento, aDistribuir: Math.max(0, doContrato - distribuido), incompleta };
}

/**
 * O texto do desvio previsto × realizado (decisão 17 do dono): enquanto a
 * cobertura não fecha, "economia" vira "custo incompleto" — porque comparar
 * um custo pela metade com o previsto inteiro sempre parece economia.
 */
export function textoDoDesvio(desvioPct: number | null, incompleta: boolean, coberturaPct: number | null): string {
  if (desvioPct === null) return '';
  if (desvioPct < 0 && incompleta) {
    return coberturaPct === null
      ? 'custo incompleto — há pedidos sem custo'
      : `custo incompleto — cobertura de ${coberturaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }
  if (Math.abs(desvioPct) < 0.05) return 'no previsto';
  return `${Math.abs(desvioPct).toFixed(1)}% ${desvioPct > 0 ? 'acima do previsto (estouro)' : 'abaixo do previsto (economia)'}`;
}

export type TituloParaRatear = { valor: number; jaRateado: number };
export type PedidoParaCobrir = { declarado: number; comprovado: number };

/** Quanto deste título sobra para ratear. */
export function sobraDoTitulo(t: TituloParaRatear): number {
  return Math.max(0, Math.round((n(t.valor) - n(t.jaRateado)) * 100) / 100);
}

/**
 * A parte sugerida ao atribuir uma compra a um pedido: o que sobra do título,
 * limitado ao que o pedido ainda não comprovou — quando há declaração. Sem
 * declaração, a sobra inteira (não há teto: o cruzamento dirá "sem
 * declaração").
 */
export function parteSugerida(t: TituloParaRatear, p: PedidoParaCobrir): number {
  const sobra = sobraDoTitulo(t);
  if (n(p.declarado) <= 0) return sobra;
  const falta = Math.max(0, Math.round((n(p.declarado) - n(p.comprovado)) * 100) / 100);
  return Math.min(sobra, falta);
}
