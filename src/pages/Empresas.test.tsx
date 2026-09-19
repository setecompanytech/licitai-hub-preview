import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * A página de empresas diante da conta de engenharia (19/09/2026): sem "Nova
 * empresa", sem formulário, e o vazio explica por quê. Conta comum sem empresa
 * segue com o cadastro por certificado.
 */
const { estado } = vi.hoisted(() => ({ estado: { engenharia: false } }));

vi.mock('@/hooks/useContaDeEngenharia', () => ({
  useContaDeEngenharia: () => ({ ehContaDeEngenharia: estado.engenharia, carregando: false }),
}));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresas: [], empresaAtiva: null, todasSelecionadas: false, reloadEmpresas: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ acoes }: { acoes?: ReactNode }) => <header data-testid="cabecalho">{acoes}</header>,
}));
vi.mock('@/components/empresa/CadastroCertificado', () => ({ default: () => <div data-testid="cadastro" /> }));
vi.mock('@/components/empresa/EditEmpresaDialog', () => ({ default: () => null }));

import Empresas from './Empresas';

describe('Empresas', () => {
  beforeEach(() => {
    estado.engenharia = false;
  });

  it('conta de engenharia: sem "Nova empresa" e sem cadastro, com o motivo', () => {
    estado.engenharia = true;
    render(<Empresas />);
    expect(screen.queryByRole('button', { name: /Nova empresa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cadastrar com Certificado Digital/ })).not.toBeInTheDocument();
    expect(screen.getByText('Conta de engenharia, sem empresa')).toBeInTheDocument();
    expect(screen.getByText(/opera o sistema pelo Admin/)).toBeInTheDocument();
  });

  it('conta comum sem empresa: "Nova empresa" e o cadastro por certificado', () => {
    render(<Empresas />);
    expect(screen.getByRole('button', { name: /Nova empresa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cadastrar com Certificado Digital/ })).toBeInTheDocument();
  });
});
