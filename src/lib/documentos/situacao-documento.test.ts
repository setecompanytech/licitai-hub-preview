import { describe, expect, it } from 'vitest';
import {
  situacaoDoDocumento,
  contaComoRegular,
  ehRegularMasVencendo,
  ROTULO_DO_DOCUMENTO,
  type SituacaoDocumento,
} from './situacao';
import { VAGAS_PREVISTAS, vagaDe } from './previstos';

/**
 * O cofre tinha três estados — `ok | vencido | ausente` — e o banco tem um
 * `validade = NULL` que significa duas coisas diferentes:
 *
 *   "ainda não informei até quando vale"   → pendência real
 *   "este documento não vence"             → nada a fazer
 *
 * Contrato social, cartão CNPJ e declaração não têm prazo. Cobrar validade
 * deles inventaria pendência; dar-lhes o mesmo selo verde de uma certidão com
 * data conferida esconde a pendência de verdade. Os dois casos caíam em
 * "Regular", e um cofre com seis documentos sem data parecia completo.
 *
 * Quem distingue não é o banco — é a NATUREZA do documento, declarada em
 * `VAGAS_PREVISTAS.vence`.
 */
const HOJE = new Date(2026, 8, 14); // 14/09/2026, meia-noite local

describe('situação do documento — arquivo, natureza e prazo', () => {
  it('sem arquivo é ausente, qualquer que seja a validade', () => {
    expect(situacaoDoDocumento({ arquivoPath: null, validade: '2027-01-01' })).toBe('ausente');
    expect(situacaoDoDocumento({ arquivoPath: '', vencePorNatureza: true })).toBe('ausente');
    expect(situacaoDoDocumento({ arquivoPath: '   ' })).toBe('ausente');
  });

  it('documento que não vence por natureza não é cobrado de validade', () => {
    const r = situacaoDoDocumento({
      arquivoPath: 'empresa/x/contrato-social.pdf',
      validade: null,
      vencePorNatureza: false,
    });
    expect(r).toBe('nao_se_aplica');
    expect(ROTULO_DO_DOCUMENTO[r]).toBe('Sem vencimento');
  });

  it('documento que VENCE e está sem data é pendência declarada', () => {
    const r = situacaoDoDocumento({
      arquivoPath: 'empresa/x/cnd.pdf',
      validade: null,
      vencePorNatureza: true,
    });
    expect(r).toBe('sem_validade');
    // O ponto do caso: não é "Regular". Antes era.
    expect(ROTULO_DO_DOCUMENTO[r]).toBe('Validade não informada');
  });

  it('data ilegível não vira regular', () => {
    // "não sei ler" tem de ser visível; virar verde esconde o problema.
    expect(
      situacaoDoDocumento({ arquivoPath: 'a.pdf', validade: 'sem data', vencePorNatureza: true }),
    ).toBe('sem_validade');
  });

  it('o prazo decide quando há arquivo, natureza e data', () => {
    const base = { arquivoPath: 'a.pdf', vencePorNatureza: true };
    const op = { hoje: HOJE };
    expect(situacaoDoDocumento({ ...base, validade: '2026-09-13' }, op)).toBe('vencido');
    expect(situacaoDoDocumento({ ...base, validade: '2026-09-14' }, op)).toBe('vence_hoje');
    expect(situacaoDoDocumento({ ...base, validade: '2026-09-30' }, op)).toBe('vencendo');
    expect(situacaoDoDocumento({ ...base, validade: '2027-06-01' }, op)).toBe('ok');
  });
});

describe('o que conta como regular no indicador', () => {
  it('quem vence em breve continua regular — e o subconjunto é declarado', () => {
    /* Decisão de produto preservada da tela anterior, escrita lá por extenso:
       "o selo diz o que o documento É, não o que vai acontecer com ele".
       Certidão válida por mais 26 dias é regular; o vencimento próximo é
       aviso. O que o comando exige é que o subconjunto seja DITO, e não
       somado de novo ao total. */
    expect(contaComoRegular('ok')).toBe(true);
    expect(contaComoRegular('vencendo')).toBe(true);
    expect(contaComoRegular('vence_hoje')).toBe(true);
    expect(contaComoRegular('nao_se_aplica')).toBe(true);

    expect(ehRegularMasVencendo('vencendo')).toBe(true);
    expect(ehRegularMasVencendo('vence_hoje')).toBe(true);
    expect(ehRegularMasVencendo('ok')).toBe(false);
  });

  it('vencido, ausente e sem validade NÃO são regulares', () => {
    expect(contaComoRegular('vencido')).toBe(false);
    expect(contaComoRegular('ausente')).toBe(false);
    // Este é o que mudou: antes contava como regular e inflava a conformidade.
    expect(contaComoRegular('sem_validade')).toBe(false);
  });

  it('os quatro indicadores não se sobrepõem', () => {
    // Previstos = regulares + vencidos + ausentes + sem validade, sem
    // interseção. Se um documento contasse em dois baldes, o total estouraria.
    const todas: SituacaoDocumento[] = [
      'ok', 'vencendo', 'vence_hoje', 'nao_se_aplica', 'vencido', 'ausente', 'sem_validade',
    ];
    for (const s of todas) {
      const baldes = [
        contaComoRegular(s),
        s === 'vencido',
        s === 'ausente',
        s === 'sem_validade',
      ].filter(Boolean).length;
      expect(baldes, `${s} caiu em ${baldes} baldes`).toBe(1);
    }
  });

  it('toda situação tem rótulo legível', () => {
    for (const chave of Object.keys(ROTULO_DO_DOCUMENTO) as SituacaoDocumento[]) {
      expect(ROTULO_DO_DOCUMENTO[chave].length).toBeGreaterThan(2);
    }
  });
});

describe('as vagas previstas', () => {
  it('declara a natureza da validade de cada uma', () => {
    for (const vaga of VAGAS_PREVISTAS) {
      expect(typeof vaga.vence, `${vaga.nome} sem natureza declarada`).toBe('boolean');
    }
  });

  it('certidão vence; ato constitutivo e declaração, não', () => {
    expect(vagaDe('Certidão Negativa de Débitos Federais (CND)')?.vence).toBe(true);
    expect(vagaDe('Certidão de Regularidade do FGTS (CRF)')?.vence).toBe(true);
    expect(vagaDe('Ato Constitutivo / Contrato Social')?.vence).toBe(false);
    expect(vagaDe('Cartão CNPJ')?.vence).toBe(false);
    expect(vagaDe('Declaração de Não Emprego de Menor')?.vence).toBe(false);
  });

  it('os nomes são a chave de casamento — nenhum repetido', () => {
    const nomes = VAGAS_PREVISTAS.map((v) => v.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});
