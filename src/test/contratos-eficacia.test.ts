import { describe, it, expect } from 'vitest';
import {
  origemPelaModalidade,
  situacaoJuridica,
  extratosExigidos,
  PRAZO_DIVULGACAO,
} from '@/lib/contratos/eficacia';

describe('origemPelaModalidade', () => {
  it('dispensa e inexigibilidade são contratação direta — 10 dias úteis', () => {
    expect(origemPelaModalidade('Dispensa Eletrônica')).toBe('direta');
    expect(origemPelaModalidade('Dispensa de Licitação')).toBe('direta');
    expect(origemPelaModalidade('Inexigibilidade')).toBe('direta');
  });

  it('o resto decorre de licitação — 20 dias úteis', () => {
    expect(origemPelaModalidade('Pregão Eletrônico')).toBe('licitacao');
    expect(origemPelaModalidade('Concorrência Eletrônica')).toBe('licitacao');
    expect(origemPelaModalidade('Diálogo Competitivo')).toBe('licitacao');
  });

  it('na dúvida supõe o prazo mais longo, para não acusar atraso inexistente', () => {
    expect(origemPelaModalidade(null)).toBe('licitacao');
    expect(origemPelaModalidade('')).toBe('licitacao');
    expect(origemPelaModalidade('Modalidade nova')).toBe('licitacao');
  });

  it('ignora acento e caixa', () => {
    expect(origemPelaModalidade('INEXIGIBILIDADE')).toBe('direta');
    expect(origemPelaModalidade('dispensa')).toBe('direta');
  });
});

describe('situacaoJuridica — assinatura', () => {
  it('sem assinatura, o contrato não existe', () => {
    const s = situacaoJuridica({ dataAssinatura: null });
    expect(s.estado).toBe('nao_assinado');
    expect(s.podeExecutar).toBe(false);
    expect(s.severidade).toBe('critico');
  });

  it('assinado só pela contratada é proposta, não ajuste', () => {
    const s = situacaoJuridica({
      dataAssinatura: '2026-08-03',
      assinaturaSituacao: 'so_contratada',
    });
    expect(s.estado).toBe('assinatura_incompleta');
    expect(s.podeExecutar).toBe(false);
    expect(s.detalhe).toMatch(/não vincula ninguém/);
  });

  it('assinado só pelo órgão também trava', () => {
    const s = situacaoJuridica({
      dataAssinatura: '2026-08-03',
      assinaturaSituacao: 'so_orgao',
    });
    expect(s.estado).toBe('assinatura_incompleta');
    expect(s.podeExecutar).toBe(false);
  });

  it('a assinatura é checada ANTES da divulgação — não se cobra publicação do que ninguém assinou', () => {
    const s = situacaoJuridica({
      dataAssinatura: '2026-08-03',
      assinaturaSituacao: 'so_contratada',
      dataDivulgacao: '2026-08-05',
    });
    expect(s.estado).toBe('assinatura_incompleta');
  });
});

describe('situacaoJuridica — eficácia', () => {
  const assinado = { dataAssinatura: '2026-08-03', assinaturaSituacao: 'ambas' as const };

  it('assinado e não divulgado é VÁLIDO mas não eficaz', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Pregão Eletrônico', hoje: '2026-08-10' });
    expect(s.estado).toBe('aguardando_divulgacao');
    expect(s.podeExecutar).toBe(false);
    expect(s.severidade).toBe('atencao');
    expect(s.titulo).toMatch(/ainda sem eficácia/);
  });

  it('divulgado passa a produzir efeitos', () => {
    const s = situacaoJuridica({ ...assinado, dataDivulgacao: '2026-08-07', modalidade: 'Pregão' });
    expect(s.estado).toBe('eficaz');
    expect(s.podeExecutar).toBe(true);
    expect(s.severidade).toBe('ok');
  });

  it('o prazo do órgão é 20 dias úteis na licitação', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Pregão Eletrônico', hoje: '2026-08-10' });
    // 03/08/2026 é segunda; +20 úteis = 31/08.
    expect(s.limiteDivulgacao).toBe('2026-08-31');
    expect(PRAZO_DIVULGACAO.licitacao).toBe(20);
  });

  it('e 10 dias úteis na contratação direta', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Dispensa Eletrônica', hoje: '2026-08-10' });
    expect(s.limiteDivulgacao).toBe('2026-08-17');
    expect(PRAZO_DIVULGACAO.direta).toBe(10);
  });

  it('prazo estourado, sem extrato e SEM execução, é crítico', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Pregão', hoje: '2026-09-10' });
    expect(s.estado).toBe('divulgacao_atrasada');
    expect(s.podeExecutar).toBe(false);
    expect(s.severidade).toBe('critico');
    expect(s.detalhe).toMatch(/cobre a publicação/i);
    // Não afirma que não foi publicado — só que não há registro aqui.
    expect(s.detalhe).toMatch(/Se já foi publicado, registre o extrato/);
  });

  it('COM execução em curso, a falta de extrato é falta de REGISTRO', () => {
    // Um contrato de 2024 que vem sendo executado foi publicado; o que falta é
    // alguém ter digitado. Gritar "vencido há 700 dias" nele é o alarme falso
    // que ensina a ignorar o alarme.
    const s = situacaoJuridica({
      ...assinado, modalidade: 'Pregão', hoje: '2026-09-10', temExecucao: true,
    });
    expect(s.estado).toBe('publicacao_nao_registrada');
    expect(s.podeExecutar).toBe(true);
    expect(s.severidade).toBe('atencao');
    expect(s.titulo).toMatch(/não registrado/);
  });

  it('sem execução, o prazo ainda correndo não vira alarme', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Pregão', hoje: '2026-08-10', temExecucao: true });
    // Dentro do prazo, execução ou não, o estado é o mesmo: ainda esperando.
    expect(s.estado).toBe('aguardando_divulgacao');
  });

  it('urgência dá eficácia desde a assinatura, mas não dispensa publicar', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Dispensa', urgencia: true, hoje: '2026-08-10' });
    expect(s.estado).toBe('eficaz_por_urgencia');
    expect(s.podeExecutar).toBe(true);
    expect(s.severidade).toBe('atencao');
    expect(s.detalhe).toMatch(/sob pena de nulidade/);
  });

  it('nenhuma mensagem acusa o assinante de atraso — o prazo é do órgão', () => {
    const s = situacaoJuridica({ ...assinado, modalidade: 'Pregão', hoje: '2026-09-10' });
    expect(s.detalhe).toMatch(/O órgão tinha até/);
    expect(s.detalhe).not.toMatch(/você (está|se) atras/i);
  });
});

describe('extratosExigidos', () => {
  it('contrato pede extrato de contrato; ata pede extrato de ata', () => {
    const c = extratosExigidos({ tipoDocumento: 'contrato', quantidadeDeAditivos: 0, temFiscalDesignado: false });
    expect(c.map(x => x.tipo)).toEqual(['extrato_contrato']);

    const a = extratosExigidos({ tipoDocumento: 'ata_srp', quantidadeDeAditivos: 0, temFiscalDesignado: false });
    expect(a.map(x => x.tipo)).toEqual(['extrato_ata']);
  });

  it('cada aditivo precisa do próprio extrato', () => {
    const l = extratosExigidos({ tipoDocumento: 'contrato', quantidadeDeAditivos: 3, temFiscalDesignado: false });
    const aditivo = l.find(x => x.tipo === 'extrato_aditivo');
    expect(aditivo?.quantos).toBe(3);
  });

  it('sem aditivo não cobra extrato de aditivo', () => {
    const l = extratosExigidos({ tipoDocumento: 'contrato', quantidadeDeAditivos: 0, temFiscalDesignado: false });
    expect(l.find(x => x.tipo === 'extrato_aditivo')).toBeUndefined();
  });

  it('fiscal designado exige o ato publicado — é o que sustenta o ateste', () => {
    const l = extratosExigidos({ tipoDocumento: 'contrato', quantidadeDeAditivos: 0, temFiscalDesignado: true });
    const fiscal = l.find(x => x.tipo === 'designacao_fiscal');
    expect(fiscal).toBeDefined();
    expect(fiscal?.porque).toMatch(/art\. 117/);
  });

  it('toda exigência vem com o motivo — cobrança sem porquê vira burocracia', () => {
    const l = extratosExigidos({ tipoDocumento: 'ata_srp', quantidadeDeAditivos: 2, temFiscalDesignado: true });
    expect(l).toHaveLength(3);
    expect(l.every(x => x.porque.length > 20)).toBe(true);
  });
});
