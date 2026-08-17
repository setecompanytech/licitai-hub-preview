import { describe, it, expect } from 'vitest';
import {
  avaliarCertidoes, diasAte, situacaoDe, podeEnviar, nomeDeArquivo,
  CERTIDOES_DO_FATURAMENTO,
} from '../certidoes';

const HOJE = new Date(2026, 7, 17); // 17/08/2026
const doc = (nome: string, validade: string | null, path: string | null = 'x/y.pdf') =>
  ({ id: nome, nome, validade, arquivo_path: path });

describe('validade da certidão', () => {
  it('conta os dias sem deixar o fuso empurrar a data', () => {
    expect(diasAte('2026-08-17', HOJE)).toBe(0);
    expect(diasAte('2026-08-24', HOJE)).toBe(7);
    expect(diasAte('2026-08-14', HOJE)).toBe(-3);
  });

  it('vencida ontem é vencida; vencendo hoje ainda vale, com aviso', () => {
    expect(situacaoDe(doc('a', '2026-08-16'), HOJE)).toBe('vencida');
    expect(situacaoDe(doc('a', '2026-08-17'), HOJE)).toBe('vence_em_breve');
    expect(situacaoDe(doc('a', '2026-09-30'), HOJE)).toBe('valida');
  });

  it('sem data não é tratada como válida nem como vencida', () => {
    // Afirmar "válida" esconderia o risco; "vencida" barraria à toa.
    expect(situacaoDe(doc('a', null), HOJE)).toBe('sem_validade');
  });

  it('cadastro sem arquivo é ausente — não há o que anexar', () => {
    expect(situacaoDe(doc('a', '2026-12-31', null), HOJE)).toBe('ausente');
    expect(situacaoDe(null, HOJE)).toBe('ausente');
  });
});

describe('montagem do pacote', () => {
  it('devolve uma linha por certidão esperada, mesmo sem cadastro', () => {
    const linhas = avaliarCertidoes([doc(CERTIDOES_DO_FATURAMENTO[0], '2026-12-31')], HOJE);
    expect(linhas).toHaveLength(CERTIDOES_DO_FATURAMENTO.length);
    expect(linhas[0].situacao).toBe('valida');
    expect(linhas[1].situacao).toBe('ausente');
  });

  it('casa o documento ignorando caixa e espaços em volta', () => {
    const nome = `  ${CERTIDOES_DO_FATURAMENTO[1].toUpperCase()}  `;
    expect(avaliarCertidoes([doc(nome, '2026-12-31')], HOJE)[1].situacao).toBe('valida');
  });

  it('vencida fica de fora do envio; o resto entra', () => {
    const linhas = avaliarCertidoes(
      [doc(CERTIDOES_DO_FATURAMENTO[0], '2026-08-01'), doc(CERTIDOES_DO_FATURAMENTO[1], '2026-12-31')],
      HOJE,
    );
    expect(podeEnviar(linhas[0])).toBe(false);
    expect(podeEnviar(linhas[1])).toBe(true);
  });
});

describe('nome do arquivo', () => {
  it('sai legível, sem acento e preservando a extensão', () => {
    expect(nomeDeArquivo('CNDT – Certidão Trabalhista', 'a/b/uuid.pdf'))
      .toBe('CNDT-Certidao-Trabalhista.pdf');
  });
});
