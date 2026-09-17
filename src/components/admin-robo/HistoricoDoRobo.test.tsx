import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * "Histórico do robô" no admin (17/09/2026): lê `robo_historico` com os filtros
 * no banco, mostra a empresa pelo nome e leva à disputa. Nada fala com a rede.
 */
const { resposta, chamadas } = vi.hoisted(() => ({
  resposta: { data: [] as unknown[], error: null as unknown, count: 0 as number | null },
  chamadas: [] as Array<[string, unknown[]]>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const cadeia: Record<string, unknown> = new Proxy(
    {},
    {
      get(_alvo, prop) {
        if (prop === 'then') {
          return (ok: (v: unknown) => unknown) => Promise.resolve({ ...resposta }).then(ok);
        }
        return (...args: unknown[]) => {
          chamadas.push([String(prop), args]);
          return cadeia;
        };
      },
    },
  );
  return {
    supabase: {
      from: () => cadeia,
      rpc: async () => ({ data: [{ id: 'emp-1', razao_social: 'SANTA ROSA LTDA', nome_fantasia: 'Santa Rosa' }], error: null }),
    },
  };
});

import HistoricoDoRobo from './HistoricoDoRobo';

const renderizar = () => render(<MemoryRouter><HistoricoDoRobo /></MemoryRouter>);

beforeEach(() => {
  chamadas.length = 0;
  resposta.error = null;
  resposta.count = 2;
  resposta.data = [
    {
      id: 'h1', origem: 'aviso', tipo: 'urgente', titulo: '⚠️ A licitação mudou — 90029/2026', mensagem: 'Item 1: quantidade 100 → 50',
      link: '/robo-lances/disputa/d1', empresa_id: 'emp-1', disputa_id: 'd1', sessao_id: null, edital: '90029/2026',
      portal: 'Compras.gov.br', destinatarios: 3, dados: {}, ocorreu_em: '2026-09-17T16:53:47Z',
    },
    {
      id: 'h2', origem: 'evento', tipo: 'lance-enviado', titulo: 'Lance Enviado', mensagem: 'Lance de R$ 85,00 aceito',
      link: null, empresa_id: null, disputa_id: null, sessao_id: 's1', edital: null, portal: null,
      destinatarios: 1, dados: {}, ocorreu_em: '2026-09-17T16:50:00Z',
    },
  ];
});

describe('HistoricoDoRobo', () => {
  it('mostra data em Brasília, empresa pelo nome, link da disputa e o que aconteceu', async () => {
    renderizar();

    expect(await screen.findByText('⚠️ A licitação mudou — 90029/2026')).toBeInTheDocument();
    expect(screen.getAllByText('17/09/2026 13:53:47').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Santa Rosa').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '90029/2026 · Compras.gov.br' })[0]).toHaveAttribute('href', '/robo-lances/disputa/d1');
    expect(screen.getAllByText('para 3 pessoas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lance enviado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plataforma').length).toBeGreaterThan(0);
    // Ordenado do mais recente, com o período no banco.
    expect(chamadas.some(([m, a]) => m === 'order' && a[0] === 'ocorreu_em')).toBe(true);
    expect(chamadas.some(([m, a]) => m === 'gte' && a[0] === 'ocorreu_em')).toBe(true);
  });

  it('a busca vai ao banco em edital, título e mensagem', async () => {
    renderizar();
    await screen.findByText('⚠️ A licitação mudou — 90029/2026');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '90029' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar no histórico' }));

    await waitFor(() =>
      expect(chamadas.some(([m, a]) => m === 'or' && a[0] === 'edital.ilike.%90029%,titulo.ilike.%90029%,mensagem.ilike.%90029%')).toBe(true),
    );
  });

  it('sem a migration aplicada, diz qual arquivo colar — não "nenhum registro"', async () => {
    resposta.data = [];
    resposta.error = { code: '42P01', message: 'relation "public.robo_historico" does not exist' };
    renderizar();

    expect(await screen.findByText('Migração pendente')).toBeInTheDocument();
    expect(screen.getByText('supabase/migrations/20260917000004_historico_do_robo.sql')).toBeInTheDocument();
  });
});
