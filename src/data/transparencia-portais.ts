export type TransparenciaPortal = {
  nome: string;
  sigla: string;
  url: string;
  tipo: 'estado' | 'capital';
  uf: string;
};

export const transparenciaPortais: TransparenciaPortal[] = [
  // ── Estados e Distrito Federal ──
  { nome: 'Acre', sigla: 'AC', url: 'https://transparencia.ac.gov.br/', tipo: 'estado', uf: 'AC' },
  { nome: 'Alagoas', sigla: 'AL', url: 'https://transparencia.al.gov.br/', tipo: 'estado', uf: 'AL' },
  { nome: 'Amapá', sigla: 'AP', url: 'https://www.transparencia.ap.gov.br/', tipo: 'estado', uf: 'AP' },
  { nome: 'Amazonas', sigla: 'AM', url: 'https://www.transparencia.am.gov.br/', tipo: 'estado', uf: 'AM' },
  { nome: 'Bahia', sigla: 'BA', url: 'https://www.transparencia.ba.gov.br/', tipo: 'estado', uf: 'BA' },
  { nome: 'Ceará', sigla: 'CE', url: 'https://cearatransparente.ce.gov.br/', tipo: 'estado', uf: 'CE' },
  { nome: 'Distrito Federal', sigla: 'DF', url: 'https://www.transparencia.df.gov.br/', tipo: 'estado', uf: 'DF' },
  { nome: 'Espírito Santo', sigla: 'ES', url: 'https://transparencia.es.gov.br/', tipo: 'estado', uf: 'ES' },
  { nome: 'Goiás', sigla: 'GO', url: 'https://transparencia.go.gov.br/', tipo: 'estado', uf: 'GO' },
  { nome: 'Maranhão', sigla: 'MA', url: 'https://transparencia.ma.gov.br/', tipo: 'estado', uf: 'MA' },
  { nome: 'Mato Grosso', sigla: 'MT', url: 'https://www.transparencia.mt.gov.br/', tipo: 'estado', uf: 'MT' },
  { nome: 'Mato Grosso do Sul', sigla: 'MS', url: 'https://www.transparencia.ms.gov.br/', tipo: 'estado', uf: 'MS' },
  { nome: 'Minas Gerais', sigla: 'MG', url: 'https://www.transparencia.mg.gov.br/', tipo: 'estado', uf: 'MG' },
  { nome: 'Pará', sigla: 'PA', url: 'https://www.sistemas.pa.gov.br/portaltransparencia', tipo: 'estado', uf: 'PA' },
  { nome: 'Paraíba', sigla: 'PB', url: 'https://transparencia.pb.gov.br/', tipo: 'estado', uf: 'PB' },
  { nome: 'Paraná', sigla: 'PR', url: 'https://www.transparencia.pr.gov.br/', tipo: 'estado', uf: 'PR' },
  { nome: 'Pernambuco', sigla: 'PE', url: 'https://transparencia.pe.gov.br/', tipo: 'estado', uf: 'PE' },
  { nome: 'Piauí', sigla: 'PI', url: 'https://transparencia2.pi.gov.br/', tipo: 'estado', uf: 'PI' },
  { nome: 'Rio de Janeiro', sigla: 'RJ', url: 'https://www.rj.gov.br/transparencia/', tipo: 'estado', uf: 'RJ' },
  { nome: 'Rio Grande do Norte', sigla: 'RN', url: 'https://www.transparencia.rn.gov.br/', tipo: 'estado', uf: 'RN' },
  { nome: 'Rio Grande do Sul', sigla: 'RS', url: 'https://www.transparencia.rs.gov.br/', tipo: 'estado', uf: 'RS' },
  { nome: 'Rondônia', sigla: 'RO', url: 'https://transparencia.ro.gov.br/', tipo: 'estado', uf: 'RO' },
  { nome: 'Roraima', sigla: 'RR', url: 'https://www.transparencia.rr.gov.br/', tipo: 'estado', uf: 'RR' },
  { nome: 'Santa Catarina', sigla: 'SC', url: 'https://www.transparencia.sc.gov.br/', tipo: 'estado', uf: 'SC' },
  { nome: 'São Paulo', sigla: 'SP', url: 'https://www.transparencia.sp.gov.br/', tipo: 'estado', uf: 'SP' },
  { nome: 'Sergipe', sigla: 'SE', url: 'https://www.transparencia.se.gov.br/', tipo: 'estado', uf: 'SE' },
  { nome: 'Tocantins', sigla: 'TO', url: 'https://www.transparencia.to.gov.br/', tipo: 'estado', uf: 'TO' },

  // ── Capitais ──
  { nome: 'Rio Branco', sigla: 'AC', url: 'https://transparencia.riobranco.ac.gov.br/', tipo: 'capital', uf: 'AC' },
  { nome: 'Maceió', sigla: 'AL', url: 'https://www.transparencia.maceio.al.gov.br/transparencia', tipo: 'capital', uf: 'AL' },
  { nome: 'Macapá', sigla: 'AP', url: 'https://macapa.ap.gov.br/portaldatransparencia/', tipo: 'capital', uf: 'AP' },
  { nome: 'Manaus', sigla: 'AM', url: 'https://transparencia.manaus.am.gov.br/', tipo: 'capital', uf: 'AM' },
  { nome: 'Salvador', sigla: 'BA', url: 'https://antigotransparencia.sefaz.salvador.ba.gov.br/', tipo: 'capital', uf: 'BA' },
  { nome: 'Fortaleza', sigla: 'CE', url: 'https://transparencia.fortaleza.ce.gov.br/', tipo: 'capital', uf: 'CE' },
  { nome: 'Brasília', sigla: 'DF', url: 'https://www.transparencia.df.gov.br/', tipo: 'capital', uf: 'DF' },
  { nome: 'Vitória', sigla: 'ES', url: 'https://transparencia.vitoria.es.gov.br/', tipo: 'capital', uf: 'ES' },
  { nome: 'Goiânia', sigla: 'GO', url: 'https://www.goiania.go.gov.br/transparencia/', tipo: 'capital', uf: 'GO' },
  { nome: 'São Luís', sigla: 'MA', url: 'https://www.saoluis.ma.gov.br/portal/transparencia/', tipo: 'capital', uf: 'MA' },
  { nome: 'Cuiabá', sigla: 'MT', url: 'https://transparencia.cuiaba.mt.gov.br/', tipo: 'capital', uf: 'MT' },
  { nome: 'Campo Grande', sigla: 'MS', url: 'https://www.campogrande.ms.gov.br/transparencia/', tipo: 'capital', uf: 'MS' },
  { nome: 'Belo Horizonte', sigla: 'MG', url: 'https://prefeitura.pbh.gov.br/transparencia', tipo: 'capital', uf: 'MG' },
  { nome: 'Belém', sigla: 'PA', url: 'https://portaltransparencia.belem.pa.gov.br/', tipo: 'capital', uf: 'PA' },
  { nome: 'João Pessoa', sigla: 'PB', url: 'https://transparencia.joaopessoa.pb.gov.br/', tipo: 'capital', uf: 'PB' },
  { nome: 'Curitiba', sigla: 'PR', url: 'https://www.transparencia.curitiba.pr.gov.br/', tipo: 'capital', uf: 'PR' },
  { nome: 'Recife', sigla: 'PE', url: 'https://portaltransparencia.recife.pe.gov.br/', tipo: 'capital', uf: 'PE' },
  { nome: 'Teresina', sigla: 'PI', url: 'https://transparencia.teresina.pi.gov.br/', tipo: 'capital', uf: 'PI' },
  { nome: 'Rio de Janeiro (Capital)', sigla: 'RJ', url: 'https://transparencia.prefeitura.rio/', tipo: 'capital', uf: 'RJ' },
  { nome: 'Natal', sigla: 'RN', url: 'https://www2.natal.rn.gov.br/transparencia/', tipo: 'capital', uf: 'RN' },
  { nome: 'Porto Alegre', sigla: 'RS', url: 'https://transparencia.portoalegre.rs.gov.br/', tipo: 'capital', uf: 'RS' },
  { nome: 'Porto Velho', sigla: 'RO', url: 'https://transparencia.portovelho.ro.gov.br/', tipo: 'capital', uf: 'RO' },
  { nome: 'Boa Vista', sigla: 'RR', url: 'https://transparencia.boavista.rr.gov.br/', tipo: 'capital', uf: 'RR' },
  { nome: 'Florianópolis', sigla: 'SC', url: 'https://www.pmf.sc.gov.br/transparencia/', tipo: 'capital', uf: 'SC' },
  { nome: 'São Paulo (Capital)', sigla: 'SP', url: 'https://transparencia.prefeitura.sp.gov.br/', tipo: 'capital', uf: 'SP' },
  { nome: 'Aracaju', sigla: 'SE', url: 'https://transparencia.aracaju.se.gov.br/prefeitura/', tipo: 'capital', uf: 'SE' },
  { nome: 'Palmas', sigla: 'TO', url: 'https://portaldatransparencia.palmas.to.gov.br/', tipo: 'capital', uf: 'TO' },
];

export const getPortalByKey = (key: string): TransparenciaPortal | undefined =>
  transparenciaPortais.find(p => `${p.tipo}-${p.uf}` === key || `${p.tipo}-${p.nome}` === key);

export const estadosPortais = transparenciaPortais.filter(p => p.tipo === 'estado');
export const capitaisPortais = transparenciaPortais.filter(p => p.tipo === 'capital');
