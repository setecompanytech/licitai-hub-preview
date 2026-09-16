import { describe, it, expect } from 'vitest';
import { agendaDoRobo, horaDeEntradaDoRobo, type DisputaNoCalendario } from '@/lib/robo/robo-no-calendario';

/** O robô agendado no calendário (Fase 8). */

const diaUTC = (d: Date) => d.toISOString().slice(0, 10);

describe('horaDeEntradaDoRobo', () => {
  it('15 minutos antes da sessão, em Brasília', () => {
    expect(horaDeEntradaDoRobo('2026-09-17T12:00:00Z')).toBe('08:45');
    expect(horaDeEntradaDoRobo('lixo')).toBeNull();
  });
});

describe('agendaDoRobo', () => {
  const disputas: DisputaNoCalendario[] = [
    { id: 'b', edital: '08/2026', inicio_sessao: '2026-09-17T14:00:00Z', licitacao_id: 'proc-1' },
    { id: 'a', edital: '07/2026', inicio_sessao: '2026-09-17T12:00:00Z', licitacao_id: 'proc-1' },
    { id: 'c', edital: '09/2026', inicio_sessao: '2026-09-18T12:00:00Z', licitacao_id: null },
    { id: 'sem-data', edital: '10/2026', inicio_sessao: null, licitacao_id: 'proc-2' },
  ];

  it('por processo e por dia, na ordem do horário; disputa sem data fica de fora', () => {
    const { porProcesso, porDia } = agendaDoRobo(disputas, diaUTC);
    expect(porProcesso.get('proc-1')?.map((d) => d.id)).toEqual(['a', 'b']);
    expect(porProcesso.has('proc-2')).toBe(false);
    expect(porDia.get('2026-09-17')?.map((d) => d.id)).toEqual(['a', 'b']);
    expect(porDia.get('2026-09-18')?.map((d) => d.id)).toEqual(['c']);
  });
});
