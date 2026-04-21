export interface ModeloDeclaracao {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  fundamento: string;
  template: (ctx: ContextoDeclaracao) => string;
}

export interface ContextoDeclaracao {
  empresaRazao: string;
  empresaCnpj: string;
  empresaEndereco: string;
  representanteNome: string;
  representanteCpf: string;
  representanteCargo: string;
  numeroLicitacao: string;
  orgao: string;
  objeto: string;
  cidade: string;
  data: string;
}

const assinatura = (c: ContextoDeclaracao) => `
<p>&nbsp;</p>
<p style="text-align:right">${c.cidade || '________________'}, ${c.data}.</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p style="text-align:center">_______________________________________</p>
<p style="text-align:center"><strong>${c.representanteNome || '[NOME DO REPRESENTANTE LEGAL]'}</strong></p>
<p style="text-align:center">${c.representanteCargo || '[CARGO]'}</p>
<p style="text-align:center">CPF: ${c.representanteCpf || '[CPF]'}</p>
<p style="text-align:center"><strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong> — CNPJ: ${c.empresaCnpj || '[CNPJ]'}</p>
`;

const cabecalho = (c: ContextoDeclaracao, titulo: string) => `
<h2 style="text-align:center">${titulo}</h2>
<p>&nbsp;</p>
<p><strong>Ref.:</strong> Processo Licitatório nº ${c.numeroLicitacao || '____'} — ${c.orgao || '[ÓRGÃO]'}</p>
<p><strong>Objeto:</strong> ${c.objeto || '[OBJETO DA LICITAÇÃO]'}</p>
<p>&nbsp;</p>
`;

export const MODELOS_DECLARACOES: ModeloDeclaracao[] = [
  {
    id: 'me-epp',
    titulo: 'Declaração de ME / EPP',
    categoria: 'Habilitação',
    descricao: 'Microempresa ou Empresa de Pequeno Porte (LC 123/2006).',
    fundamento: 'Lei Complementar nº 123/2006, art. 3º; Lei nº 14.133/2021, art. 4º.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE ENQUADRAMENTO COMO ME/EPP')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, inscrita no CNPJ sob o nº <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, com sede em ${c.empresaEndereco || '[ENDEREÇO]'}, por intermédio de seu representante legal abaixo assinado, <strong>DECLARA</strong>, sob as penas da lei, que se enquadra como <strong>Microempresa (ME)</strong> ou <strong>Empresa de Pequeno Porte (EPP)</strong>, nos termos do art. 3º da Lei Complementar nº 123/2006, fazendo jus aos benefícios e tratamento diferenciado previstos na referida lei e na Lei nº 14.133/2021.</p>
<p>Declara, ainda, que <strong>não se enquadra</strong> em qualquer das hipóteses de exclusão previstas no §4º do art. 3º da LC 123/2006.</p>
${assinatura(c)}`,
  },
  {
    id: 'inidoneidade',
    titulo: 'Declaração de Inexistência de Fato Impeditivo',
    categoria: 'Habilitação',
    descricao: 'Não há fatos impeditivos para participação (idoneidade).',
    fundamento: 'Lei nº 14.133/2021, art. 63, IV.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE INEXISTÊNCIA DE FATO IMPEDITIVO')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, por seu representante legal, <strong>DECLARA</strong>, sob as penas da lei, que <strong>inexistem fatos impeditivos</strong> à sua habilitação no presente certame, ciente da obrigatoriedade de declarar ocorrências posteriores, conforme exigido no art. 63, IV, da Lei nº 14.133/2021.</p>
<p>Declara, ainda, que não foi declarada inidônea para licitar ou contratar com a Administração Pública, em quaisquer de suas esferas, e que não está suspensa do direito de licitar.</p>
${assinatura(c)}`,
  },
  {
    id: 'menor',
    titulo: 'Declaração de Não Emprego de Menor',
    categoria: 'Habilitação',
    descricao: 'Cumprimento ao art. 7º, XXXIII da CF/88.',
    fundamento: 'CF/88, art. 7º, XXXIII; Lei 14.133/2021, art. 63, V.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE NÃO EMPREGO DE MENOR')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, por seu representante legal, <strong>DECLARA</strong>, para fins do disposto no art. 7º, inciso XXXIII, da Constituição Federal, e no art. 63, V, da Lei nº 14.133/2021, que <strong>não emprega menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre</strong>, e que <strong>não emprega menor de 16 (dezesseis) anos</strong>, salvo na condição de aprendiz, a partir de 14 (quatorze) anos.</p>
${assinatura(c)}`,
  },
  {
    id: 'habilitacao',
    titulo: 'Declaração de Pleno Atendimento aos Requisitos de Habilitação',
    categoria: 'Habilitação',
    descricao: 'Atende a todos os requisitos do edital.',
    fundamento: 'Lei nº 14.133/2021, art. 63, I.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE PLENO ATENDIMENTO AOS REQUISITOS DE HABILITAÇÃO')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, por seu representante legal, <strong>DECLARA</strong>, sob as penas da lei, que <strong>atende plenamente a todos os requisitos de habilitação</strong> exigidos no edital do processo em referência, comprometendo-se a apresentar a documentação correspondente quando solicitada.</p>
${assinatura(c)}`,
  },
  {
    id: 'elaboracao-independente',
    titulo: 'Declaração de Elaboração Independente de Proposta',
    categoria: 'Proposta',
    descricao: 'Proposta elaborada de forma independente, sem conluio.',
    fundamento: 'IN SLTI/MPOG nº 02/2009; Lei 14.133/2021.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE ELABORAÇÃO INDEPENDENTE DE PROPOSTA')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, por seu representante legal, <strong>DECLARA</strong>, sob as penas da lei, em especial o art. 299 do Código Penal Brasileiro, que:</p>
<ol>
  <li>A proposta foi elaborada de forma <strong>independente</strong>;</li>
  <li>A intenção de apresentar proposta não foi informada, discutida ou recebida de qualquer outro participante potencial;</li>
  <li>Não tentou influenciar a decisão de outro participante quanto a participar ou não do certame;</li>
  <li>O conteúdo da proposta não será informado a outro participante antes da abertura;</li>
  <li>Não tentou influenciar a decisão da autoridade responsável pela licitação.</li>
</ol>
${assinatura(c)}`,
  },
  {
    id: 'cota-aprendizagem',
    titulo: 'Declaração de Cumprimento da Cota de Aprendizagem',
    categoria: 'Habilitação',
    descricao: 'Cumprimento da cota de aprendizes (Lei 10.097/2000).',
    fundamento: 'Lei nº 10.097/2000; Decreto nº 9.579/2018.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE CUMPRIMENTO DA COTA DE APRENDIZAGEM')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, <strong>DECLARA</strong> que cumpre a cota de aprendizagem prevista no art. 429 da CLT e regulamentada pela Lei nº 10.097/2000 e Decreto nº 9.579/2018, ou que está dispensada na forma da legislação vigente.</p>
${assinatura(c)}`,
  },
  {
    id: 'reserva-pcd',
    titulo: 'Declaração de Reserva de Vagas para PCD',
    categoria: 'Habilitação',
    descricao: 'Cumprimento da reserva legal a pessoas com deficiência.',
    fundamento: 'Lei nº 8.213/91, art. 93.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE RESERVA DE CARGOS PARA PCD')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, <strong>DECLARA</strong> que reserva o percentual legal de cargos para pessoas com deficiência ou beneficiários reabilitados da Previdência Social, conforme exigido pelo art. 93 da Lei nº 8.213/1991, ou que está desobrigada por possuir quadro de pessoal abaixo do limite legal.</p>
${assinatura(c)}`,
  },
  {
    id: 'nao-parentesco',
    titulo: 'Declaração de Não Parentesco (Nepotismo)',
    categoria: 'Habilitação',
    descricao: 'Inexistência de vínculo familiar com servidores do órgão.',
    fundamento: 'Súmula Vinculante nº 13 do STF.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE NÃO PARENTESCO')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, por seu representante legal, <strong>DECLARA</strong> que seus sócios, dirigentes e responsáveis técnicos <strong>não possuem vínculo de parentesco</strong>, em linha reta ou colateral, até o terceiro grau, com agente público integrante do quadro do(a) ${c.orgao || '[ÓRGÃO]'}, em obediência à Súmula Vinculante nº 13 do STF.</p>
${assinatura(c)}`,
  },
  {
    id: 'ciencia-edital',
    titulo: 'Declaração de Ciência e Concordância com o Edital',
    categoria: 'Proposta',
    descricao: 'Conhecimento integral do edital e seus anexos.',
    fundamento: 'Princípio da vinculação ao edital — Lei 14.133/2021.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE CIÊNCIA E CONCORDÂNCIA COM O EDITAL')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, <strong>DECLARA</strong> ter pleno conhecimento e estar de acordo com todas as condições estabelecidas no Edital nº ${c.numeroLicitacao || '____'} e seus anexos, comprometendo-se a cumpri-las integralmente caso seja declarada vencedora.</p>
${assinatura(c)}`,
  },
  {
    id: 'idoneidade-financeira',
    titulo: 'Declaração de Idoneidade Financeira',
    categoria: 'Habilitação',
    descricao: 'Idoneidade econômico-financeira da empresa.',
    fundamento: 'Lei nº 14.133/2021, art. 69.',
    template: (c) => `${cabecalho(c, 'DECLARAÇÃO DE IDONEIDADE ECONÔMICO-FINANCEIRA')}
<p>A empresa <strong>${c.empresaRazao || '[RAZÃO SOCIAL]'}</strong>, CNPJ <strong>${c.empresaCnpj || '[CNPJ]'}</strong>, <strong>DECLARA</strong>, sob as penas da lei, que possui plena <strong>idoneidade econômico-financeira</strong> para participar da presente licitação e cumprir integralmente as obrigações que vier a assumir, nos termos do art. 69 da Lei nº 14.133/2021.</p>
${assinatura(c)}`,
  },
];
