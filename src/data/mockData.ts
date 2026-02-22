export type Licitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: 'Pregão Eletrônico' | 'Concorrência' | 'Tomada de Preços' | 'Dispensa' | 'Inexigibilidade';
  valor: number;
  dataAbertura: string;
  dataEncerramento: string;
  status: 'monitorando' | 'analisando' | 'proposta' | 'enviada' | 'vencida' | 'perdida';
  uf: string;
  cidade: string;
  cnae: string;
  portal: string;
  relevancia: number; // 0-100
  uasg?: string;
  unidadeCompradora?: string;
};

export type Concorrente = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  vitorias: number;
  derrotas: number;
  lanceMedio: number;
  sancoes: number;
  ultimaAtividade: string;
  risco: 'baixo' | 'medio' | 'alto';
};

export const licitacoesMock: Licitacao[] = [
  {
    id: '1',
    numero: 'PE-001/2026',
    orgao: 'Prefeitura Municipal de Belém',
    objeto: 'Construção de ponte sobre o Rio Guamá - Trecho Norte',
    modalidade: 'Pregão Eletrônico',
    valor: 4500000,
    dataAbertura: '2026-02-20',
    dataEncerramento: '2026-03-05',
    status: 'analisando',
    uf: 'PA',
    cidade: 'Belém',
    cnae: '42.11-1',
    portal: 'Compras.gov.br',
    relevancia: 95,
    uasg: '925373',
    unidadeCompradora: 'Prefeitura Municipal de Belém - SEURB',
  },
  {
    id: '2',
    numero: 'CC-012/2026',
    orgao: 'Governo do Estado do Pará',
    objeto: 'Pavimentação asfáltica da rodovia PA-150 - Lote 3',
    modalidade: 'Concorrência',
    valor: 12800000,
    dataAbertura: '2026-02-25',
    dataEncerramento: '2026-03-15',
    status: 'monitorando',
    uf: 'PA',
    cidade: 'Marabá',
    cnae: '42.13-8',
    portal: 'PNCP',
    relevancia: 88,
    uasg: '926004',
    unidadeCompradora: 'SETRAN - Secretaria de Transportes',
  },
  {
    id: '3',
    numero: 'PE-045/2026',
    orgao: 'SESPA - Secretaria de Saúde do Pará',
    objeto: 'Reforma e ampliação do Hospital Regional de Tucuruí',
    modalidade: 'Pregão Eletrônico',
    valor: 7200000,
    dataAbertura: '2026-03-01',
    dataEncerramento: '2026-03-20',
    status: 'proposta',
    uf: 'PA',
    cidade: 'Tucuruí',
    cnae: '41.20-4',
    portal: 'Compras.gov.br',
    relevancia: 82,
    uasg: '926102',
    unidadeCompradora: 'SESPA - Secretaria de Saúde do Pará',
  },
  {
    id: '4',
    numero: 'TP-008/2026',
    orgao: 'DNIT - Departamento Nacional de Infraestrutura',
    objeto: 'Manutenção da BR-316 - Trecho Belém/Castanhal',
    modalidade: 'Tomada de Preços',
    valor: 3200000,
    dataAbertura: '2026-02-18',
    dataEncerramento: '2026-02-28',
    status: 'enviada',
    uf: 'PA',
    cidade: 'Castanhal',
    cnae: '42.13-8',
    portal: 'Compras.gov.br',
    relevancia: 76,
    uasg: '393003',
    unidadeCompradora: 'DNIT - Superintendência Regional PA',
  },
  {
    id: '5',
    numero: 'PE-089/2026',
    orgao: 'Prefeitura Municipal de Ananindeua',
    objeto: 'Construção de creche modelo - Bairro Coqueiro',
    modalidade: 'Pregão Eletrônico',
    valor: 1800000,
    dataAbertura: '2026-03-10',
    dataEncerramento: '2026-03-25',
    status: 'monitorando',
    uf: 'PA',
    cidade: 'Ananindeua',
    cnae: '41.20-4',
    portal: 'PNCP',
    relevancia: 70,
    uasg: '925501',
    unidadeCompradora: 'Prefeitura Municipal de Ananindeua - SEOB',
  },
  {
    id: '6',
    numero: 'DL-003/2026',
    orgao: 'UFPA - Universidade Federal do Pará',
    objeto: 'Adequação de laboratórios - Campus Guamá',
    modalidade: 'Dispensa',
    valor: 450000,
    dataAbertura: '2026-02-15',
    dataEncerramento: '2026-02-22',
    status: 'vencida',
    uf: 'PA',
    cidade: 'Belém',
    cnae: '41.20-4',
    portal: 'Compras.gov.br',
    relevancia: 65,
    uasg: '153063',
    unidadeCompradora: 'UFPA - Prefeitura do Campus',
  },
  {
    id: '7',
    numero: 'PE-112/2026',
    orgao: 'Prefeitura de Manaus',
    objeto: 'Sistema de drenagem urbana - Zona Leste',
    modalidade: 'Pregão Eletrônico',
    valor: 8900000,
    dataAbertura: '2026-03-05',
    dataEncerramento: '2026-03-20',
    status: 'monitorando',
    uf: 'AM',
    cidade: 'Manaus',
    cnae: '42.22-7',
    portal: 'PNCP',
    relevancia: 60,
    uasg: '920010',
    unidadeCompradora: 'Prefeitura Municipal de Manaus - SEMINF',
  },
  {
    id: '8',
    numero: 'CC-005/2026',
    orgao: 'SEDOP - Secretaria de Desenvolvimento',
    objeto: 'Construção do Terminal Hidroviário de Santarém',
    modalidade: 'Concorrência',
    valor: 22000000,
    dataAbertura: '2026-03-15',
    dataEncerramento: '2026-04-10',
    status: 'monitorando',
    uf: 'PA',
    cidade: 'Santarém',
    cnae: '42.91-0',
    portal: 'Compras.gov.br',
    relevancia: 92,
    uasg: '926200',
    unidadeCompradora: 'SEDOP - Secretaria de Desenvolvimento',
  },
];

export const concorrentesMock: Concorrente[] = [
  {
    id: '1',
    razaoSocial: 'Construtora Norte Ltda.',
    cnpj: '12.345.678/0001-01',
    vitorias: 23,
    derrotas: 45,
    lanceMedio: 3200000,
    sancoes: 0,
    ultimaAtividade: '2026-02-10',
    risco: 'alto',
  },
  {
    id: '2',
    razaoSocial: 'Engepará Engenharia S.A.',
    cnpj: '98.765.432/0001-02',
    vitorias: 18,
    derrotas: 30,
    lanceMedio: 4100000,
    sancoes: 1,
    ultimaAtividade: '2026-02-12',
    risco: 'medio',
  },
  {
    id: '3',
    razaoSocial: 'Amazônia Construções Eireli',
    cnpj: '11.222.333/0001-03',
    vitorias: 12,
    derrotas: 22,
    lanceMedio: 2800000,
    sancoes: 0,
    ultimaAtividade: '2026-02-08',
    risco: 'baixo',
  },
  {
    id: '4',
    razaoSocial: 'JR Infraestrutura Ltda.',
    cnpj: '44.555.666/0001-04',
    vitorias: 31,
    derrotas: 38,
    lanceMedio: 5500000,
    sancoes: 2,
    ultimaAtividade: '2026-01-28',
    risco: 'alto',
  },
  {
    id: '5',
    razaoSocial: 'Marajó Serviços de Engenharia',
    cnpj: '77.888.999/0001-05',
    vitorias: 8,
    derrotas: 15,
    lanceMedio: 1900000,
    sancoes: 0,
    ultimaAtividade: '2026-02-14',
    risco: 'baixo',
  },
];

export const kpiData = {
  licitacoesMonitoradas: 147,
  propostasEnviadas: 23,
  taxaVitoria: 34.8,
  roiMedio: 18.5,
  valorTotalGanho: 15400000,
  licitacoesHoje: 12,
};

export const chartDataMensal = [
  { mes: 'Set', vitorias: 3, derrotas: 5, propostas: 8 },
  { mes: 'Out', vitorias: 5, derrotas: 4, propostas: 9 },
  { mes: 'Nov', vitorias: 4, derrotas: 6, propostas: 10 },
  { mes: 'Dez', vitorias: 6, derrotas: 3, propostas: 9 },
  { mes: 'Jan', vitorias: 7, derrotas: 5, propostas: 12 },
  { mes: 'Fev', vitorias: 5, derrotas: 4, propostas: 9 },
];

export const chartDataValor = [
  { mes: 'Set', valor: 2400000 },
  { mes: 'Out', valor: 4100000 },
  { mes: 'Nov', valor: 3200000 },
  { mes: 'Dez', valor: 5800000 },
  { mes: 'Jan', valor: 7200000 },
  { mes: 'Fev', valor: 4500000 },
];

export const modalidadeDistribuicao = [
  { name: 'Pregão Eletrônico', value: 58, fill: 'hsl(210, 100%, 40%)' },
  { name: 'Concorrência', value: 22, fill: 'hsl(174, 72%, 40%)' },
  { name: 'Tomada de Preços', value: 12, fill: 'hsl(38, 92%, 50%)' },
  { name: 'Dispensa', value: 5, fill: 'hsl(220, 14%, 60%)' },
  { name: 'Inexigibilidade', value: 3, fill: 'hsl(142, 71%, 45%)' },
];
