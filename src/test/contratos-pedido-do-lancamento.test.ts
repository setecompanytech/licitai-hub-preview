import { describe, it, expect } from 'vitest';
import {
  pontuarContrato, ordenarContratos, pedidoAPartirDoLancamento,
  type LancamentoParaVincular,
} from '@/lib/contratos/pedido-do-lancamento';

const lanc = (over: Partial<LancamentoParaVincular> = {}): LancamentoParaVincular => ({
  id: 'l1',
  descricao: 'FORN. NFE Nº 000.000.125',
  valor: 30960,
  numero_documento: '000.000.125',
  data_competencia: '2026-05-27',
  data_emissao: '2026-05-20',
  pessoa_id: 'pmpa',
  projeto_id: 'p002',
  contrato_id: null,
  contrato_pedido_id: null,
  ...over,
});

describe('pontuarContrato', () => {
  it('contrato já apontado pelo lançamento é o candidato óbvio', () => {
    const p = pontuarContrato(lanc({ contrato_id: 'c1' }), { id: 'c1', numero_contrato: '008/2026', objeto: null, orgao_contratante: null });
    expect(p).toBeGreaterThanOrEqual(100);
  });

  it('mesmo cliente pesa', () => {
    const p = pontuarContrato(lanc(), { id: 'c1', numero_contrato: null, objeto: null, orgao_contratante: null, cliente_id: 'pmpa' });
    expect(p).toBe(50);
  });

  it('mesmo projeto pesa', () => {
    const p = pontuarContrato(lanc(), { id: 'c1', numero_contrato: null, objeto: null, orgao_contratante: null, projeto_id: 'p002' });
    expect(p).toBe(40);
  });

  it('número do contrato citado na descrição resgata o que o cadastro não ligou', () => {
    const p = pontuarContrato(
      lanc({ descricao: 'FORN. CONTRATO 008/2026 - AGUA MINERAL', pessoa_id: null, projeto_id: null }),
      { id: 'c1', numero_contrato: '008/2026', objeto: null, orgao_contratante: null },
    );
    expect(p).toBe(30);
  });

  it('número curto demais não pontua — "1" casaria com qualquer descrição', () => {
    const p = pontuarContrato(
      lanc({ descricao: 'NOTA 1 DE MAIO', pessoa_id: null, projeto_id: null }),
      { id: 'c1', numero_contrato: '1', objeto: null, orgao_contratante: null },
    );
    expect(p).toBe(0);
  });

  it('sem nenhum sinal, zero — e o contrato continua na lista', () => {
    const p = pontuarContrato(lanc(), { id: 'outro', numero_contrato: '999/2020', objeto: null, orgao_contratante: null });
    expect(p).toBe(0);
  });
});

describe('ordenarContratos', () => {
  it('o mais provável vem primeiro, e nenhum é descartado', () => {
    const r = ordenarContratos(lanc(), [
      { id: 'c3', numero_contrato: '999/2020', objeto: null, orgao_contratante: null },
      { id: 'c1', numero_contrato: '008/2026', objeto: null, orgao_contratante: null, cliente_id: 'pmpa', projeto_id: 'p002' },
      { id: 'c2', numero_contrato: '010/2026', objeto: null, orgao_contratante: null, cliente_id: 'pmpa' },
    ]);
    expect(r.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(r).toHaveLength(3);
  });

  it('empate preserva a ordem recebida', () => {
    const r = ordenarContratos(lanc({ pessoa_id: null, projeto_id: null }), [
      { id: 'a', numero_contrato: null, objeto: null, orgao_contratante: null },
      { id: 'b', numero_contrato: null, objeto: null, orgao_contratante: null },
    ]);
    expect(r.map(c => c.id)).toEqual(['a', 'b']);
  });
});

describe('pedidoAPartirDoLancamento', () => {
  it('o valor é o do lançamento, não o recalculado', () => {
    // 30960 / 72000 = 0,43 exato; mas com quantidade que não divide redondo o
    // recálculo divergiria da nota por centavos.
    const p = pedidoAPartirDoLancamento(lanc({ valor: 1000 }), {
      contratoId: 'c1', numeroPedido: '001', quantidade: 3,
    });
    expect(p.valor_total).toBe(1000);
    expect(p.valor_unitario).toBe(333.3333);
    expect(p.quantidade).toBe(3);
  });

  it('quantidade zero não vira divisão por zero', () => {
    const p = pedidoAPartirDoLancamento(lanc({ valor: 500 }), {
      contratoId: 'c1', numeroPedido: '001', quantidade: 0,
    });
    expect(p.valor_unitario).toBe(500);
    expect(Number.isFinite(p.valor_unitario)).toBe(true);
  });

  it('a data é a do fato, não a de hoje — emissão manda sobre competência', () => {
    const p = pedidoAPartirDoLancamento(lanc(), { contratoId: 'c1', numeroPedido: '001', quantidade: 1 });
    expect(p.data_pedido).toBe('2026-05-20');
  });

  it('sem emissão, cai na competência', () => {
    const p = pedidoAPartirDoLancamento(lanc({ data_emissao: null }), {
      contratoId: 'c1', numeroPedido: '001', quantidade: 1,
    });
    expect(p.data_pedido).toBe('2026-05-27');
  });

  it('nasce entregue: a nota foi emitida, então a entrega aconteceu', () => {
    const p = pedidoAPartirDoLancamento(lanc(), { contratoId: 'c1', numeroPedido: '001', quantidade: 1 });
    expect(p.status).toBe('entregue');
  });

  it('leva a nota, a cota e o empenho escolhidos', () => {
    const p = pedidoAPartirDoLancamento(lanc(), {
      contratoId: 'c1', numeroPedido: '003', quantidade: 72000,
      itemId: 'i1', cota: 'principal', empenhoId: 'e1',
    });
    expect(p.nota_fiscal).toBe('000.000.125');
    expect(p.cota).toBe('principal');
    expect(p.empenho_id).toBe('e1');
    expect(p.contrato_item_id).toBe('i1');
  });

  it('a observação registra que veio do Financeiro — e de qual nota', () => {
    const p = pedidoAPartirDoLancamento(lanc(), { contratoId: 'c1', numeroPedido: '001', quantidade: 1 });
    expect(p.observacoes).toContain('retroativo');
    expect(p.observacoes).toContain('000.000.125');
  });
});
