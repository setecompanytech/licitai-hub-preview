import { describe, it, expect } from 'vitest';
import { deduplicarAnexos, descricaoDaOrdem, numeroDaNotaNoNome, numeroDoAnexo, numeroParaGuardar, ordenarAnexos } from './ordem-dos-anexos';

const a = (id: string, numero: string | null, nome: string, created_at = '2026-09-22') =>
  ({ id, numero, arquivo_nome: nome, storage_path: `p/${id}.pdf`, created_at });

describe('ordem dos anexos pelo número da nota', () => {
  it('o número vem do gravado, senão do nome do arquivo', () => {
    expect(numeroDoAnexo({ numero: '000.000.725', arquivo_nome: null })).toBe(725);
    expect(numeroDoAnexo({ numero: null, arquivo_nome: 'NFe N° 000.000.729 - SEDUC - CARNE MOIDA.pdf' })).toBe(729);
    expect(numeroDoAnexo({ numero: null, arquivo_nome: 'comprovante.pdf' })).toBeNull();
  });
  it('sai em ordem numérica, os sem número por último', () => {
    const lista = [a('c', '729', 'NFe 729.pdf'), a('x', null, 'comprovante.pdf'), a('a', null, 'NFe N° 000.000.725.pdf'), a('b', '726', 'NFe 726.pdf')];
    expect(ordenarAnexos(lista).map((d) => d.id)).toEqual(['a', 'b', 'c', 'x']);
    expect(descricaoDaOrdem(ordenarAnexos(lista))).toBe('725, 726, 729, comprovante.pdf');
  });
  it('um anexo por número — a cópia sem número da mesma nota some', () => {
    const lista = [a('n', '725', 'NFe N° 000.000.725.pdf'), a('copia', null, 'NFe N° 000.000.725.pdf', '2026-09-09'), a('b', '726', 'NFe 726.pdf')];
    expect(deduplicarAnexos(lista).map((d) => d.id)).toEqual(['n', 'b']);
  });
});

describe('o número da nota no nome do arquivo', () => {
  it('lê os nomes que dizem que é nota', () => {
    expect(numeroDaNotaNoNome('NFe N° 000.000.728 - SEDUC - CARNE MOIDA.pdf')).toBe(728);
    expect(numeroDaNotaNoNome('NF-e_725.pdf')).toBe(725);
    expect(numeroDaNotaNoNome('DANFE 000000726.PDF')).toBe(726);
    expect(numeroDaNotaNoNome('nfe729.pdf')).toBe(729);
    expect(numeroDaNotaNoNome('Nota Fiscal 730 - Santa Rosa.pdf')).toBe(730);
    expect(numeroDaNotaNoNome('NF 692 SEDUC.pdf')).toBe(692);
    expect(numeroDaNotaNoNome('000000725.pdf')).toBe(725);
  });
  it('lê o número dentro da chave de acesso', () => {
    // nNF = posições 26 a 34 da chave: 000000713.
    expect(numeroDaNotaNoNome('15260512345678000199550010000007131000007138.xml')).toBe(713);
  });
  it('não inventa número para o que não é nota', () => {
    expect(numeroDaNotaNoNome('comprovante-ted-27-05.pdf')).toBeNull();
    expect(numeroDaNotaNoNome('Boleto 45.pdf')).toBeNull();
    expect(numeroDaNotaNoNome('INFORME 2024.pdf')).toBeNull();
    expect(numeroDaNotaNoNome('20260527.pdf')).toBeNull();
    expect(numeroDaNotaNoNome('')).toBeNull();
    expect(numeroDaNotaNoNome(null)).toBeNull();
    expect(numeroDoAnexo({ numero: null, arquivo_nome: 'comprovante-ted-27-05.pdf' })).toBeNull();
  });
});

describe('o número que se grava no anexo', () => {
  it('o nome do arquivo manda, mesmo com número no título — as três DANFEs 728 carimbadas como 727', () => {
    expect(numeroParaGuardar({ nomeDoArquivo: 'NFe N° 000.000.728 - SEDUC.pdf', numeroDoLancamento: '727', rateado: true })).toBe('728');
    expect(numeroParaGuardar({ nomeDoArquivo: 'NFe N° 000.000.728 - SEDUC.pdf', numeroDoLancamento: '727', rateado: false })).toBe('728');
  });
  it('sem número no nome, o título de UMA nota empresta o seu; o rateado não', () => {
    expect(numeroParaGuardar({ nomeDoArquivo: 'boleto.pdf', numeroDoLancamento: '123' })).toBe('123');
    expect(numeroParaGuardar({ nomeDoArquivo: 'comprovante-ted-27-05.pdf', numeroDoLancamento: '727', rateado: true })).toBeNull();
    expect(numeroParaGuardar({ nomeDoArquivo: 'comprovante-ted-27-05.pdf', numeroDoLancamento: '  ' })).toBeNull();
  });
});
