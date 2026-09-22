/**
 * Nome de órgão legível (22/09/2026).
 *
 * O PNCP e os portais entregam o nome em caixa alta e sem acento
 * ("MUNICIPIO DE RONDON DO PARA", "COMANDO DO EXERCITO", "DEPARTAMENTO
 * AUTONOMO DEAGUA E ESGOTO"), e a lista de processos da Análise de
 * concorrente saía assim, desorganizada. Aqui o nome ganha a norma da língua:
 * caixa de nome próprio, conectivos em minúscula, o acento das palavras da
 * administração pública e dos lugares do Pará (dicionário curto), siglas
 * preservadas. Palavra que o dicionário não conhece só muda de caixa — nunca
 * ganha acento inventado. Nome que já vem em caixa mista passa intacto: foi
 * escrito por gente.
 */
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'no', 'na', 'nos', 'nas', 'por', 'com', 'para']);

/** Grafia com acento das palavras que aparecem em nome de órgão, pela chave sem acento. */
const ACENTUADAS: Record<string, string> = {
  MUNICIPIO: 'Município', MUNICIPIOS: 'Municípios', CAMARA: 'Câmara', SECRETARIA: 'Secretaria', SAUDE: 'Saúde',
  EDUCACAO: 'Educação', FUNDACAO: 'Fundação', ASSISTENCIA: 'Assistência', EXERCITO: 'Exército', AERONAUTICA: 'Aeronáutica',
  MINISTERIO: 'Ministério', PUBLICO: 'Público', PUBLICA: 'Pública', PUBLICOS: 'Públicos', PUBLICAS: 'Públicas',
  JUSTICA: 'Justiça', POLICIA: 'Polícia', CIENCIA: 'Ciência', CIENCIAS: 'Ciências', AGENCIA: 'Agência', AGENCIAS: 'Agências',
  CLINICAS: 'Clínicas', CLINICA: 'Clínica', AGUA: 'Água', AGUAS: 'Águas', AUTONOMO: 'Autônomo', AUTONOMA: 'Autônoma',
  SEGURANCA: 'Segurança', TRANSITO: 'Trânsito', HABITACAO: 'Habitação', ECONOMICO: 'Econômico', ECONOMICA: 'Econômica',
  INDUSTRIA: 'Indústria', COMERCIO: 'Comércio', SERVICOS: 'Serviços', SERVICO: 'Serviço', ADMINISTRACAO: 'Administração',
  GESTAO: 'Gestão', FINANCAS: 'Finanças', PATRIMONIO: 'Patrimônio', ELETRICA: 'Elétrica', TECNICO: 'Técnico', TECNICA: 'Técnica',
  CIENTIFICO: 'Científico', CIENTIFICA: 'Científica', MEDICO: 'Médico', MEDICA: 'Médica', FARMACIA: 'Farmácia',
  BATALHAO: 'Batalhão', PREVIDENCIA: 'Previdência', PREVIDENCIARIO: 'Previdenciário', GENERO: 'Gênero', CRIANCA: 'Criança',
  FAMILIA: 'Família', ANONIMA: 'Anônima', PROTECAO: 'Proteção', INFANCIA: 'Infância', ADOLESCENCIA: 'Adolescência',
  UNIAO: 'União', REGIAO: 'Região', AMAZONIA: 'Amazônia', AMAZONICA: 'Amazônica', AMAZONICO: 'Amazônico',
  HIDRICOS: 'Hídricos', ENERGETICA: 'Energética', AGRARIO: 'Agrário', AGRARIA: 'Agrária', FUNDIARIO: 'Fundiário',
  RODOVIARIO: 'Rodoviário', FERROVIARIO: 'Ferroviário', PORTUARIA: 'Portuária', AGROPECUARIA: 'Agropecuária',
  TECNOLOGICO: 'Tecnológico', TECNOLOGICA: 'Tecnológica', BASICA: 'Básica', BASICO: 'Básico', PRACA: 'Praça',
  CONSORCIO: 'Consórcio', SINDICO: 'Síndico', JURIDICA: 'Jurídica', JURIDICO: 'Jurídico', TRIBUTARIA: 'Tributária',
  ESTATISTICA: 'Estatística', GEOGRAFIA: 'Geografia', HEMATOLOGIA: 'Hematologia', HEMOTERAPIA: 'Hemoterapia',
  ESPIRITO: 'Espírito', SAO: 'São', JOSE: 'José', JOAO: 'João', ANTONIO: 'Antônio', SEBASTIAO: 'Sebastião', LUIS: 'Luís',
  GONCALO: 'Gonçalo', CONCEICAO: 'Conceição', SENHORA: 'Senhora', GRACAS: 'Graças', VITORIA: 'Vitória',
  // Lugares do Pará e estados vizinhos.
  PARA: 'Pará', BELEM: 'Belém', MARABA: 'Marabá', SANTAREM: 'Santarém', BRAGANCA: 'Bragança', TUCURUI: 'Tucuruí',
  CAMETA: 'Cametá', REDENCAO: 'Redenção', ORIXIMINA: 'Oriximiná', PARAGOMINAS: 'Paragominas', ULIANOPOLIS: 'Ulianópolis',
  ACARA: 'Acará', MOCAJUBA: 'Mocajuba', OBIDOS: 'Óbidos', ITUPIRANGA: 'Itupiranga', TAILANDIA: 'Tailândia',
  IGARAPE: 'Igarapé', ACU: 'Açu', TOME: 'Tomé', MIRI: 'Miri', BAIAO: 'Baião', CURUCA: 'Curuçá', GURUPA: 'Gurupá',
  MELGACO: 'Melgaço', OUREM: 'Ourém', PACAJA: 'Pacajá', CUMARU: 'Cumaru', GARRAFAO: 'Garrafão', RONDON: 'Rondon',
  MEDICILANDIA: 'Medicilândia', ALTAMIRA: 'Altamira', GOIANESIA: 'Goianésia', TRAIRAO: 'Trairão', AUGUSTO: 'Augusto',
  CORREA: 'Corrêa', BENEVIDES: 'Benevides', ANANINDEUA: 'Ananindeua', MARITUBA: 'Marituba', CASTANHAL: 'Castanhal',
  AMAPA: 'Amapá', MARANHAO: 'Maranhão', CEARA: 'Ceará', PIAUI: 'Piauí', GOIAS: 'Goiás', PARAIBA: 'Paraíba', PARANA: 'Paraná',
  RONDONIA: 'Rondônia', TOCANTINS: 'Tocantins', ROTARIO: 'Rotário',
  // Modalidades e termos de licitação, para a mesma régua servir à modalidade.
  PREGAO: 'Pregão', ELETRONICO: 'Eletrônico', ELETRONICA: 'Eletrônica', CONCORRENCIA: 'Concorrência', LICITACAO: 'Licitação',
  LEILAO: 'Leilão', DIALOGO: 'Diálogo', PRECOS: 'Preços', PRECO: 'Preço', REGISTRO: 'Registro', DISPENSA: 'Dispensa',
  INEXIGIBILIDADE: 'Inexigibilidade', CREDENCIAMENTO: 'Credenciamento', PRESENCIAL: 'Presencial', COMPETITIVO: 'Competitivo',
};

/** Grafias que chegam grudadas ou erradas na fonte e têm uma forma certa conhecida. */
const GRAFIAS: Record<string, string> = {
  DEAGUA: 'de Água',
  'S.A.': 'S.A.', 'S/A': 'S/A', LTDA: 'Ltda', LTDA_: 'Ltda.', EIRELI: 'Eireli', ME: 'ME', EPP: 'EPP',
};

/** Siglas frequentes que uma regra de vogais não pegaria. */
const SIGLAS = new Set([
  'PA', 'UF', 'SRP', 'FME', 'FMS', 'FMAS', 'CRAS', 'CREAS', 'SUS', 'PNAE', 'PEAE', 'IFPA', 'UFPA', 'UEPA', 'UFRA', 'UFOPA', 'UNIFESSPA',
  'TJPA', 'MPPA', 'TCE', 'TCM', 'TRT', 'TRE', 'TST', 'STF', 'STJ', 'INSS', 'IBGE', 'FNDE', 'SEDUC', 'SESPA', 'SEMED', 'SEMSA', 'SEMAS',
  'SEMOB', 'DAE', 'SAAE', 'CODEM', 'COSANPA', 'CELPA', 'EMATER', 'CEASA', 'SEBRAE', 'SENAI', 'SENAC', 'SESI', 'SESC', 'SEST', 'SENAT',
  'EBSERH', 'FUNAI', 'IBAMA', 'ICMBIO', 'DNIT', 'DER', 'DETRAN', 'PRF', 'PF', 'PM', 'CBM', 'CBMPA', 'PMPA', 'PCPA', 'SEGUP', 'SEFA',
  'SEPLAD', 'SEAD', 'HEMOPA', 'EGOV', 'SCFV', 'CAPS', 'UPA', 'UBS', 'SAMU', 'NASF', 'CEO', 'HRBA', 'HGE', 'ONG', 'CNPJ', 'CPF',
  'FUNDEB', 'FUNDEF', 'FPM', 'ICMS', 'IPTU', 'ISS', 'IPVA', 'IR', 'INCRA', 'ITERPA', 'IDEFLOR', 'SEMMA', 'SEMAD', 'SEMUS', 'SEMEC',
]);

const semAcento = (t: string): string => t.normalize('NFD').replace(/\p{Mn}/gu, '');

const capitalizar = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

/** Uma palavra (sem pontuação) na grafia certa. `ehInicio`: primeira palavra da parte, sempre em maiúscula. */
function palavraLegivel(palavra: string, ehInicio: boolean, anterior: string, ehUltima: boolean): string {
  if (!palavra) return palavra;
  if (/\d/.test(palavra)) return palavra;
  const chave = semAcento(palavra).toUpperCase();
  if (GRAFIAS[chave]) return GRAFIAS[chave];
  const minuscula = chave.toLowerCase();
  if (chave === 'PARA') {
    // "MUNICIPIO DE RONDON DO PARA", "ESTADO DO PARA" → Pará; "FUNDO PARA A INFANCIA" → para.
    const anteriorChave = semAcento(anterior).toUpperCase();
    if (anteriorChave === 'DO' || ehUltima) return 'Pará';
    return ehInicio ? 'Para' : 'para';
  }
  if (CONECTIVOS.has(minuscula) && !ehInicio) return minuscula;
  if (ACENTUADAS[chave]) return ACENTUADAS[chave];
  if (SIGLAS.has(chave)) return chave;
  if (chave.length <= 2) return chave;
  if (!/[AEIOU]/.test(chave)) return chave;
  if (palavra.includes('-')) return palavra.split('-').map((p, i) => palavraLegivel(p, i === 0 ? ehInicio : true, '', false)).join('-');
  return capitalizar(palavra);
}

/**
 * O nome do órgão na norma da língua. Só transforma o que vem todo em caixa
 * alta; nome em caixa mista já foi escrito por gente e passa como está.
 */
export function nomeDeOrgaoLegivel(nome: string | null | undefined): string {
  const t = String(nome ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t !== t.toUpperCase()) return t;

  // As partes separadas por travessão ou hífen solto ("… DO PARÁ – HEMOPA"):
  // a última, quando é uma palavra só, é sigla e fica como veio.
  const partes = t.split(/\s+[–—-]\s+/);
  const saida = partes.map((parte, indiceParte) => {
    const palavras = parte.split(' ');
    if (indiceParte === partes.length - 1 && indiceParte > 0 && palavras.length === 1) return parte;
    return palavras.map((bruta, i) => {
      // Pontuação de borda fica onde está: "SAUDE," → "Saúde,".
      const m = bruta.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
      const [, antes = '', miolo = bruta, depois = ''] = m ?? [];
      const anterior = i > 0 ? palavras[i - 1].replace(/[^\p{L}\p{N}]/gu, '') : '';
      return antes + palavraLegivel(miolo, i === 0, anterior, i === palavras.length - 1) + depois;
    }).join(' ');
  });
  return saida.join(' – ');
}
