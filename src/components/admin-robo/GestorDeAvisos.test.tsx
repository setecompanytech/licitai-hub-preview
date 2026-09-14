import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Gestão dos avisos aos clientes.
 *
 * O que estes testes prendem:
 *  1. a validação barra antes do banco — título, mensagem, fim depois do início;
 *  2. o FORMATO da linha inserida: "Todos os portais" como nulo e as datas
 *     digitadas lidas como horário de Brasília;
 *  3. migração não aplicada vira "Migração pendente", não lista vazia;
 *  4. a falha ao salvar mostra a mensagem real e não perde o que foi digitado.
 *
 * Nada fala com rede: o supabase é dublê.
 */

const dubles = vi.hoisted(() => ({
  leitura: { data: [] as unknown[] | null, error: null as unknown },
  escrita: { error: null as unknown },
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => {
  // MESMO objeto a cada `from`: a leitura e as escritas passam pelos dublês acima.
  const tabela = {
    select: () => tabela,
    order: () => tabela,
    limit: () => Promise.resolve(dubles.leitura),
    insert: (payload: unknown) => {
      dubles.insert(payload);
      return Promise.resolve(dubles.escrita);
    },
    update: (payload: unknown) => {
      dubles.update(payload);
      return {
        eq: (coluna: string, valor: unknown) => {
          dubles.eq(coluna, valor);
          return Promise.resolve(dubles.escrita);
        },
      };
    },
  };
  return { supabase: { from: () => tabela } };
});

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), dubles.toast) }));

import GestorDeAvisos from './GestorDeAvisos';

beforeAll(() => {
  // O Switch do Radix mede o próprio tamanho com ResizeObserver, que o jsdom não tem.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const AVISOS = [
  {
    id: 'a-vigente', portal_id: 'compras-gov', severidade: 'critico',
    titulo: 'Compras.gov instável', mensagem: 'O portal está lento. Lances já enviados valem.',
    ativo: true, inicio_em: '2020-01-01T12:00:00.000Z', fim_em: null,
  },
  {
    id: 'a-agendado', portal_id: null, severidade: 'informativo',
    titulo: 'Manutenção programada', mensagem: 'Janela de manutenção.',
    ativo: true, inicio_em: '2099-01-01T12:00:00.000Z', fim_em: null,
  },
  {
    id: 'a-encerrado', portal_id: 'bll', severidade: 'atencao',
    titulo: 'BLL fora do ar', mensagem: 'Resolvido.',
    ativo: true, inicio_em: '2020-01-01T12:00:00.000Z', fim_em: '2021-01-01T12:00:00.000Z',
  },
  {
    id: 'a-inativo', portal_id: null, severidade: 'atencao',
    titulo: 'Rascunho antigo', mensagem: 'Nunca foi ao ar.',
    ativo: false, inicio_em: '2020-01-01T12:00:00.000Z', fim_em: null,
  },
];

beforeEach(() => {
  dubles.leitura = { data: AVISOS, error: null };
  dubles.escrita = { error: null };
  dubles.insert.mockClear();
  dubles.update.mockClear();
  dubles.eq.mockClear();
  Object.values(dubles.toast).forEach((f) => f.mockClear());
});

async function abrirNovoAviso() {
  render(<GestorDeAvisos />);
  await screen.findByText('Compras.gov instável');
  fireEvent.click(screen.getByRole('button', { name: /Novo aviso/ }));
  await screen.findByRole('dialog');
}

const campo = (rotulo: RegExp) => screen.getByLabelText(rotulo) as HTMLInputElement;
const digitar = (rotulo: RegExp, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } });

describe('lista de avisos', () => {
  it('mostra a situação de cada aviso diante do cliente', async () => {
    render(<GestorDeAvisos />);
    expect(await screen.findByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText('Agendado')).toBeInTheDocument();
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getByText('Compras.gov.br')).toBeInTheDocument();
  });

  it('desativar grava ativo = false naquele aviso', async () => {
    render(<GestorDeAvisos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar aviso "Compras.gov instável"' }));
    await waitFor(() => expect(dubles.update).toHaveBeenCalledWith({ ativo: false }));
    expect(dubles.eq).toHaveBeenCalledWith('id', 'a-vigente');
    expect(dubles.toast.success).toHaveBeenCalled();
    // Aviso já inativo não oferece desativar de novo.
    expect(screen.queryByRole('button', { name: 'Desativar aviso "Rascunho antigo"' })).toBeNull();
  });
});

describe('formulário de aviso', () => {
  it('orienta a escrever para o cliente, sem erro técnico', async () => {
    await abrirNovoAviso();
    expect(
      screen.getByText('Escreva para o cliente: o que acontece, o que continua funcionando, o que fazer. Nada de erro técnico.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Como o cliente vai ler')).toBeInTheDocument();
  });

  it('título e mensagem são obrigatórios — nada vai ao banco', async () => {
    await abrirNovoAviso();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar aviso' }));
    expect(await screen.findByText('Escreva o título do aviso.')).toBeInTheDocument();
    expect(screen.getByText('Escreva a mensagem que o cliente vai ler.')).toBeInTheDocument();
    expect(dubles.insert).not.toHaveBeenCalled();
  });

  it('fim antes do início é recusado', async () => {
    await abrirNovoAviso();
    digitar(/^Título/, 'Instabilidade no Compras.gov.br');
    digitar(/^Mensagem/, 'O portal está lento.');
    digitar(/^Início/, '2026-09-20T10:00');
    digitar(/^Fim/, '2026-09-20T09:00');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar aviso' }));
    expect(await screen.findByText('O fim precisa ser depois do início.')).toBeInTheDocument();
    expect(dubles.insert).not.toHaveBeenCalled();
  });

  it('insere a linha no formato do banco, com a prévia lendo o que foi digitado', async () => {
    await abrirNovoAviso();
    digitar(/^Título/, '  Instabilidade no Compras.gov.br ');
    digitar(/^Mensagem/, 'O portal está lento. Lances já enviados continuam valendo.');
    digitar(/^Início/, '2026-09-20T10:00');
    digitar(/^Fim/, '2026-09-20T18:30');

    // A prévia é o banner do cliente, com o texto digitado.
    expect(screen.getByText('Instabilidade no Compras.gov.br')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar aviso' }));
    await waitFor(() => expect(dubles.insert).toHaveBeenCalledTimes(1));
    expect(dubles.insert).toHaveBeenCalledWith({
      portal_id: null,
      severidade: 'atencao',
      titulo: 'Instabilidade no Compras.gov.br',
      mensagem: 'O portal está lento. Lances já enviados continuam valendo.',
      ativo: true,
      inicio_em: '2026-09-20T13:00:00.000Z',
      fim_em: '2026-09-20T21:30:00.000Z',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(dubles.toast.success).toHaveBeenCalled();
  });

  it('falha ao salvar mostra a mensagem real e mantém o formulário aberto', async () => {
    dubles.escrita = { error: { code: '42501', message: 'new row violates row-level security policy' } };
    await abrirNovoAviso();
    digitar(/^Título/, 'Instabilidade');
    digitar(/^Mensagem/, 'Texto para o cliente.');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar aviso' }));
    await waitFor(() => expect(dubles.toast.error).toHaveBeenCalled());
    expect(String(dubles.toast.error.mock.calls[0][0])).toContain('new row violates row-level security policy');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(campo(/^Título/).value).toBe('Instabilidade');
  });
});

describe('migração não aplicada', () => {
  it('diz "Migração pendente" e não oferece criar aviso', async () => {
    dubles.leitura = {
      data: null,
      error: { code: 'PGRST205', message: "Could not find the table 'public.robo_avisos_portal' in the schema cache" },
    };
    render(<GestorDeAvisos />);
    expect(await screen.findByText('Migração pendente')).toBeInTheDocument();
    expect(screen.getByText(/20260914000004_robo_separacao_plataforma\.sql/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo aviso/ })).toBeDisabled();
    expect(screen.queryByText('Nenhum aviso publicado')).toBeNull();
  });
});
