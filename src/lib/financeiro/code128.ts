/**
 * Code 128, subconjunto C (pares de dígitos) — o código de barras da chave
 * de acesso no DANFE (30/09/2026). Sem dependência: a tabela de padrões é a
 * da norma (cada símbolo = 6 larguras, barra/espaço alternados, somando 11
 * módulos; o STOP tem 7 larguras e 13 módulos). Puro e testado.
 */
export const PADROES_CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
export const START_C = 105;
export const STOP = 106;

/** Os símbolos (valores 0–106) de uma sequência de dígitos de tamanho par, com o dígito de verificação. */
export function simbolos128C(digitos: string): number[] {
  const d = digitos.replace(/\D/g, '');
  if (d.length === 0 || d.length % 2 !== 0) throw new Error('Code 128 C exige quantidade par de dígitos');
  const valores: number[] = [START_C];
  for (let i = 0; i < d.length; i += 2) valores.push(Number(d.slice(i, i + 2)));
  let soma = START_C;
  for (let i = 1; i < valores.length; i++) soma += valores[i] * i;
  valores.push(soma % 103);
  valores.push(STOP);
  return valores;
}

/** As larguras em módulos, alternando barra/espaço a partir de uma barra. */
export function larguras128C(digitos: string): number[] {
  return simbolos128C(digitos).flatMap((v) => PADROES_CODE128[v].split('').map(Number));
}

/** Largura total em módulos (para escolher o módulo que cabe na caixa). */
export function modulos128C(digitos: string): number {
  return larguras128C(digitos).reduce((a, b) => a + b, 0);
}
