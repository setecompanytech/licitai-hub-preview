import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * O cartão "Condições de entrega" do contrato 17/2025 em 18/09: "481 dias
 * corridos" lidos de uma linha de tabela de itens, três colunas embaralhadas
 * num painel estreito, e "art. 92, V" onde o prazo de pagamento é o inciso VI.
 */

const CONTRATO_481 = {
  prazo_entrega_dias: 481,
  prazo_entrega_unidade: 'corridos',
  prazo_entrega_clausula: '23/04/2026 Inclusão 481,78950 38,0000 18.308,00',
  local_entrega: 'AV. ALMIRANTE BARROSO Nº 1155',
  local_entrega_clausula: 'AV. ALMIRANTE BARROSO Nº 1155',
  prazo_recebimento_dias: null,
  prazo_recebimento_unidade: null,
  prazo_recebimento_clausula: null,
  prazo_pagamento_dias: null,
  prazo_pagamento_unidade: null,
  prazo_pagamento_marco: null,
  prazo_pagamento_clausula: null,
};

const { estado } = vi.hoisted(() => ({
  estado: { contrato: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[] },
}));

/** Cadeia do supabase-js: `select…single` devolve o contrato; `update…eq` registra o payload. */
function criarCadeia() {
  let payload: Record<string, unknown> | null = null;
  const cadeia: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'single', 'maybeSingle', 'order', 'limit']) cadeia[metodo] = vi.fn(() => cadeia);
  cadeia.update = vi.fn((v: Record<string, unknown>) => { payload = v; return cadeia; });
  cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => {
    if (payload) estado.updates.push(payload);
    return Promise.resolve(payload ? { data: null, error: null } : { data: estado.contrato, error: null }).then(ok, erro);
  };
  return cadeia;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => criarCadeia()) },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ContratoEntrega from './ContratoEntrega';

const montar = () => render(
  <MemoryRouter initialEntries={['/gestao-contratos?contrato=c1']}>
    <ContratoEntrega contratoId="c1" />
  </MemoryRouter>,
);

describe('ContratoEntrega — prazo sem evidência e referências legais', () => {
  beforeEach(() => {
    estado.contrato = { ...CONTRATO_481 };
    estado.updates = [];
  });

  it('mostra o prazo lido, avisa que a frase citada não fala em prazo, e cita o art. 92, VI para o pagamento', async () => {
    montar();
    expect(await screen.findByText('481 dias corridos')).toBeTruthy();

    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('O prazo de entrega de 481 dias não tem cláusula que o sustente');
    expect(aviso.textContent).toContain('linha de tabela de itens');

    // A evidência continua visível, com o nome do campo na frente.
    expect(screen.getByText(/Prazo de entrega:/).parentElement?.textContent).toContain('481,78950');
    // O prazo de pagamento é cláusula necessária do art. 92, VI — não do V.
    expect(screen.getByText(/art\. 92, VI/)).toBeTruthy();
    expect(screen.queryByText(/art\. 92, V\b(?!I)/)).toBeNull();
  });

  it('descartar apaga dias, unidade e frase, e o campo volta a "não fixado"', async () => {
    montar();
    await screen.findByText('481 dias corridos');

    fireEvent.click(screen.getByRole('button', { name: /Descartar este prazo/ }));

    await waitFor(() => expect(estado.updates).toHaveLength(1));
    expect(estado.updates[0]).toEqual({
      prazo_entrega_dias: null,
      prazo_entrega_unidade: null,
      prazo_entrega_clausula: null,
    });
    expect(screen.queryByText('481 dias corridos')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('não fixado').length).toBeGreaterThan(0);
  });

  it('prazo preenchido à mão (sem frase) não recebe o aviso', async () => {
    estado.contrato = { ...CONTRATO_481, prazo_entrega_dias: 10, prazo_entrega_clausula: null };
    montar();
    expect(await screen.findByText('10 dias corridos')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
