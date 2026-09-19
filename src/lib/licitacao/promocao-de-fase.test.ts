import { describe, expect, it } from 'vitest';
import { podePromover, sessaoDoRoboEhDisputa } from './promocao-de-fase';

/**
 * A promoção automática de fase (19/09) só anda para a frente e nunca decide
 * desfecho. O que se trava aqui é a fronteira: quem pode subir, quem não.
 */
describe('podePromover — só para a frente, só de processo vivo', () => {
  it('radar sobe para Proposta Enviada e para Em Disputa', () => {
    expect(podePromover('Monitorando', null, 'Proposta Enviada')).toBe(true);
    expect(podePromover('Em Análise', null, 'Proposta Enviada')).toBe(true);
    expect(podePromover('Monitorando', null, 'Em Disputa')).toBe(true);
  });

  it('Proposta Enviada sobe para Em Disputa, mas Em Disputa não volta', () => {
    expect(podePromover('Proposta Enviada', null, 'Em Disputa')).toBe(true);
    expect(podePromover('Em Disputa', null, 'Proposta Enviada')).toBe(false);
  });

  it('já na fase alvo, não toca — o gatilho do banco nem roda', () => {
    expect(podePromover('Em Disputa', null, 'Em Disputa')).toBe(false);
    expect(podePromover('Proposta Enviada', null, 'Proposta Enviada')).toBe(false);
  });

  it('decidido e arquivado ficam como estão: desfecho é decisão da pessoa', () => {
    for (const decidido of ['Vencida', 'Homologada', 'Perdida']) {
      expect(podePromover(decidido, null, 'Em Disputa'), decidido).toBe(false);
    }
    expect(podePromover('Monitorando', '2026-09-10T12:00:00.000Z', 'Em Disputa')).toBe(false);
    expect(podePromover('Arquivada', null, 'Proposta Enviada')).toBe(false);
  });

  it('grafia antiga do banco entra pela régua única: "Publicado" e vazio são radar', () => {
    expect(podePromover('Publicado', null, 'Em Disputa')).toBe(true);
    expect(podePromover(null, null, 'Proposta Enviada')).toBe(true);
    expect(podePromover('Homologado', null, 'Em Disputa')).toBe(false);
  });
});

describe('sessaoDoRoboEhDisputa — acompanhar não é participar', () => {
  const agora = new Date('2026-09-19T14:00:00-03:00');

  it('sessão marcada como acompanhamento não promove, seja qual for a data', () => {
    expect(sessaoDoRoboEhDisputa({ soAcompanhamento: true, dataSessao: '2026-09-25', horario: '09:00' }, agora)).toBe(false);
  });

  it('sessão de dia anterior é acompanhamento mesmo sem a marca', () => {
    expect(sessaoDoRoboEhDisputa({ dataSessao: '2026-09-18', horario: '09:00' }, agora)).toBe(false);
  });

  it('sessão de hoje (já aberta ou não), futura ou sem data é disputa', () => {
    expect(sessaoDoRoboEhDisputa({ dataSessao: '2026-09-19', horario: '09:00' }, agora)).toBe(true);
    expect(sessaoDoRoboEhDisputa({ dataSessao: '2026-09-19', horario: '16:00' }, agora)).toBe(true);
    expect(sessaoDoRoboEhDisputa({ dataSessao: '2026-09-25', horario: '09:00' }, agora)).toBe(true);
    expect(sessaoDoRoboEhDisputa({ dataSessao: undefined, horario: '' }, agora)).toBe(true);
  });
});
