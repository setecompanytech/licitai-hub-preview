import { describe, expect, it } from 'vitest';
import {
  avaliarCreditoIcms,
  finalidadePeloCfop,
  finalidadeSugerida,
  sugerirFinalidade,
  ROTULO_FINALIDADE,
  type FinalidadeDaEntrada,
} from './credito-icms';

/**
 * A finalidade da compra é o parâmetro do crédito de ICMS — regra fixada pelo
 * dono do produto em 13/09/2026.
 *
 * O que estes casos protegem não é o cálculo (não há cálculo aqui), é a
 * CLASSIFICAÇÃO. Escriturar crédito indevido volta como glosa e multa, e o
 * caminho mais fácil para isso é uma função que responde "permitido" por
 * omissão. Por isso metade dos casos verifica que o sistema diz "a conferir"
 * quando não sabe, em vez de chutar para o lado generoso.
 */
describe('direito a crédito de ICMS por finalidade', () => {
  it('no Simples, o regime decide antes da finalidade', () => {
    // O ICMS já foi recolhido no documento único: nenhum destino gera crédito.
    const finalidades: FinalidadeDaEntrada[] = ['revenda', 'uso_consumo', 'imobilizado', 'materia_prima'];
    for (const f of finalidades) {
      const r = avaliarCreditoIcms(f, 'simples_nacional');
      expect(r.situacao, `${f} no Simples`).toBe('vedado');
      expect(r.fundamento).toContain('LC 123/2006');
    }
  });

  it('no regime normal, revenda e insumo creditam', () => {
    for (const regime of ['lucro_presumido', 'lucro_real'] as const) {
      expect(avaliarCreditoIcms('revenda', regime).situacao).toBe('permitido');
      expect(avaliarCreditoIcms('materia_prima', regime).situacao).toBe('permitido');
    }
  });

  it('uso e consumo não credita, e o motivo é datado', () => {
    const r = avaliarCreditoIcms('uso_consumo', 'lucro_real');
    expect(r.situacao).toBe('vedado');
    // A regra foi adiada cinco vezes; quem reler precisa achar o dispositivo.
    expect(r.fundamento).toContain('art. 33');
  });

  it('imobilizado credita em 48 parcelas, não de uma vez', () => {
    const r = avaliarCreditoIcms('imobilizado', 'lucro_presumido');
    expect(r.situacao).toBe('parcelado');
    expect(r.parcelas).toBe(48);
    expect(r.fundamento).toContain('§5º');
  });

  it('sem regime ou sem finalidade, diz que não sabe — não chuta', () => {
    expect(avaliarCreditoIcms('revenda', null).situacao).toBe('a_conferir');
    expect(avaliarCreditoIcms('revenda', undefined).situacao).toBe('a_conferir');
    expect(avaliarCreditoIcms('nao_informada', 'lucro_real').situacao).toBe('a_conferir');
  });
});

describe('de onde vem a sugestão de finalidade', () => {
  it('o CFOP da nota classifica a operação', () => {
    expect(finalidadePeloCfop('1102')).toBe('revenda'); // compra p/ comercialização
    expect(finalidadePeloCfop('2102')).toBe('revenda'); // idem, interestadual
    expect(finalidadePeloCfop('1556')).toBe('uso_consumo');
    expect(finalidadePeloCfop('2551')).toBe('imobilizado');
    expect(finalidadePeloCfop('1101')).toBe('materia_prima');
  });

  it('CFOP de saída não classifica entrada', () => {
    // 5/6/7 é saída. Aceitá-lo aqui esconderia uma nota trocada.
    expect(finalidadePeloCfop('5102')).toBe('nao_informada');
    expect(finalidadePeloCfop('6102')).toBe('nao_informada');
    expect(finalidadePeloCfop('')).toBe('nao_informada');
    expect(finalidadePeloCfop('11')).toBe('nao_informada');
  });

  it('o cadastro do produto sugere, com o vocabulário que já existia', () => {
    expect(finalidadeSugerida('00')).toBe('revenda');
    expect(finalidadeSugerida('07')).toBe('uso_consumo');
    expect(finalidadeSugerida('08')).toBe('imobilizado');
    expect(finalidadeSugerida(null)).toBe('nao_informada');
  });

  it('a nota vence o cadastro, e a procedência vai junto', () => {
    // Produto cadastrado como revenda, comprado com CFOP de uso e consumo:
    // quem emitiu a nota classificou a operação, e é a operação que importa.
    const r = sugerirFinalidade('1556', '00');
    expect(r.finalidade).toBe('uso_consumo');
    expect(r.procedencia).toContain('CFOP');

    const semCfop = sugerirFinalidade(null, '08');
    expect(semCfop.finalidade).toBe('imobilizado');
    expect(semCfop.procedencia).toContain('cadastro');

    const semNada = sugerirFinalidade(null, null);
    expect(semNada.finalidade).toBe('nao_informada');
  });

  it('toda finalidade tem rótulo legível', () => {
    for (const chave of Object.keys(ROTULO_FINALIDADE) as FinalidadeDaEntrada[]) {
      expect(ROTULO_FINALIDADE[chave].length).toBeGreaterThan(3);
    }
  });
});
