import { describe, it, expect } from 'vitest';
import { normalizarChaveNfe, chaveNfeSuspeita } from '@/lib/financeiro/chave-nfe';
import { explicarErroDoBanco, restricaoViolada, mensagemDeErro } from '@/lib/financeiro/erro-do-banco';

/**
 * O caso real: uma NF-e da SEDUC de carne moída, lida de PDF por IA. A leitura
 * devolveu o número da nota no lugar da chave, e o INSERT foi recusado com
 * `violates check constraint "chk_fl_chave_nfe_44"` na cara de quem só queria
 * lançar o recebimento.
 */

const CHAVE_44  = '3524061234567800019955001000000692112345678'.padEnd(44, '0');
const TRUNCADA  = CHAVE_44.slice(0, 43);

describe('chave de acesso da NF-e', () => {
  it('aceita 44 dígitos', () => {
    expect(CHAVE_44).toHaveLength(44);
    expect(normalizarChaveNfe(CHAVE_44)).toBe(CHAVE_44);
  });

  it('aceita chave com separadores e devolve só os dígitos', () => {
    const comEspacos = CHAVE_44.replace(/(\d{4})/g, '$1 ').trim();
    expect(normalizarChaveNfe(comEspacos)).toBe(CHAVE_44);
  });

  it('recusa o número da nota, que foi o erro real', () => {
    expect(normalizarChaveNfe('000.000.692')).toBeNull();
    expect(normalizarChaveNfe('692')).toBeNull();
  });

  it('recusa chave truncada — 43 dígitos não é chave', () => {
    expect(TRUNCADA).toHaveLength(43);
    expect(normalizarChaveNfe(TRUNCADA)).toBeNull();
    expect(normalizarChaveNfe(CHAVE_44 + '0')).toBeNull();  // 45 também não é chave
  });

  it('recusa vazio, nulo e texto', () => {
    for (const v of [null, undefined, '', '   ', 'sem chave', 'N/A']) {
      expect(normalizarChaveNfe(v), String(v)).toBeNull();
    }
  });

  it('sinaliza suspeita só quando havia algo que não era chave', () => {
    expect(chaveNfeSuspeita('000.000.692')).toBe(true);
    expect(chaveNfeSuspeita(CHAVE_44)).toBe(false);   // é chave: não é suspeita
    expect(chaveNfeSuspeita(null)).toBe(false);       // não veio nada: nada a dizer
    expect(chaveNfeSuspeita('sem chave')).toBe(false); // zero dígitos: nada a dizer
  });
});

describe('o que o banco recusou, em português', () => {
  const cru = 'new row for relation "financeiro_lancamentos" violates check constraint "chk_fl_chave_nfe_44"';

  it('extrai o nome da restrição', () => {
    expect(restricaoViolada(cru)).toBe('chk_fl_chave_nfe_44');
    expect(restricaoViolada('erro qualquer')).toBeNull();
  });

  it('traduz a restrição da chave — o erro que o dono do produto viu', () => {
    const texto = explicarErroDoBanco({ message: cru });
    expect(texto).toContain('44 dígitos');
    expect(texto).not.toContain('chk_fl_chave_nfe_44');
  });

  it('traduz as invariantes criadas em 25/08', () => {
    for (const c of [
      'chk_transferencia_tem_destino',
      'chk_destino_so_em_transferencia',
      'chk_transferencia_contas_distintas',
      'chk_realizado_tem_data',
      'chk_vencimento_plausivel',
      'chk_competencia_plausivel',
    ]) {
      const m = explicarErroDoBanco({ message: `violates check constraint "${c}"` });
      expect(m, c).toBeTruthy();
      expect(m, c).not.toContain('chk_');
    }
  });

  it('traduz os erros genéricos que mais aparecem', () => {
    expect(explicarErroDoBanco({ message: 'numeric field overflow' })).toContain('não cabe');
    expect(explicarErroDoBanco({ message: 'duplicate key value violates unique constraint "x"' })).toContain('duplicidade');
    expect(explicarErroDoBanco({ message: 'null value in column "valor" violates not-null constraint' })).toContain('valor');
  });

  it('devolve null quando não sabe — inventar seria pior que a mensagem crua', () => {
    expect(explicarErroDoBanco({ message: 'connection reset by peer' })).toBeNull();
    expect(explicarErroDoBanco(null)).toBeNull();
    expect(explicarErroDoBanco({ message: '' })).toBeNull();
  });

  it('mensagemDeErro cai para o texto original quando não há tradução', () => {
    expect(mensagemDeErro({ message: 'connection reset by peer' })).toBe('connection reset by peer');
    expect(mensagemDeErro({ message: cru })).toContain('44 dígitos');
    expect(mensagemDeErro(null, 'padrão')).toBe('padrão');
  });
});
