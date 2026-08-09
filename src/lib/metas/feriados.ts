/**
 * Regras de cadastro de feriado, isoladas da interface para poderem ser testadas.
 *
 * A abrangência NUNCA é digitada: ela é consequência de `uf`/`municipio`. Deixar
 * o usuário escolher as duas coisas permitiria a combinação incoerente que o
 * CHECK `comercial_feriados_abrangencia_praca` recusaria — erro que só
 * apareceria no fim, como falha do banco.
 */

import { normalizarMunicipio } from './praca';

export type Abrangencia = 'nacional' | 'estadual' | 'municipal';

/** Feriado normalizado, pronto para gravar. */
export type FeriadoNormalizado = {
  data: string;
  descricao: string;
  uf: string | null;
  municipio: string | null;
  abrangencia: Abrangencia;
};

export function derivarAbrangencia(
  uf: string | null | undefined,
  municipio: string | null | undefined,
): Abrangencia {
  if (!uf) return 'nacional';
  return municipio ? 'municipal' : 'estadual';
}

/**
 * Normaliza a entrada do formulário.
 * Município sem UF é descartado: municipal exige a UF, e guardar o município
 * solto criaria um feriado que não vale para ninguém.
 */
export function normalizarFeriado(entrada: {
  data: string;
  descricao: string;
  uf?: string | null;
  municipio?: string | null;
}): FeriadoNormalizado {
  const uf = entrada.uf?.trim().toUpperCase() || null;
  const ufValida = uf && /^[A-Z]{2}$/.test(uf) ? uf : null;
  const municipio = ufValida ? (entrada.municipio?.trim() || null) : null;

  return {
    data: entrada.data,
    descricao: entrada.descricao.trim(),
    uf: ufValida,
    municipio,
    abrangencia: derivarAbrangencia(ufValida, municipio),
  };
}

/**
 * O feriado atinge alguma praça cadastrada?
 * Não impede o cadastro — serve para avisar que ele não afetará ninguém,
 * situação que de outro modo passaria despercebida.
 */
export function atingeAlgumaPraca(
  feriado: { uf: string | null; municipio: string | null },
  pracas: { praca_uf: string | null; praca_municipio: string | null }[],
): boolean {
  if (!feriado.uf) return true; // nacional atinge todo mundo

  return pracas.some((p) => {
    if (p.praca_uf !== feriado.uf) return false;
    if (!feriado.municipio) return true; // estadual: basta a UF
    return normalizarMunicipio(p.praca_municipio) === normalizarMunicipio(feriado.municipio);
  });
}
