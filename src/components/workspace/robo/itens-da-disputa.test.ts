import { describe, expect, it } from 'vitest';
import { linhasDaDisputa, situacaoDoItem, type ItemDaSessao } from './itens-da-disputa';

/**
 * O casamento item da disputa × item da sessão.
 *
 * O defeito que estes casos impedem é silencioso: um lance real exibido na
 * linha do item errado parece correto, e ninguém confere o que parece
 * correto. Por isso a regra está travada por escrito — identificador, depois
 * lote + número, nunca descrição, nunca posição, e ambiguidade vira ausência.
 */

const daSessao = (ajuste: Partial<ItemDaSessao>): ItemDaSessao => ({
  sessao_id: 'sessao-1',
  numero: 1,
  lote: null,
  descricao: null,
  seu_ultimo_lance: null,
  melhor_lance: null,
  sou_lider: null,
  situacao: null,
  valor_minimo: null,
  licitacao_item_id: null,
  ...ajuste,
});

describe('linhasDaDisputa — casamento dos itens', () => {
  it('casa pelo licitacao_item_id quando os dois lados o têm, mesmo com número divergente', () => {
    const [linha] = linhasDaDisputa(
      [{ licitacao_item_id: 'li-7', numero: 1, lote: '1', descricao: 'Papel A4' }],
      [daSessao({ licitacao_item_id: 'li-7', numero: 9, lote: '3', seu_ultimo_lance: 10 })],
    );
    expect(linha.daSessao?.seu_ultimo_lance).toBe(10);
  });

  it('sem identificador, casa por lote + número, ignorando caixa e espaços do lote', () => {
    const [linha] = linhasDaDisputa([{ numero: 2, lote: 'Lote A' }], [daSessao({ numero: 2, lote: ' lote a ', melhor_lance: 5 })]);
    expect(linha.daSessao?.melhor_lance).toBe(5);
  });

  it('nunca casa por descrição', () => {
    const [linha] = linhasDaDisputa(
      [{ numero: 1, lote: '1', descricao: 'Caneta azul' }],
      [daSessao({ numero: 2, lote: '1', descricao: 'Caneta azul', seu_ultimo_lance: 3 })],
    );
    expect(linha.daSessao).toBeNull();
  });

  it('nunca casa por posição na lista', () => {
    const linhas = linhasDaDisputa([{ numero: 5 }, { numero: 6 }], [daSessao({ numero: 7 }), daSessao({ numero: 8 })]);
    expect(linhas.map((l) => l.daSessao)).toEqual([null, null]);
  });

  it('identificadores divergentes não caem no lote + número', () => {
    const [linha] = linhasDaDisputa(
      [{ licitacaoItemId: 'a', numero: 1, lote: '1' }],
      [daSessao({ licitacao_item_id: 'b', numero: 1, lote: '1' })],
    );
    expect(linha.daSessao).toBeNull();
  });

  it('duas linhas da sessão com o mesmo lote e número: ambiguidade vira ausência', () => {
    const [linha] = linhasDaDisputa(
      [{ numero: 1, lote: '1' }],
      [daSessao({ numero: 1, lote: '1', seu_ultimo_lance: 10 }), daSessao({ numero: 1, lote: '1', seu_ultimo_lance: 20 })],
    );
    expect(linha.daSessao).toBeNull();
  });

  it('limite zero ou ausente é "sem limite", nunca "pode descer até zero"', () => {
    const linhas = linhasDaDisputa([{ numero: 1, valorMinimo: 0 }, { numero: 2, valor_minimo: 750 }, { numero: 3 }], []);
    expect(linhas.map((l) => l.limite)).toEqual([null, 750, null]);
  });

  it('lance final fechado nas duas grafias; zero ou ausente é "não definido"', () => {
    const linhas = linhasDaDisputa(
      [{ numero: 1, lanceFinalFechado: 77.5 }, { numero: 2, lance_final_fechado: '88' }, { numero: 3, lanceFinalFechado: 0 }, { numero: 4 }],
      [],
    );
    expect(linhas.map((l) => l.lanceFinalFechado)).toEqual([77.5, 88, null, null]);
  });

  it('gera chaves únicas mesmo para itens repetidos', () => {
    const linhas = linhasDaDisputa([{ numero: 1, lote: '1' }, { numero: 1, lote: '1' }], []);
    expect(new Set(linhas.map((l) => l.chave)).size).toBe(2);
  });

  it('itens ausentes ou fora de lista viram tabela vazia', () => {
    expect(linhasDaDisputa(null, [])).toEqual([]);
    expect(linhasDaDisputa({ numero: 1 }, [])).toEqual([]);
  });
});

describe('situacaoDoItem', () => {
  const linha = (sessao: Partial<ItemDaSessao> | null) =>
    linhasDaDisputa([{ numero: 1 }], sessao ? [daSessao({ numero: 1, ...sessao })] : [])[0];

  it('liderança nula não vira "Você lidera" nem "Outro lidera"', () => {
    expect(situacaoDoItem(linha({ sou_lider: null, situacao: null }), true)).toEqual({ rotulo: 'Não informado', tom: 'indisponivel' });
  });

  it('distingue sem sessão de item sem registro', () => {
    expect(situacaoDoItem(linha(null), false).rotulo).toBe('Robô não iniciado');
    expect(situacaoDoItem(linha(null), true).rotulo).toBe('Não informado');
  });

  it('lê a liderança informada pelo portal', () => {
    expect(situacaoDoItem(linha({ sou_lider: true }), true).rotulo).toBe('Você lidera');
    expect(situacaoDoItem(linha({ sou_lider: false }), true).rotulo).toBe('Outro participante lidera');
  });
});
