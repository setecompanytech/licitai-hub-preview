/**
 * Resolução das coordenadas de uma contratação no PNCP (cnpj/ano/sequencial).
 *
 * PADRÃO DE ARQUITETURA (2026-08-14): três fontes, nesta ordem —
 *   1. a URL do edital no formato do PNCP (/editais/CNPJ/ANO/SEQ)
 *   2. as colunas gravadas no processo (cnpj_orgao, ano_compra, sequencial_compra)
 *   3. o número de controle (CNPJ-1-SEQUENCIAL/ANO)
 *
 * Resolver só pela URL foi a causa de três defeitos idênticos em pontos
 * diferentes (workspace, viewer, auto-prepare): editais de portais parceiros
 * têm url_edital fora do padrão, e o recurso simplesmente não funcionava.
 * Toda função nova que precise de coordenadas DEVE usar este helper.
 */

export interface CoordsPncp {
  cnpj: string;
  ano: string;
  seq: string;
}

export function resolverCoordsPncp(lic: {
  url_edital?: string | null;
  cnpj_orgao?: string | null;
  ano_compra?: string | null;
  sequencial_compra?: string | null;
  numero_controle_pncp?: string | null;
}): CoordsPncp | null {
  const m = (lic.url_edital || "").match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
  if (m) return { cnpj: m[1], ano: m[2], seq: m[3] };

  if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra) {
    return {
      cnpj: lic.cnpj_orgao.replace(/\D/g, ""),
      ano: String(lic.ano_compra),
      seq: String(Number(lic.sequencial_compra)),
    };
  }

  const n = (lic.numero_controle_pncp || "").match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
  if (n) return { cnpj: n[1], seq: String(Number(n[2])), ano: n[3] };

  return null;
}
