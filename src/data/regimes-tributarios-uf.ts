/**
 * Base de Inteligência Tributária por UF
 * 
 * Fonte: RICMS de cada estado, Convênios CONFAZ, Decretos Estaduais
 * Atualizado: 2025
 * 
 * Tratamentos tributários do ICMS por categoria de produto/serviço:
 * - ISENTO: Não há incidência de ICMS
 * - ST: Substituição Tributária (ICMS retido na fonte pelo substituto)
 * - REDUCAO_BC: Redução de Base de Cálculo (alíquota efetiva menor)
 * - DIFERIDO: Diferimento (pagamento postergado na cadeia)
 * - ALIQUOTA_CHEIA: Alíquota interna padrão do estado
 * - ALIQUOTA_ESPECIAL: Alíquota diferenciada (superior ou inferior à padrão)
 */

export type TratamentoICMS = 
  | 'ISENTO'
  | 'ST'
  | 'REDUCAO_BC'
  | 'DIFERIDO'
  | 'ALIQUOTA_CHEIA'
  | 'ALIQUOTA_ESPECIAL';

export type CategoriaFiscal =
  | 'cesta_basica'
  | 'medicamentos'
  | 'informatica'
  | 'combustiveis'
  | 'veiculos'
  | 'bebidas'
  | 'cigarros'
  | 'materiais_construcao'
  | 'eletrodomesticos'
  | 'cosmeticos'
  | 'autopecas'
  | 'alimentos_industrializados'
  | 'hortifruticolas'
  | 'energia_eletrica'
  | 'telecomunicacoes'
  | 'material_escolar'
  | 'equipamentos_hospitalares'
  | 'insumos_agropecuarios'
  | 'material_limpeza'
  | 'mobiliario'
  | 'equipamentos_seguranca'
  | 'vestuario'
  | 'servicos_engenharia'
  | 'servicos_ti'
  | 'servicos_limpeza_conservacao'
  | 'servicos_vigilancia'
  | 'servicos_manutencao';

export interface RegraTributariaUF {
  categoria: CategoriaFiscal;
  tratamento: TratamentoICMS;
  aliquota_efetiva: number; // % efetivo após redução/isenção
  aliquota_st_mva?: number; // MVA para ST (%)
  ncm_exemplos: string[]; // NCMs de referência
  descricao: string;
  fundamentacao: string; // Base legal
  observacoes?: string;
  produtos_exemplos: string[];
}

export interface UFTributaria {
  uf: string;
  nome: string;
  aliquota_padrao: number;
  aliquota_interestadual_sul_sudeste: number; // 12%
  aliquota_interestadual_demais: number; // 7%
  fundo_combate_pobreza: number; // FECP/FCP
  regras: RegraTributariaUF[];
  legislacao_base: string;
  ultima_atualizacao: string;
}

// ── PARÁ ──
const PA_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['1006.30', '0713.33', '0407.21', '0407.11'],
    descricao: 'Arroz, feijão e ovos na 1ª operação (saída do produtor)',
    fundamentacao: 'Decreto nº 2.931/2023 (RICMS/PA) — Art. 1º, I',
    produtos_exemplos: ['Arroz beneficiado', 'Feijão em grãos', 'Ovos de galinha'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709', '0803', '0804', '0805'],
    descricao: 'Hortifrutícolas em estado natural na 1ª operação',
    fundamentacao: 'RICMS/PA, Anexo I — Convênio ICMS 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras', 'Tubérculos in natura'],
  },
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 3,
    ncm_exemplos: ['0201', '0202', '0203', '0204', '0207', '0401', '0402', '1701', '0901', '1507', '1516', '1101', '1106'],
    descricao: 'Itens da cesta básica: carnes, leite, açúcar, café, óleos, farinhas',
    fundamentacao: 'Decreto nº 2.931/2023 — Art. 2º; Decreto nº 4.676/2001 (RICMS/PA), Anexo II',
    observacoes: '55 produtos com carga tributária reduzida conforme SEFA/PA',
    produtos_exemplos: [
      'Carnes frescas/congeladas', 'Leite UHT/em pó', 'Açúcar refinado/cristal',
      'Café torrado e moído', 'Óleo de soja', 'Margarina', 'Farinha de mandioca',
      'Fubá', 'Chocolate em pó',
    ],
  },
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 1.8,
    ncm_exemplos: ['0201', '0202', '0206'],
    descricao: 'Derivados do abate bovino em estabelecimentos com RTD',
    fundamentacao: 'Decreto nº 2.931/2023 — Art. 3º (Regime Tributário Diferenciado)',
    produtos_exemplos: ['Carnes bovinas em RTD', 'Subprodutos do abate bovino'],
  },
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 1,
    ncm_exemplos: ['0201', '0202', '1602'],
    descricao: 'Carnes processadas em indústrias de verticalização no PA',
    fundamentacao: 'Decreto nº 2.931/2023 — Art. 4º (verticalização da carne)',
    produtos_exemplos: ['Carne desossada', 'Carne moída', 'Carne temperada/defumada'],
  },
  {
    categoria: 'material_limpeza',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 3,
    ncm_exemplos: ['3401.19', '3402', '2207', '2828.90'],
    descricao: 'Produtos de higiene e limpeza da cesta básica',
    fundamentacao: 'Decreto nº 2.931/2023 — Anexo; RICMS/PA',
    produtos_exemplos: ['Sabão em barra', 'Detergente', 'Álcool em gel 70%', 'Água sanitária', 'Hipoclorito de sódio'],
  },
  {
    categoria: 'medicamentos',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['3003', '3004', '3006', '9018', '9019'],
    descricao: 'Medicamentos e produtos farmacêuticos',
    fundamentacao: 'Convênio ICMS 234/2017; RICMS/PA, Anexo II',
    produtos_exemplos: ['Medicamentos genéricos', 'Medicamentos de referência'],
  },
  {
    categoria: 'equipamentos_hospitalares',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['9018', '9019', '9021', '9022'],
    descricao: 'Equipamentos e insumos médico-hospitalares (órgãos públicos)',
    fundamentacao: 'Convênio ICMS 01/99; RICMS/PA, Anexo I',
    observacoes: 'Isenção condicionada ao destino: órgão público ou entidade assistencial',
    produtos_exemplos: ['Equipamentos cirúrgicos', 'Aparelhos de diagnóstico', 'Próteses'],
  },
  {
    categoria: 'informatica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 12,
    ncm_exemplos: ['8471', '8473', '8443.31', '8528.51'],
    descricao: 'Produtos de informática e automação',
    fundamentacao: 'Convênio ICMS 52/91; RICMS/PA, Anexo II',
    observacoes: 'Benefício vinculado à Lei Federal de Informática (Lei 8.248/91)',
    produtos_exemplos: ['Computadores', 'Notebooks', 'Impressoras', 'Monitores'],
  },
  {
    categoria: 'combustiveis',
    tratamento: 'ST',
    aliquota_efetiva: 25,
    aliquota_st_mva: 30,
    ncm_exemplos: ['2710.12', '2710.19', '2711.19'],
    descricao: 'Combustíveis e lubrificantes — ICMS monofásico',
    fundamentacao: 'Convênio ICMS 110/07; EC 33/2001; LC 192/2022',
    produtos_exemplos: ['Gasolina', 'Diesel', 'Etanol', 'GLP'],
  },
  {
    categoria: 'bebidas',
    tratamento: 'ST',
    aliquota_efetiva: 25,
    aliquota_st_mva: 40,
    ncm_exemplos: ['2203', '2204', '2205', '2206', '2208'],
    descricao: 'Bebidas alcoólicas',
    fundamentacao: 'Protocolo ICMS 11/91; RICMS/PA, Anexo V',
    produtos_exemplos: ['Cerveja', 'Vinho', 'Destilados'],
  },
  {
    categoria: 'bebidas',
    tratamento: 'ST',
    aliquota_efetiva: 19,
    aliquota_st_mva: 40,
    ncm_exemplos: ['2201', '2202'],
    descricao: 'Águas e refrigerantes',
    fundamentacao: 'Protocolo ICMS 11/91; RICMS/PA, Anexo V',
    produtos_exemplos: ['Água mineral', 'Refrigerantes', 'Sucos industrializados'],
  },
  {
    categoria: 'cigarros',
    tratamento: 'ST',
    aliquota_efetiva: 30,
    ncm_exemplos: ['2402'],
    descricao: 'Cigarros e produtos do fumo',
    fundamentacao: 'Convênio ICMS 111/17; RICMS/PA',
    produtos_exemplos: ['Cigarros', 'Charutos', 'Tabaco'],
  },
  {
    categoria: 'materiais_construcao',
    tratamento: 'ST',
    aliquota_efetiva: 19,
    aliquota_st_mva: 37,
    ncm_exemplos: ['2523', '6810', '7214', '7306', '7308', '7610'],
    descricao: 'Materiais de construção',
    fundamentacao: 'Protocolo ICMS 196/09; RICMS/PA, Anexo V',
    produtos_exemplos: ['Cimento', 'Vergalhão', 'Tubos PVC', 'Tintas', 'Telhas'],
  },
  {
    categoria: 'autopecas',
    tratamento: 'ST',
    aliquota_efetiva: 19,
    aliquota_st_mva: 59.60,
    ncm_exemplos: ['8708', '4011', '7007', '8507', '8511'],
    descricao: 'Autopeças e acessórios para veículos',
    fundamentacao: 'Convênio ICMS 142/18; RICMS/PA, Anexo V',
    produtos_exemplos: ['Pneus', 'Baterias', 'Filtros', 'Pastilhas de freio'],
  },
  {
    categoria: 'insumos_agropecuarios',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['3102', '3103', '3104', '3105', '0602'],
    descricao: 'Insumos agropecuários: sementes, fertilizantes, defensivos',
    fundamentacao: 'Convênio ICMS 100/97; RICMS/PA, Anexo I',
    produtos_exemplos: ['Fertilizantes', 'Sementes certificadas', 'Defensivos agrícolas', 'Mudas'],
  },
  {
    categoria: 'energia_eletrica',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 25,
    ncm_exemplos: ['2716.00'],
    descricao: 'Energia elétrica (exceto consumo até 150 kWh — isento para baixa renda)',
    fundamentacao: 'RICMS/PA, Art. 12, VII',
    produtos_exemplos: ['Energia elétrica residencial acima de 150 kWh', 'Energia industrial'],
  },
  {
    categoria: 'telecomunicacoes',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 25,
    ncm_exemplos: [],
    descricao: 'Serviços de telecomunicações',
    fundamentacao: 'RICMS/PA, Art. 12, VIII; Convênio ICMS 69/98',
    produtos_exemplos: ['Telefonia fixa/móvel', 'Internet banda larga'],
  },
];

// ── SÃO PAULO ──
const SP_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0203', '0207', '0401', '1006.30', '0713.33', '1701', '1507', '1101'],
    descricao: 'Cesta básica — alíquota reduzida de 7%',
    fundamentacao: 'Decreto 65.255/2020; RICMS/SP, Anexo II, Art. 39',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite', 'Açúcar', 'Óleo de soja', 'Farinha de trigo'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704', '0705', '0803', '0804', '0805'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/SP, Anexo I, Art. 36; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
  {
    categoria: 'medicamentos',
    tratamento: 'ST',
    aliquota_efetiva: 18,
    aliquota_st_mva: 38.24,
    ncm_exemplos: ['3003', '3004'],
    descricao: 'Medicamentos — Substituição Tributária',
    fundamentacao: 'RICMS/SP, Anexo IV; Convênio ICMS 234/17',
    produtos_exemplos: ['Medicamentos genéricos', 'Medicamentos de referência'],
  },
  {
    categoria: 'informatica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 12,
    ncm_exemplos: ['8471', '8473', '8443.31'],
    descricao: 'Produtos de informática com PPB',
    fundamentacao: 'RICMS/SP, Anexo II, Art. 26; Lei Federal 8.248/91',
    produtos_exemplos: ['Computadores', 'Notebooks', 'Impressoras', 'Servidores'],
  },
  {
    categoria: 'combustiveis',
    tratamento: 'ST',
    aliquota_efetiva: 25,
    aliquota_st_mva: 53.83,
    ncm_exemplos: ['2710.12', '2710.19'],
    descricao: 'Combustíveis — monofásico',
    fundamentacao: 'Convênio ICMS 110/07; LC 192/2022',
    produtos_exemplos: ['Gasolina', 'Diesel', 'Etanol'],
  },
  {
    categoria: 'materiais_construcao',
    tratamento: 'ALIQUOTA_CHEIA',
    aliquota_efetiva: 18,
    ncm_exemplos: ['2523', '6810', '7214', '7306'],
    descricao: 'Materiais de construção — SP retirou da ST em 2024',
    fundamentacao: 'Decreto 68.492/2024; RICMS/SP',
    observacoes: 'SP excluiu diversos segmentos da ST desde 2024 (materiais construção, autopeças, eletroeletrônicos)',
    produtos_exemplos: ['Cimento', 'Vergalhão', 'Tubos', 'Tintas'],
  },
  {
    categoria: 'eletrodomesticos',
    tratamento: 'ALIQUOTA_CHEIA',
    aliquota_efetiva: 18,
    ncm_exemplos: ['8418', '8450', '8451', '8516'],
    descricao: 'Eletrodomésticos — retirados da ST em SP',
    fundamentacao: 'Decreto 68.492/2024; RICMS/SP',
    produtos_exemplos: ['Geladeira', 'Máquina de lavar', 'Micro-ondas'],
  },
  {
    categoria: 'bebidas',
    tratamento: 'ST',
    aliquota_efetiva: 25,
    aliquota_st_mva: 140,
    ncm_exemplos: ['2203', '2204', '2208'],
    descricao: 'Bebidas alcoólicas',
    fundamentacao: 'RICMS/SP, Anexo IV',
    produtos_exemplos: ['Cerveja', 'Vinho', 'Cachaça', 'Whisky'],
  },
  {
    categoria: 'energia_eletrica',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 25,
    ncm_exemplos: ['2716.00'],
    descricao: 'Energia elétrica acima de 200 kWh',
    fundamentacao: 'RICMS/SP, Art. 54, §2º',
    produtos_exemplos: ['Energia elétrica residencial/comercial/industrial'],
  },
];

// ── MINAS GERAIS ──
const MG_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33', '1701', '1507'],
    descricao: 'Cesta básica — carga tributária de 7%',
    fundamentacao: 'RICMS/MG, Anexo IV, Item 19; Decreto 48.589/2023',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite', 'Açúcar', 'Óleo de soja'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704', '0803', '0804'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/MG, Anexo I, Item 41',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
  {
    categoria: 'medicamentos',
    tratamento: 'ST',
    aliquota_efetiva: 18,
    aliquota_st_mva: 33,
    ncm_exemplos: ['3003', '3004'],
    descricao: 'Medicamentos — Substituição Tributária',
    fundamentacao: 'RICMS/MG, Anexo XV; Convênio ICMS 234/17',
    produtos_exemplos: ['Medicamentos'],
  },
  {
    categoria: 'informatica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 12,
    ncm_exemplos: ['8471', '8473'],
    descricao: 'Informática e automação com PPB',
    fundamentacao: 'RICMS/MG, Anexo IV; Lei 8.248/91',
    produtos_exemplos: ['Computadores', 'Periféricos'],
  },
  {
    categoria: 'insumos_agropecuarios',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['3102', '3103', '3104', '3105'],
    descricao: 'Insumos agropecuários',
    fundamentacao: 'Convênio ICMS 100/97; RICMS/MG, Anexo I',
    produtos_exemplos: ['Fertilizantes', 'Sementes', 'Defensivos'],
  },
];

// ── RIO DE JANEIRO ──
const RJ_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33', '1701'],
    descricao: 'Cesta básica — carga tributária de 7%',
    fundamentacao: 'RICMS/RJ, Livro IV, Art. 4º; Decreto 27.427/2000',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite', 'Açúcar'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/RJ, Livro I, Art. 40; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
  {
    categoria: 'energia_eletrica',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 32,
    ncm_exemplos: ['2716.00'],
    descricao: 'Energia elétrica (com FECP de 2%)',
    fundamentacao: 'RICMS/RJ; Lei 4.056/2002 (FECP)',
    observacoes: 'RJ aplica adicional de 2% do FECP em energia e telecomunicações',
    produtos_exemplos: ['Energia elétrica'],
  },
];

// ── RIO GRANDE DO SUL ──
const RS_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33', '1701'],
    descricao: 'Cesta básica — carga tributária de 7%',
    fundamentacao: 'RICMS/RS, Livro I, Art. 23, XII; Decreto 37.699/97',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite', 'Açúcar'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/RS, Livro I, Art. 9º, XXII; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
  {
    categoria: 'informatica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 12,
    ncm_exemplos: ['8471', '8473'],
    descricao: 'Informática e automação',
    fundamentacao: 'RICMS/RS; Convênio ICMS 52/91',
    produtos_exemplos: ['Computadores', 'Notebooks', 'Servidores'],
  },
];

// ── BAHIA ──
const BA_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33'],
    descricao: 'Cesta básica',
    fundamentacao: 'RICMS/BA, Art. 85; Decreto 13.780/2012',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703', '0704'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/BA; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
];

// ── PARANÁ ──
const PR_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33', '1701'],
    descricao: 'Cesta básica',
    fundamentacao: 'RICMS/PR, Art. 14, §4º; Decreto 7.871/2017',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite', 'Açúcar'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/PR; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
  {
    categoria: 'informatica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 12,
    ncm_exemplos: ['8471', '8473'],
    descricao: 'Informática com PPB',
    fundamentacao: 'RICMS/PR; Convênio ICMS 52/91',
    produtos_exemplos: ['Computadores', 'Notebooks'],
  },
];

// ── SANTA CATARINA ──
const SC_REGRAS: RegraTributariaUF[] = [
  {
    categoria: 'cesta_basica',
    tratamento: 'REDUCAO_BC',
    aliquota_efetiva: 7,
    ncm_exemplos: ['0201', '0202', '0401', '1006.30', '0713.33'],
    descricao: 'Cesta básica — carga de 7%',
    fundamentacao: 'RICMS/SC, Anexo 2, Art. 11; Decreto 2.870/2001',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Leite'],
  },
  {
    categoria: 'cesta_basica',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0201', '0202', '1006.30', '0713.33', '0401'],
    descricao: 'Cesta básica com ICMS zerado (2024+)',
    fundamentacao: 'Lei 18.673/2024 (SC); Convênio ICMS 224/23',
    observacoes: 'SC implementou ICMS zero para itens essenciais da cesta a partir de 2024',
    produtos_exemplos: ['Arroz', 'Feijão', 'Carnes', 'Ovos', 'Leite'],
  },
  {
    categoria: 'hortifruticolas',
    tratamento: 'ISENTO',
    aliquota_efetiva: 0,
    ncm_exemplos: ['0701', '0702', '0703'],
    descricao: 'Hortifrutícolas em estado natural',
    fundamentacao: 'RICMS/SC; Convênio ICM 44/75',
    produtos_exemplos: ['Frutas', 'Legumes', 'Verduras'],
  },
];

// ── Serviços (aplicável a todos os estados via ISS) ──
const SERVICOS_REGRAS_PADRAO: RegraTributariaUF[] = [
  {
    categoria: 'servicos_engenharia',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 5,
    ncm_exemplos: [],
    descricao: 'Serviços de engenharia — ISS de 2% a 5% (varia por município)',
    fundamentacao: 'LC 116/2003, Art. 7º; Lista de Serviços, Item 7',
    observacoes: 'ISS não incide sobre o material quando há discriminação na NF. ICMS pode incidir sobre o material aplicado.',
    produtos_exemplos: ['Obras de engenharia', 'Manutenção predial', 'Reformas'],
  },
  {
    categoria: 'servicos_ti',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 5,
    ncm_exemplos: [],
    descricao: 'Serviços de TI — ISS de 2% a 5%',
    fundamentacao: 'LC 116/2003, Lista de Serviços, Item 1',
    produtos_exemplos: ['Desenvolvimento de software', 'Consultoria em TI', 'Suporte técnico'],
  },
  {
    categoria: 'servicos_limpeza_conservacao',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 5,
    ncm_exemplos: [],
    descricao: 'Serviços de limpeza e conservação — ISS de 2% a 5%',
    fundamentacao: 'LC 116/2003, Lista de Serviços, Item 7.10',
    produtos_exemplos: ['Limpeza predial', 'Conservação de áreas', 'Jardinagem'],
  },
  {
    categoria: 'servicos_vigilancia',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 5,
    ncm_exemplos: [],
    descricao: 'Serviços de vigilância e segurança — ISS de 2% a 5%',
    fundamentacao: 'LC 116/2003, Lista de Serviços, Item 11',
    produtos_exemplos: ['Vigilância patrimonial', 'Segurança pessoal', 'Escolta'],
  },
  {
    categoria: 'servicos_manutencao',
    tratamento: 'ALIQUOTA_ESPECIAL',
    aliquota_efetiva: 5,
    ncm_exemplos: [],
    descricao: 'Serviços de manutenção — ISS de 2% a 5%',
    fundamentacao: 'LC 116/2003, Lista de Serviços, Item 14',
    produtos_exemplos: ['Manutenção preventiva', 'Manutenção corretiva', 'Assistência técnica'],
  },
];

// ── Mapa completo UF → Regras ──
export const UF_TRIBUTARIA: Record<string, UFTributaria> = {
  PA: {
    uf: 'PA', nome: 'Pará', aliquota_padrao: 19,
    aliquota_interestadual_sul_sudeste: 7, aliquota_interestadual_demais: 12,
    fundo_combate_pobreza: 0,
    regras: [...PA_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 4.676/2001 (RICMS/PA); Decreto nº 2.931/2023',
    ultima_atualizacao: '2025-03',
  },
  SP: {
    uf: 'SP', nome: 'São Paulo', aliquota_padrao: 18,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 0,
    regras: [...SP_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 45.490/2000 (RICMS/SP)',
    ultima_atualizacao: '2025-03',
  },
  MG: {
    uf: 'MG', nome: 'Minas Gerais', aliquota_padrao: 18,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 2,
    regras: [...MG_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 48.589/2023 (RICMS/MG)',
    ultima_atualizacao: '2025-03',
  },
  RJ: {
    uf: 'RJ', nome: 'Rio de Janeiro', aliquota_padrao: 22,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 2,
    regras: [...RJ_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 27.427/2000 (RICMS/RJ)',
    ultima_atualizacao: '2025-03',
  },
  RS: {
    uf: 'RS', nome: 'Rio Grande do Sul', aliquota_padrao: 17,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 2,
    regras: [...RS_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 37.699/97 (RICMS/RS)',
    ultima_atualizacao: '2025-03',
  },
  BA: {
    uf: 'BA', nome: 'Bahia', aliquota_padrao: 20.5,
    aliquota_interestadual_sul_sudeste: 7, aliquota_interestadual_demais: 12,
    fundo_combate_pobreza: 2,
    regras: [...BA_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 13.780/2012 (RICMS/BA)',
    ultima_atualizacao: '2025-03',
  },
  PR: {
    uf: 'PR', nome: 'Paraná', aliquota_padrao: 19.5,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 0,
    regras: [...PR_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 7.871/2017 (RICMS/PR)',
    ultima_atualizacao: '2025-03',
  },
  SC: {
    uf: 'SC', nome: 'Santa Catarina', aliquota_padrao: 17,
    aliquota_interestadual_sul_sudeste: 12, aliquota_interestadual_demais: 7,
    fundo_combate_pobreza: 0,
    regras: [...SC_REGRAS, ...SERVICOS_REGRAS_PADRAO],
    legislacao_base: 'Decreto nº 2.870/2001 (RICMS/SC)',
    ultima_atualizacao: '2025-03',
  },
};

// ── Helpers ──

/** Busca regras tributárias por UF e categoria */
export function getRegrasPorUF(uf: string): RegraTributariaUF[] {
  const data = UF_TRIBUTARIA[uf];
  if (data) return data.regras;
  // Retorna regras de serviço padrão para UFs sem dados detalhados
  return SERVICOS_REGRAS_PADRAO;
}

/** Busca regras por NCM em uma UF */
export function getRegrasPorNCM(uf: string, ncm: string): RegraTributariaUF[] {
  const regras = getRegrasPorUF(uf);
  const ncmNorm = ncm.replace(/[.\-\s]/g, '');
  return regras.filter(r =>
    r.ncm_exemplos.some(ex => {
      const exNorm = ex.replace(/[.\-\s]/g, '');
      return ncmNorm.startsWith(exNorm) || exNorm.startsWith(ncmNorm);
    })
  );
}

/** Busca regras por categoria em uma UF */
export function getRegrasPorCategoria(uf: string, categoria: CategoriaFiscal): RegraTributariaUF[] {
  return getRegrasPorUF(uf).filter(r => r.categoria === categoria);
}

/** Retorna o rótulo legível para cada tratamento ICMS */
export function getTratamentoLabel(tratamento: TratamentoICMS): { label: string; cor: string } {
  const map: Record<TratamentoICMS, { label: string; cor: string }> = {
    ISENTO: { label: 'Isento', cor: 'text-green-600 bg-green-100 border-green-200' },
    ST: { label: 'Subst. Tributária', cor: 'text-orange-600 bg-orange-100 border-orange-200' },
    REDUCAO_BC: { label: 'Redução BC', cor: 'text-blue-600 bg-blue-100 border-blue-200' },
    DIFERIDO: { label: 'Diferido', cor: 'text-purple-600 bg-purple-100 border-purple-200' },
    ALIQUOTA_CHEIA: { label: 'Alíq. Cheia', cor: 'text-red-600 bg-red-100 border-red-200' },
    ALIQUOTA_ESPECIAL: { label: 'Alíq. Especial', cor: 'text-amber-600 bg-amber-100 border-amber-200' },
  };
  return map[tratamento];
}

/** Retorna o rótulo de categoria legível */
export function getCategoriaLabel(categoria: CategoriaFiscal): string {
  const map: Record<CategoriaFiscal, string> = {
    cesta_basica: 'Cesta Básica',
    medicamentos: 'Medicamentos',
    informatica: 'Informática',
    combustiveis: 'Combustíveis',
    veiculos: 'Veículos',
    bebidas: 'Bebidas',
    cigarros: 'Cigarros/Fumo',
    materiais_construcao: 'Mat. Construção',
    eletrodomesticos: 'Eletrodomésticos',
    cosmeticos: 'Cosméticos',
    autopecas: 'Autopeças',
    alimentos_industrializados: 'Alim. Industrializados',
    hortifruticolas: 'Hortifrutícolas',
    energia_eletrica: 'Energia Elétrica',
    telecomunicacoes: 'Telecomunicações',
    material_escolar: 'Mat. Escolar',
    equipamentos_hospitalares: 'Equip. Hospitalares',
    insumos_agropecuarios: 'Insumos Agropecuários',
    material_limpeza: 'Material Limpeza',
    mobiliario: 'Mobiliário',
    equipamentos_seguranca: 'Equip. Segurança',
    vestuario: 'Vestuário',
    servicos_engenharia: 'Serviços Engenharia',
    servicos_ti: 'Serviços de TI',
    servicos_limpeza_conservacao: 'Serv. Limpeza/Conservação',
    servicos_vigilancia: 'Serv. Vigilância',
    servicos_manutencao: 'Serv. Manutenção',
  };
  return map[categoria] || categoria;
}

/** Lista todas as UFs com dados detalhados */
export function getUFsComDados(): string[] {
  return Object.keys(UF_TRIBUTARIA);
}

/** Verifica se a UF tem dados detalhados */
export function temDadosDetalhados(uf: string): boolean {
  return uf in UF_TRIBUTARIA;
}
