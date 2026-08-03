import { describe, it, expect } from 'vitest';
import { resolverValoresAlvo, type ValorAlvoLinha } from '@/lib/metas/valores-alvo';

const linha = (over: Partial<ValorAlvoLinha> = {}): ValorAlvoLinha => ({
  modalidade_codigo: 'pregao_eletronico',
  valor_alvo: 300_000,
  vigencia_inicio: '2026-01-01',
  vigencia_fim: null,
  user_id: null,
  ...over,
});

const ANA = '11111111-1111-1111-1111-111111111111';
const BRUNO = '22222222-2222-2222-2222-222222222222';

describe('resolverValoresAlvo', () => {
  it('sem linhas, devolve mapa vazio', () => {
    expect(resolverValoresAlvo([], '2026-08-03', ANA)).toEqual({});
  });

  it('converte reais para centavos', () => {
    const mapa = resolverValoresAlvo([linha({ valor_alvo: 300_000 })], '2026-08-03');
    expect(mapa.pregao_eletronico).toBe(300_000_00);
  });

  it('aceita valor vindo como string do Supabase', () => {
    const mapa = resolverValoresAlvo([linha({ valor_alvo: '1234.56' })], '2026-08-03');
    expect(mapa.pregao_eletronico).toBe(123_456);
  });

  it('ignora linha que ainda não entrou em vigência', () => {
    const mapa = resolverValoresAlvo([linha({ vigencia_inicio: '2026-09-01' })], '2026-08-03');
    expect(mapa).toEqual({});
  });

  it('ignora linha já encerrada', () => {
    const mapa = resolverValoresAlvo([linha({ vigencia_fim: '2026-07-31' })], '2026-08-03');
    expect(mapa).toEqual({});
  });

  it('inclui a linha nos dias exatos de início e de fim', () => {
    const l = linha({ vigencia_inicio: '2026-08-03', vigencia_fim: '2026-08-03' });
    expect(resolverValoresAlvo([l], '2026-08-03').pregao_eletronico).toBe(300_000_00);
  });

  it('entre linhas da empresa, a vigência mais recente vence', () => {
    const mapa = resolverValoresAlvo(
      [
        linha({ valor_alvo: 300_000, vigencia_inicio: '2026-01-01' }),
        linha({ valor_alvo: 350_000, vigencia_inicio: '2026-06-01' }),
      ],
      '2026-08-03',
    );
    expect(mapa.pregao_eletronico).toBe(350_000_00);
  });

  it('a ordem de entrada não muda o resultado', () => {
    const antiga = linha({ valor_alvo: 300_000, vigencia_inicio: '2026-01-01' });
    const nova = linha({ valor_alvo: 350_000, vigencia_inicio: '2026-06-01' });
    expect(resolverValoresAlvo([nova, antiga], '2026-08-03').pregao_eletronico).toBe(350_000_00);
    expect(resolverValoresAlvo([antiga, nova], '2026-08-03').pregao_eletronico).toBe(350_000_00);
  });

  it('linha do colaborador vence a da empresa, mesmo sendo mais antiga', () => {
    const mapa = resolverValoresAlvo(
      [
        linha({ valor_alvo: 350_000, vigencia_inicio: '2026-06-01', user_id: null }),
        linha({ valor_alvo: 500_000, vigencia_inicio: '2026-01-01', user_id: ANA }),
      ],
      '2026-08-03',
      ANA,
    );
    expect(mapa.pregao_eletronico).toBe(500_000_00);
  });

  it('override de outro colaborador não vaza', () => {
    const mapa = resolverValoresAlvo(
      [
        linha({ valor_alvo: 350_000, user_id: null }),
        linha({ valor_alvo: 500_000, user_id: BRUNO }),
      ],
      '2026-08-03',
      ANA,
    );
    expect(mapa.pregao_eletronico).toBe(350_000_00);
  });

  it('sem colaborador informado, resolve só os padrões da empresa', () => {
    const mapa = resolverValoresAlvo(
      [
        linha({ valor_alvo: 350_000, user_id: null }),
        linha({ valor_alvo: 500_000, user_id: ANA }),
      ],
      '2026-08-03',
    );
    expect(mapa.pregao_eletronico).toBe(350_000_00);
  });

  it('resolve cada modalidade de forma independente', () => {
    const mapa = resolverValoresAlvo(
      [
        linha({ modalidade_codigo: 'pregao_eletronico', valor_alvo: 300_000 }),
        linha({ modalidade_codigo: 'dispensa', valor_alvo: 100_000 }),
      ],
      '2026-08-03',
    );
    expect(mapa).toEqual({ pregao_eletronico: 300_000_00, dispensa: 100_000_00 });
  });
});
