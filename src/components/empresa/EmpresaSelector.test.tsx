import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * O seletor de empresa diante da conta de engenharia (19/09/2026): diz o que a
 * conta é e não oferece "Cadastrar empresa". Conta comum sem empresa segue
 * vendo o cadastro.
 */
const { estado } = vi.hoisted(() => ({
  estado: {
    engenharia: false,
    empresas: [] as Array<{ empresa_id: string; papel: string; empresa: { nome_fantasia: string; razao_social: string; cnpj: string } }>,
  },
}));

vi.mock('@/hooks/useContaDeEngenharia', () => ({
  useContaDeEngenharia: () => ({ ehContaDeEngenharia: estado.engenharia, carregando: false }),
}));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({
    empresas: estado.empresas,
    empresaAtiva: estado.empresas[0] ? { id: estado.empresas[0].empresa_id, ...estado.empresas[0].empresa } : null,
    todasSelecionadas: false,
    setEmpresaAtiva: vi.fn(),
  }),
}));

import EmpresaSelector from './EmpresaSelector';

const abrir = () => {
  render(
    <MemoryRouter>
      <EmpresaSelector />
    </MemoryRouter>,
  );
  const gatilho = screen.getByRole('button');
  // O Radix abre pelo teclado também; o pointerDown não chega inteiro no jsdom.
  fireEvent.keyDown(gatilho, { key: 'Enter' });
  return gatilho;
};

describe('EmpresaSelector', () => {
  beforeEach(() => {
    estado.engenharia = false;
    estado.empresas = [];
  });

  it('conta de engenharia: "Conta de engenharia", sem "Cadastrar empresa"', () => {
    estado.engenharia = true;
    const gatilho = abrir();
    expect(gatilho).toHaveTextContent('Conta de engenharia');
    expect(screen.getByText(/não entra em empresa de cliente/)).toBeInTheDocument();
    expect(screen.queryByText('Cadastrar empresa')).not.toBeInTheDocument();
  });

  it('conta comum sem empresa: segue oferecendo o cadastro', () => {
    const gatilho = abrir();
    expect(gatilho).toHaveTextContent('Nenhuma empresa');
    expect(screen.getByText('Cadastrar empresa')).toBeInTheDocument();
  });

  it('com empresa: mostra a empresa, como sempre', () => {
    estado.empresas = [{ empresa_id: 'e1', papel: 'admin', empresa: { nome_fantasia: 'Grupo Santa Rosa', razao_social: 'Santa Rosa Ltda', cnpj: '00.000.000/0001-00' } }];
    const gatilho = abrir();
    expect(gatilho).toHaveTextContent('Grupo Santa Rosa');
    expect(screen.queryByText('Cadastrar empresa')).not.toBeInTheDocument();
  });
});
