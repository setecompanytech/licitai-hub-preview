import { describe, it, expect } from 'vitest';
import {
  posicoesFinais,
  processoEntraEmDisputa,
  textoDoProcessoEmDisputa,
} from '../../../../supabase/functions/_shared/robo-kanban';

/** O robô move o processo no Kanban só com o que vê na sala (16/09/2026). */

const reais = (n: unknown) => Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

describe('Kanban: robô na sala com a proposta da empresa', () => {
  it('entra em disputa a partir de Monitorando, Em Análise ou Proposta Enviada', () => {
    for (const s of ['Monitorando', 'Em Análise', 'Proposta Enviada']) expect(processoEntraEmDisputa(s, true)).toBe(true);
  });

  it('nunca anda para trás nem mexe em processo decidido ou arquivado', () => {
    for (const s of ['Em Disputa', 'Vencida', 'Homologada', 'Perdida', 'Arquivada']) expect(processoEntraEmDisputa(s, true)).toBe(false);
  });

  it('sem a proposta da empresa na sala (ou sem leitura), não move', () => {
    expect(processoEntraEmDisputa('Proposta Enviada', false)).toBe(false);
    expect(processoEntraEmDisputa('Proposta Enviada', null)).toBe(false);
  });

  it('o mural diz o que o robô viu e de onde o processo saiu', () => {
    expect(textoDoProcessoEmDisputa('07/2026', 'Proposta Enviada', 'Compras.gov.br')).toBe(
      '🤖 **Processo movido para Em Disputa** — o robô viu a proposta da empresa na sala da compra 07/2026 (Compras.gov.br). Estava em Proposta Enviada.',
    );
  });
});

describe('fim da sessão: a última posição de cada item', () => {
  it('os quatro itens da prova de 16/09, em ordem', () => {
    const estado = {
      item: 5,
      por_item: {
        '5': { item: 5, nossa_desclassificada: true },
        '1': { item: 1, posicao: 8, nosso_lance: 4999.7, melhor_lance: 3100, tem_proposta: true },
        '3': { item: 3, posicao: 4, nosso_lance: 5579.2, melhor_lance: 3495, tem_proposta: true },
        '2': { item: 2, tem_proposta: false },
      },
    };
    expect(posicoesFinais(estado, reais)).toBe(
      'Última leitura da sala — item 1: 8º lugar (nosso R$ 4.999,70, melhor R$ 3.100,00); item 2: sem proposta da empresa; item 3: 4º lugar (nosso R$ 5.579,20, melhor R$ 3.495,00); item 5: proposta desclassificada',
    );
  });

  it('formato antigo (um item, sem por_item) e sem leitura', () => {
    expect(posicoesFinais({ item: 1, posicao: 1, nosso_lance: 90 }, reais)).toBe('Última leitura da sala — item 1: 1º lugar (nosso R$ 90,00)');
    expect(posicoesFinais(null, reais)).toBeNull();
    expect(posicoesFinais({}, reais)).toBeNull();
  });
});
