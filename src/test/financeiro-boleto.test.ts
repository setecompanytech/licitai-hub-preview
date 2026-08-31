import { describe, it, expect } from 'vitest';
import {
  moduloDez, moduloOnzeBarras, dataDoFator,
  lerLinhaDigitavel, acharLinhaDigitavel,
} from '@/lib/financeiro/boleto';

/**
 * Linhas montadas a partir dos campos, com os DVs calculados — não copiadas de
 * um boleto real. Assim o próprio teste prova o cálculo, e não há dado de
 * terceiro no repositório.
 */
const BANCARIO = '34191234546789012345767890123457514660000035062'; // Itaú, fator 1466, R$ 350,62
const ANTIGO   = '00191234546789012345767890123457995000000100000'; // fator 9500, R$ 1.000,00
const SEM_VALOR = '23791234546789012345767890123457414660000000000';

describe('moduloDez', () => {
  it('soma os DÍGITOS do produto quando ele passa de 9', () => {
    // 7×2 = 14 → 1+4 = 5 → resto 5 → DV 5. Somar 14 direto daria DV 6, que é
    // o erro clássico deste algoritmo.
    expect(moduloDez('7')).toBe(5);
  });

  it('fecha os três campos da linha bancária', () => {
    expect(moduloDez(BANCARIO.slice(0, 9))).toBe(Number(BANCARIO[9]));
    expect(moduloDez(BANCARIO.slice(10, 20))).toBe(Number(BANCARIO[20]));
    expect(moduloDez(BANCARIO.slice(21, 31))).toBe(Number(BANCARIO[31]));
  });

  it('vazio não tem DV', () => {
    expect(moduloDez('')).toBeNull();
  });
});

describe('moduloOnzeBarras', () => {
  it('exige exatamente 43 dígitos', () => {
    expect(moduloOnzeBarras('123')).toBeNull();
    expect(moduloOnzeBarras('1'.repeat(44))).toBeNull();
  });

  it('resto que produziria 0, 10 ou 11 vira 1 — regra da FEBRABAN', () => {
    // Ignorar essa regra recusa boletos válidos.
    const dv = moduloOnzeBarras('0'.repeat(43));
    expect(dv).toBe(1);
  });
});

describe('dataDoFator — o estouro de 22/02/2025', () => {
  it('as âncoras conhecidas do primeiro ciclo', () => {
    // Fator 1000 = 03/07/2000 e fator 9999 = 21/02/2025 são datas publicadas.
    // Elas fixam que 07/10/1997 é o DIA ZERO, não o fator 1000 — errar isso
    // desloca todo o cálculo em anos, e foi o que a primeira versão fez.
    expect(dataDoFator(1000, '2000-01-01')).toBe('2000-07-03');
    expect(dataDoFator(9999, '2024-06-01')).toBe('2025-02-21');
  });

  it('fator baixo lido em 2026 é do ciclo NOVO, não de 2000', () => {
    // Muito sistema em produção ignora o estouro e devolve 2000 aqui.
    expect(dataDoFator(1000, '2026-08-31')).toBe('2025-02-22');
    expect(dataDoFator(1466, '2026-08-31')).toBe('2026-06-03');
  });

  it('fator alto lido em 2026 é boleto ANTIGO, do ciclo velho', () => {
    // 9500 no ciclo 2 cairia em 2048; no ciclo 1, em 2023. A proximidade
    // escolhe sozinha, e escolhe certo.
    expect(dataDoFator(9500, '2026-08-31')).toBe('2023-10-11');
  });

  it('fator fora da faixa não é vencimento', () => {
    expect(dataDoFator(0, '2026-08-31')).toBeNull();
    expect(dataDoFator(999, '2026-08-31')).toBeNull();
    expect(dataDoFator(10000, '2026-08-31')).toBeNull();
  });
});

describe('lerLinhaDigitavel — bancário', () => {
  it('devolve valor, vencimento e banco', () => {
    const b = lerLinhaDigitavel(BANCARIO, '2026-08-31')!;
    expect(b.formato).toBe('bancario');
    expect(b.valor).toBe(350.62);
    expect(b.vencimento).toBe('2026-06-03');
    expect(b.banco).toBe('341');
  });

  it('aceita a linha escrita como o papel imprime', () => {
    const comoNoPapel = '34191.23454 67890.123457 67890.123457 5 14660000035062';
    expect(lerLinhaDigitavel(comoNoPapel, '2026-08-31')?.valor).toBe(350.62);
  });

  it('um dígito trocado derruba — é o ponto do DV', () => {
    const trocado = BANCARIO.slice(0, 5) + '9' + BANCARIO.slice(6);
    expect(lerLinhaDigitavel(trocado, '2026-08-31')).toBeNull();
  });

  it('valor zerado é "a combinar", não R$ 0,00', () => {
    // Preencher zero apagaria o valor que já está no lançamento.
    expect(lerLinhaDigitavel(SEM_VALOR, '2026-08-31')?.valor).toBeNull();
  });

  it('comprimento errado não é linha digitável', () => {
    expect(lerLinhaDigitavel(BANCARIO.slice(0, 46), '2026-08-31')).toBeNull();
    expect(lerLinhaDigitavel('', '2026-08-31')).toBeNull();
  });

  it('boleto antigo lê o vencimento no ciclo certo', () => {
    const b = lerLinhaDigitavel(ANTIGO, '2026-08-31')!;
    expect(b.valor).toBe(1000);
    expect(b.vencimento).toBe('2023-10-11');
  });
});

describe('acharLinhaDigitavel', () => {
  it('acha no meio do texto do boleto', () => {
    const texto = `Banco Itaú S.A.\nLocal de pagamento: qualquer banco\n`
      + `${BANCARIO.replace(/(\d{5})(?=\d)/g, '$1 ')}\n`
      + `Beneficiário: EMPRESA LTDA  CNPJ 12.345.678/0001-99`;
    expect(acharLinhaDigitavel(texto, '2026-08-31')?.valor).toBe(350.62);
  });

  it('separa a linha dos outros números da página', () => {
    const texto = `CNPJ 12.345.678/0001-99 AGENCIA 1234 CONTA 56789-0 `
      + `LINHA ${BANCARIO} NOSSO NUMERO 12345678901234567`;
    expect(acharLinhaDigitavel(texto, '2026-08-31')?.linha).toBe(BANCARIO);
  });

  it('texto sem linha devolve null, e não um palpite', () => {
    expect(acharLinhaDigitavel('BOLETO VENCIMENTO 10/09/2026 VALOR 350,62', '2026-08-31')).toBeNull();
    expect(acharLinhaDigitavel('', '2026-08-31')).toBeNull();
  });

  it('número comprido que não fecha DV não passa', () => {
    expect(acharLinhaDigitavel('9'.repeat(60), '2026-08-31')).toBeNull();
  });
});
