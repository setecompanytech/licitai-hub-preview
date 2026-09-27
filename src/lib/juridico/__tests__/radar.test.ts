import { describe, it, expect } from 'vitest';
import { eventosDoRadar, type ContratoDoRadar, type LicitacaoDoRadar } from '../radar';

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
