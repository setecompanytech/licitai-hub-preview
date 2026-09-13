import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowIA from './WorkflowIA';
import { WORKFLOW_STEPS } from '@/components/workflow-ia/etapas';

/**
 * O Workflow IA não executa nada — são oito chamadas de texto ao modelo, sem
 * INSERT, sem UPDATE e sem edge function própria. Estes casos travam as duas
 * coisas que a tela antiga errava e que ninguém percebia olhando a página:
 *
 *  1. Etapa que FALHA aparecia como "Concluído", porque `ai-stream.ts` chama
 *     `onError` e logo depois `onDone`, e o `onDone` marcava concluída sem
 *     saber da falha. O mock abaixo reproduz essa ordem de propósito: é o
 *     ponto exato do defeito.
 *  2. A tela afirmava ter executado a esteira ("Iniciar esteira",
 *     "Executando...", "Esteira concluída") quando só tinha gerado texto.
 */

const ERRO_402 = 'Créditos de IA insuficientes (402) — verifique o plano da conta.';

const streamAIChat = vi.fn();

vi.mock('@/lib/ai-stream', () => ({
  streamAIChat: (args: unknown) => streamAIChat(args),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const EMPRESA = {
  id: 'emp-1',
  cnpj: '00.000.000/0001-00',
  razao_social: 'Empresa Teste LTDA',
  nome_fantasia: 'Empresa Teste',
  cnae_principal: '4211-1/01',
  uf: 'PA',
  municipio: 'Belém',
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({
    empresas: [{ empresa_id: 'emp-1', papel: 'admin', empresa: EMPRESA }],
    empresaAtiva: EMPRESA,
  }),
}));

type ArgsStream = {
  messages: { role: string; content: string }[];
  onDelta: (t: string) => void;
  onDone: () => void;
  onError?: (m: string) => void;
};

/** Responde como `ai-stream.ts` responde: erro sempre seguido de `onDone`. */
const respondendo = (falhaEm?: string) => (args: ArgsStream) => {
  const prompt = args.messages[0].content;
  const etapa = WORKFLOW_STEPS.find((e) => prompt.includes(`**Etapa**: ${e.label}`));
  if (falhaEm && etapa?.key === falhaEm) {
    args.onError?.(ERRO_402);
    args.onDone();
    return Promise.resolve();
  }
  args.onDelta(`Analise da etapa ${etapa?.label}.`);
  args.onDone();
  return Promise.resolve();
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/workflow-ia']}>
      <WorkflowIA />
    </MemoryRouter>,
  );

const gerar = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Gerar análise/i }));
  });
};

const colunaEtapas = () => screen.getByRole('navigation', { name: 'Etapas da análise' });

const itemDaEtapa = (label: string) =>
  within(colunaEtapas())
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(label))!;

beforeEach(() => {
  streamAIChat.mockReset();
});

describe('WorkflowIA — coluna de etapas', () => {
  it('mostra as oito etapas, na ordem e com os rótulos do sistema', () => {
    montar();
    const itens = within(colunaEtapas()).getAllByRole('button');
    expect(itens).toHaveLength(WORKFLOW_STEPS.length);
    WORKFLOW_STEPS.forEach((etapa, i) => {
      expect(itens[i].textContent).toContain(etapa.label);
    });
  });

  it('começa com todas as etapas sem análise — nenhuma se diz pronta', () => {
    montar();
    for (const etapa of WORKFLOW_STEPS) {
      expect(itemDaEtapa(etapa.label).textContent).toContain('Não analisada');
    }
  });

  it('abre no centro a etapa escolhida na coluna', () => {
    montar();
    fireEvent.click(itemDaEtapa('Robô de Lances'));
    const centro = screen.getByRole('region', { name: /Robô de Lances/ });
    expect(within(centro).getByText(WORKFLOW_STEPS[7].desc)).toBeTruthy();
  });
});

describe('WorkflowIA — falha e recuperação', () => {
  it('etapa que falha mostra FALHA, e não análise pronta', async () => {
    streamAIChat.mockImplementation(respondendo('agendamento'));
    montar();
    await gerar();

    const item = itemDaEtapa('Agendamento');
    expect(item.textContent).toContain('Falhou');
    // O defeito original: `onDone` marcava concluída mesmo depois de `onError`.
    expect(item.textContent).not.toContain('Análise pronta');
    expect(item.textContent).not.toContain('Concluído');
  });

  it('exibe a mensagem REAL do servidor, não um texto genérico', async () => {
    streamAIChat.mockImplementation(respondendo('agendamento'));
    montar();
    await gerar();

    expect(screen.getByText(ERRO_402)).toBeTruthy();
    expect(screen.queryByText('Erro ao executar esta etapa.')).toBeNull();
  });

  it('oferece recuperação: tentar de novo só aquela etapa', async () => {
    streamAIChat.mockImplementation(respondendo('agendamento'));
    montar();
    await gerar();
    expect(streamAIChat).toHaveBeenCalledTimes(WORKFLOW_STEPS.length);

    const retentar = screen.getByRole('button', { name: /Tentar novamente esta etapa/i });
    streamAIChat.mockImplementation(respondendo());
    await act(async () => {
      fireEvent.click(retentar);
    });

    // Uma chamada a mais, não outras oito.
    expect(streamAIChat).toHaveBeenCalledTimes(WORKFLOW_STEPS.length + 1);
    expect(itemDaEtapa('Agendamento').textContent).toContain('Análise pronta');
    expect(screen.queryByText(ERRO_402)).toBeNull();
  });

  it('a etapa que falhou não entra na contagem de análises prontas', async () => {
    streamAIChat.mockImplementation(respondendo('agendamento'));
    montar();
    await gerar();

    const resumo = screen.getByRole('complementary', { name: 'Resumo da análise' });
    expect(within(resumo).getByText(`${WORKFLOW_STEPS.length - 1} de ${WORKFLOW_STEPS.length}`)).toBeTruthy();
    // E o alerta de conclusão não aparece com uma etapa quebrada.
    expect(screen.queryByText(/Análise das oito etapas concluída/)).toBeNull();
  });
});

describe('WorkflowIA — sugestão não é execução', () => {
  it('diz, antes de qualquer resultado, que nada é gravado no sistema', () => {
    montar();
    expect(screen.getByText(/Esta tela sugere; quem executa é você/)).toBeTruthy();
    expect(screen.getByText(/nada é gravado no sistema/i)).toBeTruthy();
    const resumo = screen.getByRole('complementary', { name: 'Resumo da análise' });
    expect(within(resumo).getByText('Registros criados no sistema')).toBeTruthy();
    expect(within(resumo).getByText('Nenhum')).toBeTruthy();
  });

  it('não usa vocabulário de execução no botão nem nos selos', async () => {
    streamAIChat.mockImplementation(respondendo());
    montar();
    expect(screen.queryByRole('button', { name: /Iniciar esteira/i })).toBeNull();

    await gerar();
    for (const proibido of ['Executando...', 'Em execução', 'Concluído', 'Esteira concluída']) {
      expect(screen.queryByText(proibido)).toBeNull();
    }
  });

  it('com as oito prontas, o fecho fala de sugestão e manda para Compromissos', async () => {
    streamAIChat.mockImplementation(respondendo());
    montar();
    await gerar();

    expect(screen.getByText(/Análise das oito etapas concluída/)).toBeTruthy();
    expect(screen.getByText(/Nada foi executado nem gravado/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver meus compromissos/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Meus compromissos/i }).getAttribute('href')).toBe(
      '/meus-compromissos',
    );
  });
});
