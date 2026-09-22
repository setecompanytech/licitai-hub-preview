import { describe, it, expect } from 'vitest';
import {
  contratoFederal, estatisticaDeItens, itemDeNota, licitacaoFederal, numeroDaLicitacaoParaApi, palavrasDoTermo, presencasDaFicha,
} from '../portal-federal';

describe('portal federal no front — os nomes da especificação', () => {
  it('o número da licitação vai só em dígitos, sem zeros à esquerda do sequencial', () => {
    expect(numeroDaLicitacaoParaApi('2/2020')).toBe('22020');
    expect(numeroDaLicitacaoParaApi('00037/2026')).toBe('372026');
    expect(numeroDaLicitacaoParaApi('372026')).toBe('372026');
  });

  it('o contrato lê valorInicialCompra da spec e ainda aceita o valorInicial antigo', () => {
    const c = contratoFederal({
      id: 9, numero: '12/2026', objeto: 'Gêneros', unidadeGestora: { nome: 'IFPA' },
      fornecedor: { nome: 'ETHOS', cnpjFormatado: '33.734.346/0001-72' }, valorInicialCompra: 1500.5, dataInicioVigencia: '01/01/2026',
    });
    expect(c).toMatchObject({ id: '9', objeto: 'Gêneros', orgao: 'IFPA', fornecedor: 'ETHOS', cnpjFornecedor: '33.734.346/0001-72', valorInicial: 1500.5 });
    expect(contratoFederal({ valorInicial: '2.000,00' }).valorInicial).toBe(2000);
    expect(contratoFederal({}).valorInicial).toBeNull();
  });

  it('a licitação lê objeto e número de dentro de `licitacao`, o valor de `valor`, e prepara o número para a API', () => {
    const l = licitacaoFederal({
      id: 7, licitacao: { numero: '00037/2026', objeto: 'Carne bovina', numeroProcesso: '23000.1' },
      modalidadeLicitacao: { codigo: '05', descricao: 'Pregão' }, unidadeGestora: { codigo: '158140', nome: 'IFPA' },
      valor: 250000, dataAbertura: '10/09/2026', situacaoCompra: 'Encerrado', municipio: { nomeIBGE: 'Belém' },
    });
    expect(l).toMatchObject({ id: '7', numero: '00037/2026', numeroParaApi: '372026', objeto: 'Carne bovina', modalidade: 'Pregão', codigoModalidade: '05', codigoUG: '158140', orgao: 'IFPA', valor: 250000, municipio: 'Belém' });
    expect(licitacaoFederal({ objeto: 'Antigo', valorEstimado: 10 })).toMatchObject({ objeto: 'Antigo', valor: 10 });
  });

  it('a estatística de itens casa todas as palavras do produto, sem acento, e cai para "ao menos uma" quando nada casa', () => {
    const itens = [
      itemDeNota({ descricaoProdutoServico: 'CARNE BOVINA MOÍDA PATINHO KG', codigoNcmSh: '02013000', quantidade: 100, unidade: 'KG', valorUnitario: 32.9, valor: 3290 }),
      itemDeNota({ descricaoProdutoServico: 'CARNE BOVINA MOIDA ACEM', quantidade: 50, unidade: 'KG', valorUnitario: 28.5, valor: 1425 }),
      itemDeNota({ descricaoProdutoServico: 'CARNE MOIDA PATINHO CONGELADA', quantidade: 10, unidade: 'KG', valorUnitario: 35.1, valor: 351 }),
      itemDeNota({ descricaoProdutoServico: 'ARROZ TIPO 1', quantidade: 10, unidade: 'KG', valorUnitario: 5, valor: 50 }),
    ];
    const e = estatisticaDeItens(itens, 'carne moída patinho');
    expect(e.casouTodas).toBe(true);
    expect(e.amostra).toBe(2);
    expect(e.mediana).toBeCloseTo(34, 5);
    expect(e.minimo).toBe(32.9);
    expect(e.maximo).toBe(35.1);
    const largo = estatisticaDeItens(itens, 'carne suína');
    expect(largo.casouTodas).toBe(false);
    expect(largo.amostra).toBe(3);
    expect(palavrasDoTermo('Carne moída, de patinho')).toEqual(['carne', 'moida', 'patinho']);
  });

  it('a ficha vira rótulos: presenças e sanções separadas; sem ficha, nada', () => {
    expect(presencasDaFicha({ possuiContratacao: true, emitiuNFe: true, sancionadoCEIS: true, favorecidoDespesas: false }))
      .toEqual({ presencas: ['Tem contrato federal', 'Emitiu NF-e a órgão federal'], sancoes: ['Sanção no CEIS'] });
    expect(presencasDaFicha(null)).toEqual({ presencas: [], sancoes: [] });
  });
});
