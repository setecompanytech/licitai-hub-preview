import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { LanceConfig } from './ConfigurarLanceDialog';

/**
 * O cadastro da disputa depois do feedback do Rafael (17/09/2026):
 *  1. sessão num dia anterior não segue como disputa de lance — só como
 *     acompanhamento, marcado pela pessoa;
 *  2. as estratégias do item são caixas cumulativas, e sem nenhuma não salva.
 *
 * NADA aqui fala com a rede: supabase, extração e contexto são dublês.
 */

/* ── Dublês: o MESMO objeto em todo render (literal novo vira laço) ─────── */
const { USUARIO, EMPRESA, EXTRACAO, EDITAL_VINCULADO, RESPOSTAS } = vi.hoisted(() => ({
  RESPOSTAS: {} as Record<string, unknown[]>,
  USUARIO: { user: { id: 'user-1' } },
  EMPRESA: { empresaAtiva: { id: 'empresa-1', razao_social: 'Empresa Teste', cnpj: '00000000000100' } },
  EXTRACAO: {
    fetchItens: async () => [],
    extrairItensDoTexto: async () => [],
    extrairItensIA: async () => [],
  },
  EDITAL_VINCULADO: { resolveLinkedEditalText: async () => null },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => USUARIO }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => EMPRESA }));
vi.mock('@/hooks/useEditalExtraction', () => ({ useEditalExtraction: () => EXTRACAO }));
vi.mock('@/hooks/useLinkedEditalSource', () => ({ useLinkedEditalSource: () => EDITAL_VINCULADO }));
vi.mock('@/components/licitacoes/LimparItensExtraidosButton', () => ({ default: () => null }));
vi.mock('@/lib/robo/uasg-do-processo', () => ({ buscarUasgDoProcesso: async () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const cadeiaDa = (tabela: string) => {
    const cadeia: Record<string, unknown> = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (prop === 'then') {
            return (ok: (v: unknown) => unknown) =>
              Promise.resolve({ data: RESPOSTAS[tabela] ?? [], error: null }).then(ok);
          }
          return () => cadeia;
        },
      },
    );
    return cadeia;
  };
  return { supabase: { from: cadeiaDa, functions: { invoke: async () => ({ data: null, error: null }) } } };
});

import ConfigurarLanceDialog from './ConfigurarLanceDialog';

const DISPUTA: LanceConfig = {
  id: 'disputa-1',
  edital: '90029/2026',
  portal: 'Compras.gov.br',
  uasg: '925448',
  valorReferencia: 1000,
  valorInicial: 950,
  valorMinimo: 0,
  decrementoMin: 0,
  decrementoPercentual: 0,
  intervaloSegundos: 30,
  maxLances: null,
  modoAutomatico: true,
  status: 'aguardando',
  horario: '',
  meuLance: 0,
  valorAtual: 1000,
  tipoDisputa: 'item',
  itens: [
    {
      id: 'i1', numero: 1, lote: 'Único', descricao: 'Computador desktop', quantidade: 1, unidade: 'UN',
      valorReferencia: 1000, valorMinimo: 800, disputando: true, situacao: 'aguardando', melhorLance: null, seuUltimoLance: null,
    } as LanceConfig['itens'][number],
  ],
};

const abrir = (lance: LanceConfig) =>
  render(<ConfigurarLanceDialog editingLance={lance} onSave={() => {}} aberto aoMudarAberto={() => {}} />);

describe('ConfigurarLanceDialog — processo vencido (Rafael, 17/09)', () => {
  it('sessão num dia anterior: "Fase de lances encerrada", Modo Automático travado, e só segue marcando acompanhamento', async () => {
    abrir({ ...DISPUTA, dataSessao: '2026-09-10', horario: '09:00' });

    const titulo = await screen.findByText('Fase de lances encerrada');
    const aviso = titulo.closest('[role="alert"]') as HTMLElement;
    expect(within(aviso).getByText(/foi em 10\/09\/2026 às 09:00/)).toBeInTheDocument();

    const proximo = screen.getByRole('button', { name: /Próximo: Itens \/ Lotes/ });
    expect(proximo).toBeDisabled();
    const modo = screen.getByRole('switch', { name: 'Modo Automático' });
    expect(modo).toBeDisabled();
    expect(modo).not.toBeChecked();

    fireEvent.click(within(aviso).getByRole('checkbox', { name: /Cadastrar só para acompanhamento/ }));
    expect(proximo).toBeEnabled();
  });

  it('sessão futura não mostra a trava', async () => {
    abrir({ ...DISPUTA, dataSessao: '2999-01-10', horario: '09:00' });
    expect(await screen.findByRole('button', { name: /Próximo: Itens \/ Lotes/ })).toBeEnabled();
    expect(screen.queryByText('Fase de lances encerrada')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Modo Automático' })).toBeEnabled();
  });
});

describe('ConfigurarLanceDialog — estratégias cumulativas (Rafael, 17/09)', () => {
  it('marca mais de uma; sem nenhuma, avisa e não salva; desempatar pede a margem', async () => {
    abrir(DISPUTA);
    fireEvent.click(await screen.findByRole('button', { name: /Próximo: Itens \/ Lotes/ }));

    const item1 = await screen.findByRole('group', { name: 'Estratégias do item 1' });
    const melhorPreco = within(item1).getByRole('checkbox', { name: 'Melhor preço' });
    const iminencia = within(item1).getByRole('checkbox', { name: 'Iminência' });
    // Item cadastrado antes, sem escolha: melhor preço, como sempre foi.
    expect(melhorPreco).toBeChecked();
    expect(iminencia).not.toBeChecked();

    fireEvent.click(iminencia);
    expect(iminencia).toBeChecked();
    expect(melhorPreco).toBeChecked();

    const salvar = screen.getByRole('button', { name: /Salvar Alterações/ });
    expect(salvar).toBeEnabled();
    fireEvent.click(melhorPreco);
    fireEvent.click(iminencia);
    expect(within(item1).getByText('Marque ao menos uma')).toBeInTheDocument();
    expect(salvar).toBeDisabled();

    fireEvent.click(within(item1).getByRole('checkbox', { name: 'Desempatar no 1º lugar' }));
    expect(within(item1).queryByText('Marque ao menos uma')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Margem de desempate do item 1' })).toBeInTheDocument();
    expect(salvar).toBeEnabled();
  });

  it('salva a lista e a mais ampla marcada, para o robô que ainda lê uma só', async () => {
    const onSave = vi.fn();
    render(<ConfigurarLanceDialog editingLance={DISPUTA} onSave={onSave} aberto aoMudarAberto={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Próximo: Itens \/ Lotes/ }));

    const item1 = await screen.findByRole('group', { name: 'Estratégias do item 1' });
    fireEvent.click(within(item1).getByRole('checkbox', { name: 'Melhor preço' }));
    fireEvent.click(within(item1).getByRole('checkbox', { name: 'Desempatar no 1º lugar' }));
    fireEvent.click(within(item1).getByRole('checkbox', { name: 'Iminência' }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    const salvo = onSave.mock.calls[0][0] as LanceConfig;
    expect(salvo.itens[0].estrategias).toEqual(['iminencia', 'desempatar_1o']);
    expect(salvo.itens[0].estrategia).toBe('iminencia');
  });
});

describe('ConfigurarLanceDialog — "Seus Processos Licitatórios" sem os encerrados (Rafael, 17/09)', () => {
  it('esconde perdido e prazo vencido por padrão, e mostra ao pedir', async () => {
    const processo = (id: string, extra: Record<string, unknown>) => ({
      id, numero: id, orgao: 'Órgão', objeto: `Objeto ${id}`, modalidade: 'Pregão Eletrônico', status: 'Monitorando',
      resultado: null, arquivado_em: null, valor_estimado: null, portal: 'PNCP', data_abertura: null,
      data_encerramento: '2999-01-10T12:00:00Z', ...extra,
    });
    RESPOSTAS.licitacoes = [
      processo('ABERTO-1', {}),
      processo('PERDIDO-2', { status: 'Perdida' }),
      processo('VENCIDO-3', { data_encerramento: '2026-07-30T12:30:00Z' }),
    ];
    render(<ConfigurarLanceDialog onSave={() => {}} aberto aoMudarAberto={() => {}} />);

    expect(await screen.findByText('Objeto ABERTO-1')).toBeInTheDocument();
    expect(screen.queryByText('Objeto PERDIDO-2')).not.toBeInTheDocument();
    expect(screen.queryByText('Objeto VENCIDO-3')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: /Mostrar encerrados \(2\)/ }));
    expect(await screen.findByText('Objeto PERDIDO-2')).toBeInTheDocument();
    expect(screen.getByText('Objeto VENCIDO-3')).toBeInTheDocument();
    expect(screen.getByText('Prazo de propostas encerrado')).toBeInTheDocument();
    delete RESPOSTAS.licitacoes;
  });
});
