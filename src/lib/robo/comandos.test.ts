import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { solicitarParada } from './comandos';

/**
 * Parar tem dois tempos, e só o segundo é "parado". Estes casos prendem a
 * rota (ação na URL, não no corpo — o defeito que fazia "parar" responder
 * 404) e a leitura honesta da resposta.
 */

describe('solicitarParada', () => {
  it('chama a ação pela URL, que é onde a função a lê', async () => {
    const invocar = vi.fn().mockResolvedValue({ data: { parou: true }, error: null });
    await solicitarParada('s-1', invocar);
    expect(invocar).toHaveBeenCalledWith('robo-lances-webhook/parar-sessao', { body: { sessao_id: 's-1' } });
  });

  it('confirmada só com evidência do agente', async () => {
    const r = await solicitarParada('s-1', vi.fn().mockResolvedValue({
      data: { parada_solicitada_em: '2026-09-14T12:00:00Z', parada_confirmada_em: '2026-09-14T12:00:03Z' },
      error: null,
    }));
    expect(r.estado).toBe('confirmada');
    expect(r.confirmadaEm).toBe('2026-09-14T12:00:03Z');
  });

  it('agente sem resposta é SOLICITADA, com o motivo — nunca "parado"', async () => {
    const r = await solicitarParada('s-1', vi.fn().mockResolvedValue({
      data: { parou: false, tentativas: [{ agente: 'VPS', motivo: 'timeout' }] },
      error: null,
    }));
    expect(r.estado).toBe('solicitada');
    expect(r.motivo).toBe('VPS: timeout');
  });

  it('erro da função é falha declarada', async () => {
    const r = await solicitarParada('s-1', vi.fn().mockResolvedValue({ data: null, error: { message: 'Não autorizado' } }));
    expect(r).toMatchObject({ estado: 'falhou', motivo: 'Não autorizado' });
  });

  it('resposta sem nenhum sinal conhecido não é confirmação', async () => {
    const r = await solicitarParada('s-1', vi.fn().mockResolvedValue({ data: { ok: true }, error: null }));
    expect(r.estado).toBe('falhou');
  });
});
