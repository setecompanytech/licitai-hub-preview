import { describe, expect, it } from 'vitest';
import {
  MOTIVO_DOCUMENTO_PROPRIO, MOTIVO_SEM_MUNICIPIO, MOTIVO_SEM_UF, esferaDaVaga, orgaoDaVaga, orgaosPorVaga,
} from './orgao-emissor';
import { VAGAS_PREVISTAS } from './previstos';

/**
 * O cofre aponta o órgão emissor de cada vaga pelo DOMICÍLIO FISCAL da
 * empresa. O que este arquivo trava: a federal vale para qualquer CNPJ; a
 * estadual e a municipal exigem o domicílio e, sem ele, a resposta é
 * "informe" — nunca uma cidade inventada; município fora do mapa recebe
 * "cadastrar" com o nome dele, nunca o órgão de outra cidade.
 */
const CND = 'Certidão Negativa de Débitos Federais (CND)';
const ESTADUAL = 'Certidão Negativa de Débitos Estaduais';
const MUNICIPAL = 'Certidão Negativa de Débitos Municipais';
const JUNTA = 'Certidão Simplificada da Junta Comercial';
const MENOR = 'Declaração de Não Emprego de Menor';

describe('esferaDaVaga', () => {
  it('classifica as vagas do cofre pela esfera que o catálogo cobre', () => {
    expect(esferaDaVaga(CND)).toBe('federal');
    expect(esferaDaVaga(ESTADUAL)).toBe('estadual');
    expect(esferaDaVaga('Certidão Negativa de Falência')).toBe('estadual');
    expect(esferaDaVaga(MUNICIPAL)).toBe('municipal');
    expect(esferaDaVaga('Inscrição Municipal (cadastro de contribuintes)')).toBe('municipal');
    // Vagas que o catálogo de certidões não cobre não ganham esfera inventada.
    expect(esferaDaVaga('Registro no CREA/CAU')).toBeNull();
    expect(esferaDaVaga('Balanço Patrimonial (último exercício)')).toBeNull();
  });

  it('só devolve esfera para nome que existe no cofre', () => {
    const nomes = new Set(VAGAS_PREVISTAS.map((v) => v.nome));
    expect(nomes.has(CND) && nomes.has(ESTADUAL) && nomes.has(MUNICIPAL)).toBe(true);
    expect(esferaDaVaga('Certidão inventada')).toBeNull();
  });
});

describe('orgaoDaVaga — o órgão de cada vaga pelo domicílio', () => {
  it('a federal aponta a Receita/PGFN com ou sem domicílio', () => {
    for (const domicilio of [{}, { uf: 'PA', municipio: 'Belém' }]) {
      const r = orgaoDaVaga(CND, domicilio);
      expect(r.esfera).toBe('federal');
      expect(r.certidao?.urlEmissao).toBe('https://servicos.receitafederal.gov.br/servico/certidoes/#/home');
      expect(r.acoes).toEqual(['emitir']);
      expect(r.motivo).toBeNull();
    }
  });

  it('a estadual exige a UF: com ela, a SEFA; sem ela, "informe o domicílio", nunca outra UF', () => {
    const pa = orgaoDaVaga(ESTADUAL, { uf: 'pa' });
    expect(pa.certidao?.urlEmissao).toBe('https://app.sefa.pa.gov.br/emissao-certidao/template.action');
    expect(pa.acoes).toEqual(['emitir']);

    const sem = orgaoDaVaga(ESTADUAL, { uf: null, municipio: 'Belém' });
    expect(sem.esfera).toBe('estadual');
    expect(sem.certidao).toBeNull();
    expect(sem.acoes).toEqual([]);
    expect(sem.motivo).toBe(MOTIVO_SEM_UF);
  });

  it('Belém: solicitação por e-mail primeiro, o site do órgão (com login) como alternativa', () => {
    const r = orgaoDaVaga(MUNICIPAL, { uf: 'PA', municipio: 'BELEM' });
    expect(r.certidao?.emissor).toContain('Belém');
    expect(r.certidao?.obtencao).toBe('solicitacao');
    expect(r.acoes).toEqual(['solicitar', 'emitir']);
    expect(r.motivo).toBeNull();
  });

  it('município fora do mapa: cadastrar o órgão vem primeiro, solicitar continua possível, e o nome é o dele', () => {
    const r = orgaoDaVaga(MUNICIPAL, { uf: 'PA', municipio: 'Cumaru do Norte' });
    expect(r.certidao?.pendenteDeCadastro).toBe(true);
    expect(r.certidao?.emissor).toContain('Cumaru do Norte');
    expect(r.certidao?.urlEmissao).toBeUndefined();
    expect(r.acoes).toEqual(['cadastrar', 'solicitar']);
    expect(JSON.stringify(r)).not.toContain('Belém');
  });

  it('município fora do mapa COM órgão cadastrado pela empresa: emitir no site dela, sem "cadastrar"', () => {
    const cadastro = {
      id: 'o1', esfera: 'municipal' as const, uf: 'PA', municipio: 'Cumaru do Norte',
      nomeDoOrgao: 'Prefeitura de Cumaru do Norte · Tributos', site: 'https://cumarudonorte.pa.gov.br/cnd',
      email: 'tributos@cumarudonorte.pa.gov.br', validadeDias: 90,
    };
    const r = orgaoDaVaga(MUNICIPAL, { uf: 'PA', municipio: 'Cumaru do Norte' }, [cadastro]);
    expect(r.certidao?.cadastradoPelaEmpresa).toBe(true);
    expect(r.certidao?.emissor).toBe('Prefeitura de Cumaru do Norte · Tributos');
    expect(r.acoes).toEqual(['emitir']);
    // Sem site, o caminho é a solicitação — endereçada ao e-mail cadastrado.
    const semSite = orgaoDaVaga(MUNICIPAL, { uf: 'PA', municipio: 'Cumaru do Norte' }, [{ ...cadastro, site: null }]);
    expect(semSite.acoes).toEqual(['solicitar']);
    expect(semSite.certidao?.emailSolicitacao).toBe('tributos@cumarudonorte.pa.gov.br');
  });

  it('a municipal sem município no cadastro pede o domicílio em vez de adivinhar', () => {
    const r = orgaoDaVaga(MUNICIPAL, { uf: 'PA', municipio: '' });
    expect(r.certidao).toBeNull();
    expect(r.acoes).toEqual([]);
    expect(r.motivo).toBe(MOTIVO_SEM_MUNICIPIO);
  });

  it('documento da própria empresa não tem órgão: diz isso em vez de sumir', () => {
    const r = orgaoDaVaga(MENOR, { uf: 'PA', municipio: 'Belém' });
    expect(r.esfera).toBe('federal');
    expect(r.acoes).toEqual([]);
    expect(r.motivo).toBe(MOTIVO_DOCUMENTO_PROPRIO);
  });

  it('a Junta sem endereço no mapa fica sem ação, com o motivo do catálogo', () => {
    expect(orgaoDaVaga(JUNTA, { uf: 'PA' }).acoes).toEqual(['emitir']);
    const ac = orgaoDaVaga(JUNTA, { uf: 'AC' });
    expect(ac.certidao?.pendenteDeCadastro).toBe(true);
    expect(ac.acoes).toEqual([]);
    expect(ac.motivo).toMatch(/edital|cadastr/i);
  });

  it('vaga fora do catálogo (CREA, balanço) não ganha órgão nem motivo', () => {
    const r = orgaoDaVaga('Registro no CREA/CAU', { uf: 'PA', municipio: 'Belém' });
    expect(r).toEqual({ esfera: null, certidao: null, acoes: [], motivo: null });
  });

  it('orgaosPorVaga cobre o cofre inteiro, chaveado pelo nome exato', () => {
    const mapa = orgaosPorVaga(VAGAS_PREVISTAS.map((v) => v.nome), { uf: 'PA', municipio: 'Belém' });
    expect(Object.keys(mapa)).toHaveLength(VAGAS_PREVISTAS.length);
    expect(mapa[CND].acoes).toEqual(['emitir']);
    expect(mapa[MUNICIPAL].acoes[0]).toBe('solicitar');
  });
});
