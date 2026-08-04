/**
 * Praça do colaborador: quais feriados contam no cálculo de dias úteis.
 *
 * Regra (Fase 1 da pendência priorizada):
 *   - feriado nacional (uf nula) vale para todo mundo;
 *   - estadual (uf preenchida) vale para quem tem praça naquela UF;
 *   - municipal (uf + município) vale para quem tem praça naquele município;
 *   - colaborador SEM praça usa só os nacionais — o comportamento anterior,
 *     para nada quebrar na transição.
 *
 * A comparação de município é sempre pela forma normalizada: texto livre
 * falha PARA MENOS quando a grafia diverge ("Santa Rosa" vs "SANTA ROSA "),
 * e o efeito seria silencioso — um dia útil a mais que não existe, inflando
 * o denominador do ritmo diário.
 *
 * `normalizarMunicipio` é ESPELHO de `public.comercial_normalizar_municipio`
 * (migration 20260804000001) — as duas versões precisam mudar juntas.
 */

import type { DataCivil } from './dias-uteis';

export type FeriadoComPraca = {
  data: DataCivil;
  uf?: string | null;
  municipio?: string | null;
};

export type Praca = {
  uf?: string | null;
  municipio?: string | null;
};

/** Minúsculas, sem acento, pontuação vira espaço, espaços colapsados. */
export function normalizarMunicipio(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sigla de UF em forma comparável; texto inválido vira vazio. */
function normalizarUf(uf: string | null | undefined): string {
  const limpa = (uf ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(limpa) ? limpa : '';
}

/**
 * Datas de feriado que valem para a praça informada.
 * Devolve só as datas — é o formato que `repartirMes`/`projetarMeta` consomem.
 */
export function filtrarFeriadosPorPraca(
  feriados: FeriadoComPraca[],
  praca: Praca | null | undefined,
): DataCivil[] {
  const ufPraca = normalizarUf(praca?.uf);
  const municipioPraca = normalizarMunicipio(praca?.municipio);

  return feriados
    .filter((f) => {
      // Nacional = uf AUSENTE. UF presente porém malformada ("R1", nome por
      // extenso) barra o feriado em vez de promovê-lo a nacional — falhar
      // fechado: dado ruim nunca desconta dia útil de todo mundo.
      const ufBruta = (f.uf ?? '').trim();
      if (!ufBruta) return true;
      const ufFeriado = normalizarUf(ufBruta);
      if (!ufFeriado) return false;

      // Estadual/municipal exigem praça com UF — sem praça, só nacionais
      if (!ufPraca || ufFeriado !== ufPraca) return false;

      const municipioFeriado = normalizarMunicipio(f.municipio);
      if (!municipioFeriado) return true; // estadual: basta a UF bater

      // Municipal: precisa do município da praça, na forma normalizada
      return municipioPraca !== '' && municipioFeriado === municipioPraca;
    })
    .map((f) => f.data);
}
