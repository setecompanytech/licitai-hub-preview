import { describe, it, expect } from 'vitest';
import {
  interpretarPlanilha,
  lerCsv,
  lerNumero,
  mapearColunas,
  separarLinhaCsv,
  detectarSeparador,
} from '@/lib/produtos/importar-planilha';

/**
 * A importação de planilha é a operação com maior chance de duplicar cadastro:
 * a mesma planilha reenviada, ou uma planilha com a linha repetida, dobra o
 * catálogo sem ninguém perceber. As duas defesas contra isso vivem em
 * `interpretarPlanilha`, e é por isso que elas são testadas aqui e não no olho.
 *
 * Descrições, códigos e preços abaixo são inventados para o teste.
 */

const CABECALHO = ['Descrição', 'Unidade', 'NCM', 'Preço de Venda'];

describe('leitura de números da planilha', () => {
  it('lê o formato brasileiro', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56);
    expect(lerNumero('0,50')).toBe(0.5);
    expect(lerNumero('R$ 99,90')).toBe(99.9);
  });

  it('lê o formato americano sem confundir com o brasileiro', () => {
    // O desempate é pela ÚLTIMA pontuação. Chutar pela vírgula sozinha
    // transformava "1,234.56" em 1,23456 — erro de mil vezes no preço.
    expect(lerNumero('1,234.56')).toBe(1234.56);
    expect(lerNumero('1234.56')).toBe(1234.56);
  });

  it('trata vazio e lixo como zero, não como NaN', () => {
    expect(lerNumero('')).toBe(0);
    expect(lerNumero(null)).toBe(0);
    expect(lerNumero('abc')).toBe(0);
  });
});

describe('leitura do CSV', () => {
  it('detecta o separador pela primeira linha', () => {
    expect(detectarSeparador('a;b;c')).toBe(';');
    expect(detectarSeparador('a,b,c')).toBe(',');
  });

  it('respeita aspas, inclusive com o separador dentro', () => {
    expect(separarLinhaCsv('"Item A; com ponto e vírgula";PC', ';'))
      .toEqual(['Item A; com ponto e vírgula', 'PC']);
    expect(separarLinhaCsv('"aspas ""dentro""";PC', ';'))
      .toEqual(['aspas "dentro"', 'PC']);
  });

  it('ignora linhas em branco do rodapé que o Excel arrasta junto', () => {
    const celulas = lerCsv('Descrição;Unidade\nItem A;PC\n\n\n');
    expect(celulas).toHaveLength(2);
  });
});

describe('mapeamento de colunas por sinônimo', () => {
  it('reconhece os apelidos usados pelas exportações de ERP', () => {
    const mapa = mapearColunas(['Produto', 'UN', 'Código NCM', 'Valor', 'Categoria']);
    expect(mapa.descricao).toBe(0);
    expect(mapa.unidade).toBe(1);
    expect(mapa.ncm).toBe(2);
    expect(mapa.preco_venda).toBe(3);
    expect(mapa.familia).toBe(4);
  });

  it('devolve -1 para a coluna que a planilha não trouxe', () => {
    expect(mapearColunas(['Descrição']).codigo_ean).toBe(-1);
  });
});

describe('interpretarPlanilha — as duas defesas contra duplicidade', () => {
  it('aceita linhas novas e converte os campos', () => {
    const r = interpretarPlanilha(
      [CABECALHO, ['Item de teste A', 'CX', '1111.22.33', '1.234,56']],
      [],
    );
    expect(r.lidas).toBe(1);
    expect(r.rejeitadas).toHaveLength(0);
    expect(r.novas[0]).toMatchObject({
      descricao: 'Item de teste A',
      unidade: 'CX',
      ncm: '11112233',          // só dígitos
      preco_venda: 1234.56,
    });
  });

  it('recusa a linha cujo produto JÁ ESTÁ no catálogo — a planilha reenviada não dobra o cadastro', () => {
    const r = interpretarPlanilha(
      [CABECALHO, ['Item de teste A', 'PC', '', '10,00']],
      ['Item de teste A'],
    );
    expect(r.novas).toHaveLength(0);
    expect(r.rejeitadas).toEqual([
      { linha: 2, descricao: 'Item de teste A', motivo: 'ja-cadastrada' },
    ]);
  });

  it('compara ignorando acento, caixa e espaço repetido', () => {
    // "CAFÉ  SOLÚVEL" e "cafe soluvel" são o mesmo produto para quem digita.
    const r = interpretarPlanilha(
      [CABECALHO, ['CAFÉ  SOLÚVEL', 'PC', '', '10,00']],
      ['cafe soluvel'],
    );
    expect(r.novas).toHaveLength(0);
    expect(r.rejeitadas[0].motivo).toBe('ja-cadastrada');
  });

  it('recusa a linha repetida DENTRO do próprio arquivo — a primeira passa, a segunda não', () => {
    const r = interpretarPlanilha(
      [
        CABECALHO,
        ['Item de teste B', 'PC', '', '10,00'],
        ['Item de teste B', 'PC', '', '10,00'],
      ],
      [],
    );
    expect(r.novas).toHaveLength(1);
    expect(r.rejeitadas).toEqual([
      { linha: 3, descricao: 'Item de teste B', motivo: 'repetida-na-planilha' },
    ]);
  });

  it('recusa linha sem descrição, que é o único campo obrigatório do cadastro', () => {
    const r = interpretarPlanilha([CABECALHO, ['', 'PC', '', '10,00']], []);
    expect(r.novas).toHaveLength(0);
    expect(r.rejeitadas[0].motivo).toBe('sem-descricao');
  });

  it('não conta linha totalmente vazia como lida nem como rejeitada', () => {
    const r = interpretarPlanilha(
      [CABECALHO, ['Item de teste C', 'PC', '', '1,00'], ['', '', '', '']],
      [],
    );
    expect(r.lidas).toBe(1);
    expect(r.rejeitadas).toHaveLength(0);
  });

  it('usa PC como unidade quando a planilha não traz a coluna', () => {
    const r = interpretarPlanilha([['Descrição'], ['Item de teste D']], []);
    expect(r.novas[0].unidade).toBe('PC');
    expect(r.novas[0].preco_venda).toBe(0);
  });

  it('planilha só com cabeçalho não produz nada', () => {
    expect(interpretarPlanilha([CABECALHO], [])).toEqual({ novas: [], rejeitadas: [], lidas: 0 });
  });
});
