/**
 * Os nomes dos meses das telas de Metas.
 *
 * Ficam num arquivo sem componente por dois motivos: o Fast Refresh só
 * funciona quando um módulo exporta apenas componentes, e esta lista estava
 * copiada em quatro telas — cópia que diverge é cópia que mente, bastava
 * alguém corrigir "Março" num arquivo só.
 */

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];
