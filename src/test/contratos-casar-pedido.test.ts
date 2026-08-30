import { describe, it, expect } from 'vitest';
import {
  pontuarCandidato,
  ordenarCandidatos,
  conferirSoma,
  quitacaoDoPedido,
  PONTOS_PARA_SUGERIR,
  type PedidoParaCasar,
  type TituloCandidato,
} from '@/lib/contratos/casar-pedido';

const pedido: PedidoParaCasar = {
  id: 'p1',
  numero_pedido: '000123',
  valor_total: 30960,
  data_pedido: '2026-05-27',
  nota_fiscal: 'NFE 000.000.125',
};

const titulo = (t: Partial<TituloCandidato>): TituloCandidato => ({
  id: 't1',
  descricao: 'Recebimento',
  valor: 30960,
  data_competencia: '2026-05-27',
  numero_documento: null,
  status: 'conciliado',
  contrato_pedido_id: null,
  contrato_id: null,
  ...t,
});

describe('pontuarCandidato', () => {
  it('valor idêntico e mesma data pontuam alto', () => {
    const p = pontuarCandidato(pedido, titulo({}));
    expect(p.pontos).toBeGreaterThanOrEqual(65);
    expect(p.motivos).toContain('valor idêntico');
    expect(p.motivos).toContain('mesma data');
  });

  it('título já preso a outro pedido não é candidato', () => {
    // Zerar em vez de pontuar baixo: candidato impossível não pode aparecer
    // na lista só porque o valor bateu.
    const p = pontuarCandidato(pedido, titulo({ contrato_pedido_id: 'outro' }));
    expect(p.pontos).toBe(0);
    expect(p.motivos).toEqual(['já vinculado a outro pedido']);
  });

  it('mas o próprio pedido não se elimina — permite reconferir o vínculo', () => {
    const p = pontuarCandidato(pedido, titulo({ contrato_pedido_id: 'p1' }));
    expect(p.pontos).toBeGreaterThan(0);
  });

  it('valor menor é parcela, não desvio', () => {
    const p = pontuarCandidato(pedido, titulo({ valor: 10320 }));
    expect(p.motivos).toContain('valor menor — possível parcela');
    expect(p.pontos).toBeGreaterThan(0);
  });

  it('valor maior pontua pouco e diz por quê', () => {
    const p = pontuarCandidato(pedido, titulo({ valor: 99999 }));
    expect(p.motivos).toContain('valor maior que o pedido');
    const cheio = pontuarCandidato(pedido, titulo({}));
    expect(p.pontos).toBeLessThan(cheio.pontos);
  });

  it('número do pedido na descrição é a evidência mais forte', () => {
    const semNumero = pontuarCandidato(pedido, titulo({ valor: 1, data_competencia: '2027-01-01' }));
    const comNumero = pontuarCandidato(
      pedido,
      titulo({ valor: 1, data_competencia: '2027-01-01', descricao: 'Contrato 008/2026 · Pedido 000123' }),
    );
    expect(comNumero.pontos - semNumero.pontos).toBe(30);
  });

  it('casa número da NF ignorando pontuação e prefixo', () => {
    // "NFE 000.000.125" no pedido contra "NF 000000125" no título.
    const p = pontuarCandidato(pedido, titulo({ descricao: 'FORN. NF 000000125' }));
    expect(p.motivos.some((m) => m.includes('NF'))).toBe(true);
  });

  it('proximidade de data soma, distância não elimina', () => {
    const perto = pontuarCandidato(pedido, titulo({ data_competencia: '2026-06-10' }));
    const longe = pontuarCandidato(pedido, titulo({ data_competencia: '2027-06-10' }));
    expect(perto.pontos).toBeGreaterThan(longe.pontos);
    expect(longe.pontos).toBeGreaterThan(0);
  });
});

describe('ordenarCandidatos', () => {
  it('tira os impossíveis e ordena do mais provável', () => {
    const lista = ordenarCandidatos(pedido, [
      titulo({ id: 'fraco', valor: 99999, data_competencia: '2027-01-01' }),
      titulo({ id: 'preso', contrato_pedido_id: 'outro' }),
      titulo({ id: 'forte' }),
    ]);
    expect(lista.map((t) => t.id)).toEqual(['forte', 'fraco']);
  });
});

describe('conferirSoma', () => {
  it('uma parcela que fecha', () => {
    const c = conferirSoma(pedido, [titulo({})]);
    expect(c.fecha).toBe(true);
    expect(c.frase).toMatch(/confere/);
  });

  it('três parcelas que somam o pedido', () => {
    const c = conferirSoma(pedido, [
      titulo({ id: 'a', valor: 10320 }),
      titulo({ id: 'b', valor: 10320 }),
      titulo({ id: 'c', valor: 10320 }),
    ]);
    expect(c.fecha).toBe(true);
    expect(c.frase).toMatch(/3 parcelas/);
  });

  it('falta uma parcela — diz quanto e sugere o motivo', () => {
    const c = conferirSoma(pedido, [titulo({ valor: 10320 })]);
    expect(c.fecha).toBe(false);
    expect(c.diferenca).toBe(-20640);
    expect(c.frase).toMatch(/Faltam/);
  });

  it('excedente aponta lançamento que talvez não seja deste pedido', () => {
    const c = conferirSoma(pedido, [titulo({ id: 'a' }), titulo({ id: 'b', valor: 100 })]);
    expect(c.diferenca).toBe(100);
    expect(c.frase).toMatch(/não ser deste pedido/);
  });

  it('nada selecionado não é "fecha"', () => {
    const c = conferirSoma(pedido, []);
    expect(c.fecha).toBe(false);
    expect(c.soma).toBe(0);
  });
});

describe('quitacaoDoPedido', () => {
  it('todas conciliadas quita, e a data é a da última', () => {
    const q = quitacaoDoPedido([
      { status: 'conciliado', data_competencia: '2026-06-10' },
      { status: 'realizado', data_competencia: '2026-07-10' },
    ]);
    expect(q.nf_quitada).toBe(true);
    expect(q.data_quitacao).toBe('2026-07-10');
  });

  it('uma parcela em aberto não quita o pedido', () => {
    // O pedido só está pago quando não falta parcela.
    const q = quitacaoDoPedido([
      { status: 'conciliado', data_competencia: '2026-06-10' },
      { status: 'previsto', data_competencia: '2026-07-10' },
    ]);
    expect(q.nf_quitada).toBe(false);
    expect(q.data_quitacao).toBeNull();
  });

  it('sem título nenhum não quita', () => {
    expect(quitacaoDoPedido([])).toEqual({ nf_quitada: false, data_quitacao: null });
  });
});

describe('PONTOS_PARA_SUGERIR', () => {
  it('é exatamente o que "valor idêntico" vale sozinho', () => {
    // Abaixo disso a sugestão nasceria de proximidade de data — que todo
    // título do mês satisfaz — e viraria aviso constante.
    const soValor = pontuarCandidato(pedido, titulo({ data_competencia: null }));
    expect(soValor.pontos).toBe(PONTOS_PARA_SUGERIR);
  });

  it('proximidade de data sozinha não chega ao limiar', () => {
    const soData = pontuarCandidato(pedido, titulo({ valor: 999999 }));
    expect(soData.pontos).toBeLessThan(PONTOS_PARA_SUGERIR);
  });

  it('mas continua aparecendo na lista do diálogo', () => {
    // Quem abriu o diálogo já está procurando: ali basta pontuar acima de zero.
    const lista = ordenarCandidatos(pedido, [titulo({ valor: 999999 })]);
    expect(lista).toHaveLength(1);
  });
});
