import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * A aba do agente na visão da plataforma (19/09/2026): lista o agente de todas
 * as contas com o dono de cada um, e a conta de engenharia não é convidada a
 * "ativar" um agente para si.
 */
const { banco, conta } = vi.hoisted(() => ({
  banco: {
    agentes: [] as Array<Record<string, unknown>>,
    donos: [] as Array<{ id: string; nome: string; empresas: string | null }>,
    erroDosDonos: null as { message: string } | null,
    filtrouPorConta: false,
  },
  conta: { ehContaDeEngenharia: false },
}));

vi.mock('@/integrations/supabase/client', () => {
  const consulta = {
    select: () => consulta,
    eq: () => {
      banco.filtrouPorConta = true;
      return consulta;
    },
    order: () => Promise.resolve({ data: banco.agentes, error: null }),
  };
  return {
    supabase: {
      from: () => consulta,
      rpc: () => Promise.resolve({ data: banco.erroDosDonos ? null : banco.donos, error: banco.erroDosDonos }),
      functions: { invoke: vi.fn() },
    },
  };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-engsoft' }, subscription: { planSlug: null } }) }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => ({ empresaAtiva: null }) }));
vi.mock('@/hooks/useMembroPermissoes', () => ({ useMembroPermissoes: () => ({ isAdmin: true }) }));
vi.mock('@/hooks/useContaDeEngenharia', () => ({ useContaDeEngenharia: () => ({ ...conta, carregando: false }) }));

import AgenteExternoConfig from './AgenteExternoConfig';

const agenteDaSantaRosa = {
  id: 'a1', user_id: 'u-santa-rosa-000001', nome: 'Agente Cloud — Enterprise', url_base: 'https://agente.praefectus.com.br',
  status: 'ativo', ultimo_heartbeat: null, versao_agente: '2.1', capacidades: [], max_sessoes_paralelas: 5, sessoes_ativas: 0, ram_mb: null,
};

describe('AgenteExternoConfig', () => {
  beforeEach(() => {
    banco.agentes = [];
    banco.donos = [];
    banco.erroDosDonos = null;
    banco.filtrouPorConta = false;
    conta.ehContaDeEngenharia = false;
  });

  it('lista o agente de outra conta, com o dono — sem filtrar pela conta logada', async () => {
    conta.ehContaDeEngenharia = true;
    banco.agentes = [agenteDaSantaRosa];
    banco.donos = [{ id: 'u-santa-rosa-000001', nome: 'Rafael William', empresas: 'GRUPO SANTA ROSA' }];
    render(<AgenteExternoConfig />);
    expect(await screen.findByText('Agente Cloud — Enterprise')).toBeInTheDocument();
    expect(await screen.findByText(/Rafael William · GRUPO SANTA ROSA · v2\.1/)).toBeInTheDocument();
    expect(banco.filtrouPorConta).toBe(false);
    // Sem empresa ativa, não há certificado de quem gerar link.
    expect(screen.queryByText('Certificado Digital')).not.toBeInTheDocument();
  });

  it('sem o nome do dono (função não aplicada), o cartão segue e diz por quê', async () => {
    banco.agentes = [agenteDaSantaRosa];
    banco.erroDosDonos = { message: 'function contas_para_plataforma does not exist' };
    render(<AgenteExternoConfig />);
    expect(await screen.findByText(/Conta …000001/)).toBeInTheDocument();
    expect(await screen.findByText(/20260919000004/)).toBeInTheDocument();
  });

  it('conta de engenharia sem agente nenhum: explica o agente da plataforma, sem "Ativar"', async () => {
    conta.ehContaDeEngenharia = true;
    render(<AgenteExternoConfig />);
    expect(await screen.findByText(/usam o agente da plataforma/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar Agente Cloud/ })).not.toBeInTheDocument();
  });
});
