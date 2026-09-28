import { describe, it, expect } from 'vitest';
import { consequenciasDeApagar, formularioDoEmpenho, montarAtualizacaoDoEmpenho, problemaDoEmpenho, totaisDasLinhas, type EmpenhoOriginal, type LinhaDoEmpenho } from '../editar-empenho';

const ORIGINAL: EmpenhoOriginal = {
  id: 'e1', numero: '0062352024', tipo: 'ordinario', tipo_origem: 'documento', tipo_trecho: 'ESPÉCIE DE EMPENHO: ORDINÁRIO',
  valor: 17283, quantidade: 2800, unidade: 'un', data_emissao: '2024-06-14', exercicio: 2024, observacao: null, arquivo_id: 'a1',
};
const linha = (p: Partial<LinhaDoEmpenho>): LinhaDoEmpenho => ({ key: 'k', contrato_item_id: '', descricao: 'AÇÚCAR', cota: 'principal', quantidade: '100', unidade: 'UN', valor_unitario: '6,81', ...p });

describe('editar empenho', () => {
  it('abre o formulário a partir do registro', () => {
    expect(formularioDoEmpenho(ORIGINAL)).toEqual({ numero: '0062352024', tipo: 'ordinario', data_emissao: '2024-06-14', valor: '17283', quantidade: '2800', unidade: 'un', observacao: '' });
  });
  it('trocar a espécie à mão desfaz a leitura do documento (origem manual, trecho apagado); manter preserva', () => {
    const f = { ...formularioDoEmpenho(ORIGINAL), tipo: 'global' as const };
    const a = montarAtualizacaoDoEmpenho(ORIGINAL, f, [], 'emp');
    expect(a.mudouEspecie).toBe(true);
    expect(a.empenho).toMatchObject({ tipo: 'global', tipo_origem: 'manual', tipo_trecho: null, valor: 17283, quantidade: 2800, exercicio: 2024 });
    expect(a.descricaoDoArquivo).toBe('Nota de empenho 0062352024 — global');
    const b = montarAtualizacaoDoEmpenho(ORIGINAL, formularioDoEmpenho(ORIGINAL), [], 'emp');
    expect(b.empenho).toMatchObject({ tipo_origem: 'documento', tipo_trecho: 'ESPÉCIE DE EMPENHO: ORDINÁRIO' });
  });
  it('com linhas, o valor e a quantidade do empenho vêm delas; linha sem quantidade é ignorada', () => {
    const linhas = [linha({ quantidade: '100', valor_unitario: '6,81' }), linha({ key: 'k2', cota: 'reservada', quantidade: '33.33', valor_unitario: '6.81' }), linha({ key: 'k3', quantidade: '' })];
    const t = totaisDasLinhas(linhas);
    expect(t.linhasValidas).toHaveLength(2);
    expect(t.quantidade).toBeCloseTo(133.33, 2);
    expect(t.valor).toBeCloseTo(907.98, 2);
    const a = montarAtualizacaoDoEmpenho(ORIGINAL, formularioDoEmpenho(ORIGINAL), linhas, 'emp');
    expect(a.empenho).toMatchObject({ valor: 907.98, quantidade: 133.33 });
    expect(a.itens).toHaveLength(2);
    expect(a.itens[1]).toMatchObject({ empenho_id: 'e1', empresa_id: 'emp', cota: 'reservada', quantidade: 33.33, valor_unitario: 6.81, valor_total: 226.98, contrato_item_id: null });
  });
  it('validação', () => {
    expect(problemaDoEmpenho({ ...formularioDoEmpenho(ORIGINAL), numero: ' ' }, [])).toMatch(/número/);
    expect(problemaDoEmpenho({ ...formularioDoEmpenho(ORIGINAL), tipo: '' }, [])).toMatch(/espécie/);
    expect(problemaDoEmpenho({ ...formularioDoEmpenho(ORIGINAL), valor: '' }, [])).toMatch(/valor do empenho/);
    expect(problemaDoEmpenho(formularioDoEmpenho(ORIGINAL), [linha({ valor_unitario: '0' })])).toMatch(/sem valor unitário/);
    expect(problemaDoEmpenho(formularioDoEmpenho(ORIGINAL), [linha({})])).toBeNull();
  });
  it('consequências de apagar', () => {
    const c = consequenciasDeApagar({ pedidos: 2, movimentos: 1, temPdf: true });
    expect(c[0]).toMatch(/2 pedido/);
    expect(c[1]).toMatch(/1 reforço/);
    expect(c).toHaveLength(4);
    expect(consequenciasDeApagar({ pedidos: 0, movimentos: 0, temPdf: false })).toHaveLength(1);
  });
});
