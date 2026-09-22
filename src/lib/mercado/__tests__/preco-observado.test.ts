import { describe, it, expect } from 'vitest';
import {
  estatisticaUnitaria, etiquetaDoValor, explicacaoDoValor, itemUnitario, itensPorEdital, unidadeLegivel,
} from '../preco-observado';

const linha = (extra: Record<string, unknown>) => ({
  pncp_id: 'a', numero_item: 1, descricao: 'CARNE BOVINA MOÍDA', unidade: 'Quilo', quantidade: 100,
  valor_unitario_estimado: 30, valor_unitario_homologado: null, situacao: 'Em andamento', tem_resultado: false, ...extra,
});

describe('preço observado — natureza e estágio em todo valor', () => {
  it('a etiqueta diz o que o valor mede e em que estágio', () => {
    expect(etiquetaDoValor('global', 'estimado')).toBe('Global · estimado');
    expect(etiquetaDoValor('unitario', 'homologado')).toBe('Unitário · homologado');
    expect(etiquetaDoValor('unitario', 'faturado')).toBe('Unitário · faturado em NF-e');
    expect(explicacaoDoValor('global', 'estimado')).toContain('todos os itens juntos');
  });

  it('lê a linha da edge e junta o edital que a busca já tinha', () => {
    const item = itemUnitario(linha({ valor_unitario_homologado: 19.96, tem_resultado: true, fornecedor: 'L B', data_resultado: '2025-10-02' }), {
      pncp_id: 'a', cnpj_orgao: '1', ano_compra: '2025', sequencial_compra: '58', orgao: 'RONDON', numero_computa: 'x', numero_compra: '44/2025', url_pncp: 'u',
    } as never);
    expect(item).toMatchObject({ pncpId: 'a', estimado: 30, homologado: 19.96, fornecedor: 'L B', orgao: 'RONDON', numeroCompra: '44/2025', urlPncp: 'u' });
  });

  it('a estatística separa homologados de estimados e conta as unidades', () => {
    const itens = [
      itemUnitario(linha({ pncp_id: 'a', valor_unitario_estimado: 30.78, valor_unitario_homologado: 19.96 })),
      itemUnitario(linha({ pncp_id: 'b', valor_unitario_estimado: 36.96, valor_unitario_homologado: 17.51, unidade: 'KG' })),
      itemUnitario(linha({ pncp_id: 'c', valor_unitario_estimado: 32.5, unidade: 'Quilograma' })),
      itemUnitario(linha({ pncp_id: 'd', valor_unitario_estimado: 0, valor_unitario_homologado: 35, unidade: 'Unidade' })),
    ];
    const e = estatisticaUnitaria(itens);
    expect(e.amostraHomologada).toBe(3);
    expect(e.medianaHomologada).toBe(19.96);
    expect(e.amostraEstimada).toBe(3);
    expect(e.medianaEstimada).toBe(32.5);
    expect(e.minimoEstimado).toBe(30.78);
    expect(e.maximoEstimado).toBe(36.96);
    expect(e.editais).toBe(4);
    expect(e.unidades).toEqual(['kg', 'un']);
    expect(itensPorEdital(itens).get('a')?.length).toBe(1);
    expect(unidadeLegivel('QUILOGRAMAS')).toBe('kg');
    expect(unidadeLegivel('Litro')).toBe('l');
    expect(unidadeLegivel('Metro')).toBe('metro');
  });
});
