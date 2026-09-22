import { describe, it, expect, vi } from 'vitest';
import {
  comResultado, coordenadas, itemCasa, itemDoAcervo, itensDaCompra, palavrasDoObjeto, palavrasQueBatem, resultadoDoItem,
  resultadoQueVale, urlDoResultado, urlDosItens, type CompraDoAcervo,
} from '../../../../supabase/functions/_shared/pncp-itens';

/**
 * A porta única dos itens do PNCP, testada aqui porque não usa `Deno.*`.
 * Os DTOs são os reais do edital de Rondon do Pará (22/09/2026): carne
 * moída a R$ 30,78 estimado e R$ 19,96 homologado à L B Distribuidora.
 */
const rondon: CompraDoAcervo = { pncp_id: '04780953000170-2025-58', cnpj_orgao: '04.780.953/0001-70', ano_compra: '2025', sequencial_compra: '000058' };

const itemCarne = {
  numeroItem: 1, descricao: 'CARNE BOVINA MOÍDA CONGELADA - Carne bovina moída, embalagem de 1 kg', materialOuServicoNome: 'Material',
  valorUnitarioEstimado: 30.78, valorTotal: 461700, quantidade: 15000, unidadeMedida: 'Quilo', situacaoCompraItemNome: 'Homologado',
  temResultado: true, ncmNbsCodigo: '02023000', itemCategoriaNome: 'Bens',
};
const itemCenoura = { numeroItem: 2, descricao: 'CENOURA, de 1ª qualidade', valorUnitarioEstimado: 8.16, valorTotal: 36720, quantidade: 4500, unidadeMedida: 'Quilo', situacaoCompraItemNome: 'Em andamento', temResultado: false };
const resultadoCarne = {
  niFornecedor: '12345678000199', nomeRazaoSocialFornecedor: 'L B DISTRIBUIDORA EIRELI', numeroItem: 1, valorUnitarioHomologado: 19.96,
  valorTotalHomologado: 299400, quantidadeHomologada: 15000, dataResultado: '2025-10-02', ordemClassificacaoSrp: 1, dataCancelamento: null,
};

const resposta = (corpo: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;

describe('itens do PNCP — a porta única', () => {
  it('monta as rotas com o sequencial sem zeros e o CNPJ só em dígitos', () => {
    expect(coordenadas(rondon)).toEqual({ cnpj: '04780953000170', ano: '2025', seq: '58' });
    expect(urlDosItens(rondon)).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/04780953000170/compras/2025/58/itens?pagina=1&tamanhoPagina=100');
    expect(urlDoResultado(rondon, 1)).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/04780953000170/compras/2025/58/itens/1/resultados');
  });

  it('lê o DTO do item como a tabela guarda: unitário e total estimados, unidade, quantidade, resultado pendente', () => {
    const item = itemDoAcervo(itemCarne, rondon);
    expect(item).toMatchObject({
      pncp_id: '04780953000170-2025-58', cnpj_orgao: '04780953000170', numero_item: 1, unidade: 'Quilo', quantidade: 15000,
      valor_unitario_estimado: 30.78, valor_total_estimado: 461700, situacao: 'Homologado', tem_resultado: true,
      valor_unitario_homologado: null, fornecedor: null, ncm: '02023000',
    });
  });

  it('o resultado aplica o homologado ao vencedor, com a data em ISO; cancelado não vale e o 1º classificado vence', () => {
    const item = comResultado(itemDoAcervo(itemCarne, rondon), resultadoCarne);
    expect(item.valor_unitario_homologado).toBe(19.96);
    expect(item.fornecedor).toBe('L B DISTRIBUIDORA EIRELI');
    expect(item.cnpj_fornecedor).toBe('12345678000199');
    expect(item.data_resultado).toBe('2025-10-02');
    expect(comResultado(item, { dataResultado: '02/10/2025' }).data_resultado).toBe('2025-10-02');
    const escolhido = resultadoQueVale([
      { ...resultadoCarne, ordemClassificacaoSrp: 2, nomeRazaoSocialFornecedor: 'SEGUNDO' },
      { ...resultadoCarne, dataCancelamento: '2025-10-05', nomeRazaoSocialFornecedor: 'CANCELADO' },
      { ...resultadoCarne, ordemClassificacaoSrp: 1, nomeRazaoSocialFornecedor: 'PRIMEIRO' },
    ]);
    expect(escolhido?.nomeRazaoSocialFornecedor).toBe('PRIMEIRO');
  });

  it('itensDaCompra pagina, deduplica e trata 404 como "sem itens"', async () => {
    const fetcher = vi.fn(async () => resposta([itemCarne, itemCenoura, itemCarne]));
    const r = await itensDaCompra(rondon, fetcher);
    expect(r.itens.map((i) => i.numero_item)).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await itensDaCompra(rondon, vi.fn(async () => resposta({}, 404)))).itens).toEqual([]);
    expect((await itensDaCompra(rondon, vi.fn(async () => resposta({}, 500)))).erro).toBe('HTTP 500');
    expect(await resultadoDoItem(rondon, 1, vi.fn(async () => resposta([resultadoCarne])))).toMatchObject({ valorUnitarioHomologado: 19.96 });
    expect(await resultadoDoItem(rondon, 2, vi.fn(async () => resposta([], 404)))).toBeNull();
  });

  it('o casamento: todas as palavras com uma de folga a partir de três; gênero e plural pelo radical', () => {
    const palavras = palavrasDoObjeto('CARNE MOÍDA PATINHO');
    expect(palavras).toEqual(['carne', 'moida', 'patinho']);
    expect(palavrasDoObjeto('carne moída de 1ª para merenda, tipo patinho, kg')).toEqual(['carne', 'moida', 'merenda', 'patinho']);
    expect(itemCasa('CARNE BOVINA MOÍDA CONGELADA', palavras)).toBe(true);
    expect(itemCasa('CARNE BOVINA, TIPO PATINHO, MOIDA DE 1ª QUALIDADE', palavras)).toBe(true);
    expect(itemCasa('CARNE DE FRANGO CONGELADA', palavras)).toBe(false);
    expect(itemCasa('CAFÉ TORRADO E MOÍDO 250g', palavras)).toBe(false);
    expect(itemCasa('CENOURA, de 1ª qualidade', palavras)).toBe(false);
    expect(palavrasQueBatem('CARNE MOÍDO CONGELADO', ['carne', 'moida', 'congelada'])).toBe(3);
    expect(itemCasa('CARNE BOVINA', ['carne', 'moida'])).toBe(false);
    expect(itemCasa('qualquer', [])).toBe(false);
  });
});
