import { describe, it, expect } from 'vitest';
import {
  convenioFederal, documentoDeDespesa, emendaEhDaUf, emendaFederal, mesAnoLegivel, recursoRecebido, somaDosValores, totaisPorMes,
} from '../credora-da-uniao';

describe('credora da União e prospecção — leituras dos DTOs', () => {
  it('o documento de despesa lê fase, órgão, valor e o sinal de intermediário', () => {
    const d = documentoDeDespesa({
      data: '10/09/2026', documento: '158140264022026NE000123', documentoResumido: '2026NE000123', fase: 'Empenho', especie: 'Original',
      orgao: 'IFPA', orgaoSuperior: 'MEC', ug: 'IFPA - Campus Belém', elemento: 'Material de consumo', valor: '1.234,56', favorecidoIntermediario: 'Sim',
    });
    expect(d).toMatchObject({ documentoResumido: '2026NE000123', orgao: 'IFPA', valor: 1234.56, intermediario: true });
    expect(somaDosValores([d, { valor: null }, { valor: 10 }])).toBeCloseTo(1244.56, 2);
  });

  it('recursos recebidos somam por mês, do mais recente ao mais antigo, com o mês legível', () => {
    const r = [
      recursoRecebido({ anoMes: '202607', nomeOrgao: 'IFPA', valor: 100 }),
      recursoRecebido({ anoMes: '202609', nomeOrgao: 'IFPA', valor: 300 }),
      recursoRecebido({ anoMes: '202609', nomeOrgao: 'UFPA', valor: 50 }),
    ];
    expect(totaisPorMes(r)).toEqual([{ mes: '09/2026', valor: 350 }, { mes: '07/2026', valor: 100 }]);
    expect(mesAnoLegivel('2026-09')).toBe('09/2026');
    expect(mesAnoLegivel('09/2026')).toBe('09/2026');
  });

  it('o convênio lê número e objeto de dentro de dimConvenio, o convenente e o município', () => {
    const c = convenioFederal({
      id: 5, dimConvenio: { numero: '912345/2025', objeto: 'Alimentação escolar' }, convenente: { nome: 'MUNICIPIO DE BELEM', cnpjFormatado: '05.055.006/0001-79' },
      municipioConvenente: { nomeIBGE: 'Belém', uf: 'PA' }, orgao: { nome: 'FNDE' }, situacao: 'Em execução', valor: 1000000, valorLiberado: 400000,
      valorDaUltimaLiberacao: 100000, dataUltimaLiberacao: '20/09/2026', dataFinalVigencia: '31/12/2026',
    });
    expect(c).toMatchObject({ id: '5', numero: '912345/2025', objeto: 'Alimentação escolar', convenente: 'MUNICIPIO DE BELEM', municipio: 'Belém', uf: 'PA', orgao: 'FNDE', valorUltimaLiberacao: 100000 });
  });

  it('a emenda é da UF quando a localidade fala da sigla ou do nome; "Nacional" não é', () => {
    const emenda = (localidade: string) => emendaFederal({ codigoEmenda: '1', localidadeDoGasto: localidade, valorPago: 1 });
    expect(emendaEhDaUf(emenda('BELÉM - PA'), 'PA', 'Pará')).toBe(true);
    expect(emendaEhDaUf(emenda('PARÁ (UF)'), 'PA', 'Pará')).toBe(true);
    expect(emendaEhDaUf(emenda('Nacional'), 'PA', 'Pará')).toBe(false);
    expect(emendaEhDaUf(emenda('CAMPINAS - SP'), 'PA', 'Pará')).toBe(false);
  });
});
