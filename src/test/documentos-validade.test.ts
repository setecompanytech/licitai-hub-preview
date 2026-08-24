import { describe, it, expect } from 'vitest';
import { extrairValidadeDoTexto, montarData } from '@/lib/documentos/validade';

const HOJE = new Date(2026, 7, 24);
const br = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR') : null);

describe('extrairValidadeDoTexto', () => {
  // O caso real que expôs o defeito: a CND estadual da SEFA/PA. O sistema
  // gravava 10/07/2026 — a emissão —, e a certidão valia até 06/01/2027.
  it('não confunde a data de emissão com a validade', () => {
    const texto = [
      'Emitida às: 14:41:42 do dia 10/07/2026',
      'Válida até: 06/01/2027',
      'Número da Certidão: 702026081315623-2',
      'Código de Controle de Autenticidade: 7D7CEA16.1B83C71C.9E7386BB.531F3DD9',
    ].join('\n');
    expect(br(extrairValidadeDoTexto(texto, HOJE))).toBe('06/01/2027');
  });

  // A causa nº 2: a janela olhava 64 caracteres para os dois lados, então a
  // emissão herdava o "Válida até" da linha seguinte. O rótulo de uma data é
  // o que vem ANTES dela.
  it('não deixa a data anterior herdar o rótulo da seguinte', () => {
    expect(br(extrairValidadeDoTexto('Emissão 01/02/2026 Validade 05/09/2026', HOJE))).toBe('05/09/2026');
    expect(br(extrairValidadeDoTexto('Expedida em 03/03/2026 - válida até 03/03/2027', HOJE))).toBe('03/03/2027');
  });

  it('lê as formas usuais de dizer o prazo', () => {
    expect(br(extrairValidadeDoTexto('Validade: 30/11/2026', HOJE))).toBe('30/11/2026');
    expect(br(extrairValidadeDoTexto('Vencimento 15/10/2026', HOJE))).toBe('15/10/2026');
    expect(br(extrairValidadeDoTexto('Eficácia até 2026-12-31', HOJE))).toBe('31/12/2026');
    expect(br(extrairValidadeDoTexto('Esta certidão é válida até 06/01/2027.', HOJE))).toBe('06/01/2027');
  });

  it('aceita certidão já vencida quando é a data rotulada', () => {
    expect(br(extrairValidadeDoTexto('Emitida em 01/01/2026. Válida até 02/08/2026.', HOJE))).toBe('02/08/2026');
  });

  it('recusa data impossível em vez de deslocá-la', () => {
    expect(montarData(2026, 2, 31)).toBeNull();
    expect(br(extrairValidadeDoTexto('Validade: 31/02/2026', HOJE))).toBeNull();
  });

  it('devolve nulo quando não há data alguma', () => {
    expect(extrairValidadeDoTexto('Certidão sem qualquer data', HOJE)).toBeNull();
    expect(extrairValidadeDoTexto('   ', HOJE)).toBeNull();
  });
});
