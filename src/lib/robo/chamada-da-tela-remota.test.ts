import { describe, it, expect, beforeEach } from 'vitest';
import {
  LINK_DA_TELA_REMOTA, chamadaAtual, chamadaDaEntrada, chamadaDoAviso, chamarTelaRemota, ehChamadaDaTelaRemota,
  fecharChamadaDaTelaRemota, mensagemSemEndereco, sessaoParou,
} from './chamada-da-tela-remota';

/** A chamada da tela remota (Ian, 17/09/2026): no clique, some quando o robô para. */
describe('chamada-da-tela-remota', () => {
  beforeEach(() => fecharChamadaDaTelaRemota());

  it('leva à aba de sessões do admin, já abrindo a tela', () => {
    expect(LINK_DA_TELA_REMOTA).toBe('/admin/robo-lances?aba=sessoes&tela=abrir');
  });

  it('a chamada da entrada: título com o edital, e só sessão nova conta', () => {
    const c = chamadaDaEntrada({ disputaId: 'd1', edital: '07/2026', portal: 'Compras.gov.br', agora: new Date('2026-09-17T18:00:10Z') });
    expect(c.titulo).toBe('Robô entrando — 07/2026');
    expect(c.mensagem).toMatch(/no Compras\.gov\.br.*captcha/);
    expect(c.sessaoDesde).toBe('2026-09-17T18:00:05.000Z');
  });

  it('uma chamada por vez; fechar pelo id não fecha a que chegou depois', () => {
    const primeira = chamarTelaRemota({ motivo: 'entrando', titulo: 'A', mensagem: '', disputaId: null, sessaoDesde: null });
    const segunda = chamarTelaRemota({ motivo: 'captcha', titulo: 'B', mensagem: '', disputaId: null, sessaoDesde: null });
    fecharChamadaDaTelaRemota(primeira);
    expect(chamadaAtual()?.id).toBe(segunda);
    fecharChamadaDaTelaRemota(segunda);
    expect(chamadaAtual()).toBeNull();
  });

  it('só o aviso que leva ao admin do robô vira chamada', () => {
    expect(ehChamadaDaTelaRemota({ link: '/admin/robo-lances' })).toBe(true);
    expect(ehChamadaDaTelaRemota({ link: '/admin/robo-lances?aba=sessoes&tela=abrir' })).toBe(true);
    expect(ehChamadaDaTelaRemota({ link: '/robo-lances/disputa/d1' })).toBe(false);
    expect(ehChamadaDaTelaRemota({ link: null })).toBe(false);
  });

  it('o aviso de captcha perde o endereço da tela remota e o emoji do título', () => {
    const c = chamadaDoAviso({
      id: 'n1',
      titulo: '🧑 Robô esperando uma pessoa — 07/2026',
      mensagem: 'O robô parou em Compras.gov.br esperando o clique no captcha do gov.br, até as 16:40. Tela remota: https://agente.praefectus.com.br/vnc/vnc.html?path=/vnc/',
      created_at: '2026-09-17T19:30:00Z',
    });
    expect(c).toMatchObject({ id: 'aviso-n1', motivo: 'captcha', titulo: 'Robô esperando uma pessoa — 07/2026' });
    expect(c.mensagem).toBe('O robô parou em Compras.gov.br esperando o clique no captcha do gov.br, até as 16:40.');
    expect(chamadaDoAviso({ id: 'n2', titulo: '📺 Assistir o robô ao vivo — 07/2026', mensagem: null, created_at: '' }).motivo).toBe('ao-vivo');
    // O aviso do servidor a quem opera, no envio da sessão (19/09).
    const entrando = chamadaDoAviso({ id: 'n3', titulo: '🤖 Robô entrando — 07/2026', mensagem: null, created_at: '' });
    expect(entrando).toMatchObject({ motivo: 'entrando', titulo: 'Robô entrando — 07/2026' });
    expect(mensagemSemEndereco('O robô entrou. Aviso só da equipe Praefectus: a tela remota não é mostrada a clientes.')).toBe('O robô entrou.');
  });

  it('a sessão parou: encerrada, com erro ou com parada confirmada', () => {
    expect(sessaoParou({ status: 'encerrado' })).toBe(true);
    expect(sessaoParou({ status: 'erro' })).toBe(true);
    expect(sessaoParou({ status: 'ativo', parada_confirmada_em: '2026-09-17T19:00:00Z' })).toBe(true);
    expect(sessaoParou({ status: 'enviando' })).toBe(false);
    expect(sessaoParou(undefined)).toBe(false);
  });
});
