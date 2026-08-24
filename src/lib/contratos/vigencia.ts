/**
 * Até quando o instrumento vale.
 *
 * O formulário já sabia somar meses à data de início, mas só disparava quando a
 * vigência estava preenchida — e a extração do PDF preenche objeto, valor e
 * datas, não o prazo. Resultado: assinatura e início vinham prontos, "Data Fim"
 * ficava em branco, e quem cadastrou tinha de calcular de cabeça o que a lei já
 * define.
 *
 * Para a ATA de Registro de Preços, o prazo NÃO é uma escolha de quem cadastra:
 * a Lei 14.133/2021, art. 84, fixa vigência de 1 ano, prorrogável por igual
 * período. Doze meses aqui é a lei, não um palpite — e por isso pode ser o
 * padrão. Para contrato não existe prazo único: o art. 105 e seguintes fazem
 * depender da espécie do objeto, então o campo continua sendo de quem cadastra.
 */

/** Vigência da ARP na Lei 14.133/2021, art. 84. */
export const MESES_VIGENCIA_ATA = 12;

/** A ARP prorroga por igual período, e só uma vez — 24 meses no total. */
export const MESES_MAXIMO_ATA = 24;

/**
 * Soma meses a uma data de calendário, sem passar por fuso e sem transbordar o
 * mês. `setMonth` faz 31/01 + 1 mês virar 03/03; aqui vira 28/02, que é o que
 * qualquer pessoa entende por "um mês depois".
 */
export function somarMeses(data: string, meses: number): string | null {
  const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !Number.isFinite(meses)) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);

  const alvo = new Date(Date.UTC(ano, mes + meses, 1));
  const ultimoDiaDoMes = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDiaDoMes));

  return alvo.toISOString().slice(0, 10);
}

export type EntradaVigencia = {
  tipoDocumento: string;
  /** Preferida; a assinatura entra como reserva quando o início ainda não existe. */
  dataInicio?: string | null;
  dataAssinatura?: string | null;
  /** Prazo do CONTRATO, em meses. */
  vigenciaMeses?: string | number | null;
  /** Prazo da ATA, em meses. */
  validadeAtaMeses?: string | number | null;
};

export type ResultadoVigencia = {
  dataFim: string | null;
  meses: number | null;
  /** Os meses vieram do art. 84, porque ninguém informou o prazo. */
  inferido: boolean;
};

const paraNumero = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function calcularVigencia(e: EntradaVigencia): ResultadoVigencia {
  const ehAta = e.tipoDocumento === 'ata_srp';
  const informado = paraNumero(ehAta ? e.validadeAtaMeses : e.vigenciaMeses);

  // Só a ATA tem prazo legal único; contrato sem prazo informado fica sem fim.
  const meses = informado ?? (ehAta ? MESES_VIGENCIA_ATA : null);
  const inferido = ehAta && informado === null;

  const base = e.dataInicio || e.dataAssinatura || null;
  if (!base || meses === null) return { dataFim: null, meses, inferido };

  return { dataFim: somarMeses(base, meses), meses, inferido };
}

/**
 * O que dizer sobre o prazo escolhido — nulo quando não há o que ressalvar.
 * A ARP prorrogada além de 24 meses é o caso que aparece na prática, porque a
 * prorrogação é assinada sem ninguém somar o total.
 */
export function avisoDeVigenciaAta(meses: number | null): string | null {
  if (meses === null) return null;
  if (meses > MESES_MAXIMO_ATA) {
    return `A ARP vale 1 ano, prorrogável por igual período — ${MESES_MAXIMO_ATA} meses no total (Lei 14.133/2021, art. 84). ${meses} meses excede o limite.`;
  }
  if (meses > MESES_VIGENCIA_ATA) {
    return `Acima de ${MESES_VIGENCIA_ATA} meses, a vigência depende de prorrogação formal com vantajosidade comprovada (art. 84).`;
  }
  return null;
}

/** Soma dias a uma data de calendário, sem passar por fuso. */
export function somarDias(data: string, dias: number): string | null {
  const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dias até uma data de calendário. Negativo = já passou. */
export function diasAteData(data: string | null | undefined, hoje = new Date()): number | null {
  const m = String(data ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}

export type SituacaoVigencia = {
  dias: number | null;
  vencido: boolean;
  /** Vence dentro de 60 dias, ainda válido. */
  vencendo: boolean;
  /** Frase pronta, sem número negativo. */
  frase: string | null;
};

/**
 * O que dizer sobre o prazo, sem inverter o sinal.
 *
 * A tela imprimia os dias restantes crus e produzia "Contrato vence em −375
 * dias" — que, além de não ser português, some com o fato: o instrumento está
 * vencido há mais de um ano. Número negativo não é aviso, é defeito.
 */
export function situacaoDaVigencia(dataFim: string | null | undefined, hoje = new Date()): SituacaoVigencia {
  const dias = diasAteData(dataFim, hoje);
  if (dias === null) return { dias: null, vencido: false, vencendo: false, frase: null };

  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      dias, vencido: true, vencendo: false,
      frase: n === 1 ? 'Venceu ontem' : `Venceu há ${n} dias`,
    };
  }
  if (dias === 0) return { dias, vencido: false, vencendo: true, frase: 'Vence hoje' };
  if (dias === 1) return { dias, vencido: false, vencendo: true, frase: 'Vence amanhã' };
  return { dias, vencido: false, vencendo: dias <= 60, frase: `Vence em ${dias} dias` };
}

/**
 * O selo de status é uma coluna preenchida à mão e envelhece sozinha: ninguém
 * volta ao cadastro no dia em que o prazo acaba. Quando a data de fim já passou,
 * ela manda — dizer "Vigente" em verde sobre um instrumento vencido há 375 dias
 * é o sistema afirmando o contrário do que ele mesmo sabe.
 */
export function statusEfetivo(statusGravado: string | null | undefined, dataFim: string | null | undefined, hoje = new Date()): string {
  const s = String(statusGravado || 'vigente');
  // Suspenso é decisão de alguém e não se dissolve com o calendário.
  if (s === 'suspenso' || s === 'encerrado') return s;
  const { vencido, vencendo } = situacaoDaVigencia(dataFim, hoje);
  if (vencido) return 'encerrado';
  if (vencendo && s === 'vigente') return 'vencendo';
  return s;
}
