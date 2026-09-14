import { describe, expect, it } from 'vitest';
import { colunaSobOPonteiro, velocidadeDeRolagem, FAIXA_DE_ROLAGEM_PX, ROLAGEM_MAXIMA_PX, type Retangulo } from './arrasto';

/**
 * A regra do destino e da rolagem durante o arrasto, sem navegador.
 *
 * Quadro de 1.000 px de largura visível; colunas de 260 px com vão de 12 px, a
 * quarta (Arquivada) parcialmente escondida atrás da borda direita.
 */
const quadro: Retangulo = { left: 0, right: 1000, top: 100, bottom: 900 };
const coluna = (id: string, left: number) => ({ id, rect: { left, right: left + 260, top: 100, bottom: 900 } });
const colunas = [coluna('Proposta Enviada', 0), coluna('Em Disputa', 272), coluna('Perdida', 544), coluna('Arquivada', 816)];

describe('colunaSobOPonteiro', () => {
  it('acha a coluna pelo retângulo — o que estiver desenhado por cima não interfere', () => {
    // O botão flutuante do chat ficava sobre a Arquivada: com `elementFromPoint`
    // o destino era o botão. Aqui só a geometria das colunas conta.
    expect(colunaSobOPonteiro(950, 860, colunas, quadro)).toBe('Arquivada');
    expect(colunaSobOPonteiro(400, 300, colunas, quadro)).toBe('Em Disputa');
  });

  it('ponteiro além da borda conta como a coluna visível junto à borda — nunca uma escondida', () => {
    // A pessoa empurra o cartão para fora do quadro, rumo à última coluna. A
    // Arquivada aparece até 1.000 px; uma quinta coluna, inteira atrás da
    // borda, não pode ser escolhida às cegas.
    const comEscondida = [...colunas, coluna('Escondida', 1088)];
    expect(colunaSobOPonteiro(1040, 300, comEscondida, quadro)).toBe('Arquivada');
    expect(colunaSobOPonteiro(1400, 300, comEscondida, quadro)).toBe('Arquivada');
  });

  it('no vão entre colunas escolhe a mais próxima, em vez de devolver o cartão', () => {
    expect(colunaSobOPonteiro(265, 300, colunas, quadro)).toBe('Proposta Enviada');
    expect(colunaSobOPonteiro(269, 300, colunas, quadro)).toBe('Em Disputa');
  });

  it('fora do quadro não há destino', () => {
    expect(colunaSobOPonteiro(400, 50, colunas, quadro)).toBeNull();
  });
});

describe('velocidadeDeRolagem', () => {
  it('no meio do quadro não rola', () => {
    expect(velocidadeDeRolagem(500, 300, quadro)).toBe(0);
  });

  it('perto da borda direita rola para a direita, mais rápido quanto mais perto', () => {
    const longe = velocidadeDeRolagem(1000 - FAIXA_DE_ROLAGEM_PX + 10, 300, quadro);
    const perto = velocidadeDeRolagem(995, 300, quadro);
    expect(longe).toBeGreaterThan(0);
    expect(perto).toBeGreaterThan(longe);
  });

  it('passar da borda rola na velocidade máxima', () => {
    expect(velocidadeDeRolagem(1300, 300, quadro)).toBe(ROLAGEM_MAXIMA_PX);
  });

  it('perto da borda esquerda rola para a esquerda', () => {
    expect(velocidadeDeRolagem(5, 300, quadro)).toBeLessThan(0);
  });

  it('acima ou abaixo do quadro não rola', () => {
    expect(velocidadeDeRolagem(995, 50, quadro)).toBe(0);
    expect(velocidadeDeRolagem(995, 950, quadro)).toBe(0);
  });

  it('em quadro estreito a faixa não toma o quadro inteiro', () => {
    const estreito: Retangulo = { left: 0, right: 200, top: 0, bottom: 500 };
    expect(velocidadeDeRolagem(100, 250, estreito)).toBe(0);
  });
});
