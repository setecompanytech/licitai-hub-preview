// Mapeamento de portais de certidões estaduais e municipais do Brasil
// Cada estado/município possui autonomia para emitir suas certidões

export type PortalCertidao = {
  nome: string;
  url: string;
  tipo: 'estadual' | 'municipal';
  descricao: string;
  requerLogin?: boolean;
};

export type CertidoesEstado = {
  uf: string;
  nomeEstado: string;
  portais: PortalCertidao[];
  municipios: Record<string, PortalCertidao[]>;
};

export const CERTIDOES_POR_ESTADO: Record<string, CertidoesEstado> = {
  AC: {
    uf: 'AC', nomeEstado: 'Acre',
    portais: [
      { nome: 'CND Estadual - SEFAZ/AC', url: 'https://sefaznet.ac.gov.br/tagnet/certidao.jsp', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Rio Branco': [
        { nome: 'CND Municipal - Rio Branco', url: 'https://portalcontribuinte.riobranco.ac.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais', requerLogin: true },
      ],
    },
  },
  AL: {
    uf: 'AL', nomeEstado: 'Alagoas',
    portais: [
      { nome: 'CND Estadual - SEFAZ/AL', url: 'https://www.sefaz.al.gov.br/certidao-negativa', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Maceió': [
        { nome: 'CND Municipal - Maceió', url: 'https://certidao.maceio.al.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  AP: {
    uf: 'AP', nomeEstado: 'Amapá',
    portais: [
      { nome: 'CND Estadual - SEFAZ/AP', url: 'https://www.sefaz.ap.gov.br/certidao', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Macapá': [
        { nome: 'CND Municipal - Macapá', url: 'https://macapa.ap.gov.br/certidao-negativa/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  AM: {
    uf: 'AM', nomeEstado: 'Amazonas',
    portais: [
      { nome: 'CND Estadual - SEFAZ/AM', url: 'https://online.sefaz.am.gov.br/cnd/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Manaus': [
        { nome: 'CND Municipal - Manaus', url: 'https://certidao.manaus.am.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  BA: {
    uf: 'BA', nomeEstado: 'Bahia',
    portais: [
      { nome: 'CND Estadual - SEFAZ/BA', url: 'https://servicos.sefaz.ba.gov.br/sistemas/certidao/modulos/certidao/modulos/emissao/Certidao.aspx', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Salvador': [
        { nome: 'CND Municipal - Salvador', url: 'https://certidao.sefaz.salvador.ba.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  CE: {
    uf: 'CE', nomeEstado: 'Ceará',
    portais: [
      { nome: 'CND Estadual - SEFAZ/CE', url: 'https://servicos.sefaz.ce.gov.br/internet/download/projetoscontribuintes/certidao/certidaoNegativa.asp', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Fortaleza': [
        { nome: 'CND Municipal - Fortaleza', url: 'https://grfrj.sefin.fortaleza.ce.gov.br/grpfor/paginaInicial.seam', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  DF: {
    uf: 'DF', nomeEstado: 'Distrito Federal',
    portais: [
      { nome: 'CND Distrital - SEF/DF', url: 'https://www2.agnet.fazenda.df.gov.br/Certidoes/CertidaoInternet', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Distritais' },
    ],
    municipios: {
      'Brasília': [
        { nome: 'CND Distrital - Brasília', url: 'https://www2.agnet.fazenda.df.gov.br/Certidoes/CertidaoInternet', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Distritais (DF acumula competências estadual e municipal)' },
      ],
    },
  },
  ES: {
    uf: 'ES', nomeEstado: 'Espírito Santo',
    portais: [
      { nome: 'CND Estadual - SEFAZ/ES', url: 'https://app2.sefaz.es.gov.br/certidaointernet/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Vitória': [
        { nome: 'CND Municipal - Vitória', url: 'https://certidoes.vitoria.es.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  GO: {
    uf: 'GO', nomeEstado: 'Goiás',
    portais: [
      { nome: 'CND Estadual - SEFAZ/GO', url: 'https://www.economia.go.gov.br/certidao-negativa.html', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Goiânia': [
        { nome: 'CND Municipal - Goiânia', url: 'https://www2.goiania.go.gov.br/certidao/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  MA: {
    uf: 'MA', nomeEstado: 'Maranhão',
    portais: [
      { nome: 'CND Estadual - SEFAZ/MA', url: 'https://sistemas1.sefaz.ma.gov.br/certidoes/jsp/emissaoCertidaoNegativa/emissaoCertidaoNegativa.jsf', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'São Luís': [
        { nome: 'CND Municipal - São Luís', url: 'https://stm.semfaz.saoluis.ma.gov.br/certidaonegativa/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  MT: {
    uf: 'MT', nomeEstado: 'Mato Grosso',
    portais: [
      { nome: 'CND Estadual - SEFAZ/MT', url: 'https://www.sefaz.mt.gov.br/portal/certidao/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Cuiabá': [
        { nome: 'CND Municipal - Cuiabá', url: 'https://certidao.cuiaba.mt.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  MS: {
    uf: 'MS', nomeEstado: 'Mato Grosso do Sul',
    portais: [
      { nome: 'CND Estadual - SEFAZ/MS', url: 'https://servicos.efazenda.ms.gov.br/certidaonegativa/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Campo Grande': [
        { nome: 'CND Municipal - Campo Grande', url: 'https://certidao.campogrande.ms.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  MG: {
    uf: 'MG', nomeEstado: 'Minas Gerais',
    portais: [
      { nome: 'CND Estadual - SEF/MG', url: 'https://www2.fazenda.mg.gov.br/sol/ctrl/SOL/CDT/SERVICO_830?ESSION=NEW', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Belo Horizonte': [
        { nome: 'CND Municipal - Belo Horizonte', url: 'https://bhissdigital.pbh.gov.br/certidao/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  PA: {
    uf: 'PA', nomeEstado: 'Pará',
    portais: [
      { nome: 'Certidão Negativa Tributária e Não Tributária - SEFA/PA', url: 'https://app.sefa.pa.gov.br/emissao-certidao/template.action', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Tributários e Não Tributários do Estado do Pará' },
      { nome: 'Ficha de Inscrição Cadastral (FIC) - SEFA/PA', url: 'https://app.sefa.pa.gov.br/consulta-fic/', tipo: 'estadual', descricao: 'Consulta da Ficha de Inscrição Cadastral no ICMS do Estado do Pará' },
    ],
    municipios: {
      'Belém': [
        { nome: 'CND Municipal - Belém/PA (Agiliza Belém)', url: 'https://sistemas.belem.pa.gov.br/agiliza/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos do Município de Belém/PA via sistema Agiliza', requerLogin: true },
      ],
      'Ananindeua': [
        { nome: 'CND Municipal - Ananindeua/PA', url: 'https://www.ananindeua.pa.gov.br/certidao-negativa/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos do Município de Ananindeua/PA' },
      ],
      'Santarém': [
        { nome: 'CND Municipal - Santarém/PA', url: 'https://santarem.pa.gov.br/certidao/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos do Município de Santarém/PA' },
      ],
      'Marabá': [
        { nome: 'CND Municipal - Marabá/PA', url: 'https://maraba.pa.gov.br/certidao/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos do Município de Marabá/PA' },
      ],
    },
  },
  PB: {
    uf: 'PB', nomeEstado: 'Paraíba',
    portais: [
      { nome: 'CND Estadual - SEFAZ/PB', url: 'https://www.sefaz.pb.gov.br/servicos/certidao-negativa', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'João Pessoa': [
        { nome: 'CND Municipal - João Pessoa', url: 'https://certidao.joaopessoa.pb.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  PR: {
    uf: 'PR', nomeEstado: 'Paraná',
    portais: [
      { nome: 'CND Estadual - SEFA/PR', url: 'http://www.fazenda.pr.gov.br/servicos/Servico/Certidoes', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Curitiba': [
        { nome: 'CND Municipal - Curitiba', url: 'https://certidoes.curitiba.pr.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  PE: {
    uf: 'PE', nomeEstado: 'Pernambuco',
    portais: [
      { nome: 'CND Estadual - SEFAZ/PE', url: 'https://efisco.sefaz.pe.gov.br/sfi_trb_gcc/PREmitirCND', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Recife': [
        { nome: 'CND Municipal - Recife', url: 'https://certidao.recife.pe.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  PI: {
    uf: 'PI', nomeEstado: 'Piauí',
    portais: [
      { nome: 'CND Estadual - SEFAZ/PI', url: 'https://webas.sefaz.pi.gov.br/certidaonegativa/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Teresina': [
        { nome: 'CND Municipal - Teresina', url: 'https://certidao.teresina.pi.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  RJ: {
    uf: 'RJ', nomeEstado: 'Rio de Janeiro',
    portais: [
      { nome: 'CND Estadual - SEFAZ/RJ', url: 'https://portal.fazenda.rj.gov.br/certidao/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Rio de Janeiro': [
        { nome: 'CND Municipal - Rio de Janeiro', url: 'https://dfrj.rio.rj.gov.br/certidoes', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  RN: {
    uf: 'RN', nomeEstado: 'Rio Grande do Norte',
    portais: [
      { nome: 'CND Estadual - SET/RN', url: 'https://uvt2.set.rn.gov.br/certidaointernet/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Natal': [
        { nome: 'CND Municipal - Natal', url: 'https://certidao.natal.rn.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  RS: {
    uf: 'RS', nomeEstado: 'Rio Grande do Sul',
    portais: [
      { nome: 'CND Estadual - SEFAZ/RS', url: 'https://www.sefaz.rs.gov.br/sat/CertidaoSitFiscalSolic.aspx', tipo: 'estadual', descricao: 'Certidão de Situação Fiscal' },
    ],
    municipios: {
      'Porto Alegre': [
        { nome: 'CND Municipal - Porto Alegre', url: 'https://dfrj.portoalegre.rs.gov.br/certidao/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  RO: {
    uf: 'RO', nomeEstado: 'Rondônia',
    portais: [
      { nome: 'CND Estadual - SEFIN/RO', url: 'https://www.sefin.ro.gov.br/certidaonegativa/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Porto Velho': [
        { nome: 'CND Municipal - Porto Velho', url: 'https://certidao.portovelho.ro.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  RR: {
    uf: 'RR', nomeEstado: 'Roraima',
    portais: [
      { nome: 'CND Estadual - SEFAZ/RR', url: 'https://www.sefaz.rr.gov.br/certidao/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Boa Vista': [
        { nome: 'CND Municipal - Boa Vista', url: 'https://certidao.boavista.rr.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  SC: {
    uf: 'SC', nomeEstado: 'Santa Catarina',
    portais: [
      { nome: 'CND Estadual - SEF/SC', url: 'https://tributario.sef.sc.gov.br/tax.NET/tax.NET.certidao.aspx', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Florianópolis': [
        { nome: 'CND Municipal - Florianópolis', url: 'https://certidao.pmf.sc.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  SP: {
    uf: 'SP', nomeEstado: 'São Paulo',
    portais: [
      { nome: 'CND Estadual - SEFAZ/SP', url: 'https://www10.fazenda.sp.gov.br/CertidaoNegativaDeb/Pages/EmissaoCertidaoNegativa.aspx', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Tributários Não Inscritos da Dívida Ativa' },
      { nome: 'CND PGE/SP - Dívida Ativa', url: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/consultarDebitosCRDA.jsf', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Inscritos na Dívida Ativa do Estado de SP' },
    ],
    municipios: {
      'São Paulo': [
        { nome: 'CND Municipal - São Paulo (CCM)', url: 'https://duc.prefeitura.sp.gov.br/certidoes/forms_anonimo/frmConsultaEmissaoCertificado.aspx', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Tributários Mobiliários - Município de São Paulo' },
      ],
    },
  },
  SE: {
    uf: 'SE', nomeEstado: 'Sergipe',
    portais: [
      { nome: 'CND Estadual - SEFAZ/SE', url: 'https://www.sefaz.se.gov.br/certidaonegativa/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Aracaju': [
        { nome: 'CND Municipal - Aracaju', url: 'https://certidao.aracaju.se.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
  TO: {
    uf: 'TO', nomeEstado: 'Tocantins',
    portais: [
      { nome: 'CND Estadual - SEFAZ/TO', url: 'https://www.sefaz.to.gov.br/certidao/', tipo: 'estadual', descricao: 'Certidão Negativa de Débitos Estaduais' },
    ],
    municipios: {
      'Palmas': [
        { nome: 'CND Municipal - Palmas', url: 'https://certidao.palmas.to.gov.br/', tipo: 'municipal', descricao: 'Certidão Negativa de Débitos Municipais' },
      ],
    },
  },
};

/**
 * Retorna os portais de certidões para um estado e município específicos
 */
export function getPortaisCertidoes(uf: string, municipio?: string): PortalCertidao[] {
  const estado = CERTIDOES_POR_ESTADO[uf.toUpperCase()];
  if (!estado) return [];

  const portais: PortalCertidao[] = [...estado.portais];

  if (municipio) {
    const municipioPortais = estado.municipios[municipio];
    if (municipioPortais) {
      portais.push(...municipioPortais);
    }
  }

  return portais;
}

/**
 * Lista todos os municípios cadastrados para um estado
 */
export function getMunicipiosCadastrados(uf: string): string[] {
  const estado = CERTIDOES_POR_ESTADO[uf.toUpperCase()];
  if (!estado) return [];
  return Object.keys(estado.municipios).sort();
}
