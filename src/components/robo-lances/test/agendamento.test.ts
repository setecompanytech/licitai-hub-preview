import { describe, it, expect } from 'vitest';
import { acaoPrincipalDaAgenda, agendamentoDaDisputa, MINUTOS_DE_ANTECEDENCIA, sessaoDoProcesso } from '@/lib/robo/agendamento';

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
 * O que fica no lugar do "Enviar ao robô" (17/09): com data e hora, o robô
 * entra sozinho e o destaque é quando; sem elas, o destaque leva a definir.
 */
describe('acaoPrincipalDaAgenda', () => {
  const agenda = agendamentoDaDisputa({ dataSessao: '2026-10-23', horario: '09:30' });
  const as = (hhmm: string, dia = '2026-10-23') => new Date(`${dia}T${hhmm}:00`);

  it('agendada e ligado: "Robô entra sozinho", com dia e hora da entrada', () => {
    expect(acaoPrincipalDaAgenda(agenda, as('08:00', '2026-10-20'), true)).toEqual({
      tipo: 'entra-sozinho',
      texto: 'Robô entra sozinho 23/10 às 09:15',
    });
  });

  it('agendada e desligado: diz que não entra', () => {
    expect(acaoPrincipalDaAgenda(agenda, as('08:00'), false)).toEqual({
      tipo: 'robo-desligado',
      texto: 'Robô da empresa desligado — não entra 23/10 às 09:15',
    });
  });

  it('passou da hora de entrar, sessão ainda alcançável: aponta para "Entrar agora"', () => {
    const a = acaoPrincipalDaAgenda(agenda, as('09:40'), true);
    expect(a.tipo).toBe('hora-de-entrar');
    expect(a.tipo === 'hora-de-entrar' && a.texto).toMatch(/Ações › Entrar agora/);
  });

  it('a sessão já passou (mais de 20 min): "Definir nova data"', () => {
    expect(acaoPrincipalDaAgenda(agenda, as('09:51'), true)).toEqual({ tipo: 'definir-data', rotulo: 'Definir nova data' });
  });

  it('sem data ou sem horário: "Definir data da sessão"', () => {
    expect(acaoPrincipalDaAgenda(agendamentoDaDisputa({ horario: '09:30' }), as('08:00'), true))
      .toEqual({ tipo: 'definir-data', rotulo: 'Definir data da sessão' });
    expect(acaoPrincipalDaAgenda(agendamentoDaDisputa({}), as('08:00'), false))
      .toEqual({ tipo: 'definir-data', rotulo: 'Definir data da sessão' });
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
