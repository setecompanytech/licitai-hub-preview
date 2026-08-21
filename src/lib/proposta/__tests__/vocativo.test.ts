import { describe, it, expect } from 'vitest';
import {
  vocativoDoOrgao, generoDoOrgao, modalidadePorExtenso,
  referenciaDoCertame, linhaDoProcessoAdministrativo,
} from '../vocativo';

describe('vocativo do órgão', () => {
  it('masculino pede "Ao" — o caso que estava errado na tela', () => {
    expect(vocativoDoOrgao('TRIBUNAL SUPERIOR ELEITORAL')).toBe('Ao');
    expect(vocativoDoOrgao('MINISTÉRIO DA SAÚDE')).toBe('Ao');
    expect(vocativoDoOrgao('INSTITUTO FEDERAL DO PARÁ')).toBe('Ao');
  });

  it('feminino pede "À", com crase', () => {
    expect(vocativoDoOrgao('PREFEITURA MUNICIPAL DE BELÉM')).toBe('À');
    expect(vocativoDoOrgao('SECRETARIA DE EDUCAÇÃO')).toBe('À');
    expect(vocativoDoOrgao('FUNDAÇÃO SANTA CASA DE MISERICÓRDIA DO PARÁ')).toBe('À');
    expect(vocativoDoOrgao('UNIVERSIDADE FEDERAL DO PARÁ')).toBe('À');
  });

  it('plural concorda em número', () => {
    expect(vocativoDoOrgao('CORREIOS')).toBe('Aos');
    expect(vocativoDoOrgao('SECRETARIAS DE ESTADO')).toBe('Às');
  });

  it('acento e caixa não atrapalham o reconhecimento', () => {
    expect(generoDoOrgao('Fundação X').feminino).toBe(true);
    expect(generoDoOrgao('MUNICÍPIO DE ITAOCA').feminino).toBe(false);
  });

  it('órgão não reconhecido cai no masculino, não em erro visível', () => {
    // "A Xyz" seria erro claro de concordância; "Ao Xyz" apenas soa neutro.
    expect(vocativoDoOrgao('XYZ COMPRAS PÚBLICAS')).toBe('Ao');
    expect(vocativoDoOrgao('')).toBe('Ao');
    expect(vocativoDoOrgao(null)).toBe('Ao');
  });
});

describe('referência do certame', () => {
  it('usa o nome do certame, não o rótulo do cadastro', () => {
    expect(modalidadePorExtenso('Pregão - Eletrônico')).toBe('PREGÃO ELETRÔNICO');
    expect(referenciaDoCertame({ numero: '87', modalidade: 'Pregão - Eletrônico', ano: 2026 }))
      .toBe('PREGÃO ELETRÔNICO Nº 87/2026');
  });

  it('número que já traz o ano não recebe outro', () => {
    expect(referenciaDoCertame({ numero: '87/2026', modalidade: 'Pregão - Eletrônico', ano: 2026 }))
      .toBe('PREGÃO ELETRÔNICO Nº 87/2026');
  });

  it('sem ano conhecido, sai sem ano — melhor que sair com um errado', () => {
    expect(referenciaDoCertame({ numero: '87', modalidade: 'Concorrência' }))
      .toBe('CONCORRÊNCIA Nº 87');
  });

  it('processo administrativo entre parênteses, sem duplicar o rótulo', () => {
    expect(linhaDoProcessoAdministrativo('Processo Administrativo SEI n.º 0002914-89.2026.6.14.8000'))
      .toBe('(Processo Administrativo SEI n.º 0002914-89.2026.6.14.8000)');
    expect(linhaDoProcessoAdministrativo('0002914-89.2026.6.14.8000'))
      .toBe('(Processo Administrativo n.º 0002914-89.2026.6.14.8000)');
    expect(linhaDoProcessoAdministrativo(null)).toBe('');
  });
});

describe('a identificação vem do edital, não da montagem', () => {
  it('a linha transcrita da capa tem precedência', () => {
    expect(referenciaDoCertame({
      numero: '87',
      modalidade: 'Pregão - Eletrônico',
      ano: 2026,
      identificacaoDoEdital: 'PREGÃO ELETRÔNICO Nº 87/2026',
    })).toBe('PREGÃO ELETRÔNICO Nº 87/2026');
  });

  it('preserva a grafia do órgão, mesmo divergindo do cadastro', () => {
    // O edital pode nomear o certame de forma que a montagem não reproduziria.
    expect(referenciaDoCertame({
      numero: '12',
      modalidade: 'Concorrência',
      ano: 2026,
      identificacaoDoEdital: 'CONCORRÊNCIA PÚBLICA N.º 012/2026 - SEMOB',
    })).toBe('CONCORRÊNCIA PÚBLICA N.º 012/2026 - SEMOB');
  });

  it('sem extração, monta a partir do cadastro — o plano B', () => {
    expect(referenciaDoCertame({
      numero: '87', modalidade: 'Pregão - Eletrônico', ano: 2026, identificacaoDoEdital: '',
    })).toBe('PREGÃO ELETRÔNICO Nº 87/2026');
  });
});
