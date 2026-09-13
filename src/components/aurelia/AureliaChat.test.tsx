import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AureliaChat from './AureliaChat';

/**
 * A conversa com a AURÉLIA vivia em `useState`: fechar o painel guardava,
 * recarregar a página apagava. Quem pedia análise de um edital, saía para
 * conferir o documento e voltava, encontrava a tela em branco — e refazia a
 * pergunta, com outro gasto de IA e outra resposta.
 *
 * E o botão "Nova consulta" não abria nada: apagava o que estava ali. "Novo"
 * significava "perdi o anterior", que é o oposto do que a palavra promete no
 * resto do sistema.
 *
 * Estes casos travam as duas coisas — que a conversa é guardada e que a
 * anterior sobrevive a começar outra.
 */
const historico = {
  conversas: [] as { id: string; titulo: string | null; ultima_mensagem_em: string; total_mensagens: number; rota_origem: string | null }[],
  carregando: false,
  erro: null as string | null,
  carregarConversas: vi.fn(),
  abrirConversa: vi.fn(async () => 'conversa-1'),
  gravarMensagem: vi.fn(async () => {}),
  carregarMensagens: vi.fn(async () => [
    { role: 'user' as const, content: 'O que é habilitação jurídica?' },
    { role: 'assistant' as const, content: 'Resposta guardada.' },
  ]),
  arquivarConversa: vi.fn(async () => {}),
};

vi.mock('@/hooks/useAureliaHistorico', () => ({
  useAureliaHistorico: () => historico,
}));
vi.mock('@/lib/ai-stream', () => ({
  streamAIChat: vi.fn(async ({ onDelta, onDone }: { onDelta: (c: string) => void; onDone: () => void }) => {
    onDelta('Resposta da AURÉLIA.');
    onDone();
  }),
}));
vi.mock('@/hooks/useFabArrastavel', () => ({
  useFabArrastavel: () => ({
    handlers: {}, estilo: {}, lado: 'direita', arrastando: false, consumirArraste: () => false,
  }),
}));

// jsdom não implementa `scrollIntoView`, e o painel rola para a última fala a
// cada mensagem. Sem este stub o erro que aparece é do ambiente, não do código.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const abrirPainel = () => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AureliaChat />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByLabelText(/Consultar AURÉLIA/i));
};

describe('AURÉLIA — histórico de conversas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historico.conversas = [];
    historico.erro = null;
  });

  it('tem as duas abas: a conversa de agora e as anteriores', () => {
    abrirPainel();
    expect(screen.getByRole('tab', { name: /Chat/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Histórico/i })).toBeTruthy();
  });

  it('guarda a pergunta ANTES de perguntar', async () => {
    abrirPainel();
    fireEvent.change(screen.getByLabelText(/Pergunta para a AURÉLIA/i), {
      target: { value: 'Prazo de recurso no pregão?' },
    });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await waitFor(() => expect(historico.abrirConversa).toHaveBeenCalled());
    // A pergunta é o que custou o raciocínio: se a resposta falhar ou a aba
    // fechar no meio, ela precisa sobreviver.
    expect(historico.gravarMensagem).toHaveBeenCalledWith(
      'conversa-1', 'user', 'Prazo de recurso no pregão?', expect.any(Number),
    );
  });

  it('guarda também a resposta, na posição seguinte', async () => {
    abrirPainel();
    fireEvent.change(screen.getByLabelText(/Pergunta para a AURÉLIA/i), {
      target: { value: 'Vale impugnar?' },
    });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await waitFor(() =>
      expect(historico.gravarMensagem).toHaveBeenCalledWith(
        'conversa-1', 'assistant', 'Resposta da AURÉLIA.', expect.any(Number), undefined,
      ),
    );
  });

  it('conversa nova não apaga a anterior — abre outra', async () => {
    abrirPainel();
    fireEvent.change(screen.getByLabelText(/Pergunta para a AURÉLIA/i), {
      target: { value: 'Primeira pergunta' },
    });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));
    await waitFor(() => expect(historico.abrirConversa).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText('Nova conversa'));
    // Nada é arquivado nem apagado: a de antes ficou gravada.
    expect(historico.arquivarConversa).not.toHaveBeenCalled();

    // E a próxima pergunta abre uma conversa NOVA, não continua a anterior.
    fireEvent.change(screen.getByLabelText(/Pergunta para a AURÉLIA/i), {
      target: { value: 'Assunto diferente' },
    });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));
    await waitFor(() => expect(historico.abrirConversa).toHaveBeenCalledTimes(2));
  });

  it('reabre uma conversa do histórico, inteira', async () => {
    historico.conversas = [{
      id: 'c-antiga',
      titulo: 'O que é habilitação jurídica?',
      ultima_mensagem_em: '2026-09-12T10:00:00Z',
      total_mensagens: 2,
      rota_origem: '/dashboard',
    }];
    abrirPainel();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/i }));
    fireEvent.click(screen.getByText('O que é habilitação jurídica?'));

    await waitFor(() => expect(historico.carregarMensagens).toHaveBeenCalledWith('c-antiga'));
    // Volta para a conversa, com as duas falas que estavam gravadas.
    await waitFor(() => expect(screen.getByText('Resposta guardada.')).toBeTruthy());
  });

  it('sem conversa guardada, explica o que a aba faz', () => {
    abrirPainel();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/i }));
    expect(screen.getByText('Nenhuma conversa guardada')).toBeTruthy();
  });

  it('falha ao carregar o histórico aparece, com caminho de volta', () => {
    historico.erro = 'permission denied for table aurelia_conversas';
    abrirPainel();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/i }));
    const alerta = screen.getByRole('alert');
    // A mensagem REAL do banco, não "erro ao carregar" — quem lê a primeira
    // sabe o que fazer; a segunda manda reiniciar o roteador.
    expect(alerta.textContent).toContain('permission denied');
    expect(screen.getByText('Tentar novamente')).toBeTruthy();
  });
});
