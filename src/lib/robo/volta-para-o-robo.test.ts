import { describe, it, expect } from 'vitest';
import {
  LINK_DO_ROBO, botaoDaVolta, caminhoDaDisputa, destinoDaVolta, linkDaTelaRemotaDe, origemDaChamada,
} from './volta-para-o-robo';

/** A volta para o robô (Ian, 17/09/2026): o botão muda com a URL da visita. */
describe('volta-para-o-robo', () => {
  it('vindo da chamada da tela remota, o botão volta para a tela de origem', () => {
    const b = botaoDaVolta('/robo-lances/disputa/d1');
    expect(b).toEqual({
      rotulo: 'Voltar para o robô',
      para: '/robo-lances/disputa/d1',
      destacado: true,
      descricao: 'Volta para a tela do Robô de Lances de onde você veio',
    });
  });

  it('sem parâmetro na URL — quem abriu pelo menu — é o estado inicial, discreto', () => {
    for (const bruto of [null, undefined, '', '   ']) {
      const b = botaoDaVolta(bruto);
      expect(b.rotulo).toBe('Ir para o Robô de Lances');
      expect(b.para).toBe(LINK_DO_ROBO);
      expect(b.destacado).toBe(false);
    }
  });

  it('só caminho do robô do cliente: nada que saia do app vira "voltar"', () => {
    expect(destinoDaVolta('/robo-lances')).toBe('/robo-lances');
    expect(destinoDaVolta('/robo-lances/disputa/abc-123')).toBe('/robo-lances/disputa/abc-123');
    expect(destinoDaVolta('//evil.com')).toBeNull();
    expect(destinoDaVolta('https://evil.com/robo-lances')).toBeNull();
    expect(destinoDaVolta('/robo-lances/../admin/financeiro')).toBeNull();
    expect(destinoDaVolta('/robo-lances-falso')).toBeNull();
    expect(destinoDaVolta('/dashboard')).toBeNull();
    // O botão nunca aponta para a própria tela do admin.
    expect(destinoDaVolta('/admin/robo-lances')).toBeNull();
  });

  it('o link da tela remota carrega a volta, e sem origem fica como era', () => {
    expect(linkDaTelaRemotaDe('/robo-lances/disputa/d1')).toBe(
      '/admin/robo-lances?aba=sessoes&tela=abrir&voltar=%2Frobo-lances%2Fdisputa%2Fd1',
    );
    expect(linkDaTelaRemotaDe('/dashboard')).toBe('/admin/robo-lances?aba=sessoes&tela=abrir');
    expect(linkDaTelaRemotaDe(null)).toBe('/admin/robo-lances?aba=sessoes&tela=abrir');
  });

  it('a origem é a disputa da chamada; sem ela, a tela do robô onde a pessoa está', () => {
    expect(origemDaChamada({ disputaId: 'd1' }, '/dashboard')).toBe(caminhoDaDisputa('d1'));
    expect(origemDaChamada({ disputaId: null }, '/robo-lances')).toBe('/robo-lances');
    expect(origemDaChamada({ disputaId: null }, '/dashboard')).toBeNull();
  });
});
