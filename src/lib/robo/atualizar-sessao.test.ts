import { describe, expect, it, vi } from 'vitest';
import { atualizarSessaoDoRobo, pausarOuRetomarRobo } from '@/lib/robo/comandos';

/**
 * Mudar a configuração com a disputa rodando (02/10/2026).
 *
 * O que estes testes protegem, acima de tudo: **a tela nunca pode dizer que
 * mudou quando não mudou**. Mudar o piso no meio de uma disputa é decisão de
 * dinheiro sob pressão; um "pronto" otimista faria a pessoa seguir achando que
 * o novo piso está valendo enquanto o robô continua no antigo.
 */
const respondendo = (data: unknown, error: { message?: string } | null = null) =>
  vi.fn().mockResolvedValue({ data, error });

describe('atualizarSessaoDoRobo', () => {
  it('manda o sessao_id junto da mudança', async () => {
    const invocar = respondendo({ atualizou: true, mudancas: ['piso do item 2: 800 -> 650'] });
    await atualizarSessaoDoRobo('s1', { itens: [{ numero: 2, valor_minimo: 650 }] }, invocar);
    expect(invocar).toHaveBeenCalledWith('robo-lances-webhook/atualizar-sessao', {
      body: { sessao_id: 's1', itens: [{ numero: 2, valor_minimo: 650 }] },
    });
  });

  it('devolve o que mudou, em português', async () => {
    const invocar = respondendo({ atualizou: true, mudancas: ['piso do item 2: 800 -> 650'] });
    const r = await atualizarSessaoDoRobo('s1', { itens: [{ numero: 2, valor_minimo: 650 }] }, invocar);
    expect(r.ok).toBe(true);
    expect(r.mudancas).toEqual(['piso do item 2: 800 -> 650']);
    expect(r.motivo).toBeNull();
  });

  it('aceito mas sem mudança nenhuma NÃO vira "pronto" silencioso', async () => {
    const invocar = respondendo({ atualizou: true, mudancas: [] });
    const r = await atualizarSessaoDoRobo('s1', { valor_minimo: 900 }, invocar);
    expect(r.ok).toBe(true);
    expect(r.motivo).toContain('Nada mudou');
  });

  it('recusa do serviço não vira sucesso', async () => {
    const invocar = respondendo({ atualizou: false, error: 'Sessão não encontrada' });
    const r = await atualizarSessaoDoRobo('s1', { valor_minimo: 900 }, invocar);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('Sessão não encontrada');
  });

  it('erro do transporte diz que o que valia continua valendo', async () => {
    const invocar = respondendo(null, { message: 'Failed to fetch' });
    const r = await atualizarSessaoDoRobo('s1', { valor_minimo: 900 }, invocar);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('Failed to fetch');
  });

  it('exceção não derruba a tela', async () => {
    const invocar = vi.fn().mockRejectedValue(new Error('rede caiu'));
    const r = await atualizarSessaoDoRobo('s1', { valor_minimo: 900 }, invocar);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('rede caiu');
  });

  it('resposta sem "atualizou" não é tratada como sucesso', async () => {
    const invocar = respondendo({});
    const r = await atualizarSessaoDoRobo('s1', { valor_minimo: 900 }, invocar);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('continua valendo');
  });

  it('parar um item vai no mesmo caminho', async () => {
    const invocar = respondendo({ atualizou: true, mudancas: ['item 1: PARADO a pedido'] });
    const r = await atualizarSessaoDoRobo('s1', { itens: [{ numero: 1, parado: true }] }, invocar);
    expect(r.ok).toBe(true);
    expect(r.mudancas[0]).toContain('PARADO');
  });
});

describe('pausarOuRetomarRobo', () => {
  it('pausar chama a rota de pausa', async () => {
    const invocar = respondendo({ ok: true, status: 'pausado' });
    const r = await pausarOuRetomarRobo('s1', false, invocar);
    expect(invocar).toHaveBeenCalledWith('robo-lances-webhook/pausar-sessao', { body: { sessao_id: 's1' } });
    expect(r.ok).toBe(true);
    expect(r.status).toBe('pausado');
  });

  it('retomar chama a rota de retomada', async () => {
    const invocar = respondendo({ ok: true, status: 'ativo' });
    const r = await pausarOuRetomarRobo('s1', true, invocar);
    expect(invocar).toHaveBeenCalledWith('robo-lances-webhook/retomar-sessao', { body: { sessao_id: 's1' } });
    expect(r.status).toBe('ativo');
  });

  it('sem confirmação, diz que o robô CONTINUA trabalhando', async () => {
    const invocar = respondendo({ ok: false });
    const r = await pausarOuRetomarRobo('s1', false, invocar);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('continua trabalhando');
  });

  it('falha ao retomar diz que ele CONTINUA pausado', async () => {
    const invocar = respondendo({ ok: false });
    const r = await pausarOuRetomarRobo('s1', true, invocar);
    expect(r.motivo).toContain('continua pausado');
  });

  it('erro do serviço aparece como está', async () => {
    const invocar = respondendo({ ok: false, error: 'Sessão não encontrada' });
    const r = await pausarOuRetomarRobo('s1', false, invocar);
    expect(r.motivo).toBe('Sessão não encontrada');
  });
});
