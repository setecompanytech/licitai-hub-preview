import { describe, it, expect } from 'vitest';
import {
  instrucaoDaMarcaEModelo,
  prioridadeDoArquivo,
  respostaDaMarcaEModelo,
  tipoDoArquivo,
  trechosDeMarcaEModelo,
} from '../../../../supabase/functions/_shared/termo-de-referencia';

/**
 * Fase 6 — marca e modelo indicados no termo de referência. Nomes de arquivo
 * e trechos reais do 7/2026 (RAR com seis PDFs; o termo não indica marca).
 */

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

describe('arquivos publicados', () => {
  it('reconhece o tipo pelos primeiros bytes, não pelo nome', () => {
    expect(tipoDoArquivo(bytes(0x25, 0x50, 0x44, 0x46))).toBe('pdf');
    expect(tipoDoArquivo(bytes(0x50, 0x4b, 0x03, 0x04))).toBe('zip');
    expect(tipoDoArquivo(bytes(0x52, 0x61, 0x72, 0x21))).toBe('rar');
    expect(tipoDoArquivo(bytes(0x3c, 0x68, 0x74, 0x6d))).toBe('outro');
  });

  it('lê o termo de referência primeiro, minuta e ETP por último — nomes do RAR do 7/2026', () => {
    const nomes = [
      '1. Edital PE SRP 07.2026 - Equipamentos de Tecnologia.pdf',
      '2. ANEXO A - ETP AQUISIÇÃO DE EQUIPAMENTOS.pdf',
      '3. ANEXO B - TR AQUISIÇÃO EQUIPAMENTOS.pdf',
      '4. ANEXO C - Minuta de Contrato - PE SRP 07.2026.pdf',
      '6. ANEXO E - Relação de Itens no Compras.gov.pdf',
    ];
    expect([...nomes].sort((a, b) => prioridadeDoArquivo(a) - prioridadeDoArquivo(b))[0]).toBe('3. ANEXO B - TR AQUISIÇÃO EQUIPAMENTOS.pdf');
    expect(prioridadeDoArquivo('Termo de Referência.pdf')).toBe(0);
    expect(prioridadeDoArquivo('2. ANEXO A - ETP AQUISIÇÃO DE EQUIPAMENTOS.pdf')).toBe(9);
    expect(prioridadeDoArquivo('Edital e anexos - PE SRP 07.2026.rar')).toBe(2);
  });
});

describe('recorte antes da IA', () => {
  it('só as partes que falam de marca, modelo ou fabricante, juntando o que se sobrepõe', () => {
    const texto = `${'a '.repeat(1000)} Monitor marca de referência Dell modelo P2422H ${'b '.repeat(1000)} sem nada aqui ${'c '.repeat(1000)}`;
    const trechos = trechosDeMarcaEModelo(texto, 50);
    expect(trechos).toHaveLength(1);
    expect(trechos[0]).toContain('marca de referência Dell modelo P2422H');
  });

  it('texto sem as palavras não gera recorte — e aí não há chamada paga', () => {
    expect(trechosDeMarcaEModelo('Notebook com processador de 2 núcleos e tela de 14 polegadas.')).toEqual([]);
  });

  it('respeita o limite de caracteres', () => {
    const texto = Array.from({ length: 200 }, (_, i) => `${'x '.repeat(400)} marca ${i}`).join(' ');
    const trechos = trechosDeMarcaEModelo(texto, 350, 5000);
    expect(trechos.reduce((s, t) => s + t.length, 0)).toBeLessThanOrEqual(5000);
  });

  it('a instrução leva os itens e diz o que não conta', () => {
    const i = instrucaoDaMarcaEModelo([{ numero: 5, descricao: 'Monitor Computador ajuste de rotação' }]);
    expect(i).toContain('5: Monitor Computador ajuste de rotação');
    expect(i).toMatch(/"marca ofertada"/);
  });
});

describe('resposta da IA conferida', () => {
  const trechos = [
    'O item 5 deverá ser monitor Dell P2422H ou similar de qualidade equivalente, conforme especificação.',
    'Placa de vídeo UHD Graphics ou similar e compatível; garantia do fabricante da marca ofertada',
    'suporte em Educa ç ã o com marca de referência Positivo Duo',
  ];
  const validos = new Set([1, 5, 6]);

  it('aceita marca com o trecho de prova achado no texto', () => {
    expect(respostaDaMarcaEModelo(
      { itens: [{ numero: 5, marca: 'Dell', modelo: 'P2422H', trecho: 'monitor Dell P2422H ou similar' }] },
      validos, trechos,
    )).toEqual([{ numero: 5, marca: 'Dell', modelo: 'P2422H', trecho: 'monitor Dell P2422H ou similar' }]);
  });

  it('o texto do PDF com letras soltas não derruba a prova', () => {
    expect(respostaDaMarcaEModelo(
      { itens: [{ numero: 6, marca: 'Positivo', modelo: 'Duo', trecho: 'Educação com marca de referência Positivo Duo' }] },
      validos, trechos,
    )).toHaveLength(1);
  });

  it('descarta o que não se prova: trecho inventado, marca fora do trecho, item de outra lista, sem marca nem modelo', () => {
    expect(respostaDaMarcaEModelo({
      itens: [
        { numero: 1, marca: 'Lenovo', modelo: null, trecho: 'notebook Lenovo exigido' },
        { numero: 5, marca: 'Samsung', modelo: null, trecho: 'monitor Dell P2422H ou similar' },
        { numero: 9, marca: 'Dell', modelo: null, trecho: 'monitor Dell P2422H ou similar' },
        { numero: 5, marca: null, modelo: null, trecho: 'monitor Dell P2422H ou similar' },
      ],
    }, validos, trechos)).toEqual([]);
  });

  it('resposta fora do formato vira lista vazia', () => {
    expect(respostaDaMarcaEModelo(null, validos, trechos)).toEqual([]);
    expect(respostaDaMarcaEModelo({ itens: 'nenhum' }, validos, trechos)).toEqual([]);
  });
});
