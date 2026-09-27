/**
 * O prazo de cada peça, pela lei (27/09/2026). A tela sempre acrescenta
 * "confira no edital ou na intimação": a lei dá o prazo, o ato dá o marco.
 */
/** O prazo de cada peça, pela lei — sempre "confira no edital ou na intimação". */
export function prazoDaPeca(categoria: string, titulo: string): { prazo: string; fundamento: string } {
  const t = titulo.toLowerCase();
  if (categoria === 'Esclarecimentos' || categoria === 'Impugnações') return { prazo: 'Até 3 dias úteis antes da data de abertura do certame', fundamento: 'Lei 14.133/2021, art. 164' };
  if (categoria === 'Recursos') {
    if (t.includes('contrarraz')) return { prazo: '3 dias úteis, contados do fim do prazo do recorrente', fundamento: 'Lei 14.133/2021, art. 165' };
    if (t.includes('reconsidera')) return { prazo: '3 dias úteis da intimação; contra impedimento ou inidoneidade, 15 dias úteis', fundamento: 'Lei 14.133/2021, art. 165, II, e art. 166' };
    return { prazo: '3 dias úteis, contados da intimação ou da lavratura da ata', fundamento: 'Lei 14.133/2021, art. 165, I e § 1º' };
  }
  if (categoria === 'Defesas') return { prazo: '15 dias úteis da intimação (multa, impedimento, inidoneidade)', fundamento: 'Lei 14.133/2021, arts. 157 e 158' };
  if (categoria === 'Judicial') return { prazo: '120 dias da ciência do ato, para mandado de segurança', fundamento: 'Lei 12.016/2009, art. 23' };
  if (categoria === 'Reequilíbrio') return { prazo: 'Sem prazo fixo: requerer na vigência e ANTES de assinar qualquer prorrogação (preclusão)', fundamento: 'Lei 14.133/2021, art. 136, I; IN SEGES 5/2017, art. 57' };
  if (categoria === 'Contratos') return { prazo: 'Antes do fim da vigência: contrato vencido não se prorroga', fundamento: 'Lei 14.133/2021, arts. 105, 107 e 111' };
  return { prazo: 'Confira o edital, o contrato ou a intimação', fundamento: '' };
}

