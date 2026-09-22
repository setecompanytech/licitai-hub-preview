import {
  CERTIDOES_FEDERAIS, certidoesEstaduais, certidoesMunicipais, checklistDeCertidoes,
  type CertidaoDoCatalogo, type Esfera, type OrgaoCadastradoPelaEmpresa,
} from '@/data/certidoes-catalogo';

/**
 * O órgão emissor de cada VAGA do cofre — fase 2 das Certidões (23/09/2026).
 *
 * O cofre de Documentos lista as vagas por nome exato (`previstos.ts`) e o
 * catálogo (`data/certidoes-catalogo.ts`) sabe, para cada certidão, quem
 * emite, onde e como. Este módulo faz a ponte: dada a vaga e o DOMICÍLIO
 * FISCAL da empresa (UF e município do cadastro em `empresas`), devolve a
 * certidão do catálogo que responde àquela vaga e o que dá para fazer com
 * ela — emitir no site do órgão, solicitar por e-mail, cadastrar o órgão.
 *
 * Duas regras que não se negociam:
 *  - o domicílio vem do cadastro da empresa; sem UF ou município, a resposta
 *    é "informe o domicílio", nunca uma cidade inventada;
 *  - sem endereço do órgão, a resposta é "sem ação" com o motivo, nunca o
 *    endereço de outro ente.
 */
export type Domicilio = { uf?: string | null; municipio?: string | null };

export type AcaoNoOrgao =
  /** Abrir o site do órgão emissor. */
  | 'emitir'
  /** Preparar o e-mail de solicitação ao órgão (e registrar a solicitação). */
  | 'solicitar'
  /** O órgão do município não tem endereço no mapa: a empresa cadastra o dela. */
  | 'cadastrar';

export const ROTULO_DA_ACAO: Record<AcaoNoOrgao, string> = {
  emitir: 'Emitir no órgão',
  solicitar: 'Solicitar por e-mail',
  cadastrar: 'Cadastrar órgão',
};

export interface OrgaoDaVaga {
  /** A esfera que a vaga exige; `null` quando o catálogo não cobre a vaga (CREA, balanço…). */
  esfera: Esfera | null;
  certidao: CertidaoDoCatalogo | null;
  /** As ações possíveis, a principal primeiro. Vazia quando não há o que fazer. */
  acoes: AcaoNoOrgao[];
  /** Por que não há ação — para a tela dizer em vez de sumir com o botão. */
  motivo: string | null;
}

const vagasDe = (lista: CertidaoDoCatalogo[]) =>
  new Set(lista.map((c) => c.vaga).filter((v): v is string => Boolean(v)));

// O CONJUNTO de vagas de cada esfera é o mesmo em todo o país — o que muda
// de um domicílio para outro é o órgão, não a vaga. Qualquer UF e qualquer
// município servem de sonda para descobrir quais vagas são estaduais e quais
// são municipais, sem copiar a lista à mão.
const VAGAS_FEDERAIS = vagasDe(CERTIDOES_FEDERAIS);
const VAGAS_ESTADUAIS = vagasDe(certidoesEstaduais('PA'));
const VAGAS_MUNICIPAIS = vagasDe(certidoesMunicipais('PA', 'Belém'));

/** A esfera que a vaga exige, ou `null` quando o catálogo não a cobre. */
export function esferaDaVaga(nomeDaVaga: string): Esfera | null {
  if (VAGAS_FEDERAIS.has(nomeDaVaga)) return 'federal';
  if (VAGAS_ESTADUAIS.has(nomeDaVaga)) return 'estadual';
  if (VAGAS_MUNICIPAIS.has(nomeDaVaga)) return 'municipal';
  return null;
}

export const MOTIVO_SEM_UF = 'Informe a UF do domicílio fiscal no cadastro da empresa para o cofre apontar o órgão estadual.';
export const MOTIVO_SEM_MUNICIPIO = 'Informe a UF e o município do domicílio fiscal no cadastro da empresa para o cofre apontar o órgão municipal.';
export const MOTIVO_DOCUMENTO_PROPRIO = 'Documento produzido pela própria empresa — não há órgão emissor.';

/** O que dá para fazer com uma certidão do catálogo. */
export function acoesDaCertidao(c: CertidaoDoCatalogo): AcaoNoOrgao[] {
  if (c.obtencao === 'documento_proprio') return [];
  if (c.obtencao === 'consulta_api') return c.urlEmissao ? ['emitir'] : [];

  const acoes: AcaoNoOrgao[] = [];
  if (c.obtencao === 'solicitacao') {
    // Município fora do mapa: primeiro se cadastra o órgão, mas quem já sabe
    // o e-mail pode solicitar desde já — o endereço fica com quem envia.
    if (c.esfera === 'municipal' && c.pendenteDeCadastro) acoes.push('cadastrar');
    acoes.push('solicitar');
    if (c.urlEmissao) acoes.push('emitir');
    return acoes;
  }

  if (c.urlEmissao) acoes.push('emitir');
  else if (c.esfera === 'municipal' && c.pendenteDeCadastro) acoes.push('cadastrar');
  return acoes;
}

function motivoSemAcao(c: CertidaoDoCatalogo): string | null {
  if (c.obtencao === 'documento_proprio') return MOTIVO_DOCUMENTO_PROPRIO;
  if (c.pendenteDeCadastro) return c.observacao ?? 'Endereço do órgão não cadastrado.';
  return null;
}

/**
 * A certidão do catálogo que responde à vaga, para o domicílio da empresa.
 *
 * `orgaosDaEmpresa` são os órgãos municipais cadastrados pela própria empresa
 * (fase 2, entrega c): valem só para município fora do mapa.
 */
export function orgaoDaVaga(
  nomeDaVaga: string,
  domicilio: Domicilio,
  orgaosDaEmpresa: OrgaoCadastradoPelaEmpresa[] = [],
): OrgaoDaVaga {
  const esfera = esferaDaVaga(nomeDaVaga);
  if (!esfera) return { esfera: null, certidao: null, acoes: [], motivo: null };

  const uf = domicilio.uf?.trim().toUpperCase() || null;
  const municipio = domicilio.municipio?.trim() || null;

  if (esfera === 'estadual' && !uf) {
    return { esfera, certidao: null, acoes: [], motivo: MOTIVO_SEM_UF };
  }
  if (esfera === 'municipal' && (!uf || !municipio)) {
    return { esfera, certidao: null, acoes: [], motivo: MOTIVO_SEM_MUNICIPIO };
  }

  const certidao = checklistDeCertidoes(uf, municipio, orgaosDaEmpresa)
    .find((c) => c.vaga === nomeDaVaga) ?? null;
  if (!certidao) return { esfera, certidao: null, acoes: [], motivo: null };

  const acoes = acoesDaCertidao(certidao);
  return { esfera, certidao, acoes, motivo: acoes.length ? null : motivoSemAcao(certidao) };
}

/** O órgão de cada vaga do cofre, de uma vez — a tela consulta por nome. */
export function orgaosPorVaga(
  vagas: string[],
  domicilio: Domicilio,
  orgaosDaEmpresa: OrgaoCadastradoPelaEmpresa[] = [],
): Record<string, OrgaoDaVaga> {
  return Object.fromEntries(vagas.map((v) => [v, orgaoDaVaga(v, domicilio, orgaosDaEmpresa)]));
}
