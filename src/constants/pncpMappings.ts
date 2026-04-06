/**
 * Mapeamentos PNCP — traduzem labels da UI para códigos da API
 */

export const MODALIDADE_PNCP: Record<string, number> = {
  "Todos": 0,
  "Leilão Eletrônico": 1,
  "Diálogo Competitivo": 2,
  "Concurso": 3,
  "Concorrência Eletrônica": 4,
  "Concorrência Presencial": 5,
  "Pregão Eletrônico": 6,
  "Pregão Presencial": 7,
  "Dispensa de Licitação": 8,
  "Inexigibilidade": 9,
  "Manifestação de Interesse": 10,
  "Pré-qualificação": 11,
  "Credenciamento": 12,
  "Leilão Presencial": 13,
};

export const ESFERA_PNCP: Record<string, string> = {
  "Todos": "",
  "Federal": "F",
  "Estadual": "E",
  "Municipal": "M",
  "Distrital": "D",
};

export const INSTRUMENTO_PNCP: Record<string, number> = {
  "Todos": 0,
  "Edital": 1,
  "Aviso": 2,
};

// Códigos IBGE dos principais municípios por UF
export const MUNICIPIO_IBGE: Record<string, string> = {
  // Pará
  "Belém": "1501402",
  "Ananindeua": "1500800",
  "Santarém": "1506807",
  "Marabá": "1504208",
  "Castanhal": "1502400",
  "Parauapebas": "1505536",
  "Altamira": "1500602",
  "Itaituba": "1503606",
  "Abaetetuba": "1500107",
  "Cametá": "1502103",
  "Barcarena": "1501303",
  "Paragominas": "1505502",
  "Tucuruí": "1508100",
  "Terra Santa": "1507979",
  "Vigia de Nazaré": "1508209",
  "Breves": "1501808",
  "Capanema": "1502202",
  "Redenção": "1506138",
  "Bragança": "1501709",
  "Tomé-Açu": "1508001",
  // São Paulo
  "São Paulo": "3550308",
  "Campinas": "3509502",
  "Guarulhos": "3518800",
  "Santos": "3548500",
  "Ribeirão Preto": "3543402",
  // Rio de Janeiro
  "Rio de Janeiro": "3304557",
  "Niterói": "3303302",
  "Duque de Caxias": "3301702",
  // Minas Gerais
  "Belo Horizonte": "3106200",
  "Uberlândia": "3170206",
  // Demais capitais
  "Fortaleza": "2304400",
  "Salvador": "2927408",
  "Manaus": "1302603",
  "Curitiba": "4106902",
  "Recife": "2611606",
  "Porto Alegre": "4314902",
  "Goiânia": "5208707",
  "Brasília": "5300108",
  "Maceió": "2704302",
  "São Luís": "2111300",
  "Natal": "2408102",
  "Teresina": "2211001",
  "Campo Grande": "5002704",
  "Cuiabá": "5103403",
  "Macapá": "1600303",
  "Porto Velho": "1100205",
  "Rio Branco": "1200401",
  "Boa Vista": "1400100",
  "Palmas": "1721000",
  "Aracaju": "2800308",
  "João Pessoa": "2507507",
  "Vitória": "3205309",
  "Florianópolis": "4205407",
};

export const PNCP_BASE_URL = "https://pncp.gov.br/api/consulta/v1";
