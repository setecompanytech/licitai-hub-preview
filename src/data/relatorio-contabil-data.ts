// ─────────────────────────────────────────────
// Dados do Relatório Contábil — Simulações LicitaIA
// ─────────────────────────────────────────────

export interface CenarioClientes {
  clientes: number;
  label: string;
  distribuicao: { plano: string; pct: number; qtd: number; preco: number; subtotal: number }[];
  receitaSaaS: number;
  receitaCR: number;
  receitaBruta: number;
  equipe: number;
  custoInfra: number;
  custoEquipe: number;
  custoOperacional: number;
  totalCustos: number;
  ebitda: number;
  inadimplencia: number;
  reserva: number;
  lucroLiquido: number;
  margemLiquida: number;
  lucroAnual: number;
  custoCliente: number;
  receitaCliente: number;
}

export const cenarios: CenarioClientes[] = [
  {
    clientes: 20, label: '20 clientes',
    distribuicao: [
      { plano: 'Básico', pct: 50, qtd: 10, preco: 197, subtotal: 1970 },
      { plano: 'Profissional', pct: 35, qtd: 7, preco: 497, subtotal: 3479 },
      { plano: 'Enterprise', pct: 15, qtd: 3, preco: 997, subtotal: 2991 },
    ],
    receitaSaaS: 8440, receitaCR: 0, receitaBruta: 8440,
    equipe: 0, custoInfra: 364, custoEquipe: 0, custoOperacional: 1010, totalCustos: 1374,
    ebitda: 5688, inadimplencia: 422, reserva: 253, lucroLiquido: 5013,
    margemLiquida: 59.4, lucroAnual: 60150, custoCliente: 68.7, receitaCliente: 422,
  },
  {
    clientes: 50, label: '50 clientes',
    distribuicao: [
      { plano: 'Básico', pct: 50, qtd: 25, preco: 197, subtotal: 4925 },
      { plano: 'Profissional', pct: 35, qtd: 18, preco: 497, subtotal: 8946 },
      { plano: 'Enterprise', pct: 15, qtd: 7, preco: 997, subtotal: 6979 },
    ],
    receitaSaaS: 20850, receitaCR: 0, receitaBruta: 20850,
    equipe: 1, custoInfra: 654, custoEquipe: 2500, custoOperacional: 1750, totalCustos: 4904,
    ebitda: 12544, inadimplencia: 1043, reserva: 626, lucroLiquido: 10873,
    margemLiquida: 52.2, lucroAnual: 130478, custoCliente: 98.08, receitaCliente: 417,
  },
  {
    clientes: 500, label: '500 clientes',
    distribuicao: [
      { plano: 'Básico', pct: 50, qtd: 250, preco: 197, subtotal: 49250 },
      { plano: 'Profissional', pct: 35, qtd: 175, preco: 497, subtotal: 86975 },
      { plano: 'Enterprise', pct: 15, qtd: 75, preco: 997, subtotal: 74775 },
    ],
    receitaSaaS: 211000, receitaCR: 67500, receitaBruta: 278500,
    equipe: 8, custoInfra: 2349, custoEquipe: 33000, custoOperacional: 10800, totalCustos: 46149,
    ebitda: 180360, inadimplencia: 13925, reserva: 8355, lucroLiquido: 158080,
    margemLiquida: 56.76, lucroAnual: 1896960, custoCliente: 92.3, receitaCliente: 557,
  },
  {
    clientes: 1000, label: '1.000 clientes',
    distribuicao: [
      { plano: 'Básico', pct: 50, qtd: 500, preco: 197, subtotal: 98500 },
      { plano: 'Profissional', pct: 35, qtd: 350, preco: 497, subtotal: 173950 },
      { plano: 'Enterprise', pct: 15, qtd: 150, preco: 997, subtotal: 149550 },
    ],
    receitaSaaS: 422000, receitaCR: 135000, receitaBruta: 557000,
    equipe: 15, custoInfra: 4649, custoEquipe: 77000, custoOperacional: 28000, totalCustos: 109649,
    ebitda: 340544, inadimplencia: 27850, reserva: 16710, lucroLiquido: 295984,
    margemLiquida: 53.14, lucroAnual: 3551808, custoCliente: 109.65, receitaCliente: 557,
  },
];

// ─────────────────────────────────────────────
// Regimes tributários comparativos
// ─────────────────────────────────────────────

export interface RegimeTributario {
  nome: string;
  faixas: { faixa: string; aliquota: number; deducao: number }[];
  cor: string;
}

export const regimesTributarios: RegimeTributario[] = [
  {
    nome: 'Simples Nacional',
    cor: 'hsl(142, 71%, 45%)',
    faixas: [
      { faixa: 'Até 180k', aliquota: 6.0, deducao: 0 },
      { faixa: '180k–360k', aliquota: 11.2, deducao: 9360 },
      { faixa: '360k–720k', aliquota: 13.5, deducao: 17640 },
      { faixa: '720k–1.8M', aliquota: 16.0, deducao: 35640 },
      { faixa: '1.8M–3.6M', aliquota: 21.0, deducao: 125640 },
      { faixa: '3.6M–4.8M', aliquota: 33.0, deducao: 648000 },
    ],
  },
  {
    nome: 'Lucro Presumido',
    cor: 'hsl(210, 100%, 40%)',
    faixas: [
      { faixa: 'ISS', aliquota: 5.0, deducao: 0 },
      { faixa: 'PIS', aliquota: 0.65, deducao: 0 },
      { faixa: 'COFINS', aliquota: 3.0, deducao: 0 },
      { faixa: 'IRPJ (32%)', aliquota: 4.8, deducao: 0 },
      { faixa: 'CSLL (32%)', aliquota: 2.88, deducao: 0 },
      { faixa: 'IRPJ adic.', aliquota: 2.5, deducao: 0 },
    ],
  },
  {
    nome: 'Lucro Real',
    cor: 'hsl(280, 60%, 50%)',
    faixas: [
      { faixa: 'ISS', aliquota: 5.0, deducao: 0 },
      { faixa: 'PIS', aliquota: 1.65, deducao: 0 },
      { faixa: 'COFINS', aliquota: 7.6, deducao: 0 },
      { faixa: 'IRPJ (lucro)', aliquota: 15.0, deducao: 0 },
      { faixa: 'CSLL (lucro)', aliquota: 9.0, deducao: 0 },
      { faixa: 'Adic. IRPJ', aliquota: 10.0, deducao: 0 },
    ],
  },
];

// Carga tributária efetiva simulada por cenário e regime
export interface CargaTributariaEfetiva {
  clientes: number;
  simplesNacional: number;
  lucroPresumido: number;
  lucroReal: number;
}

export const cargaEfetiva: CargaTributariaEfetiva[] = [
  { clientes: 20, simplesNacional: 6.0, lucroPresumido: 16.33, lucroReal: 22.5 },
  { clientes: 50, simplesNacional: 11.2, lucroPresumido: 16.33, lucroReal: 19.8 },
  { clientes: 500, simplesNacional: 0, lucroPresumido: 18.67, lucroReal: 16.2 },
  { clientes: 1000, simplesNacional: 0, lucroPresumido: 19.17, lucroReal: 15.5 },
];

// ─────────────────────────────────────────────
// Mercado Regional Pará
// ─────────────────────────────────────────────
export const mercadoPara = {
  municipios: 144,
  volumeAnual: 'R$ 15–20 bi',
  empresasAtivas: 3200,
  penetracaoDigital: 18,
  polos: ['Belém', 'Ananindeua', 'Marabá', 'Santarém', 'Parauapebas', 'Castanhal'],
  concorrentes: [
    { nome: 'Consultorias manuais', preco: '500–2.000', penetracao: 60 },
    { nome: 'Sistemas básicos', preco: '99–299', penetracao: 25 },
    { nome: 'LicitaIA', preco: '147–997', penetracao: 0.5 },
  ],
};

// ─────────────────────────────────────────────
// DRE detalhada por regime tributário (cenário 500)
// ─────────────────────────────────────────────
export interface DreLine {
  item: string;
  valor: number;
  pct: number;
  grupo: 'receita' | 'tributo' | 'custo' | 'resultado';
}

export function buildDre(cenario: CenarioClientes, regime: 'simples' | 'presumido' | 'real'): DreLine[] {
  const rb = cenario.receitaBruta;
  let tributos: { item: string; valor: number }[] = [];

  if (regime === 'simples') {
    const aliq = rb * 12 <= 180000 ? 0.06 : rb * 12 <= 360000 ? 0.112 : rb * 12 <= 720000 ? 0.135 : rb * 12 <= 1800000 ? 0.16 : 0.21;
    tributos = [{ item: 'DAS (Simples Nacional)', valor: rb * aliq }];
  } else if (regime === 'presumido') {
    tributos = [
      { item: 'ISS (5%)', valor: rb * 0.05 },
      { item: 'PIS (0,65%)', valor: rb * 0.0065 },
      { item: 'COFINS (3%)', valor: rb * 0.03 },
      { item: 'IRPJ (15% s/ 32%)', valor: rb * 0.048 },
      { item: 'CSLL (9% s/ 32%)', valor: rb * 0.0288 },
      { item: 'IRPJ Adicional', valor: Math.max(0, (rb * 0.32 - 20000) * 0.10) },
    ];
  } else {
    const lucroBase = rb - cenario.totalCustos;
    tributos = [
      { item: 'ISS (5%)', valor: rb * 0.05 },
      { item: 'PIS (1,65%)', valor: rb * 0.0165 },
      { item: 'COFINS (7,6%)', valor: rb * 0.076 },
      { item: 'IRPJ (15% s/ lucro)', valor: lucroBase * 0.15 },
      { item: 'CSLL (9% s/ lucro)', valor: lucroBase * 0.09 },
      { item: 'IRPJ Adicional', valor: Math.max(0, (lucroBase - 20000) * 0.10) },
    ];
  }

  const totalTributos = tributos.reduce((s, t) => s + t.valor, 0);
  const lucro = rb - totalTributos - cenario.totalCustos - cenario.inadimplencia - cenario.reserva;

  return [
    { item: 'Receita Bruta', valor: rb, pct: 100, grupo: 'receita' },
    ...tributos.map(t => ({ item: t.item, valor: -t.valor, pct: (t.valor / rb) * 100, grupo: 'tributo' as const })),
    { item: 'Total Tributos', valor: -totalTributos, pct: (totalTributos / rb) * 100, grupo: 'tributo' },
    { item: 'Infraestrutura', valor: -cenario.custoInfra, pct: (cenario.custoInfra / rb) * 100, grupo: 'custo' },
    { item: 'Equipe', valor: -cenario.custoEquipe, pct: (cenario.custoEquipe / rb) * 100, grupo: 'custo' },
    { item: 'Operacional', valor: -cenario.custoOperacional, pct: (cenario.custoOperacional / rb) * 100, grupo: 'custo' },
    { item: 'Inadimplência (5%)', valor: -cenario.inadimplencia, pct: 5, grupo: 'custo' },
    { item: 'Reserva técnica (3%)', valor: -cenario.reserva, pct: 3, grupo: 'custo' },
    { item: 'Lucro Líquido', valor: lucro, pct: (lucro / rb) * 100, grupo: 'resultado' },
  ];
}
