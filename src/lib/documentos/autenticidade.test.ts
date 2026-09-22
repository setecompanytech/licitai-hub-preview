import { describe, expect, it } from 'vitest';
import { autenticidadeGravada, comAutenticidade, extrairAutenticidade, urlDeConferencia } from './autenticidade';

/**
 * O código de autenticidade é o que prova a certidão. O que este arquivo
 * trava: cada emissor é reconhecido pela MARCA dele mais o RÓTULO que ele
 * usa; o link de conferência vem do catálogo; sem padrão claro, nada — nem
 * código solto, nem emissor adivinhado.
 */
describe('extrairAutenticidade — os padrões dos emissores mais comuns', () => {
  it('Receita/PGFN: "Código de controle da certidão", quatro blocos de quatro', () => {
    const texto = [
      'MINISTÉRIO DA FAZENDA Secretaria da Receita Federal do Brasil Procuradoria-Geral da Fazenda Nacional',
      'CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS CRÉDITOS TRIBUTÁRIOS FEDERAIS E À DÍVIDA ATIVA DA UNIÃO',
      'Nome: ETHOS NEGOCIOS LTDA CNPJ: 33.734.346/0001-72',
      'Emitida às 09:12:44 do dia 22/09/2026 <hora e data de Brasília>. Válida até 21/03/2027.',
      'Código de controle da certidão: 3f8a.2B7C.9d1e.4A6B',
      'Qualquer rasura ou emenda invalidará este documento.',
    ].join('\n');
    expect(extrairAutenticidade(texto)).toEqual({
      emissor: 'Receita Federal do Brasil / Procuradoria-Geral da Fazenda Nacional',
      codigo: '3F8A.2B7C.9D1E.4A6B',
      conferirEm: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home',
    });
  });

  it('Caixa CRF: "Certificação Número", só dígitos', () => {
    const texto = [
      'CAIXA ECONÔMICA FEDERAL Certificado de Regularidade do FGTS - CRF',
      'Inscrição: 33.734.346/0001-72 Razão Social: ETHOS NEGOCIOS LTDA',
      'Validade: 23/09/2026 a 22/10/2026',
      'Certificação Número: 2026092303334570826430',
      'Informação obtida em 23/09/2026 08:01:12',
    ].join(' ');
    expect(extrairAutenticidade(texto)).toEqual({
      emissor: 'Caixa Econômica Federal',
      codigo: '2026092303334570826430',
      conferirEm: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    });
  });

  it('TST CNDT: "Certidão nº" numa certidão de débitos trabalhistas — positiva com efeitos de negativa inclusive', () => {
    const negativa = 'PODER JUDICIÁRIO JUSTIÇA DO TRABALHO CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS Nome: ETHOS Certidão nº: 12345678/2026 Expedição: 22/09/2026, às 10:41:07 Validade: 20/03/2027 - 180 (cento e oitenta) dias';
    expect(extrairAutenticidade(negativa)).toEqual({
      emissor: 'Tribunal Superior do Trabalho',
      codigo: '12345678/2026',
      conferirEm: 'https://cndt-certidao.tst.jus.br/',
    });
    const positiva = 'CERTIDÃO POSITIVA DE DÉBITOS TRABALHISTAS COM EFEITO DE NEGATIVA Certidão n°: 987/2026';
    expect(extrairAutenticidade(positiva)?.codigo).toBe('987/2026');
  });

  it('SEFA/PA: "Código de Controle de Autenticidade", quatro blocos de oito, com a marca do Pará', () => {
    const texto = [
      'GOVERNO DO ESTADO DO PARÁ SECRETARIA DE ESTADO DA FAZENDA',
      'CERTIDÃO NEGATIVA DE NATUREZA TRIBUTÁRIA E NÃO TRIBUTÁRIA',
      'Emitida às: 14:41:42 do dia 10/07/2026 Válida até: 06/01/2027',
      'Número da Certidão: 702026081315623-2',
      'Código de Controle de Autenticidade: 7d7cea16.1b83c71c.9e7386bb.531f3dd9',
    ].join('\n');
    expect(extrairAutenticidade(texto)).toEqual({
      emissor: 'Secretaria de Estado da Fazenda do Pará (SEFA/PA)',
      codigo: '7D7CEA16.1B83C71C.9E7386BB.531F3DD9',
      conferirEm: 'https://app.sefa.pa.gov.br/emissao-certidao/template.action',
    });
  });

  it('o mesmo formato sem a marca do emissor não vira certidão de ninguém', () => {
    // Quatro blocos de oito, mas sem "Pará" nem "SEFA": pode ser de outra UF.
    expect(extrairAutenticidade('Código de Controle de Autenticidade: 7D7CEA16.1B83C71C.9E7386BB.531F3DD9')).toBeNull();
    // "Certidão nº" sem "débitos trabalhistas": qualquer certidão tem número.
    expect(extrairAutenticidade('Tribunal de Justiça Certidão nº: 4455/2026 negativa de falência')).toBeNull();
    // Marca sem o rótulo do código: não há o que mostrar.
    expect(extrairAutenticidade('Receita Federal do Brasil — certidão sem código impresso')).toBeNull();
  });

  it('rótulo certo com código no formato errado não é aceito', () => {
    expect(extrairAutenticidade('Receita Federal Código de controle da certidão: 12345')).toBeNull();
    expect(extrairAutenticidade('CAIXA Certificação Número: 12')).toBeNull();
  });

  it('texto vazio ou sem certidão devolve nulo', () => {
    expect(extrairAutenticidade('')).toBeNull();
    expect(extrairAutenticidade('   ')).toBeNull();
    expect(extrairAutenticidade('Contrato social da empresa, cláusula primeira.')).toBeNull();
  });
});

describe('autenticidadeGravada / comAutenticidade — o que vai e o que volta do banco', () => {
  const lida = { emissor: 'Caixa Econômica Federal', codigo: '2026092303334570826430', conferirEm: 'https://antigo.caixa.gov.br/' };

  it('grava ao lado do que já estava na coluna, e tira quando o arquivo novo não tem código', () => {
    const gravado = comAutenticidade({ outro: 'uso' }, lida);
    expect(gravado?.outro).toBe('uso');
    expect(gravado?.autenticidade).toEqual(expect.objectContaining({ emissor: lida.emissor, codigo: lida.codigo }));
    expect((gravado?.autenticidade as { lidoEm: string }).lidoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(comAutenticidade(gravado, null)).toEqual({ outro: 'uso' });
    // Sem nada para guardar, a coluna fica nula — não `{}`.
    expect(comAutenticidade(null, null)).toBeNull();
    expect(comAutenticidade({ autenticidade: lida }, null)).toBeNull();
  });

  it('lê de volta validando a forma, e reatualiza o link pelo catálogo', () => {
    const lidaDeVolta = autenticidadeGravada(comAutenticidade(null, lida));
    expect(lidaDeVolta?.codigo).toBe('2026092303334570826430');
    // O link gravado era o antigo; o catálogo manda.
    expect(lidaDeVolta?.conferirEm).toBe('https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf');
    expect(urlDeConferencia('Caixa Econômica Federal')).toBe('https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf');
  });

  it('emissor que o catálogo não conhece fica com o link gravado; JSON torto vira nulo', () => {
    const outro = autenticidadeGravada({ autenticidade: { emissor: 'Prefeitura de X', codigo: 'ABC', conferirEm: 'https://x.gov.br/conferir' } });
    expect(outro).toEqual({ emissor: 'Prefeitura de X', codigo: 'ABC', conferirEm: 'https://x.gov.br/conferir' });
    expect(autenticidadeGravada(null)).toBeNull();
    expect(autenticidadeGravada({ autenticidade: { emissor: '', codigo: 'ABC' } })).toBeNull();
    expect(autenticidadeGravada({ autenticidade: { emissor: 'X', codigo: 42 } })).toBeNull();
    expect(autenticidadeGravada({ objeto: 'atestado sem autenticidade' })).toBeNull();
  });
});
