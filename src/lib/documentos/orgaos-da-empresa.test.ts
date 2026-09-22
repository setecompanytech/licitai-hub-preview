import { describe, expect, it } from 'vitest';
import {
  dadosDoOrgao, linhaDoOrgao, normalizarSite, orgaoDaLinha, orgaosDasLinhas, validarOrgao, type LinhaDeOrgao,
} from './orgaos-da-empresa';

const linha: LinhaDeOrgao = {
  id: 'o1',
  empresa_id: 'e1',
  esfera: 'municipal',
  uf: 'PA',
  municipio: 'Cumaru do Norte',
  nome_orgao: 'Prefeitura Municipal de Cumaru do Norte · Setor de Tributos',
  site: 'https://cumarudonorte.pa.gov.br/certidoes',
  email: 'tributos@cumarudonorte.pa.gov.br',
  instrucoes: null,
  validade_dias: 90,
  user_id: 'u1',
  created_at: '2026-09-23T12:00:00Z',
  updated_at: '2026-09-23T12:00:00Z',
};

describe('órgão cadastrado pela empresa — linha, formulário e validação', () => {
  it('a linha gravada vira o órgão que o catálogo entende; outra esfera é ignorada', () => {
    expect(orgaoDaLinha(linha)).toEqual({
      id: 'o1', esfera: 'municipal', uf: 'PA', municipio: 'Cumaru do Norte',
      nomeDoOrgao: 'Prefeitura Municipal de Cumaru do Norte · Setor de Tributos',
      site: 'https://cumarudonorte.pa.gov.br/certidoes', email: 'tributos@cumarudonorte.pa.gov.br',
      instrucoes: null, validadeDias: 90,
    });
    expect(orgaoDaLinha({ ...linha, esfera: 'estadual' })).toBeNull();
    expect(orgaosDasLinhas([linha, { ...linha, id: 'o2', esfera: 'estadual' }])).toHaveLength(1);
  });

  it('o site ganha https:// quando vem sem esquema, e fica como está quando vem com', () => {
    expect(normalizarSite('cumarudonorte.pa.gov.br/certidoes')).toBe('https://cumarudonorte.pa.gov.br/certidoes');
    expect(normalizarSite('http://prefeitura.local/cnd')).toBe('http://prefeitura.local/cnd');
    expect(normalizarSite('   ')).toBeNull();
    expect(normalizarSite(undefined)).toBeNull();
  });

  it('o mínimo é o nome e UM canal (site ou e-mail)', () => {
    expect(validarOrgao({ nomeDoOrgao: 'Prefeitura de X', site: 'x.pa.gov.br' })).toEqual([]);
    expect(validarOrgao({ nomeDoOrgao: 'Prefeitura de X', email: 'tributos@x.pa.gov.br' })).toEqual([]);
    const semCanal = validarOrgao({ nomeDoOrgao: 'Prefeitura de X' });
    expect(semCanal).toHaveLength(1);
    expect(semCanal[0]).toMatch(/ao menos um canal/);
  });

  it('recusa nome vazio, site torto, e-mail torto e validade fora da faixa, dizendo por quê', () => {
    const erros = validarOrgao({ nomeDoOrgao: ' ', site: 'sem-ponto', email: 'tributos@', validadeDias: '0' });
    expect(erros).toHaveLength(4);
    expect(erros.join(' ')).toMatch(/nome do órgão/);
    expect(erros.join(' ')).toMatch(/site/);
    expect(erros.join(' ')).toMatch(/e-mail/);
    expect(erros.join(' ')).toMatch(/1 a 3650/);
    expect(validarOrgao({ nomeDoOrgao: 'x', site: 'x.gov.br', validadeDias: '30,5' })).toHaveLength(1);
    expect(validarOrgao({ nomeDoOrgao: 'x', site: 'x.gov.br', validadeDias: '9999' })).toHaveLength(1);
    expect(validarOrgao({ nomeDoOrgao: 'x', site: 'x.gov.br', validadeDias: '90' })).toEqual([]);
  });

  it('a linha sai limpa: UF em caixa alta, esfera municipal, vazio vira nulo, dias vira número', () => {
    const l = linhaDoOrgao(
      { nomeDoOrgao: '  Prefeitura de X ', site: 'x.pa.gov.br/cnd', email: '', instrucoes: '  ', validadeDias: ' 60 ' },
      { empresaId: 'e1', userId: 'u1', uf: 'pa', municipio: ' Cumaru do Norte ' },
    );
    expect(l).toEqual({
      empresa_id: 'e1',
      user_id: 'u1',
      esfera: 'municipal',
      uf: 'PA',
      municipio: 'Cumaru do Norte',
      nome_orgao: 'Prefeitura de X',
      site: 'https://x.pa.gov.br/cnd',
      email: null,
      instrucoes: null,
      validade_dias: 60,
    });
    expect(linhaDoOrgao({ nomeDoOrgao: 'x', email: 'a@b.co' }, { empresaId: 'e1', userId: 'u1', uf: 'PA', municipio: 'Y' }).validade_dias).toBeNull();
  });

  it('o cadastro existente volta ao formulário como texto, para corrigir', () => {
    const o = orgaoDaLinha(linha);
    expect(o && dadosDoOrgao(o)).toEqual({
      nomeDoOrgao: 'Prefeitura Municipal de Cumaru do Norte · Setor de Tributos',
      site: 'https://cumarudonorte.pa.gov.br/certidoes',
      email: 'tributos@cumarudonorte.pa.gov.br',
      instrucoes: '',
      validadeDias: '90',
    });
  });
});
