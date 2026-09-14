import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * `AtivacaoChecklist` nos dois modos (14/09/2026).
 *
 * Mora aqui, e não ao lado do componente, porque nasceu com a separação entre
 * a tela do cliente e a da plataforma.
 *
 *  - `cliente`: só o que é da empresa (acesso aos portais e certificado), mais
 *    uma linha de disponibilidade vinda de `situacao-do-robo`. Nada de agente,
 *    healthcheck, freio, slots, RAM ou "portais respondendo" — mesmo quando o
 *    healthcheck responde com tudo isso.
 *  - `plataforma` (padrão): a versão completa, que o Admin importa sem mudança
 *    — e sem a frase "Sistema pronto para disputas reais", que era falsa.
 */

type Resposta = { data: unknown; error: { message: string } | null };

const dubles = vi.hoisted(() => ({
  respostas: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  tabelasConsultadas: [] as string[],
  acoesChamadas: [] as string[],
  healthcheck: { data: null as unknown, error: null as unknown },
  situacao: { data: null as unknown, error: null as unknown },
}));

vi.mock('@/integrations/supabase/client', () => {
  function cadeiaDa(tabela: string) {
    const resolver = () => Promise.resolve(dubles.respostas[tabela] ?? { data: [], error: null });
    const cadeia: Record<string, unknown> = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (typeof prop !== 'string') return undefined;
          if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            const p = resolver() as unknown as Record<string, (...a: unknown[]) => unknown>;
            return (p[prop] as (...a: unknown[]) => unknown).bind(p);
          }
          return () => cadeia;
        },
      },
    );
    return cadeia;
  }
  return {
    supabase: {
      from: (tabela: string) => {
        dubles.tabelasConsultadas.push(tabela);
        return cadeiaDa(tabela);
      },
      functions: {
        invoke: async (nome: string) => {
          dubles.acoesChamadas.push(nome);
          if (nome === 'robo-lances-webhook/healthcheck') return dubles.healthcheck;
          if (nome === 'robo-lances-webhook/situacao-do-robo') return dubles.situacao;
          return { data: null, error: null };
        },
      },
    },
  };
});

// MESMO objeto a cada render: o checklist observa `[user, empresaAtiva]`.
vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'admin@exemplo.com' } };
  return { useAuth: () => valor };
});
vi.mock('@/contexts/EmpresaContext', () => {
  const valor = { empresaAtiva: { id: 'empresa-1', razao_social: 'Acme Licitações LTDA' }, empresas: [] };
  return { useEmpresa: () => valor };
});
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import AtivacaoChecklist from '@/components/robo-lances/AtivacaoChecklist';

function healthcheckCompleto(certificadoCarregado: boolean): Resposta {
  return {
    data: {
      agentes: [
        {
          online: true,
          versao: '9.9.9',
          capacidade: { ram_total_mb: 4096, max_sessoes: 3, slots_disponiveis: 2 },
          kill_switch: { ok: true, testado_em: '2026-09-14T10:00:00Z' },
          certificado: {
            carregado: certificadoCarregado,
            motivo: certificadoCarregado ? null : 'base NSS ausente em /root/.pki/nssdb',
            titulares: certificadoCarregado ? ['ACME LICITACOES LTDA'] : [],
          },
        },
      ],
    },
    error: null,
  };
}

function renderizar(modo?: 'cliente' | 'plataforma') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <AtivacaoChecklist modo={modo} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const k of Object.keys(dubles.respostas)) delete dubles.respostas[k];
  dubles.tabelasConsultadas.length = 0;
  dubles.acoesChamadas.length = 0;
  dubles.respostas.agente_externo_config = {
    data: [{
      id: 'a-1', nome: 'VPS', url_base: 'http://10.0.0.1:3000', status: 'ativo',
      versao_agente: '9.9.9', max_sessoes_paralelas: 3, sessoes_ativas: 1, ram_mb: 4096,
    }],
    error: null,
  };
  dubles.respostas.cert_upload_tokens = {
    data: [{ id: 't-1', cert_file_path: 'empresa-1/cert.pfx', used_at: '2026-09-01T00:00:00Z', expires_at: '2027-01-01T00:00:00Z' }],
    error: null,
  };
  dubles.respostas.credenciais_portais_safe = { data: [{ id: 'c-1' }], error: null };
  dubles.respostas.portal_healthcheck = { data: [{ id: 'h-1' }], error: null };
  dubles.healthcheck = healthcheckCompleto(false);
  dubles.situacao = {
    data: { disponivel: true, motivo: null, ligado: true, portais_suportados: ['comprasgov'], verificado_em: '2026-09-14T13:05:00Z' },
    error: null,
  };
});

describe('AtivacaoChecklist modo="cliente"', () => {
  it('mostra acesso e certificado, e nada de infraestrutura', async () => {
    renderizar('cliente');

    expect(await screen.findByText('Certificado Digital')).toBeInTheDocument();
    expect(screen.getByText('Credenciais de Portal')).toBeInTheDocument();
    expect(screen.getByText('Acesso da empresa aos portais')).toBeInTheDocument();

    for (const tecnico of [
      /Agente Externo/, /Sinal de vida/, /healthcheck/i, /Freio/, /Slots/, /RAM/,
      /Portais respondendo/, /10\.0\.0\.1/, /NSS/, /Conexão/, /Prontidão do robô/, /Sistema pronto/,
    ]) {
      expect(screen.queryByText(tecnico)).not.toBeInTheDocument();
    }
    // A consulta à configuração do agente nem sai no modo cliente: a empresa
    // no agente gerenciado não tem linha lá, e o item leria "pendente".
    expect(dubles.tabelasConsultadas).not.toContain('agente_externo_config');
    expect(dubles.tabelasConsultadas).not.toContain('portal_healthcheck');
    expect(screen.queryByText(/Agente Externo Configurado/)).not.toBeInTheDocument();
    // Nenhum botão de ação só da plataforma (o servidor responde 403).
    expect(screen.queryByRole('button', { name: /Testar freio/ })).not.toBeInTheDocument();
    expect(dubles.acoesChamadas).not.toContain('robo-lances-webhook/testar-kill-switch');
    expect(dubles.acoesChamadas).not.toContain('robo-lances-webhook/configurar-agente');
    // A disponibilidade vem da ação do servidor, uma vez só ao montar.
    await screen.findByText('Disponível');
    expect(dubles.acoesChamadas.filter((n) => n === 'robo-lances-webhook/situacao-do-robo')).toHaveLength(1);
  });

  it('traz a disponibilidade do robô numa linha, vinda do servidor', async () => {
    renderizar('cliente');

    expect(await screen.findByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText(/verificado em .* \(Brasília\)/)).toBeInTheDocument();
  });

  it('sem resposta do servidor, diz que a situação está indisponível — nunca "pronto"', async () => {
    dubles.situacao = { data: null, error: { message: 'Edge Function returned a non-2xx status code' } };
    renderizar('cliente');

    expect(await screen.findByText('Situação do robô indisponível no momento')).toBeInTheDocument();
    expect(screen.queryByText('Disponível')).not.toBeInTheDocument();
    expect(screen.queryByText(/non-2xx/)).not.toBeInTheDocument();
  });
});

describe('AtivacaoChecklist modo padrão (plataforma)', () => {
  it('continua completo para a operação Praefectus', async () => {
    renderizar();

    expect(await screen.findByText('Slots Disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Freio de emergência verificado')).toBeInTheDocument();
    expect(screen.getByText('Portal respondendo não significa automação validada.')).toBeInTheDocument();
  });

  it('com tudo verde, não afirma "Sistema pronto": diz que o envio de lances não foi liberado', async () => {
    dubles.healthcheck = healthcheckCompleto(true);
    renderizar();

    expect(
      await screen.findByText('Todas as verificações passaram — isso não libera o envio de lances.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Sistema pronto/)).not.toBeInTheDocument());
  });
});
