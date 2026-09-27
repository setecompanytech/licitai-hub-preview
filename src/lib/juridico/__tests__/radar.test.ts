import { describe, it, expect } from 'vitest';
import { eventosDoRadar, rotaDoEvento, type ContratoDoRadar, type LicitacaoDoRadar } from '../radar';

const base: ContratoDoRadar = {
  id: 'c1', numero_contrato: '772/2024', orgao_contratante: 'SEMAS Barcarena', tipo_documento: 'contrato', status: 'vigente',
  data_assinatura: '2024-06-11', data_fim: '2027-06-11', indice_reajuste: 'IPCA', data_base_reajuste: '2024-06-11',
  saldo_remanescente: 1236891.22, valor_global: 1236891.22, fiscal_nome: 'Shirley',
  aditivos: [
    { tipo: 'reequilibrio', data_assinatura: '2025-05-06' },
    { tipo: 'prorrogacao', data_assinatura: '2025-06-11' },
    { tipo: 'prorrogacao', data_assinatura: '2026-06-11' },
    { tipo: 'reequilibrio', data_assinatura: '2026-08-20' },
  ],
  publicacoes: [],
};
const HOJE = '2026-09-27';

describe('Radar Jurídico', () => {
  it('772/2024: reequilíbrio não reinicia o interregno — reajuste devido desde 06/2025, crítico pelas prorrogações assinadas depois; extratos faltam', () => {
    const ev = eventosDoRadar({ contratos: [base], licitacoes: [], hoje: HOJE });
    const r = ev.find((x) => x.chave === 'reajuste:c1');
    expect(r?.gravidade).toBe('critico');
    expect(r?.titulo).toContain('11/06/2025');
    const pub = ev.find((x) => x.chave === 'publicacao:c1');
    expect(pub?.titulo).toContain('Extrato do Contrato');
    expect(pub?.titulo).toContain('(4)');
    expect(pub?.rota).toContain('c1');
  });
  it('reajuste devido, crítico quando um aditivo de prorrogação veio depois do aniversário sem reajuste', () => {
    const c = { ...base, aditivos: [{ tipo: 'prorrogacao', data_assinatura: '2025-06-11' }] };
    const ev = eventosDoRadar({ contratos: [c], licitacoes: [], hoje: HOJE });
    const r = ev.find((x) => x.chave === 'reajuste:c1');
    expect(r?.gravidade).toBe('critico');
    expect(r?.titulo).toContain('11/06/2025');
    expect(r?.modeloId).toBe('7');
    expect(r?.detalhe).toContain('preclusão');
  });
  it('reajuste devido sem aditivo posterior é atenção; sem data-base não há evento', () => {
    const c = { ...base, aditivos: [] };
    expect(eventosDoRadar({ contratos: [c], licitacoes: [], hoje: HOJE }).find((x) => x.chave === 'reajuste:c1')?.gravidade).toBe('atencao');
    const semBase = { ...c, data_base_reajuste: null };
    expect(eventosDoRadar({ contratos: [semBase], licitacoes: [], hoje: HOJE }).find((x) => x.chave === 'reajuste:c1')).toBeUndefined();
  });
  it('vigência vencida é crítica; vencendo em 60 dias é atenção; encerrado não entra', () => {
    const vencido = { ...base, data_fim: '2026-09-01', data_base_reajuste: null, aditivos: [] };
    const ev = eventosDoRadar({ contratos: [vencido], licitacoes: [], hoje: HOJE });
    expect(ev.find((x) => x.chave === 'vigencia:c1')?.gravidade).toBe('critico');
    const vencendo = { ...vencido, data_fim: '2026-10-22' };
    expect(eventosDoRadar({ contratos: [vencendo], licitacoes: [], hoje: HOJE }).find((x) => x.chave === 'vencendo:c1')?.titulo).toContain('25 dia');
    expect(eventosDoRadar({ contratos: [{ ...vencido, status: 'encerrado' }], licitacoes: [], hoje: HOJE })).toEqual([]);
  });
  it('saldo negativo com vigência em curso é executado acima do valor (art. 125)', () => {
    const c = { ...base, saldo_remanescente: -76602.35, data_base_reajuste: null, aditivos: [] };
    const s = eventosDoRadar({ contratos: [c], licitacoes: [], hoje: HOJE }).find((x) => x.chave === 'saldo:c1');
    expect(s?.gravidade).toBe('critico');
    expect(s?.modeloId).toBe('21');
  });
  it('desclassificação vira recurso com o prazo do art. 165; a ordem é crítico → atenção', () => {
    const lic: LicitacaoDoRadar = { id: 'l1', numero: 'PE 12/2026', orgao: 'Prefeitura X', status: 'Perdida', resultado: 'Desclassificada', updated_at: '2026-09-25' };
    const ev = eventosDoRadar({ contratos: [base], licitacoes: [lic], hoje: HOJE });
    const rec = ev.find((x) => x.chave === 'recurso:l1');
    expect(rec?.gravidade).toBe('critico');
    expect(rec?.fundamento).toContain('art. 165');
    expect(rec?.modeloId).toBe('3');
    // Todo crítico vem antes de qualquer atenção.
    const ultimoCritico = ev.map((x) => x.gravidade).lastIndexOf('critico');
    const primeiroNaoCritico = ev.findIndex((x) => x.gravidade !== 'critico');
    expect(ultimoCritico).toBeLessThan(primeiroNaoCritico);
  });
});

describe('Radar Jurídico — F2', () => {
  it('convenção coletiva nova alcança só o contrato de serviço contínuo com mão de obra em vigor', () => {
    const continuo = { ...base, id: 'c2', numero_contrato: '17/2025', especie_objeto: 'servico_continuo', data_base_reajuste: null, aditivos: [], publicacoes: [{ tipo: 'extrato_contrato' }] };
    const fornecimento = { ...base, id: 'c3', especie_objeto: null, data_base_reajuste: null, aditivos: [], publicacoes: [{ tipo: 'extrato_contrato' }] };
    const ev = eventosDoRadar({
      contratos: [continuo, fornecimento], licitacoes: [], hoje: HOJE,
      ccts: [{ id: 'k1', categoria_profissional: 'Asseio e conservação', vigencia_inicio: '2026-09-01', abrangencia_uf: 'PA' }],
    });
    const cct = ev.filter((x) => x.chave.startsWith('cct:'));
    expect(cct).toHaveLength(1);
    expect(cct[0].contratoId).toBe('c2');
    expect(cct[0].modeloId).toBe('8');
    expect(cct[0].fundamento).toContain('art. 135, II');
  });
  it('certidão vencida ou a 7 dias é crítica; a 30 dias é atenção; além disso não entra', () => {
    const ev = eventosDoRadar({
      contratos: [], licitacoes: [], hoje: HOJE,
      documentos: [
        { id: 'd1', nome: 'CND Federal', tipo: 'Regularidade Fiscal', validade: '2026-09-20' },
        { id: 'd2', nome: 'CRF FGTS', tipo: 'Regularidade Fiscal', validade: '2026-10-02' },
        { id: 'd3', nome: 'CNDT', tipo: 'Regularidade Fiscal', validade: '2026-10-20' },
        { id: 'd4', nome: 'Contrato social', tipo: 'Habilitação Jurídica', validade: '2030-01-01' },
      ],
    });
    expect(ev.find((x) => x.chave === 'documento:d1')).toMatchObject({ gravidade: 'critico', titulo: 'CND Federal — vencido há 7 dia(s)', rota: '/documentos' });
    expect(ev.find((x) => x.chave === 'documento:d2')?.gravidade).toBe('critico');
    expect(ev.find((x) => x.chave === 'documento:d3')?.gravidade).toBe('atencao');
    expect(ev.find((x) => x.chave === 'documento:d4')).toBeUndefined();
  });
  it('aviso do robô de edital alterado vira impugnação com o link da disputa, só nos últimos 15 dias', () => {
    const ev = eventosDoRadar({
      contratos: [], licitacoes: [], hoje: HOJE,
      alteracoesDeEdital: [
        { id: 'h1', edital: '90029/2026', link: '/robo-lances?disputa=x', ocorreu_em: '2026-09-25T10:00:00Z' },
        { id: 'h2', edital: '1/2026', link: null, ocorreu_em: '2026-08-01T10:00:00Z' },
      ],
    });
    const e1 = ev.find((x) => x.chave === 'edital:h1');
    expect(e1?.modeloId).toBe('2');
    expect(e1?.rota).toBe('/robo-lances?disputa=x');
    expect(ev.find((x) => x.chave === 'edital:h2')).toBeUndefined();
  });
});

describe('a rota do evento', () => {
  it('peça com contrato, peça com processo, ou a rota do caso', () => {
    const ev = eventosDoRadar({ contratos: [base], licitacoes: [{ id: 'l1', numero: 'PE 1', orgao: null, status: 'Perdida', resultado: 'Desclassificada', updated_at: '2026-09-26' }], hoje: HOJE });
    expect(rotaDoEvento(ev.find((x) => x.chave === 'reajuste:c1')!)).toBe('/apoio-juridico/redigir/7?contrato=c1');
    expect(rotaDoEvento(ev.find((x) => x.chave === 'recurso:l1')!)).toBe('/apoio-juridico/redigir/3?licitacao=l1');
    expect(rotaDoEvento(ev.find((x) => x.chave === 'publicacao:c1')!)).toBe('/gestao-contratos?contrato=c1');
  });
});
