import { describe, it, expect } from 'vitest';
import { agendamentoDaDisputa, MINUTOS_DE_ANTECEDENCIA } from '@/lib/robo/agendamento';

/**
 * O texto do agendamento que a tela mostra. O agendador só despacha disputa com
 * data E horário, 15 minutos antes — e a tela tem de dizer isso do mesmo jeito.
 */
describe('agendamentoDaDisputa', () => {
  it('data e horário: diz quando é a sessão e quando o robô entra sozinho', () => {
    const a = agendamentoDaDisputa({ dataSessao: '2026-10-23', horario: '08:45' });
    expect(a.tipo).toBe('agendada');
    if (a.tipo !== 'agendada') return;
    expect(a.texto).toBe('23/10/2026 às 08:45');
    expect(a.textoEntrada).toBe('às 08:30');
    expect(a.sessaoEm.getTime() - a.roboEntraEm.getTime()).toBe(MINUTOS_DE_ANTECEDENCIA * 60_000);
  });

  it('sessão logo depois da meia-noite: o robô entra na véspera, e o texto diz o dia', () => {
    const a = agendamentoDaDisputa({ dataSessao: '2026-10-23', horario: '00:10' });
    expect(a.tipo === 'agendada' && a.textoEntrada).toBe('em 22/10/2026 às 23:55');
  });

  it('lê o instante gravado no banco, no fuso de quem vê', () => {
    const gravado = new Date('2026-10-23T08:45:00').toISOString();
    const a = agendamentoDaDisputa({ inicioSessao: gravado, horario: '08:45' });
    expect(a.tipo === 'agendada' && a.texto).toBe('23/10/2026 às 08:45');
  });

  it('só o horário não agenda — é o caso que passava calado', () => {
    expect(agendamentoDaDisputa({ horario: '09:00' })).toEqual({ tipo: 'so-horario', texto: '09:00' });
  });

  it('só a data também não: sem horário o agendador não tem instante', () => {
    expect(agendamentoDaDisputa({ dataSessao: '2026-10-23', horario: '' })).toEqual({ tipo: 'so-data', texto: '23/10/2026' });
  });

  it('nada preenchido', () => {
    expect(agendamentoDaDisputa({})).toEqual({ tipo: 'sem-agenda' });
    expect(agendamentoDaDisputa({ inicioSessao: 'lixo', horario: null })).toEqual({ tipo: 'sem-agenda' });
  });
});
