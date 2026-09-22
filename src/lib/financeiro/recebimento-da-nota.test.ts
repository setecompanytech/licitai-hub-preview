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

  it('dois fortes e só um com o CNPJ da outra parte: o CNPJ desempata', () => {
    const r = procurarRecebimentoDaNota({ numero: '129', valor: 11275, cnpj: '24.687.187/0001-01' }, [
      recibo({ id: 'a', descricao: 'NFe N° 000.000.129', valor: 11275, pessoa_documento: '11111111000111' }),
      recibo({ id: 'b', descricao: 'NFe 129', valor: 11275, pessoa_documento: '24687187000101' }),
    ]);
    expect(r.veredito).toBe('certo');
    if (r.veredito === 'certo') {
      expect(r.recebimento.id).toBe('b');
      expect(r.motivos).toContain('mesmo CNPJ');
    }
  });

  it('CNPJ igual sem número nem valor não é indício: a empresa paga o mesmo fornecedor várias vezes', () => {
    const r = procurarRecebimentoDaNota({ numero: '105775', valor: 4500, cnpj: '24687187000101' }, [
      recibo({ id: 'a', descricao: 'PIX FORNECEDOR', valor: 999, pessoa_documento: '24687187000101' }),
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

describe('fracionado (22/09): parte e parcial', () => {
  it('pagamento MAIOR que a nota, citando-a: parte, com a sobra dita', () => {
    const r = procurarRecebimentoDaNota({ numero: '883379', valor: 200000 }, [
      recibo({ id: 'pg', descricao: 'PAGTO NF 883379 E 889491', valor: 440000, coberto_por_notas: 0 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
    if (r.veredito === 'ambiguo') {
      expect(r.sugestoes[0].relacao).toBe('parte');
      expect(r.sugestoes[0].restante).toBe(240000);
      expect(r.sugestoes[0].motivos).toContain('pagamento maior que a nota — pode cobrir mais de uma');
    }
  });

  it('pagamento MENOR que a nota, citando-a: parcial, com o que fica em aberto', () => {
    const r = procurarRecebimentoDaNota({ numero: '895461', valor: 400080 }, [
      recibo({ id: 'pg', descricao: 'NF 895461 1/2', valor: 200040 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
    if (r.veredito === 'ambiguo') {
      expect(r.sugestoes[0].relacao).toBe('parcial');
      expect(r.sugestoes[0].restante).toBe(200040);
    }
  });

  it('mesmo CNPJ na janela de 90 dias: parte só se a sobra sem nota cobre a nota inteira', () => {
    const cnpj = '24687187000101';
    const nota = { numero: '5', valor: 200000, cnpj, dataEmissao: '2026-07-10' };
    const comSobra = procurarRecebimentoDaNota(nota, [
      recibo({ id: 'pg', descricao: 'TED FORNECEDOR', valor: 400000, pessoa_documento: cnpj, data_realizado: '2026-07-15', coberto_por_notas: 200000 }),
    ]);
    expect(comSobra.veredito).toBe('ambiguo');
    if (comSobra.veredito === 'ambiguo') {
      expect(comSobra.sugestoes[0].relacao).toBe('parte');
      expect(comSobra.sugestoes[0].restante).toBe(0);
    }
    const semSobra = procurarRecebimentoDaNota(nota, [
      recibo({ id: 'pg', descricao: 'TED FORNECEDOR', valor: 400000, pessoa_documento: cnpj, data_realizado: '2026-07-15', coberto_por_notas: 300000 }),
    ]);
    expect(semSobra.veredito).toBe('nenhum');
  });

  it('mesmo CNPJ com pagamento menor na janela: parcial; fora da janela ou sem data de emissão: nada', () => {
    const cnpj = '24687187000101';
    const dentro = procurarRecebimentoDaNota({ numero: '5', valor: 400000, cnpj, dataEmissao: '2026-07-10' }, [
      recibo({ id: 'pg', descricao: 'PIX FORNECEDOR', valor: 200000, pessoa_documento: cnpj, data_realizado: '2026-08-01' }),
    ]);
    expect(dentro.veredito).toBe('ambiguo');
    if (dentro.veredito === 'ambiguo') expect(dentro.sugestoes[0].relacao).toBe('parcial');
    const fora = procurarRecebimentoDaNota({ numero: '5', valor: 400000, cnpj, dataEmissao: '2026-01-10' }, [
      recibo({ id: 'pg', descricao: 'PIX FORNECEDOR', valor: 200000, pessoa_documento: cnpj, data_realizado: '2026-08-01' }),
    ]);
    expect(fora.veredito).toBe('nenhum');
    const semData = procurarRecebimentoDaNota({ numero: '5', valor: 400000, cnpj }, [
      recibo({ id: 'pg', descricao: 'PIX FORNECEDOR', valor: 200000, pessoa_documento: cnpj, data_realizado: '2026-08-01' }),
    ]);
    expect(semData.veredito).toBe('nenhum');
  });

  it('quem cita a nota vem antes de quem só tem CNPJ e janela; igual continua certo', () => {
    const cnpj = '24687187000101';
    const r = procurarRecebimentoDaNota({ numero: '7', valor: 100, cnpj, dataEmissao: '2026-07-10' }, [
      recibo({ id: 'janela', descricao: 'PIX', valor: 50, pessoa_documento: cnpj, data_realizado: '2026-07-12' }),
      recibo({ id: 'cita', descricao: 'NF 7 parte 1', valor: 60 }),
    ]);
    expect(r.veredito).toBe('ambiguo');
    if (r.veredito === 'ambiguo') expect(r.sugestoes[0].recebimento.id).toBe('cita');
    const igual = procurarRecebimentoDaNota({ numero: '7', valor: 100, cnpj, dataEmissao: '2026-07-10' }, [
      recibo({ id: 'ok', descricao: 'NF 7', valor: 100 }),
    ]);
    expect(igual.veredito).toBe('certo');
  });
});
