import { describe, it, expect } from 'vitest';
import { faixaDaEntrada, tempoCorrido } from '@/lib/robo/entrada-do-robo';

/**
 * A página da disputa reage enquanto o robô entra (17/09/2026): nada de tela
 * parada entre o clique e o primeiro retrato da sala.
 */
const AGORA = new Date('2026-09-17T12:00:00Z');
const antes = (s: number) => new Date(AGORA.getTime() - s * 1000).toISOString();
const base = { enviando: false, sessaoCriadaEm: null, esperandoPessoa: false, portal: 'Compras.gov.br', agora: AGORA };

describe('faixaDaEntrada', () => {
  it('clique indo ao servidor: "Enviando ao robô…"', () => {
    expect(faixaDaEntrada({ ...base, estado: 'sem_sessao', enviando: true })?.titulo).toBe('Enviando ao robô…');
  });

  it('entrando: "Ligando o robô" com o tempo correndo e o que ele está fazendo', () => {
    const f = faixaDaEntrada({ ...base, estado: 'enviando', sessaoCriadaEm: antes(23) });
    expect(f).toMatchObject({ tom: 'andamento', titulo: 'Ligando o robô · há 23 s', verAcompanhamento: false });
    expect(f?.detalhe).toContain('procurando a compra no Compras.gov.br');
  });

  it('entrada demorada vira atenção, com o que fazer', () => {
    const f = faixaDaEntrada({ ...base, estado: 'enviando', sessaoCriadaEm: antes(150) });
    expect(f).toMatchObject({ tom: 'atencao', titulo: 'Ainda entrando no Compras.gov.br · há 2 min 30 s' });
  });

  it('captcha pedido: diz que espera o clique, antes do tempo', () => {
    expect(faixaDaEntrada({ ...base, estado: 'enviando', sessaoCriadaEm: antes(40), esperandoPessoa: true })?.titulo)
      .toBe('O robô está esperando o clique no captcha do gov.br');
  });

  it('acabou de entrar: "Robô na sala" com atalho para o acompanhamento; depois some', () => {
    expect(faixaDaEntrada({ ...base, estado: 'operando', sessaoCriadaEm: antes(30) })).toMatchObject({ tom: 'na-sala', verAcompanhamento: true });
    expect(faixaDaEntrada({ ...base, estado: 'operando', sessaoCriadaEm: antes(600) })).toBeNull();
  });

  it('sem sessão, parado ou com erro: nada', () => {
    expect(faixaDaEntrada({ ...base, estado: 'sem_sessao' })).toBeNull();
    expect(faixaDaEntrada({ ...base, estado: 'parado', sessaoCriadaEm: antes(10) })).toBeNull();
    expect(faixaDaEntrada({ ...base, estado: 'erro', sessaoCriadaEm: antes(10) })).toBeNull();
  });

  it('tempo corrido legível', () => {
    expect(tempoCorrido(5)).toBe('5 s');
    expect(tempoCorrido(60)).toBe('1 min');
    expect(tempoCorrido(125)).toBe('2 min 5 s');
  });
});
