import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

/**
 * A pasta manual (Compromissos › Nova pasta). O que se trava:
 *
 *  - obrigatórios dizem o que falta e o foco vai ao primeiro erro;
 *  - licitação já na gestão oferece a pasta existente e NÃO cria outra;
 *  - a sequência: processo sem preparação automática → compromisso → anexos
 *    com a categoria e o metadata de cada tipo → só então a preparação;
 *  - anexo que falha não some: a lista com a mensagem real e as duas saídas;
 *  - sem Edital/TR, o aviso de que a extração por IA espera o edital;
 *  - quem só acompanha não cria, e vê por quê.
 *
 * Supabase, sessão, empresa, criador de processo e envio de anexo são dublês.
 */

const estado = vi.hoisted(() => {
  const s = {
    duplicadas: [] as { id: string }[],
    invoke: vi.fn(),
    enviar: vi.fn(),
    iniciarProcesso: vi.fn(),
    criarCompromisso: vi.fn(),
    auth: { user: { id: 'u1' } },
    empresa: {
      empresaAtiva: { id: 'e1' },
      empresas: [{ empresa_id: 'e1', papel: 'operador' }],
    },
  };
  return { ...s, integracao: { iniciarProcesso: s.iniciarProcesso, criarCompromisso: s.criarCompromisso } };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const metodo of ['select', 'eq', 'limit']) q[metodo] = () => q;
      q.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve({ data: estado.duplicadas, error: null }).then(ok, falha);
      return q;
    },
    functions: { invoke: (...args: unknown[]) => estado.invoke(...args) },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => estado.empresa }));
vi.mock('@/hooks/useLicitacaoIntegration', () => ({ useLicitacaoIntegration: () => estado.integracao }));
vi.mock('@/lib/processo/anexos', () => ({
  enviarAnexoDoProcesso: (...args: unknown[]) => estado.enviar(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// Radix (Select, Popover) mede elementos e o cmdk rola a opção ativa; o jsdom
// não traz nenhum dos dois.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as never;
Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

import NovaPastaManualDialog, { BotaoNovaPastaManual } from './NovaPastaManualDialog';

function PastaAberta() {
  const { id } = useParams();
  return <p>pasta {id}</p>;
}

const aoFechar = vi.fn();
const aoCriar = vi.fn();

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/kanban']}>
      <Routes>
        <Route path="/kanban" element={<NovaPastaManualDialog aberto aoFechar={aoFechar} aoCriar={aoCriar} />} />
        <Route path="/processo/:id" element={<PastaAberta />} />
      </Routes>
    </MemoryRouter>,
  );

const pdf = (nome: string) => new File(['%PDF-1.4'], nome, { type: 'application/pdf' });

async function preencherObrigatorios() {
  fireEvent.change(screen.getByLabelText(/Número do processo/), { target: { value: 'DE 12/2026' } });
  fireEvent.change(screen.getByLabelText(/Órgão ou entidade/), { target: { value: 'Secretaria de Saúde do Pará' } });
  fireEvent.change(screen.getByLabelText(/^Objeto/), { target: { value: 'Aquisição de insumos hospitalares' } });
  fireEvent.click(screen.getByLabelText(/Sistema de origem/));
  fireEvent.click(await screen.findByText('Banparanet (Pará) — sistema Paradigma'));
}

const anexar = (arquivos: File[]) =>
  fireEvent.change(screen.getByLabelText('Anexar arquivos'), { target: { files: arquivos } });

const criar = () => fireEvent.click(screen.getByRole('button', { name: 'Criar pasta' }));

beforeEach(() => {
  estado.duplicadas = [];
  estado.invoke.mockReset().mockResolvedValue({ error: null });
  estado.enviar.mockReset().mockResolvedValue({ ok: true, anexo: {} });
  estado.iniciarProcesso.mockReset().mockResolvedValue('lic-novo');
  estado.criarCompromisso.mockReset().mockResolvedValue('comp-1');
  aoFechar.mockReset();
  aoCriar.mockReset();
});

describe('NovaPastaManualDialog', () => {
  it('diz o que falta, leva o foco ao primeiro erro e não cria nada', async () => {
    montar();

    criar();

    expect(await screen.findByText('Informe o número do processo.')).toBeTruthy();
    expect(screen.getByText('Informe o órgão ou a entidade.')).toBeTruthy();
    expect(screen.getByText('Descreva o objeto.')).toBeTruthy();
    expect(screen.getByText('Escolha o sistema de origem.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Número do processo/));
    expect(screen.getByLabelText(/Número do processo/).getAttribute('aria-invalid')).toBe('true');
    expect(estado.iniciarProcesso).not.toHaveBeenCalled();
  });

  it('licitação já na gestão oferece a pasta existente e não cria outra', async () => {
    estado.duplicadas = [{ id: 'lic-antiga' }];
    montar();
    await preencherObrigatorios();

    criar();

    expect(await screen.findByText('Esta licitação já está na gestão da empresa')).toBeTruthy();
    expect(estado.iniciarProcesso).not.toHaveBeenCalled();
    expect(estado.enviar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir pasta existente' }));
    expect(await screen.findByText('pasta lic-antiga')).toBeTruthy();
  });

  it('cria o processo, o compromisso, envia os anexos com o tipo certo e só então pede a preparação', async () => {
    montar();
    await preencherObrigatorios();
    anexar([
      pdf('Edital DE 12-2026.pdf'),
      pdf('Termo de Referência.pdf'),
      new File(['x'], 'Planilha de itens.xlsx', { type: 'application/vnd.ms-excel' }),
    ]);

    criar();

    expect(await screen.findByText('pasta lic-novo')).toBeTruthy();

    expect(estado.iniciarProcesso).toHaveBeenCalledWith(
      expect.objectContaining({
        numero: 'DE 12/2026',
        orgao: 'Secretaria de Saúde do Pará',
        objeto: 'Aquisição de insumos hospitalares',
        modalidade: 'Dispensa Eletrônica',
        portal: 'Banparanet (PA)',
        uf: 'PA',
      }),
      undefined,
      expect.objectContaining({ origem: 'manual', prepararAutomaticamente: false }),
    );
    expect(estado.criarCompromisso).toHaveBeenCalledWith(expect.objectContaining({ numero: 'DE 12/2026' }), 'lic-novo', 'e1');
    expect(aoCriar).toHaveBeenCalledWith('lic-novo');

    const envios = estado.enviar.mock.calls.map(([p]) => p);
    expect(envios.map((p) => [p.arquivo.name, p.categoria, p.metadata, p.descricao])).toEqual([
      ['Edital DE 12-2026.pdf', 'edital', { tipo: 'edital' }, undefined],
      ['Termo de Referência.pdf', 'edital', { tipo: 'termo_referencia' }, 'Termo de Referência'],
      ['Planilha de itens.xlsx', 'edital', { tipo: 'anexo_edital' }, undefined],
    ]);
    expect(envios.every((p) => p.licitacaoId === 'lic-novo' && p.userId === 'u1')).toBe(true);

    expect(estado.invoke).toHaveBeenCalledWith('processo-auto-prepare', { body: { licitacao_id: 'lic-novo' } });
    const ordem = (fn: typeof estado.enviar) => fn.mock.invocationCallOrder;
    expect(ordem(estado.criarCompromisso)[0]).toBeGreaterThan(ordem(estado.iniciarProcesso)[0]);
    expect(Math.min(...ordem(estado.enviar))).toBeGreaterThan(ordem(estado.criarCompromisso)[0]);
    expect(ordem(estado.invoke)[0]).toBeGreaterThan(Math.max(...ordem(estado.enviar)));
  });

  it('anexo que falha aparece com a mensagem real, e a pessoa escolhe entre tentar de novo e abrir a pasta', async () => {
    estado.enviar
      .mockResolvedValueOnce({ ok: true, anexo: {} })
      .mockResolvedValueOnce({ ok: false, etapa: 'upload', erro: 'The object exceeded the maximum allowed size' });
    montar();
    await preencherObrigatorios();
    anexar([pdf('Edital DE 12-2026.pdf'), pdf('Declaração ME.pdf')]);

    criar();

    expect(await screen.findByText('A pasta foi criada, mas nem tudo foi salvo')).toBeTruthy();
    expect(screen.getByText('Declaração ME.pdf')).toBeTruthy();
    expect(screen.getByText(/The object exceeded the maximum allowed size/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar enviar de novo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir a pasta mesmo assim' })).toBeTruthy();
    expect(screen.queryByText('pasta lic-novo')).toBeNull();
    // O edital chegou: a preparação já foi pedida, uma vez só.
    expect(estado.invoke).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar enviar de novo' }));

    expect(await screen.findByText('pasta lic-novo')).toBeTruthy();
    expect(estado.enviar).toHaveBeenCalledTimes(3);
    expect(estado.enviar.mock.calls[2][0].arquivo.name).toBe('Declaração ME.pdf');
    expect(estado.iniciarProcesso).toHaveBeenCalledTimes(1);
    expect(estado.criarCompromisso).toHaveBeenCalledTimes(1);
    expect(estado.invoke).toHaveBeenCalledTimes(1);
  });

  it('sem Edital nem TR avisa que a extração espera o edital, e cria sem pedir a preparação', async () => {
    montar();
    const aviso = /extração dos\s+itens por IA só roda depois que o edital for anexado/;
    expect(screen.getByText(aviso)).toBeTruthy();

    anexar([pdf('Termo de Referência.pdf')]);
    expect(screen.queryByText(aviso)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remover Termo de Referência.pdf' }));
    expect(screen.getByText(aviso)).toBeTruthy();

    await preencherObrigatorios();
    criar();

    expect(await screen.findByText('pasta lic-novo')).toBeTruthy();
    expect(estado.enviar).not.toHaveBeenCalled();
    expect(estado.invoke).not.toHaveBeenCalled();
  });

  it('processo que não foi criado mostra o erro do banco e mantém o formulário', async () => {
    estado.iniciarProcesso.mockImplementation(async (_d: unknown, _n: unknown, opcoes: { aoFalhar?: (m: string) => void }) => {
      opcoes.aoFalhar?.('new row violates row-level security policy');
      return null;
    });
    montar();
    await preencherObrigatorios();

    criar();

    expect(await screen.findByText(/A pasta não foi criada: new row violates row-level security policy/)).toBeTruthy();
    expect((screen.getByLabelText(/Número do processo/) as HTMLInputElement).value).toBe('DE 12/2026');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar pasta' })).not.toBeDisabled());
    expect(estado.criarCompromisso).not.toHaveBeenCalled();
  });
});

describe('BotaoNovaPastaManual', () => {
  it('quem só acompanha vê o botão desabilitado e o motivo', () => {
    estado.empresa.empresas[0].papel = 'viewer';
    try {
      render(<BotaoNovaPastaManual aoAbrir={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Nova pasta/ })).toBeDisabled();
      expect(screen.getByText(/modo leitura/)).toBeTruthy();
    } finally {
      estado.empresa.empresas[0].papel = 'operador';
    }
  });

  it('operador abre o diálogo', () => {
    const aoAbrir = vi.fn();
    render(<BotaoNovaPastaManual aoAbrir={aoAbrir} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova pasta/ }));
    expect(aoAbrir).toHaveBeenCalled();
  });
});
