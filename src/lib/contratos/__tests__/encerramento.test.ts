import { describe, it, expect } from 'vitest';
import {
  sugestaoDeEncerramento,
  aditivoPosteriorAoEncerramento,
  saldoDaCarteira,
  atendeAoFiltroDeSituacao,
  explicacaoDaSituacao,
  rotuloDoMotivo,
  FILTRO_DE_SITUACAO_PADRAO,
} from '../encerramento';

/**
 * Decisões do dono de 21/09 sobre o fim do contrato: o sistema SUGERE, quem
 * opera DECLARA; a carteira deixa encerrados e saldo negativo de fora; a lista
 * esconde encerrados por padrão. Nenhum valor aqui é de contrato real.
 */

const sinais = (over: Partial<Parameters<typeof sugestaoDeEncerramento>[0]> = {}) => ({
  encerrado: false,
  saldoEsgotado: false,
  vencido: false,
  entregaUnicaConcluida: false,
  todosEntregues: false,
  instrumento: 'contrato' as const,
  ...over,
});

describe('sugestaoDeEncerramento — o sistema sugere, nunca decide', () => {
  it('sem sinal de fim, não pergunta nada', () => {
    expect(sugestaoDeEncerramento(sinais())).toBeNull();
  });

  it('contrato já encerrado não recebe sugestão, mesmo esgotado e vencido', () => {
    expect(sugestaoDeEncerramento(sinais({ encerrado: true, saldoEsgotado: true, vencido: true }))).toBeNull();
  });

  it('saldo esgotado sugere quantitativo esgotado e oferece o aditivo de quantidade/valor', () => {
    const s = sugestaoDeEncerramento(sinais({ saldoEsgotado: true, todosEntregues: true }))!;
    expect(s.motivo).toBe('quantitativo_esgotado');
    expect(s.aditivo).toBe('quantidade ou valor');
    expect(s.titulo).toMatch(/Saldo esgotado — o contrato chegou ao fim\?/);
    expect(s.detalhe).toMatch(/estão entregues/);
  });

  it('saldo esgotado com entregas pendentes avisa que esgotado mede pedidos lançados, não entregues', () => {
    const s = sugestaoDeEncerramento(sinais({ saldoEsgotado: true, todosEntregues: false }))!;
    expect(s.detalhe).toMatch(/nem todos estão entregues/);
  });

  it('entrega única concluída vence o saldo esgotado genérico', () => {
    const s = sugestaoDeEncerramento(sinais({ saldoEsgotado: true, entregaUnicaConcluida: true, todosEntregues: true }))!;
    expect(s.motivo).toBe('entrega_unica_concluida');
  });

  it('vigência vencida sugere prazo vencido e oferece o aditivo de prazo, com a frase da vigência', () => {
    const s = sugestaoDeEncerramento(sinais({ vencido: true, vigenciaFrase: 'Venceu há 12 dias' }))!;
    expect(s.motivo).toBe('prazo_vencido');
    expect(s.aditivo).toBe('prazo');
    expect(s.detalhe).toMatch(/^Venceu há 12 dias\. /);
  });

  it('saldo esgotado tem precedência sobre a vigência vencida', () => {
    const s = sugestaoDeEncerramento(sinais({ saldoEsgotado: true, vencido: true }))!;
    expect(s.motivo).toBe('quantitativo_esgotado');
  });

  it('na ata as palavras mudam, a regra não', () => {
    const s = sugestaoDeEncerramento(sinais({ instrumento: 'ata', vencido: true }))!;
    expect(s.titulo).toMatch(/a ata chegou ao fim\?/);
  });
});

describe('aditivoPosteriorAoEncerramento — só aditivo assinado depois do fim sugere reabrir', () => {
  it('aditivo assinado depois do encerramento é devolvido, o mais recente', () => {
    const r = aditivoPosteriorAoEncerramento('2026-09-10', [
      { id: 'a1', numero_aditivo: '1º TA', data_assinatura: '2026-09-12' },
      { id: 'a2', numero_aditivo: '2º TA', data_assinatura: '2026-09-20' },
    ]);
    expect(r).toEqual({ id: 'a2', numero: '2º TA', data: '2026-09-20' });
  });

  it('aditivo antigo registrado tarde não conta — vale a assinatura, não o registro', () => {
    const r = aditivoPosteriorAoEncerramento('2026-09-10', [
      { id: 'a1', numero_aditivo: '1º TA', data_assinatura: '2026-08-01', created_at: '2026-09-15T10:00:00Z' },
    ]);
    expect(r).toBeNull();
  });

  it('sem data de assinatura, vale a data do registro', () => {
    const r = aditivoPosteriorAoEncerramento('2026-09-10', [
      { id: 'a1', numero_aditivo: null, created_at: '2026-09-15T10:00:00Z' },
    ]);
    expect(r).toEqual({ id: 'a1', numero: 'sem número', data: '2026-09-15' });
  });

  it('sem data de encerramento não há o que comparar', () => {
    expect(aditivoPosteriorAoEncerramento(null, [{ id: 'a1', data_assinatura: '2026-09-15' }])).toBeNull();
  });
});

describe('saldoDaCarteira — encerrado e saldo negativo ficam de fora, contados', () => {
  const contratos = [
    { id: '149', status: 'vigente', valor_global: 162_360, saldo_remanescente: -76_602.35 },
    { id: '166', status: 'vigente', valor_global: 65_270.38, saldo_remanescente: 0 },
    { id: '008', status: 'vigente', valor_global: 175_440, saldo_remanescente: 103_200 },
    { id: '017', status: 'vigente', valor_global: 74_520, saldo_remanescente: 49_400 },
    { id: 'enc', status: 'encerrado', valor_global: 10_000, saldo_remanescente: 2_000 },
    { id: 'nulo', status: 'vigente', valor_global: null, saldo_remanescente: null },
  ];

  it('soma só o que está em andamento e apurado', () => {
    const r = saldoDaCarteira(contratos);
    expect(r.total).toBe(152_600);
    expect(r.encerrados).toBe(1);
    expect(r.negativos).toBe(1);
    expect(r.apurados).toBe(5);
    expect(r.base.map(c => c.id)).toEqual(['166', '008', '017']);
  });

  it('o percentual usa o valor global da mesma base, não da carteira inteira', () => {
    const r = saldoDaCarteira(contratos);
    expect(r.valorDaBase).toBe(65_270.38 + 175_440 + 74_520);
  });

  it('nada apurado é ausência, não zero', () => {
    const r = saldoDaCarteira([{ status: 'vigente', valor_global: null, saldo_remanescente: null }]);
    expect(r.apurados).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe('atendeAoFiltroDeSituacao — a lista esconde encerrados por padrão', () => {
  const vigente = { status: 'vigente', saldo_remanescente: 10 };
  const encerrado = { status: 'encerrado', saldo_remanescente: 10 };
  const negativo = { status: 'vigente', saldo_remanescente: -5 };

  it('o padrão é "em andamento"', () => {
    expect(FILTRO_DE_SITUACAO_PADRAO).toBe('em_andamento');
    expect(atendeAoFiltroDeSituacao(vigente, 'em_andamento')).toBe(true);
    expect(atendeAoFiltroDeSituacao(encerrado, 'em_andamento')).toBe(false);
  });

  it('"Todos" traz o encerrado de volta; "Encerrado" mostra só ele', () => {
    expect(atendeAoFiltroDeSituacao(encerrado, 'all')).toBe(true);
    expect(atendeAoFiltroDeSituacao(encerrado, 'encerrado')).toBe(true);
    expect(atendeAoFiltroDeSituacao(vigente, 'encerrado')).toBe(false);
  });

  it('"Executados acima do valor" cruza o saldo negativo, em qualquer situação', () => {
    expect(atendeAoFiltroDeSituacao(negativo, 'saldo_negativo')).toBe(true);
    expect(atendeAoFiltroDeSituacao(vigente, 'saldo_negativo')).toBe(false);
  });
});

describe('explicacaoDaSituacao — Encerrado (declarado) × Vencido (sem decisão)', () => {
  it('encerrado diz quando e por quê', () => {
    expect(explicacaoDaSituacao(
      { status: 'encerrado', data_encerramento: '2026-09-10', motivo_encerramento: 'quantitativo_esgotado' },
      'encerrado',
    )).toBe('Encerrado em 10/09/2026 · Quantitativo esgotado.');
  });

  it('vencido sem declaração pede a decisão', () => {
    expect(explicacaoDaSituacao({ status: 'vigente', data_fim: '2026-08-31' }, 'vencido'))
      .toMatch(/^Vigência vencida em 31\/08\/2026 — o encerramento não foi declarado/);
  });

  it('motivo desconhecido cai em "Motivo não informado"', () => {
    expect(rotuloDoMotivo('qualquer coisa')).toBe('Motivo não informado');
    expect(rotuloDoMotivo(null)).toBe('Motivo não informado');
  });
});
