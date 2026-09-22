import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VincularLancamentoDialog from './VincularLancamentoDialog';

/**
 * Rateio de um recebimento entre pedidos (22/09/2026).
 *
 * Órgão público paga várias notas num TED só. O que este arquivo prende:
 *  1. recebimento MAIOR que o pedido, baixado e sem dono, ganha o botão
 *     "Ratear" com a parte exata do pedido — e a RPC recebe essa parte;
 *  2. recebimento de valor igual segue no vínculo 1↔1, sem botão;
 *  3. recebimento já rateado a outro pedido não vira vínculo 1↔1: a caixa
 *     trava e o que ainda está disponível fica à vista;
 *  4. o pedido que recebe por rateio mostra a parte e desfaz com motivo.
 */

type Linha = Record<string, unknown>;

const { dados, rpc } = vi.hoisted(() => ({
  dados: {
    lancamentos: [] as Linha[],
    /** O que a tela pergunta com `.in('lancamento_id', …)`: rateios dos candidatos. */
    rateiosDosLancamentos: [] as Linha[],
    /** O que a tela pergunta com `.eq('contrato_pedido_id', …)`: rateios deste pedido. */
    rateiosDoPedido: [] as Linha[],
  },
  rpc: vi.fn(),
}));

/** Builder encadeável e "thenável"; lembra se o último filtro foi `in` ou `eq`. */
function consulta(resolver: (filtro: string | null) => Linha[]) {
  let filtro: string | null = null;
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'in', 'or', 'order', 'limit', 'neq', 'is']) {
    builder[metodo] = () => {
      if (metodo === 'in' || metodo === 'eq') filtro = metodo;
      return builder;
    };
  }
  builder.then = (aoResolver: (v: { data: Linha[]; error: null }) => unknown) =>
    Promise.resolve({ data: resolver(filtro), error: null }).then(aoResolver);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'financeiro_lancamentos') return consulta(() => dados.lancamentos);
      if (tabela === 'financeiro_lancamento_rateios') {
        return consulta((filtro) => (filtro === 'in' ? dados.rateiosDosLancamentos : dados.rateiosDoPedido));
      }
      return consulta(() => []);
    },
    rpc: (nome: string, args: unknown) => rpc(nome, args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const pedido725 = { id: 'p-725', numero_pedido: '725', valor_total: 97090.99, data_pedido: '2026-05-20', nota_fiscal: '725' };

/** O TED da SEDUC de 27/05: cita as seis notas na descrição e já aponta para o contrato. */
const ted = {
  id: 'ted',
  descricao: 'NFe N° 000.000.725; 000.000.726; 000.000.727; 000.000.728; 000.000.729; 000.000.730.',
  valor: 1819739.36,
  data_competencia: '2026-05-27',
  numero_documento: null,
  status: 'conciliado',
  contrato_pedido_id: null,
  contrato_id: 'c-1',
};

function abrir() {
  const onFechar = vi.fn();
  const aoVincular = vi.fn();
  render(
    <VincularLancamentoDialog
      aberto
      onFechar={onFechar}
      contratoId="c-1"
      empresaId="e-1"
      pedido={pedido725}
      aoVincular={aoVincular}
    />,
  );
  return { onFechar, aoVincular };
}

beforeEach(() => {
  dados.lancamentos = [ted];
  dados.rateiosDosLancamentos = [];
  dados.rateiosDoPedido = [];
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, sobra: 1722648.37 }, error: null });
});

describe('VincularLancamentoDialog — rateio', () => {
  it('recebimento maior que o pedido oferece ratear só a parte do pedido, e a RPC recebe essa parte', async () => {
    const { onFechar, aoVincular } = abrir();

    const botao = await screen.findByRole('button', { name: /Ratear .*97\.090,99 para este pedido/ });
    fireEvent.click(botao);

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('ratear_lancamento_em_pedidos', {
      p_lancamento_id: 'ted',
      p_rateios: [{ pedido_id: 'p-725', valor: 97090.99 }],
      p_observacao: null,
    }));
    await waitFor(() => expect(aoVincular).toHaveBeenCalled());
    expect(onFechar).toHaveBeenCalled();
  });

  it('recebimento de valor igual segue no vínculo 1↔1, sem botão de ratear', async () => {
    dados.lancamentos = [{ ...ted, valor: 97090.99 }];
    abrir();

    await screen.findByRole('checkbox');
    expect(screen.queryByRole('button', { name: /Ratear/ })).toBeNull();
    expect(screen.getByRole('checkbox')).not.toBeDisabled();
  });

  it('recebimento já rateado a outro pedido trava a caixa do vínculo 1↔1 e mostra o que ainda está disponível', async () => {
    dados.rateiosDosLancamentos = [
      { id: 'r-1', lancamento_id: 'ted', contrato_pedido_id: 'p-outro', valor: 1722648.37, observacao: null },
    ];
    abrir();

    const caixa = await screen.findByRole('checkbox');
    expect(caixa).toBeDisabled();
    // 1.819.739,36 − 1.722.648,37 = 97.090,99 — exatamente o que falta à NF 725.
    expect(screen.getByText(/rateado .*disponível .*97\.090,99/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ratear .*97\.090,99 para este pedido/ })).toBeTruthy();
  });

  it('pedido que recebe por rateio mostra a parte e desfaz com motivo pela RPC', async () => {
    const rateio = { id: 'r-9', lancamento_id: 'ted', contrato_pedido_id: 'p-725', valor: 97090.99, observacao: null };
    dados.rateiosDosLancamentos = [rateio];
    dados.rateiosDoPedido = [rateio];
    abrir();

    expect(await screen.findByText(/Este pedido recebe .*97\.090,99 por rateio de recebimento/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Desfazer rateio/ }));

    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled(); // sem motivo não desfaz
    fireEvent.change(screen.getByLabelText('Motivo para desfazer o rateio'), { target: { value: 'Nota errada' } });
    expect(confirmar).not.toBeDisabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('desfazer_rateio', { p_rateio_id: 'r-9', p_motivo: 'Nota errada' }));
  });
});
