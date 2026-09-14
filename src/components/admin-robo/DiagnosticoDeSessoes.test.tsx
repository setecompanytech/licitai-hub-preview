import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { resumirErroParaCliente } from '@/lib/robo/situacao-da-participacao';
import { dataHoraDeBrasilia } from '@/components/workspace/precificacao/formato';

/**
 * Diagnóstico das sessões, entre empresas.
 *
 * O teste que importa é o primeiro: o erro técnico INTEIRO e a frase que o
 * cliente lê aparecem juntos. Se só a tradução aparecesse, quem conserta não
 * teria o que consertar; se só o erro cru, não daria para conferir a tradução.
 *
 * A frase esperada vem de `resumirErroParaCliente` e não de um literal: o
 * teste prova que a tela mostra a tradução, não congela o texto dela.
 */

const respostas = vi.hoisted(() => ({}) as Record<string, { data: unknown; error: unknown }>);

vi.mock('@/integrations/supabase/client', () => {
  /** Cadeia encadeável e "thenable": resolve com a resposta da tabela. */
  function cadeiaDa(tabela: string) {
    const resolver = () => Promise.resolve(respostas[tabela] ?? { data: [], error: null });
    const cadeia: Record<string, unknown> = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (typeof prop !== 'string') return undefined;
          if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            const p = resolver() as unknown as Record<string, (...a: unknown[]) => unknown>;
            return p[prop].bind(p);
          }
          return () => cadeia;
        },
      },
    );
    return cadeia;
  }
  // `rpc` responde pela mesma chave de `respostas`, com o nome da função.
  return { supabase: { from: (tabela: string) => cadeiaDa(tabela), rpc: (funcao: string) => cadeiaDa(funcao) } };
});

import DiagnosticoDeSessoes from './DiagnosticoDeSessoes';

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

const ERRO_LONGO =
  'Signal timed out. Contexto do agente: a conta usada no portal está com acesso vencido e sem créditos; ' +
  'o navegador ficou onze minutos na tela de login aguardando resposta do servidor do portal antes de desistir.';
const ERRO_CURTO = 'Processo 90003 não encontrado na conta';

const SESSOES = [
  {
    id: 's-1', empresa_id: 'emp-1', user_id: 'user-aaaaaaaa', edital: 'PE 90001/2026',
    portal_nome: 'Compras.gov.br', portal_id: 'compras-gov', status: 'erro', modo: 'automatico',
    erro: ERRO_LONGO, created_at: '2026-09-14T15:00:00.000Z', updated_at: '2026-09-14T15:30:00.000Z',
  },
  {
    id: 's-2', empresa_id: 'emp-2', user_id: 'user-bbbbbbbb', edital: 'PE 90002/2026',
    portal_nome: 'BLL Compras', portal_id: 'bll', status: 'encerrado', modo: 'manual',
    erro: null, created_at: '2026-09-14T14:00:00.000Z', updated_at: '2026-09-14T14:10:00.000Z',
  },
  {
    id: 's-3', empresa_id: null, user_id: 'user-cccccccc', edital: 'PE 90003/2026',
    portal_nome: 'Licitanet', portal_id: 'licitanet', status: 'erro', modo: 'automatico',
    erro: ERRO_CURTO, created_at: '2026-09-13T10:00:00.000Z', updated_at: null,
  },
];

beforeEach(() => {
  for (const chave of Object.keys(respostas)) delete respostas[chave];
  respostas.sessoes_lance_real = { data: SESSOES, error: null };
  respostas.nomes_de_empresas_para_plataforma = {
    data: [
      { id: 'emp-1', razao_social: 'Acme Licitações LTDA', nome_fantasia: 'Acme' },
      { id: 'emp-2', razao_social: 'Beta Comércio LTDA', nome_fantasia: null },
    ],
    error: null,
  };
});

describe('diagnóstico de sessões', () => {
  it('mostra o erro técnico inteiro ao lado do que o cliente vê', async () => {
    render(<DiagnosticoDeSessoes />);

    // Erro cru, completo — o recorte visual é CSS, o texto está todo na tela.
    expect(await screen.findByText(ERRO_LONGO)).toBeInTheDocument();
    expect(screen.getByText(ERRO_CURTO)).toBeInTheDocument();

    // E a tradução de cada um, na coluna do cliente.
    expect(screen.getByText(resumirErroParaCliente(ERRO_LONGO).texto)).toBeInTheDocument();
    expect(screen.getByText(resumirErroParaCliente(ERRO_CURTO).texto)).toBeInTheDocument();

    // Erro longo abre por inteiro com um botão de verdade.
    const abrir = screen.getByRole('button', { name: 'Ver erro completo' });
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(abrir);
    expect(screen.getByRole('button', { name: 'Recolher erro' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('identifica a empresa pelo nome e a sessão antiga como sem empresa', async () => {
    render(<DiagnosticoDeSessoes />);
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('Acme')).toBeInTheDocument();
    expect(within(tabela).getByText('Beta Comércio LTDA')).toBeInTheDocument();
    expect(within(tabela).getByText('Sem empresa')).toBeInTheDocument();
    expect(within(tabela).getByText(dataHoraDeBrasilia('2026-09-14T15:30:00.000Z'))).toBeInTheDocument();
  });

  it('"Só com erro" esconde a sessão que terminou bem', async () => {
    render(<DiagnosticoDeSessoes />);
    expect(await screen.findByText('PE 90002/2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Só com erro' }));
    expect(screen.queryByText('PE 90002/2026')).toBeNull();
    expect(screen.getByText('PE 90001/2026')).toBeInTheDocument();
    expect(screen.getByText('PE 90003/2026')).toBeInTheDocument();
  });

  it('sem os nomes das empresas, as sessões continuam na tela', async () => {
    respostas.nomes_de_empresas_para_plataforma = { data: null, error: { code: 'P0001', message: 'Consulta exclusiva da operação Praefectus.' } };
    render(<DiagnosticoDeSessoes />);
    expect(await screen.findByText('Nomes das empresas indisponíveis')).toBeInTheDocument();
    expect(screen.getByText(ERRO_LONGO)).toBeInTheDocument();
    expect(screen.getByText('Empresa emp-1')).toBeInTheDocument();
  });

  it('migração não aplicada é "Migração pendente", não lista vazia', async () => {
    respostas.sessoes_lance_real = {
      data: null,
      error: { code: '42P01', message: 'relation "public.sessoes_lance_real" does not exist' },
    };
    render(<DiagnosticoDeSessoes />);
    expect(await screen.findByText('Migração pendente')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma sessão registrada.')).toBeNull();
  });

  it('falha comum mostra a mensagem real e oferece tentar de novo', async () => {
    respostas.sessoes_lance_real = {
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    };
    render(<DiagnosticoDeSessoes />);
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('canceling statement due to statement timeout');
    expect(within(alerta).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
