import { describe, it, expect } from 'vitest';
import { nomeDeOrgaoLegivel } from '../nome-de-orgao';

describe('nome de órgão legível — a norma da língua no que a fonte entrega em caixa alta', () => {
  it('caixa de nome próprio, conectivos em minúscula e o acento do dicionário', () => {
    expect(nomeDeOrgaoLegivel('MUNICIPIO DE RONDON DO PARA')).toBe('Município de Rondon do Pará');
    expect(nomeDeOrgaoLegivel('COMANDO DO EXERCITO')).toBe('Comando do Exército');
    expect(nomeDeOrgaoLegivel('MINISTERIO DA SAUDE')).toBe('Ministério da Saúde');
    expect(nomeDeOrgaoLegivel('CORPO DE BOMBEIROS MILITAR DO ESTADO DO PARA')).toBe('Corpo de Bombeiros Militar do Estado do Pará');
    expect(nomeDeOrgaoLegivel('FUNDACAO MUNICIPAL DE SAUDE DE RIO CLARO')).toBe('Fundação Municipal de Saúde de Rio Claro');
  });

  it('"PARA" é Pará depois de "DO" ou no fim, e preposição no meio', () => {
    expect(nomeDeOrgaoLegivel('ESTADO DO PARA')).toBe('Estado do Pará');
    expect(nomeDeOrgaoLegivel('FUNDO PARA A INFANCIA E ADOLESCENCIA')).toBe('Fundo para a Infância e Adolescência');
  });

  it('siglas ficam siglas: sem vogal, curtas, conhecidas, ou sozinhas depois do travessão', () => {
    expect(nomeDeOrgaoLegivel('FUNDAÇÃO CENTRO DE HEMOTERAPIA E HEMATOLOGIA DO PARÁ – HEMOPA')).toBe('Fundação Centro de Hemoterapia e Hematologia do Pará – HEMOPA');
    expect(nomeDeOrgaoLegivel('FUNDO MUNICIPAL DE EDUCACAO FME')).toBe('Fundo Municipal de Educação FME');
    expect(nomeDeOrgaoLegivel('TRIBUNAL SUPERIOR DO TRABALHO')).toBe('Tribunal Superior do Trabalho');
    expect(nomeDeOrgaoLegivel('PREFEITURA MUNICIPAL DE BELEM - PA')).toBe('Prefeitura Municipal de Belém – PA');
  });

  it('corrige a grafia grudada conhecida e preserva a pontuação de borda', () => {
    expect(nomeDeOrgaoLegivel('DEPARTAMENTO AUTONOMO DEAGUA E ESGOTO')).toBe('Departamento Autônomo de Água e Esgoto');
    expect(nomeDeOrgaoLegivel('SECRETARIA DE SAUDE, EDUCACAO E CULTURA')).toBe('Secretaria de Saúde, Educação e Cultura');
  });

  it('nome em caixa mista passa intacto; vazio vira vazio; espaços sobrando somem', () => {
    expect(nomeDeOrgaoLegivel('Município de Benevides')).toBe('Município de Benevides');
    expect(nomeDeOrgaoLegivel('  MUNICIPIO   DE  OUREM ')).toBe('Município de Ourém');
    expect(nomeDeOrgaoLegivel('')).toBe('');
    expect(nomeDeOrgaoLegivel(null)).toBe('');
  });
});
