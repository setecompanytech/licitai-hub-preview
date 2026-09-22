import { describe, it, expect } from 'vitest';
import {
  coberturaDoContrato, fraseDaCobertura, parteSugerida, quemLancouPrimeiro, ROTULO_SITUACAO,
  situacaoDoCusto, sobraDoTitulo, textoDoDesvio, toleranciaEmReais, TOLERANCIA_PADRAO,
} from '../cobertura-de-custo';

/** Os números do estudo de 22/09: 80.000 kg × R$ 15,00 declarados no pedido. */
const declarado = 1_200_000;

describe('a régua do cruzamento (mesma conta de situacao_do_custo no banco)', () => {
  it('tolerância é o maior entre o percentual e o valor', () => {
    expect(toleranciaEmReais(declarado)).toBe(6_000);          // 0,5% de 1,2 mi
    expect(toleranciaEmReais(1_000)).toBe(50);                 // 0,5% = 5, vale os R$ 50
    expect(toleranciaEmReais(declarado, { pct: 0, valor: 0 })).toBe(0);
    expect(TOLERANCIA_PADRAO).toEqual({ pct: 0.5, valor: 50 });
  });

  it('as seis situações', () => {
    expect(situacaoDoCusto({ declarado: 0, pago: 0, aberto: 0 })).toBe('sem_custo');
    expect(situacaoDoCusto({ declarado, pago: 0, aberto: 0 })).toBe('declarado');
    expect(situacaoDoCusto({ declarado: 0, pago: 262_500, aberto: 0 })).toBe('documentado');
    expect(situacaoDoCusto({ declarado, pago: 600_000, aberto: 0 })).toBe('parcial');
    expect(situacaoDoCusto({ declarado, pago: 1_200_000, aberto: 0 })).toBe('conferido');
    expect(situacaoDoCusto({ declarado, pago: 1_000_000, aberto: 300_000 })).toBe('divergente');
  });

  it('o comprometido (em aberto) conta como comprovado; a tolerância decide a borda', () => {
    expect(situacaoDoCusto({ declarado, pago: 0, aberto: 1_195_000 })).toBe('conferido');   // −5.000 ≤ 6.000
    expect(situacaoDoCusto({ declarado, pago: 0, aberto: 1_193_000 })).toBe('parcial');     // −7.000 > 6.000
    expect(situacaoDoCusto({ declarado, pago: 1_206_000, aberto: 0 })).toBe('conferido');   // +6.000 na borda
    expect(situacaoDoCusto({ declarado, pago: 1_206_001, aberto: 0 })).toBe('divergente');
    expect(situacaoDoCusto({ declarado, pago: 1_250_000, aberto: 0 }, { pct: 5, valor: 0 })).toBe('conferido');
  });

  it('quem lançou primeiro recebe o aviso de "casou"', () => {
    expect(quemLancouPrimeiro('2026-09-22T10:00:00Z', '2026-09-23T10:00:00Z')).toBe('comercial');
    expect(quemLancouPrimeiro('2026-09-24T10:00:00Z', '2026-09-23T10:00:00Z')).toBe('financeiro');
    expect(quemLancouPrimeiro(null, '2026-09-23T10:00:00Z')).toBe('financeiro');
    expect(quemLancouPrimeiro('2026-09-23T10:00:00Z', null)).toBe('comercial');
    expect(quemLancouPrimeiro(null, null)).toBeNull();
  });

  it('cada situação tem rótulo, tom e explicação em português de tela', () => {
    for (const s of Object.values(ROTULO_SITUACAO)) {
      expect(s.rotulo.length).toBeGreaterThan(2);
      expect(s.explicacao).not.toMatch(/API|RPC|null/i);
    }
    expect(ROTULO_SITUACAO.documentado.rotulo).toBe('Sem declaração');
    expect(fraseDaCobertura({ declarado, pago: 600_000, aberto: 0 })).toContain('faltam R$');
    expect(fraseDaCobertura({ declarado, pago: 1_300_000, aberto: 0 })).toContain('diferença R$');
    expect(fraseDaCobertura({ declarado, pago: 1_000_000, aberto: 200_000 })).toContain('ainda a pagar');
  });
});

describe('a cobertura do contrato e o texto do desvio', () => {
  it('cobertura = contas a pagar do contrato sobre o declarado; a distribuir = o que ainda não chegou a pedido', () => {
    const c = coberturaDoContrato({
      declarado: 2_000_000, comprovadoPago: 500_000, comprovadoAberto: 0,
      doContratoPago: 1_200_000, doContratoAberto: 300_000, pedidosTotal: 2, pedidosSemCusto: 0,
    });
    expect(c.pct).toBe(75);
    expect(c.semDocumento).toBe(500_000);
    expect(c.aDistribuir).toBe(1_000_000);
    expect(c.incompleta).toBe(true);
  });

  it('sem declaração a cobertura não existe, e pedido sem custo deixa o custo incompleto', () => {
    const c = coberturaDoContrato({
      declarado: 0, comprovadoPago: 0, comprovadoAberto: 0,
      doContratoPago: 4_699_166.98, doContratoAberto: 140_160, pedidosTotal: 10, pedidosSemCusto: 10,
    });
    expect(c.pct).toBeNull();
    expect(c.semDocumento).toBe(0);
    expect(c.incompleta).toBe(true);
    const ok = coberturaDoContrato({
      declarado: 1_200_000, comprovadoPago: 1_200_000, comprovadoAberto: 0,
      doContratoPago: 1_200_000, doContratoAberto: 0, pedidosTotal: 1, pedidosSemCusto: 0,
    });
    expect(ok).toEqual({ pct: 100, semDocumento: 0, aDistribuir: 0, incompleta: false });
  });

  it('"economia" só quando a cobertura fecha (decisão 17)', () => {
    expect(textoDoDesvio(-40, true, 63.4)).toBe('custo incompleto — cobertura de 63,4%');
    expect(textoDoDesvio(-40, true, null)).toBe('custo incompleto — há pedidos sem custo');
    expect(textoDoDesvio(-40, false, 100)).toBe('40.0% abaixo do previsto (economia)');
    expect(textoDoDesvio(12.3, true, 50)).toBe('12.3% acima do previsto (estouro)');
    expect(textoDoDesvio(0.01, false, 100)).toBe('no previsto');
    expect(textoDoDesvio(null, true, null)).toBe('');
  });
});

describe('a parte sugerida ao atribuir uma compra a um pedido', () => {
  it('sobra do título, limitada ao que o pedido ainda não comprovou', () => {
    expect(sobraDoTitulo({ valor: 730_000, jaRateado: 200_000 })).toBe(530_000);
    expect(parteSugerida({ valor: 730_000, jaRateado: 0 }, { declarado: 1_400_157.5, comprovado: 1_312_570 })).toBe(87_587.5);
    expect(parteSugerida({ valor: 262_500, jaRateado: 0 }, { declarado: 1_200_000, comprovado: 0 })).toBe(262_500);
  });
  it('sem declaração, a sobra inteira — o cruzamento dirá "sem declaração"', () => {
    expect(parteSugerida({ valor: 262_500, jaRateado: 62_500 }, { declarado: 0, comprovado: 0 })).toBe(200_000);
    expect(parteSugerida({ valor: 100, jaRateado: 100 }, { declarado: 0, comprovado: 0 })).toBe(0);
  });
});
