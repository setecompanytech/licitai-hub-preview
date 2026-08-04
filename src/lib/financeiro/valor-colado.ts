/**
 * Interpreta texto colado como um valor monetário, em reais.
 *
 * A máscara do MoneyInput trata todo dígito como centavo — correto para
 * teclar, desastroso para colar: "300000" copiado de uma planilha viraria
 * R$ 3.000,00 (100× menor) se caísse na máscara. Aqui o texto é lido como
 * número no formato de origem: pt-BR ("1.234,56"), en-US ("1,234.56") ou
 * cru ("300000").
 *
 * Devolve null quando o texto não é interpretável — o chamador deixa o
 * evento seguir o fluxo normal.
 */
export function interpretarValorColado(texto: string): number | null {
  const s = texto.replace(/[^\d.,-]/g, '').trim();
  if (!s || !/\d/.test(s)) return null;

  const virgulas = (s.match(/,/g) || []).length;
  const pontos = (s.match(/\./g) || []).length;
  let normalizado: string;

  if (virgulas > 0 && pontos > 0) {
    // O separador que aparece por último é o decimal
    normalizado =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.') // 1.234,56 (pt-BR)
        : s.replace(/,/g, ''); // 1,234.56 (en-US)
  } else if (virgulas > 1) {
    normalizado = s.replace(/,/g, ''); // 1,234,567 — vírgula de milhar
  } else if (virgulas === 1) {
    normalizado = s.replace(',', '.'); // 1234,5 — vírgula decimal
  } else if (pontos > 0) {
    // "1.234" ou "1.234.567" são milhar; "1234.5" é decimal
    normalizado = /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    normalizado = s; // "300000" = trezentos mil, não três mil
  }

  const n = Number(normalizado);
  return isFinite(n) ? n : null;
}
