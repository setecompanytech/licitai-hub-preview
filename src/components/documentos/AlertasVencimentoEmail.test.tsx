import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlertasVencimentoEmail from './AlertasVencimentoEmail';

/**
 * Três defeitos da tela de alertas, cada um com um teste que os prende:
 *
 *  1. a antecedência só era gravada quando o alerta JÁ estava ligado — o
 *     `onBlur` era `ativo && salvarConfig(true)`. Quem desligava os alertas,
 *     ajustava a janela para 60 e voltava depois encontrava 30 de novo, sem
 *     nenhuma mensagem de erro no caminho;
 *
 *  2. WhatsApp aparecia como canal ("aguarda contratação de provedor"), e não
 *     existe canal nenhum: a função `whatsapp-envio` grava `status:'simulado'`
 *     e nada lê a coluna `whatsapp`;
 *
 *  3. sem empresa ativa, `carregar()` retornava antes de `setCarregando(false)`
 *     e a tela girava para sempre.
 */

const upserts: Array<Record<string, unknown>> = [];

let configNoBanco: { ativo: boolean; antecedencia_dias: number } | null = {
  ativo: false,
  antecedencia_dias: 30,
};
let empresaAtiva: { id: string; razao_social?: string } | null = { id: 'empresa-1' };

/** Construtor encadeável que devolve o resultado da tabela pedida. */
function builderDe(tabela: string) {
  const resultado =
    tabela === 'documentos_alertas_config'
      ? { data: configNoBanco, error: null }
      : tabela === 'documentos_alertas_destinatarios'
        ? {
            data: [
              {
                id: 'd1',
                nome: 'Contabilidade XYZ',
                email: 'alertas@xyz.com.br',
                tipo: 'assessoria_contabil',
                ativo: true,
              },
            ],
            error: null,
          }
        : { data: [], error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  for (const metodo of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete']) {
    b[metodo] = vi.fn(() => b);
  }
  b.upsert = vi.fn((payload: Record<string, unknown>) => {
    if (tabela === 'documentos_alertas_config') upserts.push(payload);
    return b;
  });
  b.maybeSingle = vi.fn(async () => resultado);
  // Torna o builder aguardável, como o PostgrestBuilder real.
  b.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, falha);
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn((tabela: string) => builderDe(tabela)) },
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  upserts.length = 0;
  configNoBanco = { ativo: false, antecedencia_dias: 30 };
  empresaAtiva = { id: 'empresa-1' };
});

const esperarCarga = () =>
  waitFor(() => expect(screen.getByText('Configuração')).toBeTruthy());

describe('a antecedência persiste com o alerta DESLIGADO', () => {
  it('salva antecedencia_dias sem exigir que `ativo` seja true', async () => {
    render(<AlertasVencimentoEmail />);
    await esperarCarga();

    // O alerta está desligado — é exatamente o cenário em que o `onBlur`
    // antigo não gravava nada.
    expect(screen.getByLabelText('Alertas desligados')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Antecedência (dias)'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar configuração/i }));

    await waitFor(() => expect(upserts.length).toBe(1));
    expect(upserts[0]).toMatchObject({
      empresa_id: 'empresa-1',
      ativo: false,
      antecedencia_dias: 60,
    });
  });

  it('prende o valor à faixa do CHECK do banco (5 a 120)', async () => {
    render(<AlertasVencimentoEmail />);
    await esperarCarga();

    fireEvent.change(screen.getByLabelText('Antecedência (dias)'), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar configuração/i }));

    await waitFor(() => expect(upserts.length).toBe(1));
    // 900 violaria `antecedencia_dias BETWEEN 5 AND 120` e voltaria como erro
    // de constraint, sem a pessoa entender o que fez de errado.
    expect(upserts[0].antecedencia_dias).toBe(120);
  });

  it('o botão de salvar só fica ativo quando há alteração pendente', async () => {
    render(<AlertasVencimentoEmail />);
    await esperarCarga();

    const botao = screen.getByRole('button', { name: /salvar configuração/i });
    expect(botao).toBeDisabled();
    expect(screen.getByText('Tudo salvo.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Antecedência (dias)'), { target: { value: '45' } });
    await waitFor(() => expect(screen.getByText('Há alterações não salvas.')).toBeTruthy());
    expect(botao).not.toBeDisabled();
  });
});

describe('o que a tela declara', () => {
  it('não apresenta WhatsApp como canal', async () => {
    const { container } = render(<AlertasVencimentoEmail />);
    await esperarCarga();
    expect(container.textContent).not.toMatch(/whatsapp/i);
  });

  it('declara o horário pela âncora real (UTC), não por uma hora local fixa', async () => {
    const { container } = render(<AlertasVencimentoEmail />);
    await esperarCarga();
    // O cron é `'0 10 * * *'` — 10:00 UTC. Dizer só "7h" vale para UTC−3 e
    // mente para todo assinante em outro fuso.
    expect(container.textContent).toContain('10:00 UTC');
    expect(container.textContent).toMatch(/no seu fuso/i);
  });

  it('explica os marcos e a repetição diária do vencido', async () => {
    const { container } = render(<AlertasVencimentoEmail />);
    await esperarCarga();
    // Marcos da edge: antecedência, 15, 7, 3, 2, 1, 0.
    expect(container.textContent).toContain('30, 15, 7, 3, 2, 1, no dia');
    expect(container.textContent).toMatch(/todos os dias/i);
  });

  it('avisa que documento legado privado não é alertado', async () => {
    const { container } = render(<AlertasVencimentoEmail />);
    await esperarCarga();
    // A edge lê `documentos` por empresa_id estrito; a tela de Documentos usa
    // um `.or()` que alcança o legado privado. A divergência tem que aparecer.
    expect(container.textContent).toMatch(/privado.*não entra no alerta/i);
  });
});

describe('sem empresa ativa', () => {
  it('não fica preso no spinner — mostra o que fazer', async () => {
    empresaAtiva = null;
    render(<AlertasVencimentoEmail />);

    await waitFor(() => expect(screen.getByText('Escolha uma empresa')).toBeTruthy());
    expect(screen.queryByText(/carregando alertas de vencimento/i)).toBeNull();
  });
});
