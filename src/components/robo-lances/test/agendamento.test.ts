import { describe, it, expect } from 'vitest';
import { agendamentoDaDisputa, MINUTOS_DE_ANTECEDENCIA, sessaoDoProcesso } from '@/lib/robo/agendamento';

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

/**
 * A sessão lida do processo (Fase 8): data e horário em Brasília, da abertura
 * quando existe, senão do fim do prazo de propostas.
 */
describe('sessaoDoProcesso', () => {
  it('processo do PNCP sem abertura: usa o fim do prazo de propostas, em Brasília', () => {
    // 7/2026 SEDUC/PA, gravado com o fuso certo (08:59 em Brasília = 11:59 UTC).
    expect(sessaoDoProcesso({ data_abertura: null, data_encerramento: '2026-09-14T11:59:00+00:00' })).toEqual({
      dataSessao: '2026-09-14',
      horario: '08:59',
      fonte: 'encerramento',
      horarioIncomum: false,
    });
  });

  it('a abertura manda quando existe', () => {
    // Pasta manual 02/2026: abertura 09:00 e encerramento 12:00, em Brasília.
    const s = sessaoDoProcesso({ data_abertura: '2026-08-31T12:00:00+00:00', data_encerramento: '2026-08-31T15:00:00+00:00' });
    expect(s).toMatchObject({ dataSessao: '2026-08-31', horario: '09:00', fonte: 'abertura' });
  });

  it('importação com o fuso errado aparece 3 horas adiantada e volta marcada para conferir', () => {
    // O PNCP manda "2026-09-18T09:00:00" sem fuso; gravado cru, vira 09:00 UTC = 06:00 em Brasília.
    expect(sessaoDoProcesso({ data_encerramento: '2026-09-18T09:00:00+00:00' })).toMatchObject({
      horario: '06:00',
      horarioIncomum: true,
    });
  });

  it('sessão logo depois da meia-noite UTC continua no dia certo em Brasília', () => {
    expect(sessaoDoProcesso({ data_abertura: '2026-10-01T01:30:00Z' })).toMatchObject({ dataSessao: '2026-09-30', horario: '22:30' });
  });

  it('só a data: não inventa horário nem desloca o dia', () => {
    expect(sessaoDoProcesso({ data_abertura: '2026-09-20' })).toEqual({
      dataSessao: '2026-09-20',
      horario: null,
      fonte: 'abertura',
      horarioIncomum: false,
    });
  });

  it('sem data nenhuma, ou data ilegível: nada a puxar', () => {
    expect(sessaoDoProcesso({ data_abertura: null, data_encerramento: null })).toBeNull();
    expect(sessaoDoProcesso({ data_abertura: 'amanhã' })).toBeNull();
  });
});
