import { describe, it, expect } from 'vitest';
import {
  periodoDoRelatorio, periodoFechado, levantarRiscos, montarRelatorio,
} from '@/lib/metas/relatorio';
import type { Projecao } from '@/lib/metas/projecao';

const R$ = (reais: number) => Math.round(reais * 100);

/** Projeção base: meta 900k, realizado 240k, no ritmo de 30k/dia útil. */
function projecao(over: Partial<Projecao> = {}): Projecao {
  return {
    metaCent: R$(900_000),
    realizadoCent: R$(240_000),
    restanteCent: R$(660_000),
    participacoesNecessarias: 16,
    contratosNecessarios: 4,
    valorAFaturarCent: R$(660_000),
    ritmoDiarioCent: R$(30_000),
    runRateNecessarioCent: R$(55_000),
    gapRitmo: 0.8333,
    projecaoFimMesCent: R$(726_000),
    percentualRealizado: 240_000 / 900_000,
    diasUteisDecorridos: 8,
    diasUteisRestantes: 12,
    premissas: {
      txGanho: 0.25,
      txFaturamento: 0.8,
      ticketPonderadoCent: R$(240_000),
      indiceSazonal: 1.35,
      confianca: 'alta',
      motivosBaixaConfianca: [],
    },
    ...over,
  };
}

describe('periodoDoRelatorio', () => {
  it('Q1 vai do dia 1 ao 15', () => {
    const p = periodoDoRelatorio('Q1', 2026, 9);
    expect(p.inicio).toBe('2026-09-01');
    expect(p.fim).toBe('2026-09-15');
    expect(p.rotulo).toBe('1ª quinzena de setembro/2026');
  });

  it('Q2 vai do dia 16 ao último do mês', () => {
    const p = periodoDoRelatorio('Q2', 2026, 9);
    expect(p.inicio).toBe('2026-09-16');
    expect(p.fim).toBe('2026-09-30');
  });

  it('Q2 respeita fevereiro, inclusive bissexto', () => {
    expect(periodoDoRelatorio('Q2', 2026, 2).fim).toBe('2026-02-28');
    expect(periodoDoRelatorio('Q2', 2024, 2).fim).toBe('2024-02-29');
  });

  it('MES cobre o mês inteiro', () => {
    const p = periodoDoRelatorio('MES', 2026, 9);
    expect(p.inicio).toBe('2026-09-01');
    expect(p.fim).toBe('2026-09-30');
    expect(p.rotulo).toBe('Mês de setembro/2026');
  });
});

describe('periodoFechado', () => {
  const q1 = periodoDoRelatorio('Q1', 2026, 9);

  it('período em curso não está fechado', () => {
    expect(periodoFechado(q1, '2026-09-10')).toBe(false);
  });

  it('o próprio dia do fim ainda não fecha o período', () => {
    expect(periodoFechado(q1, '2026-09-15')).toBe(false);
  });

  it('fecha no dia seguinte ao fim', () => {
    expect(periodoFechado(q1, '2026-09-16')).toBe(true);
  });
});

describe('levantarRiscos', () => {
  const base = { perdidosNoPeriodo: 0, participadosNoPeriodo: 5 };

  it('sem meta, aponta isso e não tenta avaliar o resto', () => {
    const r = levantarRiscos({ ...base, projecao: projecao({ metaCent: 0 }) });
    expect(r).toHaveLength(1);
    expect(r[0].codigo).toBe('sem_meta');
    expect(r[0].severidade).toBe('alta');
  });

  it('projeção abaixo da meta vira risco com o valor que falta', () => {
    const r = levantarRiscos({ ...base, projecao: projecao() });
    const achado = r.find((x) => x.codigo === 'projecao_abaixo_da_meta')!;
    expect(achado).toBeDefined();
    expect(achado.descricao).toContain('174.000'); // 900.000 − 726.000
  });

  it('projeção muito abaixo eleva a severidade', () => {
    const r = levantarRiscos({
      ...base,
      projecao: projecao({ projecaoFimMesCent: R$(300_000) }),
    });
    expect(r.find((x) => x.codigo === 'projecao_abaixo_da_meta')!.severidade).toBe('alta');
  });

  it('meta já alcançada não gera risco de projeção nem de ritmo', () => {
    const r = levantarRiscos({
      ...base,
      projecao: projecao({
        restanteCent: 0, projecaoFimMesCent: R$(950_000), gapRitmo: -0.2,
      }),
    });
    expect(r.find((x) => x.codigo === 'projecao_abaixo_da_meta')).toBeUndefined();
    expect(r.find((x) => x.codigo === 'gap_de_ritmo')).toBeUndefined();
  });

  it('nenhuma proposta enviada é risco alto quando ainda falta meta', () => {
    const r = levantarRiscos({ ...base, participadosNoPeriodo: 0, projecao: projecao() });
    const achado = r.find((x) => x.codigo === 'sem_participacao')!;
    expect(achado.severidade).toBe('alta');
    expect(achado.acao).toContain('16');
  });

  it('prazo curto com meta em aberto vira risco', () => {
    const r = levantarRiscos({ ...base, projecao: projecao({ diasUteisRestantes: 2 }) });
    expect(r.find((x) => x.codigo === 'prazo_curto')).toBeDefined();
  });

  it('motivo de perda concentrado só acusa com amostra e maioria', () => {
    const comMaioria = levantarRiscos({
      ...base,
      projecao: projecao(),
      motivoPerdaDominante: { label: 'Preço', quantidade: 3, total: 4 },
    });
    expect(comMaioria.find((x) => x.codigo === 'motivo_perda_concentrado')).toBeDefined();

    const amostraPequena = levantarRiscos({
      ...base,
      projecao: projecao(),
      motivoPerdaDominante: { label: 'Preço', quantidade: 2, total: 2 },
    });
    expect(amostraPequena.find((x) => x.codigo === 'motivo_perda_concentrado')).toBeUndefined();

    const semMaioria = levantarRiscos({
      ...base,
      projecao: projecao(),
      motivoPerdaDominante: { label: 'Preço', quantidade: 2, total: 6 },
    });
    expect(semMaioria.find((x) => x.codigo === 'motivo_perda_concentrado')).toBeUndefined();
  });

  it('baixa confiança entra como risco informativo, não alarme', () => {
    const r = levantarRiscos({
      ...base,
      projecao: projecao({
        premissas: {
          txGanho: 0.2, txFaturamento: 0.7, ticketPonderadoCent: R$(200_000),
          indiceSazonal: 1, confianca: 'baixa',
          motivosBaixaConfianca: ['Sem histórico de conversão.'],
        },
      }),
    });
    const achado = r.find((x) => x.codigo === 'baixa_confianca')!;
    expect(achado.severidade).toBe('baixa');
    expect(achado.acao).toContain('Sem histórico');
  });
});

describe('montarRelatorio', () => {
  const entrada = {
    tipo: 'Q1' as const,
    ano: 2026,
    mes: 9,
    hoje: '2026-09-10',
    colaborador: 'Maria',
    projecao: projecao(),
    realizado: { participados: 8, ganhos: 2, perdidos: 4, pedidos_faturados: 3, nfe_quitadas: 1 },
    motivosPerda: [{ label: 'Preço', quantidade: 3 }, { label: 'Prazo', quantidade: 1 }],
    atividades: [{ modulo: 'licitacoes', quantidade: 12 }],
  };

  it('marca como parcial quando o período ainda está em curso', () => {
    expect(montarRelatorio(entrada).parcial).toBe(true);
    expect(montarRelatorio({ ...entrada, hoje: '2026-09-20' }).parcial).toBe(false);
  });

  it('calcula a taxa de conversão do período', () => {
    const rel = montarRelatorio(entrada);
    const linha = rel.indicadores.find((i) => i.rotulo === 'Taxa de conversão do período')!;
    expect(linha.valor).toBe('25%'); // 2 ganhos / 8 participados
  });

  it('sem participação, a conversão fica em branco em vez de dividir por zero', () => {
    const rel = montarRelatorio({
      ...entrada,
      realizado: { ...entrada.realizado, participados: 0, ganhos: 0 },
    });
    expect(rel.indicadores.find((i) => i.rotulo === 'Taxa de conversão do período')!.valor).toBe('—');
  });

  it('traz as sugestões do motor com números exatos', () => {
    const rel = montarRelatorio(entrada);
    expect(rel.sugestoes.find((s) => s.rotulo === 'Processos a participar')!.valor).toBe('16');
    expect(rel.sugestoes.find((s) => s.rotulo === 'Contratos a fechar')!.valor).toBe('4');
  });

  it('meta batida troca as sugestões por uma única linha de situação', () => {
    const rel = montarRelatorio({ ...entrada, projecao: projecao({ restanteCent: 0 }) });
    expect(rel.sugestoes).toHaveLength(1);
    expect(rel.sugestoes[0].valor).toContain('Meta alcançada');
  });

  it('registra as premissas usadas, para o relatório ser auditável depois', () => {
    const rel = montarRelatorio(entrada);
    expect(rel.premissas.find((p) => p.rotulo === 'Conversão participado → ganho')!.valor).toBe('25%');
    expect(rel.premissas.find((p) => p.rotulo === 'Índice de sazonalidade')!.valor).toBe('1.35');
  });

  it('detecta a concentração de motivo de perda a partir da lista', () => {
    const rel = montarRelatorio(entrada); // 3 de 4 perdas por Preço
    expect(rel.riscos.find((r) => r.codigo === 'motivo_perda_concentrado')).toBeDefined();
  });
});
