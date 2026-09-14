import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Tabela de lançamentos (Contas a Receber / a Pagar).
 *
 * Em 14/09/2026 a tabela saía quebrada a 1.710 px: o título "Parcela" em uma
 * letra por linha e a coluna Ações cortada na borda do cartão, com os botões de
 * vincular e editar fora de alcance. O jsdom não tem layout — a medição de
 * largura é feita no navegador (captura). Aqui ficam os contratos de estrutura
 * que sustentam a correção e que uma edição distraída desfaria.
 */

const { lancamentos } = vi.hoisted(() => ({ lancamentos: [] as Record<string, unknown>[] }));

vi.mock('@/hooks/useFinanceiro', () => ({
  useLancamentos: () => ({ data: lancamentos, isLoading: false }),
  useUpsertLancamento: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useMembrosEmpresa: () => ({ data: [] }),
}));
// O clipe do documento e os diálogos fazem as próprias consultas; não são o
// objeto do teste.
vi.mock('./DocumentoDoLancamento', () => ({
  default: () => null,
  useDocumentosPorLancamento: () => ({ data: {} }),
}));
vi.mock('./LancamentoDialog', () => ({ default: () => null }));
vi.mock('./VincularContratoDialog', () => ({ default: () => null }));
vi.mock('./DataDaBaixaDialog', () => ({ DataDaBaixaDialog: () => null }));

import FinTabelaLancamentos from './FinTabelaLancamentos';

const lancamento = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  empresa_id: 'e1',
  tipo: 'a_receber',
  descricao: 'NF-e 71 · Gêneros alimentícios para merenda escolar',
  valor: 11250,
  status: 'previsto',
  data_vencimento: '2099-02-24',
  data_competencia: '2099-02-24',
  numero_documento: '000.000.071',
  serie_documento: '1',
  parcela_numero: 2,
  parcela_total: 3,
  tipo_documento: 'nfe',
  pessoa: { id: 'p1', nome: 'SECRETARIA DE ESTADO DE EDUCAÇÃO DO PARÁ' },
  categoria: null,
  conta: null,
  contrato_pedido_id: null,
  ...over,
});

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FinTabelaLancamentos tipo="a_receber" />
    </QueryClientProvider>,
  );

beforeEach(() => {
  lancamentos.length = 0;
});

describe('tabela de lançamentos', () => {
  it('a parcela aparece junto do documento, sem coluna própria', () => {
    lancamentos.push(lancamento());
    montar();

    const titulos = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(titulos).not.toContain('Parcela');
    expect(titulos).toHaveLength(8);

    const documento = screen.getByText('000.000.071 / 1').closest('td') as HTMLElement;
    expect(within(documento).getByText('Parcela 2/3')).toBeTruthy();
  });

  it('parcela única não acrescenta nada à célula do documento', () => {
    lancamentos.push(lancamento({ parcela_numero: 1, parcela_total: 1 }));
    montar();
    const documento = screen.getByText('000.000.071 / 1').closest('td') as HTMLElement;
    expect(within(documento).queryByText(/Parcela/)).toBeNull();
  });

  it('nenhum título de coluna quebra linha', () => {
    lancamentos.push(lancamento());
    montar();
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th.className).toContain('whitespace-nowrap');
    }
  });

  it('a coluna de ações fica presa à direita a partir do tablet, no título e na linha', () => {
    lancamentos.push(lancamento());
    montar();
    const titulos = screen.getAllByRole('columnheader');
    const acoes = titulos[titulos.length - 1];
    expect(acoes.textContent).toBe('Ações');
    expect(acoes.className).toContain('md:sticky');
    expect(acoes.className).toContain('md:right-0');

    const celula = screen.getByRole('button', { name: 'Receber' }).closest('td') as HTMLElement;
    expect(celula.className).toContain('md:sticky');
    // Coluna presa sem fundo próprio deixaria o texto rolado aparecer por baixo.
    expect(celula.className).toContain('md:bg-card');
  });

  it('Responsável só aparece em tela larga — abaixo dela, Valor ficaria escondido sob as ações', () => {
    lancamentos.push(lancamento());
    montar();
    const responsavel = screen.getAllByRole('columnheader').find((th) => th.textContent === 'Responsável') as HTMLElement;
    expect(responsavel.className).toContain('hidden');
    expect(responsavel.className).toContain('min-[1400px]:table-cell');
    // O filtro por responsável continua disponível em qualquer largura.
    expect(screen.getByRole('combobox', { name: 'Filtrar por responsável' })).toBeTruthy();
  });

  it('o estado vazio ocupa a largura exata das colunas', () => {
    montar();
    const vazio = screen.getByText('Nenhum lançamento encontrado').closest('td') as HTMLElement;
    expect(vazio.getAttribute('colspan')).toBe(String(screen.getAllByRole('columnheader').length));
  });
});
