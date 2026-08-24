/**
 * O número da ata, sem repetir o que o rótulo já diz.
 *
 * A tela escrevia "ATA SRP n. " antes do valor, e o valor às vezes já é o nome
 * inteiro ("ATA SRP Nº 022/2024") — saía "ATA SRP n. ATA SRP Nº 022/2024".
 * Quando o próprio número se apresenta, ele fala por si.
 */
export const rotuloDaAta = (numero: string | null | undefined) => {
  const n = (numero || '').trim();
  if (!n) return 'ATA SRP';
  return /^\s*(ata|arp)\b/i.test(n) ? n : `ATA SRP n. ${n}`;
};
