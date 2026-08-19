import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTOS, SEQUENCIA, LIMITES_ADITIVO, VIGENCIA_ATA, instrumentoDoTipo,
  avisoDeExecucaoIncompativel,
} from '../instrumentos';

describe('vocabulário dos instrumentos da contratação', () => {
  it('a sequência reflete a ordem real da compra pública', () => {
    expect(SEQUENCIA).toEqual(['ata_srp', 'contrato', 'aditivo']);
  });

  it('cada instrumento declara resumo, papel e amparo legal', () => {
    SEQUENCIA.forEach((i) => {
      expect(INSTRUMENTOS[i].resumo.length).toBeGreaterThan(20);
      expect(INSTRUMENTOS[i].papel.length).toBeGreaterThan(20);
      expect(INSTRUMENTOS[i].amparo).toMatch(/14\.133\/2021/);
    });
  });

  it('a distinção que protege o saldo está escrita: ATA não obriga a comprar', () => {
    expect(INSTRUMENTOS.ata_srp.resumo).toMatch(/NÃO obriga/);
  });

  it('o tipo gravado em contratos traduz para o instrumento certo', () => {
    expect(instrumentoDoTipo('ata_srp')).toBe('ata_srp');
    expect(instrumentoDoTipo('contrato')).toBe('contrato');
    // Aditivo não é linha de `contratos` — vive em contrato_aditivos.
    expect(instrumentoDoTipo(null)).toBe('contrato');
  });

  it('limites de alteração conferem com o art. 125', () => {
    expect(LIMITES_ADITIVO.acrescimoPadrao).toBe(25);
    expect(LIMITES_ADITIVO.acrescimoReforma).toBe(50);
    expect(LIMITES_ADITIVO.observacao).toMatch(/art\. 125/);
  });

  it('vigência da ATA é de um ano, prorrogável', () => {
    expect(VIGENCIA_ATA.mesesPadrao).toBe(12);
    expect(VIGENCIA_ATA.observacao).toMatch(/prorrogá/);
  });
});

describe('execução da ATA por empenho (art. 95)', () => {
  it('não avisa quando a execução é por contrato formal', () => {
    expect(avisoDeExecucaoIncompativel({
      formaExecucao: 'contrato_formal', fundamento: null, quantidadePedidos: 9,
    })).toBeNull();
  });

  it('não avisa no primeiro pedido — entrega integral tem um pedido só', () => {
    expect(avisoDeExecucaoIncompativel({
      formaExecucao: 'empenho', fundamento: 'entrega_imediata', quantidadePedidos: 1,
    })).toBeNull();
  });

  it('avisa quando a entrega declarada como integral vira parcelada', () => {
    const aviso = avisoDeExecucaoIncompativel({
      formaExecucao: 'empenho', fundamento: 'entrega_imediata', quantidadePedidos: 4,
    });
    expect(aviso).toMatch(/4 pedidos/);
    expect(aviso).toMatch(/art\. 95/);
  });

  it('valor de dispensa não é hipótese de entrega única — não avisa por parcelamento', () => {
    // O limite ali é de VALOR; parcelar não contradiz a hipótese.
    expect(avisoDeExecucaoIncompativel({
      formaExecucao: 'empenho', fundamento: 'valor_dispensa', quantidadePedidos: 5,
    })).toBeNull();
  });

  it('registro antigo, sem declaração, não gera alarme', () => {
    expect(avisoDeExecucaoIncompativel({
      formaExecucao: null, fundamento: null, quantidadePedidos: 12,
    })).toBeNull();
  });
});
