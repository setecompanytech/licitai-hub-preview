import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * `iniciarProcesso` ganhou um terceiro parâmetro para a pasta manual. O que se
 * trava aqui é que os chamadores de sempre (monitoramento, mural, compromisso
 * sem pasta) não mudam: sem opções, a preparação da pasta continua disparando
 * na hora e o texto continua dizendo "a partir do monitoramento".
 */

const estado = vi.hoisted(() => ({
  chamadas: [] as { tabela: string; metodo: string; args: unknown[] }[],
  respostas: {} as Record<string, { data: unknown; error: unknown }>,
  invoke: vi.fn(),
  registrar: vi.fn(),
  auth: { user: { id: 'u1' } },
  empresa: { empresaAtiva: { id: 'e1' } },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      let operacao = 'select';
      const q: Record<string, unknown> = {};
      for (const metodo of ['select', 'eq', 'limit', 'order', 'maybeSingle', 'single']) {
        q[metodo] = (...args: unknown[]) => {
          estado.chamadas.push({ tabela, metodo, args });
          return q;
        };
      }
      for (const metodo of ['insert', 'update', 'delete']) {
        q[metodo] = (...args: unknown[]) => {
          operacao = metodo;
          estado.chamadas.push({ tabela, metodo, args });
          return q;
        };
      }
      q.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve(estado.respostas[`${tabela}:${operacao}`] ?? { data: null, error: null }).then(ok, falha);
      return q;
    },
    functions: { invoke: (...args: unknown[]) => estado.invoke(...args) },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.auth }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => estado.empresa }));
vi.mock('@/hooks/useActivityLog', () => {
  const log = { registrar: (...args: unknown[]) => estado.registrar(...args) };
  return { useActivityLog: () => log };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useLicitacaoIntegration } from './useLicitacaoIntegration';

const montar = () =>
  renderHook(() => useLicitacaoIntegration(), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>,
  }).result.current;

const inseridos = (tabela: string) =>
  estado.chamadas
    .filter((c) => c.tabela === tabela && c.metodo === 'insert')
    .map((c) => c.args[0] as Record<string, unknown>);

const EDITAL = { numero: 'DE 12/2026', orgao: 'Secretaria de Saúde', objeto: 'Insumos hospitalares', portal: 'Banparanet (PA)' };

beforeEach(() => {
  estado.chamadas = [];
  estado.respostas = {
    'licitacoes:insert': { data: { id: 'lic-novo' }, error: null },
    'processos_interesse:insert': { data: { id: 'comp-1' }, error: null },
  };
  estado.invoke.mockReset().mockResolvedValue({ error: null });
  estado.registrar.mockReset().mockResolvedValue(undefined);
});

describe('iniciarProcesso', () => {
  it('sem opções, mantém o comportamento de sempre: prepara a pasta na hora e fala em monitoramento', async () => {
    const { iniciarProcesso } = montar();

    const id = await iniciarProcesso(EDITAL);

    expect(id).toBe('lic-novo');
    expect(estado.invoke).toHaveBeenCalledWith('processo-auto-prepare', { body: { licitacao_id: 'lic-novo' } });
    expect(inseridos('licitacoes')[0]).not.toHaveProperty('data_abertura');
    expect(inseridos('licitacoes')[0]).toMatchObject({ empresa_id: 'e1', operador_id: 'u1', portal: 'Banparanet (PA)' });
    expect(String(inseridos('licitacao_mensagens')[0].conteudo)).toContain('a partir do monitoramento');
    expect(estado.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: expect.stringContaining('a partir do monitoramento') }),
    );
  });

  it('origem manual sem preparação automática: não dispara a preparação e diz que foi criado manualmente', async () => {
    const { iniciarProcesso } = montar();

    const id = await iniciarProcesso(
      { ...EDITAL, data_abertura: '2026-09-20T12:00:00.000Z' },
      undefined,
      { origem: 'manual', prepararAutomaticamente: false },
    );

    expect(id).toBe('lic-novo');
    expect(estado.invoke).not.toHaveBeenCalled();
    expect(inseridos('licitacoes')[0]).toMatchObject({ data_abertura: '2026-09-20T12:00:00.000Z' });
    const mensagem = String(inseridos('licitacao_mensagens')[0].conteudo);
    expect(mensagem).toContain('criado manualmente');
    expect(mensagem).toContain('Banparanet (PA)');
    expect(String(inseridos('notificacoes')[0].mensagem)).toContain('criada manualmente');
    expect(estado.registrar).toHaveBeenCalledWith(expect.objectContaining({
      descricao: expect.stringContaining('criado manualmente'),
      metadata: expect.objectContaining({ origem: 'manual' }),
    }));
  });

  it('devolve a mensagem real do banco a quem pediu', async () => {
    estado.respostas['licitacoes:insert'] = { data: null, error: { message: 'new row violates row-level security policy' } };
    const aoFalhar = vi.fn();
    const { iniciarProcesso } = montar();

    const id = await iniciarProcesso(EDITAL, undefined, { origem: 'manual', prepararAutomaticamente: false, aoFalhar });

    expect(id).toBeNull();
    expect(aoFalhar).toHaveBeenCalledWith('new row violates row-level security policy');
    expect(estado.invoke).not.toHaveBeenCalled();
  });
});

/**
 * 17/09: o processo chegava ao Kanban e a pasta não nascia. Três dos quatro
 * caminhos de entrada não chamavam `criarCompromisso` — na O S eram 31
 * processos no quadro e 2 pastas na aba. A pasta passa a nascer com o processo.
 */
describe('iniciarProcesso cria a pasta em Compromissos', () => {
  it('grava o compromisso com a empresa ativa, junto do processo', async () => {
    const { iniciarProcesso } = montar();
    await iniciarProcesso(EDITAL);

    const [compromisso] = inseridos('processos_interesse');
    expect(compromisso).toMatchObject({
      user_id: 'u1',
      empresa_id: 'e1',
      licitacao_id: 'lic-novo',
      numero: 'DE 12/2026',
      status: 'interessado',
      alerta_sistema: true,
    });
  });

  it('processo que já existe na empresa ganha a pasta de quem chegou agora', async () => {
    estado.respostas['licitacoes:select'] = { data: { id: 'lic-do-colega' }, error: null };
    const { iniciarProcesso } = montar();
    await iniciarProcesso(EDITAL);

    // Nenhum processo novo…
    expect(inseridos('licitacoes')).toHaveLength(0);
    // …e a pasta do processo do colega, para esta pessoa.
    expect(inseridos('processos_interesse')[0]).toMatchObject({ licitacao_id: 'lic-do-colega', user_id: 'u1' });
  });

  it('não duplica: com pasta existente, reaproveita e não insere', async () => {
    estado.respostas['processos_interesse:select'] = { data: { id: 'comp-que-ja-existe' }, error: null };
    const { iniciarProcesso } = montar();
    await iniciarProcesso(EDITAL);

    expect(inseridos('processos_interesse')).toHaveLength(0);
  });
});

describe('criarCompromisso', () => {
  it('usa a data da sessão quando existe e o prazo quando não', async () => {
    const { criarCompromisso } = montar();

    await criarCompromisso(
      { ...EDITAL, data_abertura: '2026-09-20T12:00:00.000Z', data_encerramento: '2026-09-19T20:00:00.000Z' },
      'lic-novo',
      'e1',
    );
    await criarCompromisso({ ...EDITAL, data_encerramento: '2026-09-19T20:00:00.000Z' }, 'lic-2', 'e1');

    const [comSessao, semSessao] = inseridos('processos_interesse');
    expect(comSessao).toMatchObject({ data_abertura: '2026-09-20T12:00:00.000Z', data_encerramento: '2026-09-19T20:00:00.000Z' });
    expect(semSessao).toMatchObject({ data_abertura: '2026-09-19T20:00:00.000Z' });
  });
});

/**
 * Promoção automática de fase (19/09): o ato da operação move o processo, só
 * para a frente, pela mesma trilha da mudança manual.
 */
describe('promoverFase', () => {
  const atualizacoes = () =>
    estado.chamadas
      .filter((c) => c.tabela === 'licitacoes' && c.metodo === 'update')
      .map((c) => c.args[0] as Record<string, unknown>);

  it('processo no radar vai para Em Disputa, com a trilha registrando de onde veio', async () => {
    estado.respostas['licitacoes:select'] = { data: { status: 'Monitorando', arquivado_em: null }, error: null };
    const { promoverFase } = montar();

    const r = await promoverFase('lic-1', 'Em Disputa', 'Sessão cadastrada no Robô de Lances');

    expect(r).toEqual({ promovido: true, de: 'Monitorando' });
    expect(atualizacoes()).toEqual([{ status: 'Em Disputa' }]);
    expect(estado.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'status_alterado', de: 'Monitorando', para: 'Em Disputa' }),
    );
  });

  it('não volta fase: Em Disputa não vira Proposta Enviada', async () => {
    estado.respostas['licitacoes:select'] = { data: { status: 'Em Disputa', arquivado_em: null }, error: null };
    const { promoverFase } = montar();

    const r = await promoverFase('lic-1', 'Proposta Enviada');

    expect(r).toEqual({ promovido: false, de: 'Em Disputa' });
    expect(atualizacoes()).toEqual([]);
  });

  it('decidido e arquivado ficam como estão', async () => {
    const { promoverFase } = montar();

    estado.respostas['licitacoes:select'] = { data: { status: 'Perdida', arquivado_em: null }, error: null };
    expect(await promoverFase('lic-1', 'Em Disputa')).toEqual({ promovido: false, de: 'Perdida' });

    estado.respostas['licitacoes:select'] = { data: { status: 'Monitorando', arquivado_em: '2026-09-01T12:00:00Z' }, error: null };
    expect(await promoverFase('lic-2', 'Em Disputa')).toEqual({ promovido: false, de: 'Monitorando' });

    expect(atualizacoes()).toEqual([]);
  });

  it('devolve a mensagem real do banco quando a leitura falha', async () => {
    estado.respostas['licitacoes:select'] = { data: null, error: { message: 'permission denied for table licitacoes' } };
    const { promoverFase } = montar();

    const r = await promoverFase('lic-1', 'Em Disputa');

    expect(r).toEqual({ promovido: false, de: null, erro: 'permission denied for table licitacoes' });
    expect(atualizacoes()).toEqual([]);
  });
});
