import { CERTIDOES_POR_ESTADO, type PortalCertidao } from './certidoes-estaduais-municipais';
import { REGIOES_ESTADOS } from './regioes-brasil';

/**
 * Catálogo de certidões — cada uma no seu órgão emissor (22/09/2026).
 *
 * O dono, na tarde de 22/09: "quem atua dentro da administração pública
 * busca por veracidade, documentos probatórios reais". A aba Certidões
 * "emitia" por raspagem com IA, resumia por IA e misturava entes (a
 * prefeitura de São Paulo para um CNPJ de Belém). Nada disso é certidão.
 *
 * Aqui mora a realidade: para cada certidão que a Lei 14.133/2021 pede na
 * habilitação, QUEM emite, ONDE, COMO se obtém (emissão on-line com
 * verificação humana; login da própria empresa; solicitação ao órgão;
 * documento da própria empresa), por QUANTO tempo vale em regra, e se um
 * terceiro consegue consultar só com o CNPJ. O Praefectus não gera certidão:
 * a válida é o PDF do órgão, com código de autenticidade. O cofre de
 * Documentos guarda o PDF, lê a validade e avisa antes de vencer.
 *
 * As entradas são chaveadas pela VAGA do cofre (`lib/documentos/previstos.ts`,
 * nomes exatos, que não se renomeiam) para o checklist e o cofre falarem do
 * mesmo documento. Estadual e municipal saem de `certidoes-estaduais-
 * municipais.ts` (27 UFs, capitais); município fora do mapa ganha uma
 * entrada "a cadastrar", nunca a de outra cidade.
 */
export type Esfera = 'federal' | 'estadual' | 'municipal';

export type Obtencao =
  /** Qualquer pessoa emite no site do órgão, só com o CNPJ (há verificação "sou humano"). */
  | 'emissao_online'
  /** Exige login, certificado digital ou cadastro da própria empresa no órgão. */
  | 'emissao_com_login'
  /** Pedido ao órgão (e-mail ou protocolo), com resposta em prazo. */
  | 'solicitacao'
  /** O Praefectus consulta na fonte, pela API oficial. */
  | 'consulta_api'
  /** A própria empresa produz (declaração, balanço). */
  | 'documento_proprio';

export const ROTULO_DA_OBTENCAO: Record<Obtencao, string> = {
  emissao_online: 'Emissão on-line no órgão, com verificação humana',
  emissao_com_login: 'Emissão no órgão, com login da própria empresa',
  solicitacao: 'Solicitação ao órgão, com resposta em prazo',
  consulta_api: 'Consultada na fonte pelo Praefectus (API oficial)',
  documento_proprio: 'Documento da própria empresa',
};

export interface CertidaoDoCatalogo {
  id: string;
  /** A vaga do cofre (`VAGAS_PREVISTAS.nome`) a que esta certidão responde. */
  vaga?: string;
  nome: string;
  sigla?: string;
  esfera: Esfera;
  /** O dispositivo da Lei 14.133/2021. */
  fundamento: string;
  emissor: string;
  urlEmissao?: string;
  /** Onde se confere o código de autenticidade do documento. */
  urlAutenticidade?: string;
  obtencao: Obtencao;
  /** Prazo usual, em dias. `null`: conforme o documento ou o edital. `0`: não vence. */
  validadeDias: number | null;
  /** Um terceiro (o concorrente, o órgão) consegue emitir ou consultar só com o CNPJ? */
  terceiroConsulta: boolean;
  observacao?: string;
  /** O órgão deste município não tem endereço ou contato cadastrado: a empresa informa. */
  pendenteDeCadastro?: boolean;
}

export const URL_CERTIDOES_RFB = 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home';
export const URL_CRF_CAIXA = 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf';
export const URL_CNDT_TST = 'https://cndt-certidao.tst.jus.br/';
export const URL_CNPJ_RFB = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/';
export const URL_SANCOES_CGU = 'https://portaldatransparencia.gov.br/sancoes/consulta';

/** As federais valem para qualquer CNPJ do país: a União não muda com o domicílio. */
export const CERTIDOES_FEDERAIS: CertidaoDoCatalogo[] = [
  {
    id: 'cartao-cnpj',
    vaga: 'Cartão CNPJ',
    nome: 'Comprovante de Inscrição e de Situação Cadastral (CNPJ)',
    sigla: 'Cartão CNPJ',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 68, I',
    emissor: 'Receita Federal do Brasil',
    urlEmissao: URL_CNPJ_RFB,
    obtencao: 'emissao_online',
    validadeDias: 0,
    terceiroConsulta: true,
    observacao: 'Não vence; retrata o cadastro na data da emissão. A Consulta CNPJ desta tela desenha o espelho.',
  },
  {
    id: 'cnd-federal',
    vaga: 'Certidão Negativa de Débitos Federais (CND)',
    nome: 'Certidão Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União',
    sigla: 'CND Federal',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 68, III e IV',
    emissor: 'Receita Federal do Brasil / Procuradoria-Geral da Fazenda Nacional',
    urlEmissao: URL_CERTIDOES_RFB,
    urlAutenticidade: URL_CERTIDOES_RFB,
    obtencao: 'emissao_online',
    validadeDias: 180,
    terceiroConsulta: true,
    observacao: 'Cobre tributos federais, dívida ativa da União e contribuições previdenciárias. Positiva com efeitos de negativa vale como negativa.',
  },
  {
    id: 'crf-fgts',
    vaga: 'Certidão de Regularidade do FGTS (CRF)',
    nome: 'Certificado de Regularidade do FGTS',
    sigla: 'CRF',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 68, IV',
    emissor: 'Caixa Econômica Federal',
    urlEmissao: URL_CRF_CAIXA,
    urlAutenticidade: URL_CRF_CAIXA,
    obtencao: 'emissao_online',
    validadeDias: 30,
    terceiroConsulta: true,
    observacao: 'Trinta dias a contar da emissão: é a que mais vence entre uma sessão e outra.',
  },
  {
    id: 'cndt',
    vaga: 'CNDT – Certidão Trabalhista',
    nome: 'Certidão Negativa de Débitos Trabalhistas',
    sigla: 'CNDT',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 68, V',
    emissor: 'Tribunal Superior do Trabalho',
    urlEmissao: URL_CNDT_TST,
    urlAutenticidade: URL_CNDT_TST,
    obtencao: 'emissao_online',
    validadeDias: 180,
    terceiroConsulta: true,
    observacao: 'Positiva com efeitos de negativa vale como negativa.',
  },
  {
    id: 'sancoes-federais',
    nome: 'Sanções e impedimentos: CEIS, CNEP, CEPIM e acordos de leniência',
    sigla: 'Sanções',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 156 e art. 14',
    emissor: 'Controladoria-Geral da União · Portal da Transparência',
    urlEmissao: URL_SANCOES_CGU,
    obtencao: 'consulta_api',
    validadeDias: null,
    terceiroConsulta: true,
    observacao: 'Não é certidão: é consulta. O Praefectus lê os quatro cadastros pela API oficial e confere que a resposta é deste CNPJ.',
  },
  {
    id: 'declaracao-menor',
    vaga: 'Declaração de Não Emprego de Menor',
    nome: 'Declaração de cumprimento do art. 7º, XXXIII, da Constituição',
    esfera: 'federal',
    fundamento: 'Lei 14.133/2021, art. 68, VI',
    emissor: 'A própria empresa',
    obtencao: 'documento_proprio',
    validadeDias: 0,
    terceiroConsulta: false,
  },
];

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim();

export function nomeDoEstado(uf: string): string {
  for (const regiao of Object.values(REGIOES_ESTADOS)) {
    const estado = regiao.estados.find((e) => e.uf === uf.toUpperCase());
    if (estado) return estado.nome;
  }
  return CERTIDOES_POR_ESTADO[uf.toUpperCase()]?.nomeEstado ?? uf.toUpperCase();
}

/** O nome do município como o mapa escreve ("Belém"), a partir do que a Receita entrega ("BELEM"). */
export function municipioDoMapa(uf: string, municipio: string): string | null {
  const estado = CERTIDOES_POR_ESTADO[uf.toUpperCase()];
  if (!estado) return null;
  const alvo = semAcento(municipio);
  if (!alvo) return null;
  return Object.keys(estado.municipios).find((m) => semAcento(m) === alvo) ?? null;
}

/** O nome como o seletor de cidades escreve, quando existe na lista da UF. */
export function cidadeDaLista(uf: string, municipio: string): string | null {
  const alvo = semAcento(municipio);
  if (!alvo) return null;
  for (const regiao of Object.values(REGIOES_ESTADOS)) {
    const estado = regiao.estados.find((e) => e.uf === uf.toUpperCase());
    if (estado) return estado.cidades?.find((c) => semAcento(c) === alvo) ?? null;
  }
  return null;
}

const ehCadastro = (p: PortalCertidao) => /\bFIC\b|cadastr|inscri/i.test(p.nome) || /cadastr|inscri/i.test(p.descricao);

const TJ_NA_WEB: Record<string, string> = { DF: 'https://www.tjdft.jus.br/' };
const tribunalDoEstado = (uf: string) => TJ_NA_WEB[uf.toUpperCase()] ?? `https://www.tj${uf.toLowerCase()}.jus.br/`;

const JUNTA_NA_WEB: Record<string, { nome: string; url: string }> = {
  PA: { nome: 'Junta Comercial do Estado do Pará (JUCEPA)', url: 'https://www.jucepa.pa.gov.br/' },
  SP: { nome: 'Junta Comercial do Estado de São Paulo (JUCESP)', url: 'https://www.jucesponline.sp.gov.br/' },
  MG: { nome: 'Junta Comercial do Estado de Minas Gerais (JUCEMG)', url: 'https://www.jucemg.mg.gov.br/' },
  RJ: { nome: 'Junta Comercial do Estado do Rio de Janeiro (JUCERJA)', url: 'https://www.jucerja.rj.gov.br/' },
};

/** As estaduais do domicílio: fazenda (débitos e cadastro), tribunal (falência) e junta. */
export function certidoesEstaduais(uf: string): CertidaoDoCatalogo[] {
  const sigla = uf.toUpperCase();
  const estado = CERTIDOES_POR_ESTADO[sigla];
  const nome = nomeDoEstado(sigla);
  const lista: CertidaoDoCatalogo[] = [];

  const portaisFazenda = (estado?.portais ?? []).filter((p) => p.tipo === 'estadual');
  const cnds = portaisFazenda.filter((p) => !ehCadastro(p));
  const cadastros = portaisFazenda.filter(ehCadastro);

  if (cnds.length === 0) {
    lista.push({
      id: `cnd-estadual-${sigla}`,
      vaga: 'Certidão Negativa de Débitos Estaduais',
      nome: `Certidão Negativa de Débitos Estaduais — ${nome}`,
      esfera: 'estadual',
      fundamento: 'Lei 14.133/2021, art. 68, III',
      emissor: `Secretaria da Fazenda do Estado (${sigla})`,
      obtencao: 'emissao_online',
      validadeDias: null,
      terceiroConsulta: true,
      pendenteDeCadastro: true,
      observacao: 'Endereço do órgão não cadastrado para esta UF.',
    });
  }
  cnds.forEach((p, i) => lista.push({
    id: `cnd-estadual-${sigla}${i > 0 ? `-${i + 1}` : ''}`,
    vaga: 'Certidão Negativa de Débitos Estaduais',
    nome: p.descricao || p.nome,
    sigla: p.nome.split(' - ')[0],
    esfera: 'estadual',
    fundamento: 'Lei 14.133/2021, art. 68, III',
    emissor: p.nome.includes(' - ') ? p.nome.split(' - ').slice(1).join(' - ') : `Secretaria da Fazenda do Estado (${sigla})`,
    urlEmissao: p.url,
    urlAutenticidade: p.url,
    obtencao: p.requerLogin ? 'emissao_com_login' : 'emissao_online',
    // Pará: emitida em 10/07/2026, válida até 06/01/2027 — 180 dias (lib/documentos/validade.ts).
    validadeDias: sigla === 'PA' ? 180 : null,
    terceiroConsulta: !p.requerLogin,
  }));

  if (cadastros.length === 0) {
    lista.push({
      id: `cadastro-estadual-${sigla}`,
      vaga: 'Inscrição Estadual (cadastro de contribuintes)',
      nome: `Comprovante de inscrição no cadastro de contribuintes do ICMS — ${nome}`,
      esfera: 'estadual',
      fundamento: 'Lei 14.133/2021, art. 68, II',
      emissor: `Secretaria da Fazenda do Estado (${sigla})`,
      obtencao: 'emissao_com_login',
      validadeDias: 0,
      terceiroConsulta: false,
      pendenteDeCadastro: true,
      observacao: 'Endereço do órgão não cadastrado para esta UF. Empresa sem inscrição estadual apresenta a declaração de não contribuinte.',
    });
  }
  cadastros.forEach((p, i) => lista.push({
    id: `cadastro-estadual-${sigla}${i > 0 ? `-${i + 1}` : ''}`,
    vaga: 'Inscrição Estadual (cadastro de contribuintes)',
    nome: p.descricao || p.nome,
    sigla: p.nome.split(' - ')[0],
    esfera: 'estadual',
    fundamento: 'Lei 14.133/2021, art. 68, II',
    emissor: p.nome.includes(' - ') ? p.nome.split(' - ').slice(1).join(' - ') : `Secretaria da Fazenda do Estado (${sigla})`,
    urlEmissao: p.url,
    obtencao: p.requerLogin ? 'emissao_com_login' : 'emissao_online',
    validadeDias: 0,
    terceiroConsulta: !p.requerLogin,
    observacao: 'Prova de inscrição, não de regularidade: não vence, retrata o cadastro na data.',
  }));

  lista.push({
    id: `falencia-${sigla}`,
    vaga: 'Certidão Negativa de Falência',
    nome: `Certidão negativa de falência e recuperação judicial — Tribunal de Justiça (${sigla})`,
    esfera: 'estadual',
    fundamento: 'Lei 14.133/2021, art. 69, II',
    emissor: `Tribunal de Justiça do Estado (${sigla}) · distribuidor da sede`,
    urlEmissao: tribunalDoEstado(sigla),
    obtencao: 'emissao_online',
    validadeDias: null,
    terceiroConsulta: true,
    observacao: 'O prazo de validade é o que o edital fixa (em regra 30 a 90 dias da emissão). Empresa em recuperação judicial apresenta a certidão positiva com o plano homologado.',
  });

  const junta = JUNTA_NA_WEB[sigla];
  lista.push({
    id: `junta-${sigla}`,
    vaga: 'Certidão Simplificada da Junta Comercial',
    nome: `Certidão simplificada — ${junta?.nome ?? `Junta Comercial do Estado (${sigla})`}`,
    esfera: 'estadual',
    fundamento: 'Lei 14.133/2021, art. 66',
    emissor: junta?.nome ?? `Junta Comercial do Estado (${sigla})`,
    urlEmissao: junta?.url,
    obtencao: 'emissao_com_login',
    validadeDias: null,
    terceiroConsulta: true,
    pendenteDeCadastro: !junta,
    observacao: 'Prazo conforme o edital (em regra até 90 dias). Não substitui o contrato social: informa o que está arquivado.',
  });

  return lista;
}

/** Instruções conhecidas de municípios cujo canal não é um site de emissão. */
const MUNICIPIOS_COM_INSTRUCAO: Record<string, { obtencao: Obtencao; observacao: string }> = {
  'PA|Belém': {
    obtencao: 'solicitacao',
    observacao: 'A Secretaria de Finanças de Belém atende a solicitação por e-mail, ao fim de cada exercício; o Agiliza Belém exige login. O sistema prepara o e-mail e o cofre guarda a resposta.',
  },
};

/** As municipais do domicílio: débitos e cadastro. Município fora do mapa recebe a vaga "a cadastrar", nunca outra cidade. */
export function certidoesMunicipais(uf: string, municipio: string): CertidaoDoCatalogo[] {
  const sigla = uf.toUpperCase();
  const nomeNoMapa = municipioDoMapa(sigla, municipio);
  const rotulo = nomeNoMapa ?? municipio.trim();
  if (!rotulo) return [];
  const portais = nomeNoMapa ? CERTIDOES_POR_ESTADO[sigla]?.municipios[nomeNoMapa] ?? [] : [];
  const instrucao = nomeNoMapa ? MUNICIPIOS_COM_INSTRUCAO[`${sigla}|${nomeNoMapa}`] : undefined;
  const lista: CertidaoDoCatalogo[] = [];

  const cnds = portais.filter((p) => !ehCadastro(p));
  if (cnds.length === 0) {
    lista.push({
      id: `cnd-municipal-${sigla}-${semAcento(rotulo).replace(/\s+/g, '-')}`,
      vaga: 'Certidão Negativa de Débitos Municipais',
      nome: `Certidão Negativa de Débitos Municipais — ${rotulo}/${sigla}`,
      esfera: 'municipal',
      fundamento: 'Lei 14.133/2021, art. 68, III',
      emissor: `Prefeitura Municipal de ${rotulo} · Secretaria de Finanças`,
      obtencao: instrucao?.obtencao ?? 'solicitacao',
      validadeDias: null,
      terceiroConsulta: false,
      pendenteDeCadastro: true,
      observacao: instrucao?.observacao ?? 'Endereço ou contato do órgão não cadastrado para este município: informe o canal de emissão.',
    });
  }
  cnds.forEach((p, i) => lista.push({
    id: `cnd-municipal-${sigla}-${semAcento(rotulo).replace(/\s+/g, '-')}${i > 0 ? `-${i + 1}` : ''}`,
    vaga: 'Certidão Negativa de Débitos Municipais',
    nome: p.descricao || p.nome,
    sigla: p.nome.split(' - ')[0],
    esfera: 'municipal',
    fundamento: 'Lei 14.133/2021, art. 68, III',
    emissor: `Prefeitura Municipal de ${rotulo} · Secretaria de Finanças`,
    urlEmissao: p.url,
    obtencao: instrucao?.obtencao ?? (p.requerLogin ? 'emissao_com_login' : 'emissao_online'),
    validadeDias: null,
    terceiroConsulta: !p.requerLogin && !instrucao,
    observacao: instrucao?.observacao,
  }));

  lista.push({
    id: `cadastro-municipal-${sigla}-${semAcento(rotulo).replace(/\s+/g, '-')}`,
    vaga: 'Inscrição Municipal (cadastro de contribuintes)',
    nome: `Comprovante de inscrição no cadastro municipal de contribuintes — ${rotulo}/${sigla}`,
    esfera: 'municipal',
    fundamento: 'Lei 14.133/2021, art. 68, II',
    emissor: `Prefeitura Municipal de ${rotulo} · Secretaria de Finanças`,
    urlEmissao: portais[0]?.url,
    obtencao: instrucao ? 'solicitacao' : portais[0]?.requerLogin ? 'emissao_com_login' : portais.length > 0 ? 'emissao_online' : 'solicitacao',
    validadeDias: 0,
    terceiroConsulta: false,
    pendenteDeCadastro: portais.length === 0,
    observacao: nomeNoMapa === 'Belém' ? 'Em Belém, a ficha cadastral (CISC) sai pelo mesmo canal da Secretaria de Finanças.' : 'Prova de inscrição, não de regularidade: não vence.',
  });

  return lista;
}

/** O checklist do domicílio: federais sempre; estaduais e municipais quando se sabe onde a empresa está. */
export function checklistDeCertidoes(uf?: string | null, municipio?: string | null): CertidaoDoCatalogo[] {
  const lista = [...CERTIDOES_FEDERAIS];
  if (uf) lista.push(...certidoesEstaduais(uf));
  if (uf && municipio) lista.push(...certidoesMunicipais(uf, municipio));
  return lista;
}

export const ROTULO_DA_ESFERA: Record<Esfera, string> = {
  federal: 'Federal — União',
  estadual: 'Estadual',
  municipal: 'Municipal',
};

export function porEsfera(lista: CertidaoDoCatalogo[]): Array<{ esfera: Esfera; certidoes: CertidaoDoCatalogo[] }> {
  return (['federal', 'estadual', 'municipal'] as Esfera[])
    .map((esfera) => ({ esfera, certidoes: lista.filter((c) => c.esfera === esfera) }))
    .filter((g) => g.certidoes.length > 0);
}

/** "180 dias", "30 dias", "não vence", "conforme o documento ou o edital". */
export function validadeLegivel(dias: number | null): string {
  if (dias === null) return 'conforme o documento ou o edital';
  if (dias === 0) return 'não vence';
  return `${dias} dias`;
}

/**
 * O e-mail de solicitação ao órgão, pronto para o cliente de e-mail. O
 * destinatário (`para`) entra quando se conhece o endereço do órgão; sem ele,
 * o endereço fica com quem envia.
 */
export function modeloDeSolicitacao(dados: { certidao: string; orgao: string; razaoSocial: string; cnpj: string; exercicio?: number; para?: string | null }): { assunto: string; corpo: string; mailto: string } {
  const exercicio = dados.exercicio ?? new Date().getFullYear();
  const assunto = `Solicitação de ${dados.certidao} — ${dados.razaoSocial} — CNPJ ${dados.cnpj}`;
  const corpo = [
    `À ${dados.orgao},`,
    '',
    `Solicitamos a emissão da ${dados.certidao} em nome de ${dados.razaoSocial}, CNPJ ${dados.cnpj}, referente ao exercício de ${exercicio}, para fins de habilitação em licitações (Lei 14.133/2021, art. 68).`,
    '',
    'Pedimos o envio do documento em PDF, com o código de autenticidade, para este e-mail.',
    '',
    'Atenciosamente,',
    dados.razaoSocial,
  ].join('\n');
  const para = dados.para?.trim() ? encodeURIComponent(dados.para.trim()) : '';
  return { assunto, corpo, mailto: `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}` };
}
