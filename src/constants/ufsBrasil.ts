export const UFS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

const UF_SET = new Set<string>(UFS_BRASIL);

export const normalizeUfs = (ufs?: string[] | null) => {
  return Array.from(
    new Set(
      (ufs ?? [])
        .map((uf) => uf?.toUpperCase().trim())
        .filter((uf): uf is string => Boolean(uf) && UF_SET.has(uf))
    )
  );
};

export const getUfPreferencial = (
  ufs?: string[] | null,
  ufSede?: string | null,
  priorizarRegiaoSede = false,
) => {
  const ufsNormalizadas = normalizeUfs(ufs);
  if (ufsNormalizadas.length > 0) return ufsNormalizadas[0];

  const ufSedeNormalizada = ufSede?.toUpperCase().trim();
  if (priorizarRegiaoSede && ufSedeNormalizada && UF_SET.has(ufSedeNormalizada)) {
    return ufSedeNormalizada;
  }

  return null;
};