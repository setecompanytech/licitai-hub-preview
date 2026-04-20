const STOPWORDS = new Set([
  'de', 'da', 'do', 'para', 'com', 'sem', 'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'em', 'no', 'na', 'nos', 'nas', 'por',
  'tipo', 'referente', 'aquisicao', 'aquisição', 'contratacao', 'contratação', 'servico', 'serviços', 'servicos', 'material', 'materiais', 'item', 'lote',
]);

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
  );
}

export function isItemsLikelyMismatched(
  objeto: string | null | undefined,
  descricoes: Array<string | null | undefined>
): boolean {
  if (!objeto || descricoes.length < 2) return false;

  const objectTokens = tokenize(objeto);
  if (objectTokens.size < 2) return false;

  const descriptionTokens = descricoes.slice(0, 5).reduce<Set<string>>((acc, descricao) => {
    if (!descricao) return acc;
    tokenize(descricao).forEach((token) => acc.add(token));
    return acc;
  }, new Set<string>());

  if (descriptionTokens.size === 0) return false;

  let overlap = 0;
  objectTokens.forEach((token) => {
    if (descriptionTokens.has(token)) overlap += 1;
  });

  return overlap === 0;
}