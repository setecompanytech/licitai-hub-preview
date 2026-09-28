import { describe, it, expect } from 'vitest';
import { melhorAssinaturaVigente } from '../vigencia';

const agora = new Date('2026-09-28T14:00:00Z').getTime();

describe('assinatura vigente lida do banco', () => {
  it('data_fim nula é por tempo indeterminado; vencida não conta; cancelada não conta', () => {
    expect(melhorAssinaturaVigente([{ status: 'ativa', data_fim: null, planos: { slug: 'enterprise' } }], agora)).toEqual({ planSlug: 'enterprise', subscriptionEnd: null, status: 'ativa' });
    expect(melhorAssinaturaVigente([{ status: 'ativa', data_fim: '2026-09-25T02:59:59+00:00', planos: { slug: 'enterprise' } }], agora)).toBeNull();
    expect(melhorAssinaturaVigente([{ status: 'cancelada', data_fim: null, planos: { slug: 'enterprise' } }], agora)).toBeNull();
    expect(melhorAssinaturaVigente([], agora)).toBeNull();
  });
  it('em mais de uma empresa vale o maior plano; entre iguais, a sem data de fim', () => {
    const r = melhorAssinaturaVigente([
      { status: 'trial', data_fim: '2026-10-05T00:00:00Z', planos: { slug: 'basico' } },
      { status: 'ativa', data_fim: '2027-01-01T02:59:59+00:00', planos: [{ slug: 'enterprise' }] },
      { status: 'ativa', data_fim: null, planos: { slug: 'enterprise' } },
    ], agora);
    expect(r).toEqual({ planSlug: 'enterprise', subscriptionEnd: null, status: 'ativa' });
  });
  it('plano desconhecido ou sem plano é ignorado', () => {
    expect(melhorAssinaturaVigente([{ status: 'ativa', data_fim: null, planos: { slug: 'premium' } }, { status: 'ativa', data_fim: null, planos: null }], agora)).toBeNull();
  });
});
