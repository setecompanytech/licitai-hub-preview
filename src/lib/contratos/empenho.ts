/**
 * O empenho, e o que ele autoriza.
 *
 * O art. 60 da Lei 4.320/64 é direto: despesa não pode ser realizada sem
 * prévio empenho. O sistema controlava consumo só contra o valor global do
 * contrato — grosso demais para servir de aviso. Um empenho estimativo de
 * R$ 40 mil pode estourar inteiro sem que um contrato de R$ 175 mil dê
 * qualquer sinal.
 */

export type TipoDeEmpenho = 'ordinario' | 'global' | 'estimativo';

export const ROTULO_DO_EMPENHO: Record<TipoDeEmpenho, string> = {
  ordinario: 'Empenho ordinário',
  global: 'Empenho global',
  estimativo: 'Empenho estimativo',
};

/**
 * O que cada tipo significa para o saldo — e é diferente em cada um.
 *
 * Não é detalhe de nomenclatura: o mesmo excesso de R$ 5.000 é irregularidade
 * grave num ordinário e rotina administrativa num estimativo.
 */
export const SENTIDO_DO_TIPO: Record<TipoDeEmpenho, string> = {
  ordinario:
    'Valor certo, pagamento de uma vez. Um pedido só deveria consumi-lo por inteiro.',
  global:
    'Teto para várias entregas parceladas. A soma dos pedidos não pode passar dele.',
  estimativo:
    'Previsão de consumo. Ultrapassar não é erro, mas exige reforço do empenho antes de continuar.',
};

/** Só os três que existem; qualquer outra coisa é null, nunca um palpite. */
export function tipoDeEmpenho(v: unknown): TipoDeEmpenho | null {
  const t = String(v ?? '').trim().toLowerCase().replace(/^empenho[_ ]?/, '');
  if (t === 'ordinario' || t === 'ordinário') return 'ordinario';
  if (t === 'global') return 'global';
  if (t === 'estimativo') return 'estimativo';
  return null;
}

/**
 * Normaliza o número do empenho.
 *
 * O mesmo empenho aparece como "2026NE003716", "2026.260101NE003716" e
 * "2026 NE 003716". Três grafias viram três empenhos na hora de somar, e o
 * controle de saldo deixa de existir sem ninguém perceber.
 *
 * A parte que identifica é `AAAANEnnnnnn`: ano, a sigla NE e o sequencial. O
 * miolo (`260101`) é a unidade gestora e varia na mesma nota conforme o
 * sistema que a imprime.
 */
export function normalizarNumeroEmpenho(v: unknown): string | null {
  const bruto = String(v ?? '').toUpperCase().replace(/\s+/g, '');
  const m = bruto.match(/(\d{4}).*?NE(\d+)/);
  if (m) return `${m[1]}NE${m[2].padStart(6, '0')}`;
  const limpo = bruto.replace(/[^\dA-Z]/g, '');
  return limpo || null;
}

export type SituacaoDoEmpenho = {
  estado: 'sem_empenho' | 'dentro' | 'no_limite' | 'excedido';
  empenhado: number;
  consumido: number;
  saldo: number;
  severidade: 'critico' | 'atencao' | 'ok';
  frase: string;
};

/**
 * A soma dos pedidos contra o valor empenhado.
 *
 * Devolve `sem_empenho` quando não há valor registrado — e é deliberado:
 * supor que o empenho cobre o pedido porque ninguém informou o contrário é
 * exatamente o silêncio que o art. 60 não admite.
 */
export function situacaoDoEmpenho(entrada: {
  valorEmpenhado?: number | null;
  somaDosPedidos: number;
  tipo?: TipoDeEmpenho | null;
}): SituacaoDoEmpenho {
  const empenhado = Number(entrada.valorEmpenhado ?? 0);
  const consumido = Number(entrada.somaDosPedidos ?? 0);
  const saldo = Number((empenhado - consumido).toFixed(2));

  if (!empenhado) {
    return {
      estado: 'sem_empenho', empenhado: 0, consumido, saldo: 0,
      severidade: 'atencao',
      frase: 'Valor do empenho não registrado — não há contra o que conferir o consumo.',
    };
  }

  if (saldo < -0.005) {
    const excesso = Math.abs(saldo);
    // O estimativo admite ultrapassagem; os outros dois, não. A frase muda
    // porque a providência muda.
    const ehEstimativo = entrada.tipo === 'estimativo';
    return {
      estado: 'excedido', empenhado, consumido, saldo,
      severidade: ehEstimativo ? 'atencao' : 'critico',
      frase: ehEstimativo
        ? `Consumo passou o estimado em ${excesso.toFixed(2)} — peça o reforço do empenho antes de continuar.`
        : `Pedidos somam ${excesso.toFixed(2)} além do empenhado. Despesa sem cobertura (Lei 4.320/64, art. 60).`,
    };
  }

  if (saldo < empenhado * 0.1) {
    return {
      estado: 'no_limite', empenhado, consumido, saldo,
      severidade: 'atencao',
      frase: `Restam ${saldo.toFixed(2)} do empenho — menos de 10%.`,
    };
  }

  return {
    estado: 'dentro', empenhado, consumido, saldo,
    severidade: 'ok',
    frase: `Restam ${saldo.toFixed(2)} do empenho.`,
  };
}
