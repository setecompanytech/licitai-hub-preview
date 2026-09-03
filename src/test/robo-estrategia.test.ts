import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import { ESTRATEGIA_FILES } from '@/lib/agent-template/estrategia';

/**
 * A decisão de preço do robô, exercitada a partir do MESMO texto que vai para o
 * ZIP do agente — não de uma reescrita em TypeScript. Testar uma cópia provaria
 * que a cópia funciona.
 *
 * A auditoria de 02/09/2026 achou aqui o defeito mais caro do sistema: o robô
 * lia "o melhor lance da sessão", que quando lideramos é o NOSSO, e o cobria.
 * Sem concorrente nenhum, descia o próprio preço até o piso.
 */

type Decisao = { acao: 'lance' | 'aguardar' | 'encerrar'; valor: number | null; motivo: string };
let decidirLance: (estado: Record<string, unknown>) => Decisao;

beforeAll(() => {
  const codigo = ESTRATEGIA_FILES['src/estrategia.js'];
  const module = { exports: {} as { decidirLance: typeof decidirLance } };
  new vm.Script(codigo, { filename: 'estrategia.js' }).runInNewContext({ module, exports: module.exports });
  decidirLance = module.exports.decidirLance;
});

/** Disputa saudável: lideramos não, há concorrente à frente, longe do piso. */
function cenario(over: Record<string, unknown> = {}) {
  return {
    valorAtual: 100,
    valorMinimo: 50,
    melhorLance: 90,
    souLider: false,
    decrementoMin: 5,
    decrementoPercentual: 1,
    rodada: 1,
    maxLances: 20,
    ...over,
  };
}

describe('decidirLance', () => {
  it('cobre o lance do concorrente com o decremento configurado', () => {
    const d = decidirLance(cenario());
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(85); // 90 − 5
  });

  it('NÃO cobre o próprio lance quando já estamos liderando', () => {
    // O defeito da auditoria. Liderando, o melhor lance da sessão é o nosso;
    // cobri-lo baixa o preço sozinho até o piso, sem concorrente nenhum.
    const d = decidirLance(cenario({ souLider: true, melhorLance: 90, valorAtual: 90 }));
    expect(d.acao).toBe('aguardar');
    expect(d.valor).toBeNull();
    expect(d.motivo).toMatch(/liderando/i);
  });

  it('não dá lance quando a leitura do portal falha', () => {
    // Antes caía em `melhorLance || valorAtual` e dava lance às cegas.
    for (const leitura of [null, undefined, NaN]) {
      const d = decidirLance(cenario({ melhorLance: leitura }));
      expect(d.acao).toBe('aguardar');
      expect(d.valor).toBeNull();
    }
  });

  it('não dá lance quando o portal não diz quem lidera', () => {
    // `souLider` desconhecido é diferente de false: sem saber, a guarda de
    // liderança perde o efeito e o robô voltaria a poder cobrir a si mesmo.
    for (const lider of [null, undefined]) {
      const d = decidirLance(cenario({ souLider: lider }));
      expect(d.acao).toBe('aguardar');
      expect(d.motivo).toMatch(/liderando/i);
    }
  });

  it('encerra ao alcançar o piso, e nunca dá lance nele', () => {
    const d = decidirLance(cenario({ melhorLance: 54, valorMinimo: 50, decrementoMin: 5 }));
    expect(d.acao).toBe('encerrar');
    expect(d.motivo).toMatch(/piso/i);
  });

  it('nunca devolve valor abaixo do piso, em nenhuma combinação', () => {
    for (const melhor of [51, 55, 60, 80, 200]) {
      for (const dec of [1, 5, 25, 100]) {
        const d = decidirLance(cenario({ melhorLance: melhor, valorMinimo: 50, decrementoMin: dec }));
        if (d.acao === 'lance') expect(d.valor!).toBeGreaterThan(50);
      }
    }
  });

  it('encerra ao atingir o teto de lances', () => {
    const d = decidirLance(cenario({ rodada: 20, maxLances: 20 }));
    expect(d.acao).toBe('encerrar');
    expect(d.motivo).toMatch(/teto/i);
  });

  it('aguarda quando o melhor lance não é melhor que o nosso', () => {
    const d = decidirLance(cenario({ melhorLance: 110, valorAtual: 100 }));
    expect(d.acao).toBe('aguardar');
  });

  it('usa o decremento percentual sobre o lance do concorrente, não sobre o nosso', () => {
    // O código antigo calculava a porcentagem sobre `valor_atual`, o que dava um
    // passo maior ou menor que o pretendido conforme a distância do concorrente.
    const d = decidirLance(cenario({ melhorLance: 200, valorAtual: 400, decrementoMin: 0, decrementoPercentual: 10 }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(180); // 200 − 10% de 200
  });

  it('aguarda quando nenhum decremento válido foi configurado', () => {
    // Zero explícito não vira 1% por conta própria: quem configurou zero não
    // disse de quanto descer, e inventar o passo é decidir preço no chute.
    for (const cfg of [
      { decrementoMin: 0, decrementoPercentual: 0 },
      { decrementoMin: undefined, decrementoPercentual: undefined },
      { decrementoMin: -5, decrementoPercentual: 0 },
    ]) {
      const d = decidirLance(cenario(cfg));
      expect(d.acao).toBe('aguardar');
      expect(d.motivo).toMatch(/decremento/i);
    }
  });

  it('arredonda para centavos — portal recusa fração de centavo', () => {
    const d = decidirLance(
      cenario({ valorAtual: 120, melhorLance: 100, decrementoMin: 0, decrementoPercentual: 3.333 }),
    );
    expect(d.acao).toBe('lance');
    expect(String(d.valor)).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(d.valor).toBe(96.67); // 100 − 3,333
  });

  it('toda decisão vem com motivo legível', () => {
    const casos = [
      cenario(),
      cenario({ souLider: true }),
      cenario({ melhorLance: null }),
      cenario({ rodada: 99 }),
      cenario({ melhorLance: 51, valorMinimo: 50 }),
    ];
    for (const c of casos) {
      const d = decidirLance(c);
      expect(d.motivo.length).toBeGreaterThan(10);
    }
  });
});
