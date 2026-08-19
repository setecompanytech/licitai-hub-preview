import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTOS, SEQUENCIA, LIMITES_ADITIVO, VIGENCIA_ATA, instrumentoDoTipo,
  avisoDeExecucaoIncompativel, naturezaDoTipo, NATUREZA_DO_VALOR,
  avisoDePreclusao, avisoDeVigencia,
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

describe('reajuste × revisão', () => {
  it('classifica cada tipo de aditivo pela natureza certa', () => {
    expect(naturezaDoTipo('reajuste')).toBe('reajuste');
    expect(naturezaDoTipo('repactuacao')).toBe('reajuste');
    expect(naturezaDoTipo('reequilibrio')).toBe('revisao');
    expect(naturezaDoTipo('revisao')).toBe('revisao');
    // Acréscimo de valor não é nem um nem outro — sujeita-se ao teto do art. 125.
    expect(naturezaDoTipo('valor')).toBeNull();
    expect(naturezaDoTipo('prazo')).toBeNull();
  });

  it('a revisão exige o que o reajuste não exige', () => {
    const rev = NATUREZA_DO_VALOR.revisao.exige.join(' ');
    expect(rev).toMatch(/imprevisível/);
    expect(rev).toMatch(/APÓS a apresentação da proposta/);
    expect(rev).toMatch(/culpa/);
    expect(NATUREZA_DO_VALOR.reajuste.exige.join(' ')).toMatch(/Índice/);
  });
});

describe('preclusão lógica do reequilíbrio', () => {
  const fato = '2026-03-10';

  it('avisa quando há prorrogação sem ressalva depois do fato gerador', () => {
    const aviso = avisoDePreclusao({
      dataFatoGerador: fato,
      prorrogacoes: [{ data_assinatura: '2026-05-02', com_ressalva: false }],
    });
    expect(aviso).toMatch(/02\/05\/2026/);
    expect(aviso).toMatch(/renúncia/);
  });

  it('prorrogação COM ressalva não gera aviso — a ressalva preserva o direito', () => {
    expect(avisoDePreclusao({
      dataFatoGerador: fato,
      prorrogacoes: [{ data_assinatura: '2026-05-02', com_ressalva: true }],
    })).toBeNull();
  });

  it('prorrogação anterior ao fato gerador é irrelevante', () => {
    expect(avisoDePreclusao({
      dataFatoGerador: fato,
      prorrogacoes: [{ data_assinatura: '2026-01-15', com_ressalva: false }],
    })).toBeNull();
  });

  it('sem data do fato gerador não há o que cruzar', () => {
    expect(avisoDePreclusao({
      dataFatoGerador: null,
      prorrogacoes: [{ data_assinatura: '2026-05-02', com_ressalva: false }],
    })).toBeNull();
  });
});

describe('vigência por espécie do objeto', () => {
  it('dez anos cabem em serviço contínuo, não em compra imediata', () => {
    expect(avisoDeVigencia('servico_continuo', 120)).toBeNull();
    expect(avisoDeVigencia('compra_entrega_imediata', 120)).toMatch(/ultrapassa/);
  });

  it('informática tem teto de quatro anos', () => {
    expect(avisoDeVigencia('informatica', 48)).toBeNull();
    expect(avisoDeVigencia('informatica', 60)).toMatch(/art\. 109/);
  });

  it('espécie não declarada não gera aviso', () => {
    expect(avisoDeVigencia(null, 200)).toBeNull();
  });
});
