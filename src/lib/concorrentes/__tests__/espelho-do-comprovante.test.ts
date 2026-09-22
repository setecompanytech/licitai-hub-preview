import { describe, it, expect } from 'vitest';
import {
  atividadesSecundarias, caixasDoEspelho, capitalSocialLegivel, dataBr, formatarCep, formatarCnae, formatarNaturezaJuridica,
  htmlDoEspelho, linhasDoQsa, numeroDoCapital, qualificacaoDoSocio, rodapeDoEspelho, siglaDoPorte, sociosDoEspelho,
  URL_COMPROVANTE_OFICIAL, VAZIO_DO_COMPROVANTE, type DadosDoEspelho,
} from '../espelho-do-comprovante';

/** A Santa Rosa como a fonte pública devolve (22/09), com o formato antigo da edge junto. */
const santaRosa: DadosDoEspelho = {
  cnpj: '24.687.187/0001-01',
  razaoSocial: 'SANTA ROSA COMERCIO, DISTRIBUIDORA E REPRESENTACOES LTDA',
  nomeFantasia: 'GRUPO SANTA ROSA',
  situacao: 'ATIVA',
  dataAbertura: '2016-04-28',
  naturezaJuridica: '2062 - Sociedade Empresária Limitada',
  cnaePrincipal: '4712100 - Comércio varejista de mercadorias em geral',
  cnaesSecundarios: ['4322302 - Instalação e manutenção de sistemas centrais de ar condicionado'],
  logradouro: 'TENENTE BEZERRA', numero: '93', complemento: 'A', bairro: 'MANGUEIRAO', cep: '66640-085',
  municipio: 'BELEM', uf: 'PA', email: '', telefone: '(91) 9225-7448', porte: 'MICRO EMPRESA', capitalSocial: 'R$ 500.000,00',
  matrizFilial: 'MATRIZ', dataSituacaoCadastral: '2016-04-28', motivoSituacaoCadastral: 'SEM MOTIVO',
  situacaoEspecial: '', dataSituacaoEspecial: '', enteFederativoResponsavel: '',
  qsa: [{ nome: 'FULANO DE TAL', qualificacao: 'Sócio-Administrador', qualificacaoCodigo: '49', dataEntrada: '2016-04-28', faixaEtaria: 'Entre 31 a 40 anos' }],
  fonte: 'brasilapi', consultadoEm: '2026-09-22T12:27:09.000Z',
};

describe('espelho do comprovante — formatos da Receita', () => {
  it('escreve CNAE, natureza jurídica, CEP, data e porte como o comprovante', () => {
    expect(formatarCnae(4712100)).toBe('47.12-1-00');
    expect(formatarCnae('47.12-1-00')).toBe('47.12-1-00');
    expect(formatarNaturezaJuridica('2062')).toBe('206-2');
    expect(formatarCep('66640085')).toBe('66.640-085');
    expect(formatarCep('66640-085')).toBe('66.640-085');
    expect(dataBr('2016-04-28')).toBe('28/04/2016');
    expect(dataBr('28/04/2016')).toBe('28/04/2016');
    expect(siglaDoPorte('MICRO EMPRESA')).toBe('ME');
    expect(siglaDoPorte('EMPRESA DE PEQUENO PORTE')).toBe('EPP');
    expect(siglaDoPorte('')).toBe(VAZIO_DO_COMPROVANTE);
  });

  it('as caixas seguem a ordem do comprovante, com o número de inscrição e a matriz na primeira', () => {
    const linhas = caixasDoEspelho(santaRosa);
    expect(linhas[0].map((c) => c.rotulo)).toEqual(['Número de inscrição', '', 'Data de abertura']);
    expect(linhas[0][0].valor).toBe('24.687.187/0001-01');
    expect(linhas[0][0].subvalor).toBe('MATRIZ');
    expect(linhas[0][2].valor).toBe('28/04/2016');
    expect(linhas.map((l) => l[0].rotulo)).toEqual([
      'Número de inscrição', 'Nome empresarial', 'Título do estabelecimento (nome de fantasia)',
      'Código e descrição da atividade econômica principal', 'Código e descrição das atividades econômicas secundárias',
      'Código e descrição da natureza jurídica', 'Logradouro', 'CEP', 'Endereço eletrônico',
      'Ente federativo responsável (EFR)', 'Situação cadastral', 'Motivo de situação cadastral', 'Situação especial',
    ]);
    for (const linha of linhas) expect(linha.reduce((s, c) => s + c.largura, 0)).toBe(12);
  });

  it('o formato antigo da edge ("4712100 - …") sai reformatado; o vazio vira asteriscos, como o comprovante imprime', () => {
    const linhas = caixasDoEspelho(santaRosa);
    expect(linhas[3][0].valor).toBe('47.12-1-00 - Comércio varejista de mercadorias em geral');
    expect(linhas[5][0].valor).toBe('206-2 - Sociedade Empresária Limitada');
    expect(atividadesSecundarias(santaRosa)).toEqual(['43.22-3-02 - Instalação e manutenção de sistemas centrais de ar condicionado']);
    expect(linhas[7][0].valor).toBe('66.640-085');
    expect(linhas[8][0].valor).toBe(VAZIO_DO_COMPROVANTE);
    expect(linhas[9][0].valor).toBe(VAZIO_DO_COMPROVANTE);
    expect(linhas[12][0].valor).toBe(VAZIO_DO_COMPROVANTE);
    expect(linhas[12][1].valor).toBe(VAZIO_DO_COMPROVANTE);
    expect(VAZIO_DO_COMPROVANTE).toBe('********');
  });

  it('os campos novos separados vencem o formato antigo, e o sócio sem nome não entra', () => {
    const linhas = caixasDoEspelho({
      ...santaRosa,
      cnaePrincipalCodigo: '4712100', cnaePrincipalDescricao: 'Minimercados',
      cnaesSecundariosDetalhados: [{ codigo: '4722901', descricao: 'Açougues' }],
    });
    expect(linhas[3][0].valor).toBe('47.12-1-00 - Minimercados');
    expect(linhas[4][0].lista).toEqual(['47.22-9-01 - Açougues']);
    expect(sociosDoEspelho({ ...santaRosa, qsa: [{ nome: '', qualificacao: 'x' }, { nome: 'BELTRANO', qualificacao: 'Sócio' }] }).map((s) => s.nome)).toEqual(['BELTRANO']);
  });

  it('o QSA como a consulta oficial: capital social por extenso, nome e qualificação com código, representante quando há; sem faixa etária', () => {
    expect(capitalSocialLegivel('R$ 500.000,00')).toBe('R$ 500.000,00 (Quinhentos mil reais)');
    expect(capitalSocialLegivel(500000)).toBe('R$ 500.000,00 (Quinhentos mil reais)');
    expect(capitalSocialLegivel('1045.2')).toBe('R$ 1.045,20 (Um mil e quarenta e cinco reais e vinte centavos)');
    expect(capitalSocialLegivel('')).toBe('');
    expect(numeroDoCapital('500.000')).toBe(500000);
    expect(qualificacaoDoSocio({ qualificacao: 'Sócio-Administrador', qualificacaoCodigo: '49' })).toBe('49-Sócio-Administrador');
    expect(qualificacaoDoSocio({ qualificacao: 'Sócio' })).toBe('Sócio');
    expect(qualificacaoDoSocio({ qualificacao: '' })).toBe(VAZIO_DO_COMPROVANTE);

    const linhas = linhasDoQsa({
      ...santaRosa,
      qsa: [{
        nome: 'FULANO', qualificacao: 'Sócio-Administrador', qualificacaoCodigo: '49', faixaEtaria: 'Entre 31 a 40 anos',
        representanteLegal: 'BELTRANO', qualificacaoRepresentante: 'Procurador', qualificacaoRepresentanteCodigo: '17',
      }],
    });
    expect(linhas).toEqual([{ nome: 'FULANO', qualificacao: '49-Sócio-Administrador', representante: 'BELTRANO', qualificacaoRepresentante: '17-Procurador' }]);
    expect(JSON.stringify(linhas)).not.toContain('31 a 40');
    expect(linhasDoQsa(santaRosa)[0].representante).toBe('');
  });

  it('o rodapé sempre separa espelho de comprovante e aponta para a emissão oficial', () => {
    const rodape = rodapeDoEspelho(santaRosa);
    expect(rodape).toContain('não substitui o comprovante oficial');
    expect(rodape).toContain(URL_COMPROVANTE_OFICIAL);
    expect(rodape).toContain('BrasilAPI');
    expect(rodapeDoEspelho({ ...santaRosa, consultadoEm: undefined, fonte: 'cnpj.ws' })).toContain('Consultado pela CNPJ.ws');
  });

  it('o HTML de impressão nasce das mesmas caixas, traz o QSA com o capital e escapa o que vier da fonte', () => {
    const html = htmlDoEspelho({ ...santaRosa, razaoSocial: 'EMPRESA <TESTE> & CIA' });
    expect(html).toContain('Espelho do Comprovante de Inscrição e de Situação Cadastral');
    expect(html).toContain('EMPRESA &lt;TESTE&gt; &amp; CIA');
    expect(html).toContain('47.12-1-00');
    expect(html).toContain('Quadro de sócios e administradores');
    expect(html).toContain('CAPITAL SOCIAL: R$ 500.000,00 (Quinhentos mil reais)');
    expect(html).toContain('<td>FULANO DE TAL</td><td>49-Sócio-Administrador</td>');
    expect(html).not.toContain('Faixa etária');
    expect(html).not.toContain('Entrada');
    expect(html).toContain('window.print()');
    expect(html).not.toContain('REPÚBLICA FEDERATIVA');
  });
});
