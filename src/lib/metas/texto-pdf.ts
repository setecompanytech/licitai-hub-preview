/**
 * As fontes padrão do jsPDF só conhecem CP1252. A seta '→' (U+2192) está fora
 * dela: no relatório de 31/08 saiu como "!’" e desalinhou o espaçamento da
 * LINHA INTEIRA — o glifo inválido quebra a métrica do texto. Todo texto que
 * vai ao PDF passa por aqui: o que a fonte não tem é trocado por um
 * equivalente que ela tem, nunca deixado passar.
 *
 * Módulo puro (sem jsPDF) para o teste não arrastar o gerador junto.
 */

const FORA_DA_FONTE: Record<string, string> = {
  '→': '»',
  '←': '«',
  '−': '-', // sinal de menos tipográfico (U+2212)
};

// Além do Latin-1, o CP1252 tem um punhado de tipográficos (— – ’ “ ” • … €)
// que o português usa; eles ficam.
const EXTRAS_CP1252 = '€‚ƒ„…†‡ˆ‰'
  + 'Š‹ŒŽ‘’“”•–—˜'
  + '™š›œžŸ';
const RX_FORA = new RegExp(`[^\\u0020-\\u00FF\\n${EXTRAS_CP1252}]`, 'g');

export function textoSeguroParaPdf(texto: string): string {
  return texto.replace(RX_FORA, (ch) => FORA_DA_FONTE[ch] ?? '');
}
