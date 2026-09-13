import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Calendário — os quatro comportamentos que a reestruturação de 13/09 firmou e
 * que nenhuma captura automatizada alcança (a tela exige sessão e empresa
 * ativa, que a conta de teste não tem, e para antes de montar):
 *
 *  1. as três abas do painel continuam existindo, com as strings exatas;
 *  2. evento de licitação abre O PROCESSO — antes todo clique caía em
 *     `/kanban`, quadro inteiro, e a pessoa procurava de novo o que clicou;
 *  3. enquanto a rede trabalha a tela diz "carregando" em vez de desenhar os
 *     estados vazios (ela mentia "nenhum evento" durante a espera);
 *  4. consulta que falha vira alerta com "Tentar novamente" — princípio 3 do
 *     CLAUDE.md, falha silenciosa é proibida.
 *
 * As três `useQuery` são mockadas pela primeira chave da `queryKey`, que é o
 * que identifica cada fonte; assim o teste controla dado, carregamento e erro
 * sem subir Supabase nem QueryClient.
 */

const navegou = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navegou,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

// O botão de sincronizar tem dependências próprias (sonner, dropdown) que não
// interessam a estes casos.
vi.mock('./SyncCalendarButton', () => ({ default: () => null }));

type EstadoDaConsulta = { data?: unknown; isLoading?: boolean; error?: unknown };

/** Estado por fonte, trocado caso a caso. */
const estados: Record<string, EstadoDaConsulta> = {};

const recarregar = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const estado = estados[queryKey[0] as string] ?? {};
    return {
      data: estado.data,
      isLoading: estado.isLoading ?? false,
      error: estado.error ?? null,
      refetch: recarregar,
    };
  },
}));

import CalendarioLicitacoes from './CalendarioLicitacoes';

/** Abertura HOJE — é assim que o processo cai na aba "Dia", que abre com a
 *  data de hoje já selecionada. */
const abreHoje = () => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

const PROCESSO = {
  id: 'lic-123',
  numero: 'PE 90001/2026',
  objeto: 'Aquisição de material de expediente',
  orgao: 'Prefeitura de Belém',
  status: 'Publicado',
  data_abertura: abreHoje(),
  data_encerramento: null,
  modalidade: 'Pregão Eletrônico',
  valor_estimado: 120000,
};

const definirEstados = (parcial: Record<string, EstadoDaConsulta>) => {
  for (const chave of Object.keys(estados)) delete estados[chave];
  Object.assign(
    estados,
    {
      'calendario-licitacoes': { data: [] },
      'calendario-docs-validade': { data: [] },
      'calendario-backup-config': { data: null },
    },
    parcial,
  );
};

beforeEach(() => {
  navegou.mockClear();
  recarregar.mockClear();
  definirEstados({});
});

describe('CalendarioLicitacoes', () => {
  it('mantém as três abas do painel', () => {
    render(<CalendarioLicitacoes />);
    expect(screen.getByRole('tab', { name: 'Dia' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Próximos 30d' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeTruthy();
  });

  it('evento de licitação abre o processo, não o kanban', () => {
    definirEstados({ 'calendario-licitacoes': { data: [PROCESSO] } });
    render(<CalendarioLicitacoes />);

    fireEvent.click(screen.getAllByText('PE 90001/2026')[0]);

    expect(navegou).toHaveBeenCalledWith('/processo/lic-123');
    expect(navegou).not.toHaveBeenCalledWith('/kanban');
  });

  it('mostra o estado de carregando em vez dos estados vazios', () => {
    definirEstados({ 'calendario-licitacoes': { isLoading: true } });
    render(<CalendarioLicitacoes />);

    expect(screen.getByText('Carregando a agenda')).toBeTruthy();
    // Nada de "não há eventos" enquanto a resposta não chegou.
    expect(screen.queryByText('Nenhum evento nesta data')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Dia' })).toBeNull();
  });

  it('consulta que falha vira alerta com retentativa', () => {
    definirEstados({
      'calendario-docs-validade': { data: [], error: new Error('Falha de rede') },
    });
    render(<CalendarioLicitacoes />);

    expect(screen.getByText('Parte da agenda não pôde ser carregada')).toBeTruthy();
    expect(screen.getByText(/Falha de rede/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(recarregar).toHaveBeenCalled();
  });
});
