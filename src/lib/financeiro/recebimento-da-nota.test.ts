import { describe, it, expect } from 'vitest';
import { procurarRecebimentoDaNota, numeroDaNota, textoCitaNota, type RecebimentoCandidato } from './recebimento-da-nota';

/**
 * Regra do dono (21/09/2026): valor igual não prova duplicidade; a identidade
 * é o número da nota (ou a chave) e o pedido. Nenhum valor aqui é real.
 */
const recibo = (over: Partial<RecebimentoCandidato> & { id: string }): RecebimentoCandidato => ({
  descricao: null,
  numero_documento: null,
  chave_acesso_nfe: null,
  valor: 0,
  data_realizado: '2026-03-25',
  status: 'conciliado',
  contrato_pedido_id: null,
  ...over,
});

describe('numeroDaNota e textoCitaNota', () => {
  it('normaliza "000.000.719", "NF 719" e "719" para o mesmo número', () => {
    expect(numeroDaNota('000.000.719')).toBe('719');
    expect(numeroDaNota('NF 719')).toBe('719');
    expect(numeroDaNota('719')).toBe('719');
  });

  it('cita a nota só como número inteiro, nunca como pedaço de outro', () => {
    expect(textoCitaNota('NFe N° 000.000.719 - SEDUC', '719')).toBe(true);
    expect(textoCitaNota('FORN. NFE N° 000.000.117', '117')).toBe(true);
    expect(textoCitaNota('NFe N° 000.000.725; 000.000.726; 000.000.727', '726')).toBe(true);
    expect(textoCitaNota('NF 1719', '719')).toBe(false);
    expect(textoCitaNota('NF 7190', '719')).toBe(false);
  });
});

describe('procurarRecebimentoDaNota', () => {
  it('mesmo número E mesmo valor, um só: certo', () => {
    const r = procurarRecebimentoDaNota({ numero: '719', valor: 2029828.33 }, [
      recibo({ id: 'r1', descricao: 'NFe N° 000.000.719 - SEDUC', valor: 2029828.33 }),
      recibo({ id: 'r2', descricao: 'NFe N° 000.000.722 - SEDUC', valor: 2204576.89 }),
    ]);
    expect(r.veredito).toBe('certo');
    if (r.veredito === 'certo') expect(r.recebimento.id).toBe('r1');
  });

  it('valor igual com nota DIFERENTE não casa: são duas notas legítimas', () => {
    // NFs 692 e 693 da ETHOS: R$ 158.000,00 cada. A 693 não é recebimento da 692.
    const r = procurarRecebimentoDaNota({ numero: '692', valor: 158000 }, [
      recibo({ id: 'r693', descricao: 'NFe N° 000.000.693', valor: 158000 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
    if (r.veredito === 'ambiguo') {
      expect(r.sugestoes[0].motivos).toEqual(['mesmo valor']);
    }
  });

  it('só valor, sem citar a nota: sugestão, nunca certo', () => {
    const r = procurarRecebimentoDaNota({ numero: '128', valor: 11275 }, [
      recibo({ id: 'a', descricao: 'CRED TED', valor: 11275 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
  });

  it('cita a nota com valor diferente: sugestão com o motivo dito', () => {
    const r = procurarRecebimentoDaNota({ numero: '728', valor: 1343620.57 }, [
      recibo({ id: 'a', descricao: 'NFe N° 000.000.728', valor: 1343.62 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
    if (r.veredito === 'ambiguo') {
      expect(r.sugestoes[0].motivos).toContain('valor diferente do da nota');
    }
  });

  it('a chave de acesso decide sozinha', () => {
    const chave = '1'.repeat(44);
    const r = procurarRecebimentoDaNota({ numero: null, chave, valor: 1 }, [
      recibo({ id: 'a', chave_acesso_nfe: chave, valor: 999 }),
    ]);
    expect(r.veredito).toBe('certo');
  });

  it('recebimento já preso a outro pedido, ou ainda em aberto, não é candidato', () => {
    const r = procurarRecebimentoDaNota({ numero: '117', valor: 33825 }, [
      recibo({ id: 'preso', descricao: 'FORN. NFE N° 000.000.117', valor: 33825, contrato_pedido_id: 'outro' }),
      recibo({ id: 'aberto', descricao: 'FORN. NFE N° 000.000.117', valor: 33825, status: 'previsto' }),
    ]);
    expect(r.veredito).toBe('nenhum');
  });

  it('dois recebimentos fortes para a mesma nota: ambíguo, quem opera decide', () => {
    const r = procurarRecebimentoDaNota({ numero: '129', valor: 11275 }, [
      recibo({ id: 'a', descricao: 'NFe N° 000.000.129', valor: 11275 }),
      recibo({ id: 'b', descricao: 'NFe 129 (2ª via)', valor: 11275 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
  });
});
