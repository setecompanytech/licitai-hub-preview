/**
 * CEST × NCM — o que o cadastro de produto confere (28/09/2026).
 *
 * A tabela é a do Convênio ICMS 142/18 (`data/cest-codes.ts`). Cada CEST
 * vale para uma lista de NCMs do convênio: posição (4 dígitos), subposição
 * (6) ou item (8), ou capítulos inteiros (2). Um NCM de produto "combina"
 * com o CEST quando começa por algum desses prefixos. Puro: a tela só chama.
 */
import { CEST_CODES, SEGMENTOS_CEST, type CestCode } from '@/data/cest-codes';

export const soDigitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '');

/** "1700100" ou "17.001.00" → "17.001.00"; qualquer outra coisa volta como veio (aparada). */
export function formatarCest(v: string | null | undefined): string {
  const d = soDigitos(v);
  return d.length === 7 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}` : String(v ?? '').trim();
}

const porCodigo = new Map<string, CestCode>(CEST_CODES.map((c) => [c.codigo, c]));

export function buscarCest(codigo: string | null | undefined): CestCode | null {
  return porCodigo.get(formatarCest(codigo)) ?? null;
}

/** O NCM do produto começa por algum NCM do convênio para este CEST? */
export function cestCombinaComNcm(c: CestCode, ncm: string | null | undefined): boolean {
  const n = soDigitos(ncm);
  if (!n) return false;
  return c.ncmPrefixos.some((p) => n.startsWith(p));
}

/** CESTs vigentes cujo NCM do convênio casa com o NCM do produto; os de prefixo mais longo (mais específicos) primeiro. */
export function cestsParaNcm(ncm: string | null | undefined): CestCode[] {
  const n = soDigitos(ncm);
  if (n.length < 2) return [];
  return CEST_CODES
    .filter((c) => !c.revogado && cestCombinaComNcm(c, n))
    .map((c) => ({ c, maior: Math.max(...c.ncmPrefixos.filter((p) => n.startsWith(p)).map((p) => p.length)) }))
    .sort((a, b) => b.maior - a.maior || a.c.codigo.localeCompare(b.c.codigo))
    .map((x) => x.c);
}

export type SituacaoCest = 'ok' | 'sem_cest' | 'inexistente' | 'revogado' | 'incompativel';
export type AvaliacaoCest = { situacao: SituacaoCest; titulo: string; explicacao: string; sugestoes: CestCode[]; registro: CestCode | null };

/**
 * O que a tela diz sobre o CEST guardado no produto. Sem CEST não é erro: a
 * maioria dos produtos não tem substituição tributária — mas se o NCM tem
 * CEST no convênio, vale sugerir.
 */
export function avaliarCest(cest: string | null | undefined, ncm: string | null | undefined): AvaliacaoCest {
  const codigo = formatarCest(cest);
  const sugestoes = cestsParaNcm(ncm).slice(0, 5);
  if (!codigo) {
    return sugestoes.length > 0
      ? { situacao: 'sem_cest', titulo: 'Este NCM tem CEST no Convênio ICMS 142/18', explicacao: 'Produto sujeito à substituição tributária de ICMS precisa do CEST na NF-e. Escolha o que descreve a mercadoria.', sugestoes, registro: null }
      : { situacao: 'ok', titulo: '', explicacao: '', sugestoes: [], registro: null };
  }
  const registro = buscarCest(codigo);
  if (!registro) {
    return { situacao: 'inexistente', titulo: `O CEST ${codigo} não existe no Convênio ICMS 142/18`, explicacao: 'A NF-e com esse código é rejeitada pela SEFAZ. O código veio de uma tabela antiga do sistema, que numerava os segmentos de outro jeito.', sugestoes, registro: null };
  }
  if (registro.revogado) {
    return { situacao: 'revogado', titulo: `O CEST ${codigo} foi revogado`, explicacao: 'O item saiu da tabela por convênio posterior. Escolha o código vigente para a mercadoria.', sugestoes, registro };
  }
  if (soDigitos(ncm) && !cestCombinaComNcm(registro, ncm)) {
    return { situacao: 'incompativel', titulo: `O CEST ${codigo} não vale para o NCM ${String(ncm).trim()}`, explicacao: `No convênio, ${codigo} (${SEGMENTOS_CEST[registro.segmento] ?? registro.segmento}) cobre NCM ${registro.ncm}. Combinação errada é rejeição na SEFAZ ou ICMS-ST apurado errado.`, sugestoes, registro };
  }
  return { situacao: 'ok', titulo: '', explicacao: '', sugestoes: [], registro };
}
