import { describe, it, expect } from 'vitest';
import { deduplicarAnexos, descricaoDaOrdem, numeroDoAnexo, ordenarAnexos } from './ordem-dos-anexos';

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
