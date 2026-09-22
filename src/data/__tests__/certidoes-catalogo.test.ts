import { describe, it, expect } from 'vitest';
import {
  CERTIDOES_FEDERAIS, certidoesEstaduais, certidoesMunicipais, checklistDeCertidoes, cidadeDaLista, mesclarOrgaoDaEmpresa,
  modeloDeSolicitacao, municipioDoMapa, orgaoCadastradoDoMunicipio, porEsfera, validadeLegivel,
  type OrgaoCadastradoPelaEmpresa,
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
    // Com o e-mail do órgão conhecido, o mailto sai endereçado.
    const endereçado = modeloDeSolicitacao({ certidao: 'x', orgao: 'y', razaoSocial: 'ETHOS', cnpj: '1', para: ' sefin@belem.pa.gov.br ' });
    expect(endereçado.mailto.startsWith('mailto:sefin%40belem.pa.gov.br?subject=')).toBe(true);
  });
});

describe('órgão municipal cadastrado pela empresa — a mescla com o mapa', () => {
  const cumaru: OrgaoCadastradoPelaEmpresa = {
    id: 'o1',
    esfera: 'municipal',
    uf: 'pa',
    municipio: 'CUMARU DO NORTE',
    nomeDoOrgao: 'Prefeitura Municipal de Cumaru do Norte · Setor de Tributos',
    site: 'https://cumarudonorte.pa.gov.br/certidoes',
    email: 'tributos@cumarudonorte.pa.gov.br',
    instrucoes: 'Emissão on-line pelo CNPJ; a inscrição sai no balcão.',
    validadeDias: 90,
  };

  it('encontra o cadastro sem acento e sem caixa, e só na esfera municipal', () => {
    expect(orgaoCadastradoDoMunicipio('PA', 'Cumaru do Norte', [cumaru])?.id).toBe('o1');
    expect(orgaoCadastradoDoMunicipio('PA', 'Cumarú do Norte', [cumaru])?.id).toBe('o1');
    expect(orgaoCadastradoDoMunicipio('MA', 'Cumaru do Norte', [cumaru])).toBeNull();
    expect(orgaoCadastradoDoMunicipio('PA', 'Belém', [cumaru])).toBeNull();
    expect(orgaoCadastradoDoMunicipio('PA', '', [cumaru])).toBeNull();
  });

  it('fora do mapa, com cadastro: as duas vagas municipais passam a apontar o órgão da empresa', () => {
    const lista = certidoesMunicipais('PA', 'Cumaru do Norte', [cumaru]);
    expect(lista).toHaveLength(2);
    for (const c of lista) {
      expect(c.pendenteDeCadastro).toBe(false);
      expect(c.cadastradoPelaEmpresa).toBe(true);
      expect(c.orgaoCadastradoId).toBe('o1');
      expect(c.emissor).toBe('Prefeitura Municipal de Cumaru do Norte · Setor de Tributos');
      expect(c.urlEmissao).toBe('https://cumarudonorte.pa.gov.br/certidoes');
      expect(c.obtencao).toBe('emissao_online');
      expect(c.emailSolicitacao).toBe('tributos@cumarudonorte.pa.gov.br');
      expect(c.observacao).toContain('balcão');
    }
    const cnd = lista.find((c) => c.vaga === 'Certidão Negativa de Débitos Municipais');
    const inscricao = lista.find((c) => c.vaga === 'Inscrição Municipal (cadastro de contribuintes)');
    expect(cnd?.validadeDias).toBe(90);
    // A inscrição não vence, seja qual for a validade usual cadastrada.
    expect(inscricao?.validadeDias).toBe(0);
  });

  it('sem site, a obtenção é solicitação, com o e-mail junto', () => {
    const lista = mesclarOrgaoDaEmpresa(certidoesMunicipais('PA', 'Cumaru do Norte'), { ...cumaru, site: '  ' });
    expect(lista[0].obtencao).toBe('solicitacao');
    expect(lista[0].urlEmissao).toBeUndefined();
    expect(lista[0].emailSolicitacao).toBe('tributos@cumarudonorte.pa.gov.br');
  });

  it('município no mapa: o mapa manda, mesmo com cadastro da empresa para ele', () => {
    const belemCadastrada: OrgaoCadastradoPelaEmpresa = { ...cumaru, municipio: 'Belém', nomeDoOrgao: 'Outro órgão' };
    const lista = certidoesMunicipais('PA', 'BELEM', [belemCadastrada]);
    expect(JSON.stringify(lista)).not.toContain('Outro órgão');
    expect(lista.find((c) => c.vaga === 'Certidão Negativa de Débitos Municipais')?.obtencao).toBe('solicitacao');
    expect(lista.every((c) => !c.cadastradoPelaEmpresa)).toBe(true);
  });

  it('sem nenhum: segue "a cadastrar" com o nome do município — comportamento anterior', () => {
    const lista = certidoesMunicipais('PA', 'Cumaru do Norte', [{ ...cumaru, municipio: 'Redenção' }]);
    expect(lista[0].pendenteDeCadastro).toBe(true);
    expect(lista[0].emissor).toContain('Cumaru do Norte');
    expect(lista[0].cadastradoPelaEmpresa).toBeUndefined();
    // Nome vazio não é cadastro.
    expect(mesclarOrgaoDaEmpresa(lista, { ...cumaru, nomeDoOrgao: '  ' })[0].pendenteDeCadastro).toBe(true);
  });

  it('a mescla nunca toca nas federais nem nas estaduais', () => {
    const tudo = checklistDeCertidoes('PA', 'Cumaru do Norte', [cumaru]);
    for (const c of tudo.filter((x) => x.esfera !== 'municipal')) {
      expect(c.cadastradoPelaEmpresa).toBeUndefined();
      expect(c.emissor).not.toContain('Cumaru');
    }
    expect(tudo.filter((x) => x.cadastradoPelaEmpresa)).toHaveLength(2);
  });
});
