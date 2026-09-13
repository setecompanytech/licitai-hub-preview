import { describe, expect, it } from 'vitest';
import { APURACAO, METRICA_DA_BASE, apuracaoDaBase, apuracaoDoIndicador } from './apuracao';
import { montarRelatorio } from './relatorio';
import { projetarMeta } from './projecao';
import type { BaseMeta } from './painel';

/**
 * A declaração da base de apuração é resolvida pelo RÓTULO que
 * `montarRelatorio` devolve — uma associação por texto, que quebra em silêncio
 * se alguém renomear "Pedidos faturados" para "Pedidos emitidos": a linha de
 * metadado simplesmente some da tela, sem erro de tipo e sem teste falhando.
 *
 * Este caso é a trava: todo indicador do relatório precisa ter base declarada.
 */

const projecao = projetarMeta({
  metaCent: 10_000_00,
  realizadoCent: 3_000_00,
  ano: 2026,
  mes: 9,
  hoje: '2026-09-15',
  feriados: [],
  historico: [],
  tickets: [],
  valoresAlvoCent: {},
  parametros: {
    txGanhoPadrao: 0.25,
    txFaturamentoPadrao: 0.8,
    minAmostraTicket: 3,
    minAnosSazonalidade: 2,
  },
});

const relatorio = montarRelatorio({
  tipo: 'MES',
  ano: 2026,
  mes: 9,
  hoje: '2026-09-15',
  colaborador: 'Ana Vendas',
  projecao,
  realizado: {
    participados: 10, ganhos: 3, perdidos: 1, pedidos_faturados: 2, nfe_quitadas: 1,
  },
  motivosPerda: [],
  atividades: [],
});

describe('apuração dos indicadores do relatório', () => {
  it('todo indicador do relatório tem base de apuração declarada', () => {
    const semBase = relatorio.indicadores
      .map((i) => i.rotulo)
      .filter((rotulo) => apuracaoDoIndicador(rotulo, 'faturamento') === null);

    expect(semBase).toEqual([]);
  });

  it('os dez indicadores continuam sendo dez — o relatório não encolheu', () => {
    expect(relatorio.indicadores).toHaveLength(10);
  });

  it('as sugestões e as premissas também declaram base — menos as que são frase', () => {
    // 'Situação' e 'Confiança' são texto, não número apurado: não têm data.
    const semData = ['Situação', 'Confiança'];
    const semBase = [...relatorio.sugestoes, ...relatorio.premissas]
      .map((l) => l.rotulo)
      .filter((rotulo) => !semData.includes(rotulo))
      .filter((rotulo) => apuracaoDoIndicador(rotulo, 'faturamento') === null);

    expect(semBase).toEqual(['Índice de sazonalidade']);
  });

  it('as duas conversões declaram que numerador e denominador têm datas distintas', () => {
    expect(apuracaoDoIndicador('Conversão participado → ganho', 'faturamento'))
      .toContain('÷');
    expect(apuracaoDoIndicador('Conversão ganho → faturado', 'faturamento'))
      .toContain('÷');
  });

  it('a taxa de conversão avisa que numerador e denominador têm datas diferentes', () => {
    const texto = apuracaoDoIndicador('Taxa de conversão do período', 'faturamento');
    expect(texto).toContain('assinatura');
    expect(texto).toContain('envio da proposta');
  });

  it('rótulo desconhecido devolve null — a tela omite em vez de inventar', () => {
    expect(apuracaoDoIndicador('Coluna que não existe', 'faturamento')).toBeNull();
  });
});

describe('as três bases de meta medem coisas diferentes', () => {
  const bases: BaseMeta[] = ['contratos_ganhos', 'faturamento', 'nf_quitada'];

  it('cada base é apurada por uma coluna — e uma data — própria', () => {
    const colunas = bases.map((b) => apuracaoDaBase(b).coluna);
    expect(new Set(colunas).size).toBe(3);
    expect(colunas).toEqual([
      'contratos.data_assinatura',
      'contrato_pedidos.data_pedido',
      'contrato_pedidos.data_quitacao',
    ]);
  });

  it('as cinco métricas da view têm, cada uma, coluna e explicação escritas', () => {
    for (const [metrica, base] of Object.entries(APURACAO)) {
      expect(base.coluna, metrica).toMatch(/\./);
      expect(base.curto.length, metrica).toBeGreaterThan(0);
      expect(base.explicacao.length, metrica).toBeGreaterThan(0);
    }
  });

  it('toda base de meta aponta para uma métrica existente da view', () => {
    for (const base of bases) {
      expect(APURACAO[METRICA_DA_BASE[base]]).toBeDefined();
    }
  });
});
