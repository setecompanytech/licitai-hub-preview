import { describe, it, expect } from 'vitest';
import {
  CERTIDOES_FEDERAIS, certidoesEstaduais, certidoesMunicipais, checklistDeCertidoes, cidadeDaLista, modeloDeSolicitacao,
  municipioDoMapa, porEsfera, validadeLegivel,
} from '../certidoes-catalogo';
import { VAGAS_PREVISTAS } from '@/lib/documentos/previstos';

describe('catálogo de certidões — cada uma no seu órgão emissor', () => {
  it('as federais apontam para o emissor de verdade, com prazo e fundamento', () => {
    const porId = Object.fromEntries(CERTIDOES_FEDERAIS.map((c) => [c.id, c]));
    expect(porId['cnd-federal'].urlEmissao).toBe('https://servicos.receitafederal.gov.br/servico/certidoes/#/home');
    expect(porId['cnd-federal'].validadeDias).toBe(180);
    expect(porId['crf-fgts'].urlEmissao).toBe('https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf');
    expect(porId['crf-fgts'].validadeDias).toBe(30);
    expect(porId['cndt'].urlEmissao).toBe('https://cndt-certidao.tst.jus.br/');
    expect(porId['cndt'].fundamento).toContain('art. 68, V');
    expect(porId['sancoes-federais'].obtencao).toBe('consulta_api');
  });

  it('toda certidão com vaga aponta para uma vaga que existe no cofre, pelo nome exato', () => {
    const nomes = new Set(VAGAS_PREVISTAS.map((v) => v.nome));
    for (const c of checklistDeCertidoes('PA', 'BELEM')) {
      if (c.vaga) expect(nomes.has(c.vaga), `${c.id} → ${c.vaga}`).toBe(true);
    }
  });

  it('o Pará: SEFA para débitos (180 dias) e FIC para o cadastro; TJPA para falência; JUCEPA', () => {
    const pa = certidoesEstaduais('PA');
    const cnd = pa.find((c) => c.vaga === 'Certidão Negativa de Débitos Estaduais');
    expect(cnd?.urlEmissao).toBe('https://app.sefa.pa.gov.br/emissao-certidao/template.action');
    expect(cnd?.validadeDias).toBe(180);
    expect(cnd?.emissor).toContain('SEFA/PA');
    const fic = pa.find((c) => c.vaga === 'Inscrição Estadual (cadastro de contribuintes)');
    expect(fic?.urlEmissao).toBe('https://app.sefa.pa.gov.br/consulta-fic/');
    expect(fic?.validadeDias).toBe(0);
    expect(pa.find((c) => c.vaga === 'Certidão Negativa de Falência')?.urlEmissao).toBe('https://www.tjpa.jus.br/');
    expect(pa.find((c) => c.vaga === 'Certidão Simplificada da Junta Comercial')?.emissor).toContain('JUCEPA');
  });

  it('Belém: a Receita escreve BELEM, o mapa escreve Belém; a certidão sai por solicitação, nunca pela prefeitura de outra cidade', () => {
    expect(municipioDoMapa('PA', 'BELEM')).toBe('Belém');
    expect(cidadeDaLista('PA', 'BELEM')).toBe('Belém');
    const belem = certidoesMunicipais('PA', 'BELEM');
    const cnd = belem.find((c) => c.vaga === 'Certidão Negativa de Débitos Municipais');
    expect(cnd?.emissor).toContain('Belém');
    expect(cnd?.obtencao).toBe('solicitacao');
    expect(cnd?.observacao).toContain('e-mail');
    expect(JSON.stringify(belem)).not.toContain('São Paulo');
    expect(belem.find((c) => c.vaga === 'Inscrição Municipal (cadastro de contribuintes)')?.observacao).toContain('CISC');
  });

  it('município fora do mapa recebe a vaga "a cadastrar" com o nome dele, não a de outra cidade', () => {
    const cumaru = certidoesMunicipais('PA', 'Cumaru do Norte');
    expect(cumaru).toHaveLength(2);
    expect(cumaru[0].pendenteDeCadastro).toBe(true);
    expect(cumaru[0].emissor).toContain('Cumaru do Norte');
    expect(cumaru[0].urlEmissao).toBeUndefined();
  });

  it('o checklist agrupa por esfera e a validade se lê', () => {
    const grupos = porEsfera(checklistDeCertidoes('PA', 'Belém'));
    expect(grupos.map((g) => g.esfera)).toEqual(['federal', 'estadual', 'municipal']);
    expect(porEsfera(checklistDeCertidoes()).map((g) => g.esfera)).toEqual(['federal']);
    expect(validadeLegivel(180)).toBe('180 dias');
    expect(validadeLegivel(0)).toBe('não vence');
    expect(validadeLegivel(null)).toBe('conforme o documento ou o edital');
  });

  it('o e-mail de solicitação sai pronto, com o exercício e o pedido do PDF com código', () => {
    const m = modeloDeSolicitacao({ certidao: 'Certidão Negativa de Débitos Municipais', orgao: 'Secretaria de Finanças de Belém', razaoSocial: 'ETHOS', cnpj: '33.734.346/0001-72', exercicio: 2026 });
    expect(m.assunto).toContain('ETHOS');
    expect(m.corpo).toContain('exercício de 2026');
    expect(m.corpo).toContain('código de autenticidade');
    expect(m.mailto.startsWith('mailto:?subject=')).toBe(true);
  });
});
