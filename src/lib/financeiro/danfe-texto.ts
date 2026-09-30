/**
 * DANFE em PDF lido pelo TEXTO do arquivo, sem IA (30/09/2026).
 *
 * O dono: "vários erros de leitura em DANFEs anexados via upload,
 * principalmente em PDF (OCR)". O DANFE é a representação impressa do XML;
 * o dado oficial está no XML. O que o texto do PDF dá com certeza é a CHAVE
 * (44 dígitos com dígito verificador) — e a chave sozinha já diz CNPJ
 * emitente, modelo, série, número e mês de emissão. Com ela o sistema acha
 * a nota que já está lançada, sabe se é entrada ou saída e pede o XML certo.
 * Valor e data saem do texto quando o layout permite; nunca por adivinhação.
 * Puro: a tela só chama.
 */
import { chaveNfeDoTexto, chaveNfeValida, dadosDaChaveNfe } from './chave-nfe';

export type DanfeLido = {
  chave: string;
  numero: number;
  serie: number;
  modelo: string;
  cnpj_emitente: string;
  competencia: string;
  /** Só quando o CNPJ da empresa foi dado: emitida por ela → saída; senão, entrada. */
  direcao: 'entrada' | 'saida' | null;
  valor_total: number | null;
  data_emissao: string | null;
};

const apenasDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

const numeroBr = (s: string): number | null => {
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** "VALOR TOTAL DA NOTA" e o primeiro dinheiro depois dele. */
export function valorTotalDoDanfe(texto: string): number | null {
  const t = texto.replace(/\s+/g, ' ');
  const m = /V(?:ALOR|\.)\s*TOTAL\s+DA\s+NOTA[^0-9]{0,80}?(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t);
  return m ? numeroBr(m[1]) : null;
}

/** "DATA DA EMISSÃO" (ou "DATA DE EMISSÃO") e a primeira dd/mm/aaaa depois. */
export function dataDeEmissaoDoDanfe(texto: string): string | null {
  const t = texto.replace(/\s+/g, ' ');
  const m = /DATA\s+D[AE]\s+EMISS[ÃA]O[^0-9]{0,80}?(\d{2})\/(\d{2})\/(\d{4})/i.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Lê o DANFE. Sem chave válida no texto, não é DANFE legível: nulo. */
export function lerDanfe(texto: string, cnpjDaEmpresa?: string | null): DanfeLido | null {
  if (!texto || texto.trim().length < 44) return null;
  const chave = chaveNfeDoTexto(texto);
  if (!chave) return null;
  const c = dadosDaChaveNfe(chave)!;
  const empresa = apenasDigitos(cnpjDaEmpresa);
  const direcao = empresa.length === 14 ? (c.cnpj_emitente === empresa ? 'saida' : 'entrada') : null;
  const data = dataDeEmissaoDoDanfe(texto);
  return {
    chave, numero: c.numero, serie: c.serie, modelo: c.modelo, cnpj_emitente: c.cnpj_emitente, competencia: c.competencia,
    direcao, valor_total: valorTotalDoDanfe(texto),
    // A data do texto só vale se for do mesmo mês que a chave declara.
    data_emissao: data && data.slice(0, 7) === c.competencia ? data : null,
  };
}

/** A pasta certa para a nota, pela direção: saída é a receber; entrada, a pagar. */
export function pastaDaDirecao(direcao: 'entrada' | 'saida' | null): 'a_receber' | 'a_pagar' | null {
  return direcao === 'saida' ? 'a_receber' : direcao === 'entrada' ? 'a_pagar' : null;
}

/**
 * O DANFE a partir da CHAVE que a leitura por imagem devolveu (30/09): PDF
 * sem texto (escaneado) não passa pelo texto, mas o OCR lê a chave — e a
 * chave, se o dígito verificador fecha, vale tanto quanto a do texto. Valor
 * e data vêm do que o OCR leu; número, série, emitente e mês, da chave.
 */
export function danfeDaChave(
  chave: unknown,
  cnpjDaEmpresa?: string | null,
  lido: { valor_total?: number | null; data_emissao?: string | null } = {},
): DanfeLido | null {
  const c = dadosDaChaveNfe(chave);
  if (!c || !chaveNfeValida(chave)) return null;
  const empresa = apenasDigitos(cnpjDaEmpresa);
  const data = lido.data_emissao ? String(lido.data_emissao).slice(0, 10) : null;
  return {
    chave: String(chave).replace(/\D/g, ''),
    numero: c.numero, serie: c.serie, modelo: c.modelo, cnpj_emitente: c.cnpj_emitente, competencia: c.competencia,
    direcao: empresa.length === 14 ? (c.cnpj_emitente === empresa ? 'saida' : 'entrada') : null,
    valor_total: Number(lido.valor_total) > 0 ? Number(lido.valor_total) : null,
    data_emissao: data && data.slice(0, 7) === c.competencia ? data : null,
  };
}
