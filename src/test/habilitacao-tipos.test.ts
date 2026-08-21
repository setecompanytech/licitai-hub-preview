import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TIPOS_HABILITACAO, classificarTipo, tiposMencionados } from '@/lib/habilitacao/tipos';

describe('classificarTipo', () => {
  const CASOS: { entrada: string; esperado: string }[] = [
    { entrada: 'Certidão Negativa de Débitos relativos a Tributos Federais e à Dívida Ativa da União', esperado: 'cnd_federal' },
    { entrada: 'Certificado de Regularidade do FGTS - CRF', esperado: 'crf_fgts' },
    { entrada: 'Certidão Negativa de Débitos Trabalhistas (CNDT)', esperado: 'cndt_trabalhista' },
    { entrada: 'Prova de regularidade com a Fazenda Municipal do domicílio', esperado: 'cnd_municipal' },
    { entrada: 'Balanço patrimonial e demonstrações contábeis do último exercício', esperado: 'balanco' },
    { entrada: 'Certidão negativa de falência ou concordata', esperado: 'certidao_falencia' },
    { entrada: 'Atestado de capacidade técnica compatível com o objeto', esperado: 'atestado_tecnico' },
    { entrada: 'Ato constitutivo, estatuto ou contrato social em vigor', esperado: 'contrato_social' },
    { entrada: 'Declaração de que não emprega menor de 18 anos (inciso XXXIII)', esperado: 'decl_menor' },
    { entrada: 'Declaração de enquadramento como Microempresa - LC 123', esperado: 'decl_me_epp' },
  ];
  it.each(CASOS)('classifica "$entrada" → $esperado', ({ entrada, esperado }) => {
    expect(classificarTipo(entrada)?.id).toBe(esperado);
  });
  it('texto sem correspondência devolve null', () => {
    expect(classificarTipo('amostra do produto em embalagem original')).toBeNull();
  });
});

describe('espelho Deno (_shared/habilitacao-tipos.ts)', () => {
  it('as duas taxonomias têm os mesmos ids, na mesma ordem', () => {
    const espelho = readFileSync(
      path.resolve(__dirname, '../../supabase/functions/_shared/habilitacao-tipos.ts'),
      'utf8',
    );
    const idsEspelho = [...espelho.matchAll(/\{ id: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(idsEspelho).toEqual(TIPOS_HABILITACAO.map((t) => t.id));
  });
});

describe('casamento por palavra inteira', () => {
  // O 'rg' de doc_socios casava dentro de "órgão": uma declaração de
  // inexistência de débitos com órgão público virava "Cédula de Identidade dos
  // Sócios", e a pessoa levava o documento errado ao pregoeiro.
  it('não confunde "órgão" com o RG dos sócios', () => {
    expect(
      classificarTipo('Declaração de que não possui débitos com qualquer órgão da administração pública'),
    ).not.toBe(TIPOS_HABILITACAO.find((t) => t.id === 'doc_socios'));
  });

  it('reconhece o documento pelo plural que o edital usa', () => {
    expect(classificarTipo('Certidão Negativa de Débitos Estaduais')?.id).toBe('cnd_estadual');
    expect(classificarTipo('Certidão Negativa de Débitos Municipais')?.id).toBe('cnd_municipal');
  });

  it('reconhece o FGTS escrito por extenso, como no art. 68', () => {
    expect(classificarTipo('contribuições ao Fundo de Garantia do Tempo de Serviço')?.id).toBe('crf_fgts');
  });
});

describe('doutrina: o que cada documento prova', () => {
  // A certidão da Junta informa o que está arquivado; quem carrega o teor
  // jurídico que habilita (objeto social, capital, poderes) é o contrato social.
  // Tratar uma como a outra dava por atendida uma exigência do art. 66 com
  // documento que não a atende.
  it('não confunde certidão da Junta com o ato constitutivo', () => {
    expect(classificarTipo('Certidão Simplificada da Junta Comercial')?.id).toBe('certidao_junta');
    expect(classificarTipo('Certidão de Inteiro Teor')?.id).toBe('certidao_junta');
    expect(classificarTipo('Certidão Específica')?.id).toBe('certidao_junta');
    expect(classificarTipo('Ato Constitutivo / Contrato Social')?.id).toBe('contrato_social');
  });

  it('reconhece a inscrição cadastral pela sigla de cada ente', () => {
    expect(classificarTipo('Ficha de Inscrição Cadastral (FIC)')?.id).toBe('inscricao_estadual');
    expect(classificarTipo('CISC – Belém')?.id).toBe('inscricao_municipal');
  });

  // Art. 68: o inciso II prova que a empresa está cadastrada; o III, que ela
  // nada deve. "Estadual" qualifica os dois, e sozinho não decide qual é.
  it('separa a inscrição do inciso II da regularidade do inciso III', () => {
    const ids = tiposMencionados(
      'prova de inscrição no cadastro de contribuintes estadual e/ou municipal, relativo ao domicílio ou sede',
    ).map((t) => t.id);
    expect(ids).toContain('inscricao_estadual');
    expect(ids).not.toContain('cnd_estadual');
  });

  it('mantém as CNDs quando a frase é de regularidade', () => {
    const ids = tiposMencionados(
      'Certidão negativa de débitos relativos a tributos federais, estaduais e municipais, bem como ao Fundo de Garantia do Tempo de Serviço',
    ).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['cnd_federal', 'cnd_estadual', 'cnd_municipal', 'crf_fgts']));
  });
});
