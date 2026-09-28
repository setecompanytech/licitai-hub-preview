import { describe, it, expect } from 'vitest';
import { MODELOS_CONTABEIS, REFERENCIAS_CONTABEIS, htmlDoRoteiro, nomeDoArquivoDoModelo, roteiroEmTexto } from '../modelos';

describe('modelos do Apoio Contábil', () => {
  it('fundamentos corrigidos contra o Planalto: custos = art. 23, encargos = IN 5/2017 Anexo VII-D, inexequibilidade sem prometer 75% para tudo', () => {
    const por = (id: string) => MODELOS_CONTABEIS.find((m) => m.id === id)!;
    expect(por('1').fundamentacao).toMatch(/Art\. 23/);
    expect(por('1').fundamentacao).not.toMatch(/58/);
    expect(por('5').fundamentacao).toMatch(/IN SEGES\/MP 5\/2017, Anexo VII-D/);
    expect(por('3').descricao).toMatch(/só em obras e engenharia/);
    expect(por('7').fundamentacao).toMatch(/Art\. 69/);
    expect(MODELOS_CONTABEIS.every((m) => /^https?:\/\//.test(m.fundamentacaoUrl))).toBe(true);
    expect(REFERENCIAS_CONTABEIS.find((r) => r.rotulo === 'IN SEGES/ME 65/2021')!.descricao).toMatch(/Pesquisa de preços/);
  });
  it('roteiro em texto e em Word; nome de arquivo sem acento', () => {
    const m = MODELOS_CONTABEIS[0];
    const t = roteiroEmTexto(m);
    expect(t.split('\n')[0]).toBe('Composição de Custos Unitários — Planilha analítica de custos e formação de preço unitário para a proposta');
    expect(t).toContain('1. Objeto, item e unidade de medida');
    const h = htmlDoRoteiro(m);
    expect(h).toContain('<h1>Composição de Custos Unitários</h1>');
    expect(h).toContain('href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm#art23"');
    expect(nomeDoArquivoDoModelo(m)).toBe('Composicao-de-Custos-Unitarios.doc');
  });
});
