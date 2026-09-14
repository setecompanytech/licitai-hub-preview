import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ParticipacaoCarregada, EstadoDasParticipacoes } from '@/hooks/useParticipacoesDoRobo';
import type { Participacao } from '@/lib/robo/situacao-da-participacao';

/**
 * Testes do painel de participações (14/09/2026).
 *
 * O hook é dublado por inteiro: nada aqui fala com banco, agente ou portal.
 * O que se guarda é a LEITURA que a tela faz da projeção — a projeção em si
 * tem os testes dela.
 *
 * O dublê devolve SEMPRE o mesmo objeto dentro de um teste. Literal novo a
 * cada render invalida os `useMemo` da tela e mascara laço de renderização.
 */

const recarregar = vi.fn(async () => {});
const estado: EstadoDasParticipacoes = {
  participacoes: [],
  carregando: false,
  erro: null,
  semEmpresa: false,
  lidoEm: new Date('2026-09-14T15:04:05Z'),
  capacidade: { portaisComLanceLiberado: [], fonte: 'nao_verificada', verificadaEm: null },
  recarregar,
};

vi.mock('@/hooks/useParticipacoesDoRobo', () => ({
  useParticipacoesDoRobo: () => estado,
}));
vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});

import PainelDeParticipacoes from './PainelDeParticipacoes';

let seq = 0;
function participacao(
  projecao: Partial<Participacao>,
  extra: { licitacaoId?: string | null; numero?: string; operador?: string | null } = {},
): ParticipacaoCarregada {
  seq += 1;
  const id = `disputa-${seq}`;
  const licitacaoId = extra.licitacaoId === undefined ? `lic-${seq}` : extra.licitacaoId;
  const numero = extra.numero ?? `PE ${seq}00/2026`;
  return {
    disputa: {
      id,
      empresa_id: 'empresa-1',
      licitacao_id: licitacaoId,
      portal: 'Compras.gov',
      status: 'aguardando',
      valor_inicial: 1000,
      valor_minimo: 800,
      itens: [],
      edital: numero,
      tipo_disputa: 'item',
      horario: '09:00',
      modo_automatico: false,
      valor_referencia: 1200,
      decremento_min: 10,
      decremento_percentual: 1,
      intervalo_segundos: 30,
      max_lances: 20,
      created_at: '2026-09-01T12:00:00Z',
      updated_at: '2026-09-01T12:00:00Z',
    },
    processo: licitacaoId
      ? {
          id: licitacaoId,
          numero,
          orgao: 'Prefeitura de Exemplo',
          objeto: 'Aquisição de material de expediente para as secretarias municipais',
          data_abertura: '2026-09-20T12:00:00Z',
          operador_id: extra.operador ?? 'user-1',
          status: 'Em andamento',
        }
      : null,
    sessao: null,
    ultimoLanceProprio: null,
    melhorLanceInformado: null,
    projecao: {
      aba: 'cadastradas',
      faseInformadaPor: null,
      estadoDoRobo: 'sem_sessao',
      lanceLiberadoNoPortal: false,
      itensSemLimite: 0,
      pendenciaPrincipal: null,
      proximaAcao: null,
      ...projecao,
    },
  };
}

/** Onde a navegação caiu, e a busca da lista que ela levou no estado. */
function LocalAtual() {
  const local = useLocation();
  const daLista = (local.state as { daLista?: string } | null)?.daLista ?? '';
  return (
    <p data-testid="local" data-lista={daLista}>
      {`${local.pathname}${local.search}`}
    </p>
  );
}

function montar(url = '/robo-lances', props: Partial<Parameters<typeof PainelDeParticipacoes>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/robo-lances" element={<PainelDeParticipacoes empresaId="empresa-1" {...props} />} />
        <Route path="/robo-lances/disputa/:id" element={<LocalAtual />} />
        <Route path="/processo/:id" element={<LocalAtual />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  estado.participacoes = [];
  estado.carregando = false;
  estado.erro = null;
  estado.semEmpresa = false;
  estado.lidoEm = new Date('2026-09-14T15:04:05Z');
  estado.capacidade = { portaisComLanceLiberado: [], fonte: 'nao_verificada', verificadaEm: null };
});

describe('PainelDeParticipacoes — abas', () => {
  it('conta cada aba pela projeção, não pelo status gravado na disputa', () => {
    estado.participacoes = [
      participacao({ aba: 'cadastradas' }),
      participacao({ aba: 'cadastradas' }),
      participacao({ aba: 'configuradas' }),
      participacao({ aba: 'em_disputa', faseInformadaPor: 'agente', estadoDoRobo: 'operando' }),
    ];
    montar();

    expect(screen.getByRole('tab', { name: /Cadastradas\s*\(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Configuradas\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Em disputa\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Encerradas\s*\(0\)/ })).toBeInTheDocument();
    // A aba padrão é fixa em "Em disputa" — não pula de aba quando os dados chegam.
    expect(screen.getByRole('tab', { name: /Em disputa/ })).toHaveAttribute('data-state', 'active');
  });

  it('abre na aba pedida pela URL', () => {
    estado.participacoes = [participacao({ aba: 'cadastradas' }, { numero: 'PE 777/2026' })];
    montar('/robo-lances?painel=cadastradas');

    expect(screen.getByRole('tab', { name: /Cadastradas/ })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('PE 777/2026')).toBeInTheDocument();
  });
});

describe('PainelDeParticipacoes — filtros', () => {
  it('"Só com pendência" deixa só quem tem pendência e recalcula a contagem', () => {
    estado.participacoes = [
      participacao({ aba: 'em_disputa', pendenciaPrincipal: 'Portal não informado.' }, { numero: 'PE 111/2026' }),
      participacao({ aba: 'em_disputa', pendenciaPrincipal: null }, { numero: 'PE 222/2026' }),
    ];
    montar();

    expect(screen.getByText('PE 111/2026')).toBeInTheDocument();
    expect(screen.getByText('PE 222/2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Só com pendência/ }));

    expect(screen.getByText('PE 111/2026')).toBeInTheDocument();
    expect(screen.queryByText('PE 222/2026')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Em disputa\s*\(1\)/ })).toBeInTheDocument();
  });

  it('a busca vem da URL (q) e filtra por processo, objeto ou edital', () => {
    estado.participacoes = [
      participacao({ aba: 'em_disputa' }, { numero: 'PE 111/2026' }),
      participacao({ aba: 'em_disputa' }, { numero: 'PE 222/2026' }),
    ];
    montar('/robo-lances?q=222');

    expect(screen.queryByText('PE 111/2026')).not.toBeInTheDocument();
    expect(screen.getByText('PE 222/2026')).toBeInTheDocument();
  });
});

describe('PainelDeParticipacoes — o que a tela afirma', () => {
  it('marca a fase informada manualmente, separada do estado do robô', () => {
    estado.participacoes = [
      participacao({ aba: 'em_disputa', faseInformadaPor: 'marcacao_manual', estadoDoRobo: 'sem_sessao' }),
    ];
    montar();

    expect(screen.getByText('Marcada manualmente — o portal não confirmou')).toBeInTheDocument();
    expect(screen.getByText('Robô não iniciado')).toBeInTheDocument();
    expect(screen.getByText('Não rastreada')).toBeInTheDocument();
  });

  it('avisa que o envio está indisponível quando a capacidade não foi verificada', () => {
    montar();
    expect(
      screen.getByText('Envio de lances indisponível — os portais estão em modo de monitoramento'),
    ).toBeInTheDocument();
  });

  it('não mostra o aviso quando o agente declarou portal com envio liberado', () => {
    estado.capacidade = { portaisComLanceLiberado: ['Compras.gov'], fonte: 'agente', verificadaEm: null };
    montar();
    expect(
      screen.queryByText('Envio de lances indisponível — os portais estão em modo de monitoramento'),
    ).not.toBeInTheDocument();
  });

  it('mostra a hora da leitura em Brasília', () => {
    montar();
    // 15:04:05 UTC = 12:04:05 em Brasília.
    expect(screen.getByText('Atualização recebida às 12:04:05 • Brasília')).toBeInTheDocument();
  });
});

describe('PainelDeParticipacoes — abrir a participação', () => {
  it('com processo vinculado, abre a página da disputa — não a pasta do processo — levando a busca da lista', () => {
    estado.participacoes = [participacao({ aba: 'em_disputa' }, { licitacaoId: 'lic-42', numero: 'PE 042/2026' })];
    montar('/robo-lances?q=042');

    fireEvent.click(screen.getByRole('button', { name: /PE 042\/2026/ }));
    const local = screen.getByTestId('local');
    expect(local).toHaveTextContent('/robo-lances/disputa/disputa-1');
    expect(local).not.toHaveTextContent('/processo/');
    // A volta cai na mesma aba e com a mesma busca.
    expect(local).toHaveAttribute('data-lista', '?q=042');
  });

  it('sem processo vinculado, abre a mesma página da disputa', () => {
    estado.participacoes = [participacao({ aba: 'em_disputa' }, { licitacaoId: null, numero: 'PE 900/2026' })];
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PE 900\/2026/ }));
    expect(screen.getByTestId('local')).toHaveTextContent('/robo-lances/disputa/disputa-1');
  });
});

describe('PainelDeParticipacoes — estados', () => {
  it('falha de carga mostra a mensagem real e tenta de novo', () => {
    estado.erro = 'permission denied for table robo_lances_disputas';
    estado.lidoEm = null;
    montar();

    expect(screen.getByRole('alert')).toHaveTextContent('permission denied for table robo_lances_disputas');
    // Sem leitura anterior, não afirma "nenhuma disputa".
    expect(screen.queryByText('Nenhuma disputa acontecendo agora.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(recarregar).toHaveBeenCalled();
  });

  it('aba vazia diz o que falta em uma linha e aponta a aba que tem registros', () => {
    estado.participacoes = [participacao({ aba: 'configuradas' })];
    montar();

    expect(screen.getByText('Nenhuma disputa acontecendo agora.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver Configuradas \(1\)/ }));
    expect(screen.getByRole('tab', { name: /Configuradas/ })).toHaveAttribute('data-state', 'active');
  });

  it('cada aba vazia diz uma coisa diferente — e sem registros em lugar nenhum, não oferece atalho', () => {
    montar('/robo-lances?painel=encerradas');

    expect(screen.getByText('Nenhuma disputa encerrada ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma disputa acontecendo agora.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Ver / })).not.toBeInTheDocument();
  });

  it('sem empresa ativa, diz o que falta', () => {
    estado.semEmpresa = true;
    montar('/robo-lances', { empresaId: null });
    expect(screen.getByText('Nenhuma empresa ativa')).toBeInTheDocument();
  });
});
