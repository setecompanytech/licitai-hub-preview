import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DIAS_RETENCAO_ARQUIVO } from '@/lib/licitacao/status';
import HistoricoLicitacoes from './HistoricoLicitacoes';

/**
 * O Histórico foi reestruturado em 13/09 (indicadores → filtros → tabela +
 * painel contextual). Estes casos travam as quatro decisões que a
 * reestruturação tomou e que um refactor futuro desfaz sem perceber:
 *
 *  1. a tabela lista o que a consulta devolveu;
 *  2. os indicadores medem `filtered`, não a lista inteira — a incoerência
 *     que fazia "Total: 87" conviver com 12 linhas na tela;
 *  3. o prazo de retenção é calculado a partir de `DIAS_RETENCAO_ARQUIVO`,
 *     não do "120" que estava escrito à mão em dois lugares;
 *  4. a divergência Perdida/Perdedor aparece na tela quando existe registro
 *     gravado pelo fluxo oficial do Comercial.
 */

const estado = vi.hoisted(() => ({
  data: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
}));

vi.mock('@/integrations/supabase/client', () => {
  const construir = () => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.update = () => q;
    q.order = () => Promise.resolve({ data: estado.data, error: estado.error });
    return q;
  };
  return { supabase: { from: construir } };
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1', nome: 'ACME' } }),
}));
// A moldura arrasta sidebar, notificações e busca global — nada disso é o que
// está sob teste, e tudo isso exige contextos que a tela não conhece.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
// jsPDF não roda em jsdom e as exportações não são o objeto destes casos.
vi.mock('@/lib/download-utils', () => ({
  downloadCSV: vi.fn(),
  downloadPDF: vi.fn(),
  downloadJSON: vi.fn(),
}));

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const processo = (over: Record<string, unknown>) => ({
  id: 'x', numero: '9/2026', orgao: 'Prefeitura de Belém', objeto: 'Objeto padrão',
  modalidade: 'Pregão Eletrônico', status: 'Em Disputa', valor_estimado: 1000,
  valor_adjudicado: null, resultado: null, vencedor: null, data_homologacao: null,
  data_encerramento: null, arquivado_em: null, uf: 'PA', municipio: 'Belém',
  created_at: '2026-01-01T00:00:00Z', ...over,
});

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/historico-licitacoes']}>
      <HistoricoLicitacoes />
    </MemoryRouter>,
  );

/** O valor de um indicador é o irmão imediato do rótulo, na tira do topo. */
const valorDoIndicador = (rotulo: string) =>
  screen.getByText(rotulo).nextElementSibling?.textContent?.trim();

beforeEach(() => {
  estado.data = [];
  estado.error = null;
});

describe('Histórico — tabela', () => {
  it('lista os processos que a consulta devolveu', async () => {
    estado.data = [
      processo({ id: '1', objeto: 'Aquisição de merenda escolar' }),
      processo({ id: '2', objeto: 'Locação de veículos' }),
    ];
    montar();
    expect(await screen.findByText('Aquisição de merenda escolar')).toBeTruthy();
    expect(screen.getByText('Locação de veículos')).toBeTruthy();
  });

  it('mostra a falha de carga com "Tentar novamente" em vez de lista vazia', async () => {
    estado.error = { message: 'Falha de rede' };
    montar();
    expect(await screen.findByText(/Falha de rede/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
  });
});

describe('Histórico — indicadores respeitam os filtros', () => {
  it('recalcula o Total quando a busca reduz a tabela', async () => {
    estado.data = [
      processo({ id: '1', objeto: 'Aquisição de merenda escolar' }),
      processo({ id: '2', objeto: 'Locação de veículos' }),
      processo({ id: '3', objeto: 'Serviço de limpeza' }),
    ];
    montar();
    await screen.findByText('Aquisição de merenda escolar');
    expect(valorDoIndicador('Total')).toBe('3');

    fireEvent.change(screen.getByPlaceholderText(/Buscar por objeto/), {
      target: { value: 'merenda' },
    });

    await waitFor(() => expect(valorDoIndicador('Total')).toBe('1'));
    expect(screen.queryByText('Locação de veículos')).toBeNull();
  });

  it('não conta como 0% a taxa de sucesso sem processo decidido — declara indisponível', async () => {
    estado.data = [processo({ id: '1' })];
    montar();
    await screen.findByText('Objeto padrão');
    expect(screen.getByText(/Nenhum processo decidido na seleção/)).toBeTruthy();
  });
});

describe('Histórico — prazo de retenção', () => {
  it('deriva os dias restantes da constante da política, não de um literal', async () => {
    estado.data = [
      processo({ id: '1', status: 'Arquivada', resultado: 'Vencida', arquivado_em: diasAtras(5) }),
    ];
    montar();
    // Se a política mudar em `lib/licitacao/status.ts`, esta expectativa muda
    // junto — e um "120" escrito à mão na tela reprova aqui.
    expect(await screen.findByText(`${DIAS_RETENCAO_ARQUIVO - 5}d restantes`)).toBeTruthy();
    // O mesmo prazo aparece no aviso de arquivados e na legenda do fluxo —
    // os dois saem da constante, nenhum de literal.
    expect(screen.getAllByText(new RegExp(`${DIAS_RETENCAO_ARQUIVO} dias`)).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('mostra "Em circulação" para processo que não foi arquivado', async () => {
    estado.data = [processo({ id: '1' })];
    montar();
    expect(await screen.findByText('Em circulação')).toBeTruthy();
  });
});

describe('Histórico — o vocabulário de desfecho é um só', () => {
  it('conta as perdas do fluxo oficial, que gravava "Perdedor"', async () => {
    /* Este caso MUDOU DE SENTIDO em 14/09/2026, por decisão do dono do produto.
     *
     * Antes ele travava o oposto: o indicador contava só `resultado='Perdida'`
     * e a tela DECLARAVA quantas perdas ficavam de fora — porque mudar a
     * agregação era decisão de produto, não de implementação.
     *
     * A decisão veio ("adeque na proporção exata"), e a proporção exata é a
     * autoridade que já existia: `normalizarStatus`, que traduz 'Perdedor'
     * (o que `registrarPerda` grava de verdade) para 'Perdida'. As três
     * linhas abaixo são a mesma coisa e agora contam como a mesma coisa.
     */
    estado.data = [
      processo({ id: '1', status: 'Perdida', resultado: 'Perdida' }),
      // Como `useLicitacaoIntegration.registrarPerda` grava de verdade:
      processo({ id: '2', status: 'Perdida', resultado: 'Perdedor' }),
      processo({ id: '3', status: 'Perdida', resultado: 'Perdedor' }),
    ];
    montar();
    await screen.findByText('Perdidas');
    expect(valorDoIndicador('Perdidas')).toBe('3');
  });

  it('conta como ganho a homologação, mesmo sem a coluna `vencedor` marcada', async () => {
    // "Ganhas" contava só `vencedor === true`. Homologação é o desfecho que
    // fecha o processo, e ficava de fora — assim como 'adjudicada',
    // 'Vencedor' e 'ata_registro', que `normalizarStatus` traduz.
    estado.data = [
      processo({ id: '1', status: 'Vencida', vencedor: true }),
      processo({ id: '2', status: 'Homologada', vencedor: null }),
      processo({ id: '3', status: 'Homologado', vencedor: null }),
    ];
    montar();
    await screen.findByText('Vencidas');
    expect(valorDoIndicador('Vencidas')).toBe('3');
  });

  it('fica em silêncio quando não há registro com a grafia divergente', async () => {
    estado.data = [processo({ id: '1', status: 'Perdida', resultado: 'Perdida' })];
    montar();
    await screen.findByText('Objeto padrão');
    expect(screen.queryByText(/Divergência de vocabulário/)).toBeNull();
  });
});
