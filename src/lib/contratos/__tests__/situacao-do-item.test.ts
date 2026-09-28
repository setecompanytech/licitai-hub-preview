import { describe, it, expect } from 'vitest';
import { FILTRO_ORIGINAL, FILTRO_TODOS, filtrarPorSituacao, rotuloDoItemNoSeletor, situacaoPorItem, termosDoFiltro } from '../situacao-do-item';

const linhas = [
  { contrato_item_id: 'acucar', aditivo_id: 'ta1', numero_aditivo: '1º Termo Aditivo', aplicado_em: '2026-09-26T23:24:08Z' },
  { contrato_item_id: 'acucar', aditivo_id: 'ta2', numero_aditivo: '2º Termo Aditivo', aplicado_em: '2026-09-26T23:33:30Z' },
  { contrato_item_id: 'acucar', aditivo_id: 'ta3', numero_aditivo: '3º Termo Aditivo', aplicado_em: '2026-09-28T13:00:00Z' },
  { contrato_item_id: 'aveia', aditivo_id: 'ta2', numero_aditivo: '2º Termo Aditivo', aplicado_em: '2026-09-26T23:33:30Z' },
  { contrato_item_id: 'sal', aditivo_id: 'ta4', numero_aditivo: '4º Termo Aditivo', aplicado_em: null },
  { contrato_item_id: null, aditivo_id: 'ta1', numero_aditivo: '1º Termo Aditivo', aplicado_em: '2026-09-26T23:24:08Z' },
];

describe('situação do item nos seletores', () => {
  it('por item, o último termo aplicado; linha não aplicada ou sem item não conta', () => {
    const s = situacaoPorItem(linhas);
    expect(s.get('acucar')).toMatchObject({ aditivoId: 'ta3', rotuloCurto: '3º TA', rotulo: '3º Termo Aditivo' });
    expect(s.get('aveia')).toMatchObject({ aditivoId: 'ta2', rotuloCurto: '2º TA' });
    expect(s.has('sal')).toBe(false);
    expect(s.size).toBe(2);
  });
  it('rótulo do seletor: termo e preço vigente; nunca mais "Contrato Original" para item alterado', () => {
    const s = situacaoPorItem(linhas);
    expect(rotuloDoItemNoSeletor({ valor_unitario: 6.81 }, s.get('acucar'))).toBe('3º TA · R$ 6,81');
    expect(rotuloDoItemNoSeletor({ valor_unitario: 5.04 }, s.get('sal'))).toBe('Original · R$ 5,04');
  });
  it('filtro: todos, nunca alterados, atualizados por um termo; e a lista de termos do filtro', () => {
    const s = situacaoPorItem(linhas);
    const itens = [{ id: 'acucar' }, { id: 'aveia' }, { id: 'sal' }];
    expect(filtrarPorSituacao(itens, s, FILTRO_TODOS)).toHaveLength(3);
    expect(filtrarPorSituacao(itens, s, FILTRO_ORIGINAL).map((i) => i.id)).toEqual(['sal']);
    expect(filtrarPorSituacao(itens, s, 'ta2').map((i) => i.id)).toEqual(['aveia']);
    expect(termosDoFiltro(s)).toEqual([
      { id: 'ta2', rotulo: '2º Termo Aditivo', rotuloCurto: '2º TA', itens: 1 },
      { id: 'ta3', rotulo: '3º Termo Aditivo', rotuloCurto: '3º TA', itens: 1 },
    ]);
  });
});
