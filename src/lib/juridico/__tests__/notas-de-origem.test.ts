import { describe, it, expect } from 'vitest';
import { marcarNotasComoLinks, notasDoTexto, resumoDasNotas, textoParaExportacao } from '../notas-de-origem';
import { NORMAS_CONFERIDAS, normaConferida } from '../normas-conferidas';
import { NORMAS_CONFERIDAS as ESPELHO } from '../../../../supabase/functions/_shared/normas-conferidas';

const PECA = `O reajuste aplica-se por apostila [[norma:Lei 14.133/2021, art. 136, I]], observado o interregno anual [[norma:Lei 10.192/2001, art. 2º, § 1º]].
O contrato 772/2024 tem data-base em 11/06/2024 [[fonte:sistema]] e o ofício do órgão fixou prazo [[fonte:anexo|Ofício 12/2026, p. 2]].
Na linha do precedente [[fonte:base|abc-1|Acórdão 2.000/2020]], e conforme o art. 65 da Lei 14.133/2021 [[norma:Lei 14.133/2021, art. 65]].`;

describe('normas conferidas', () => {
  it('a edge tem o mesmo espelho do front', () => {
    expect(ESPELHO).toEqual(NORMAS_CONFERIDAS);
  });
  it('casa a citação em texto livre com a lista, do mais específico ao genérico', () => {
    expect(normaConferida('Lei 14.133/2021, art. 92, § 3º')?.chave).toBe('14.133|92|3');
    expect(normaConferida('Lei nº 14.133/2021, art. 124, II, "d"')?.chave).toBe('14.133|124|ii|d');
    expect(normaConferida('art. 136, I da Lei 14.133/2021')?.chave).toBe('14.133|136|i');
    expect(normaConferida('Lei 10.192/2001, art. 2º, § 1º')?.chave).toBe('10.192|2|1');
    expect(normaConferida('Acórdão TCU 1.563/2004')?.chave).toBe('tcu|1.563/2004');
    expect(normaConferida('Lei 14.133/2021, art. 65')).toBeNull();
    expect(normaConferida('Lei 8.666/1993, art. 65')).toBeNull();
  });
});

describe('notas de origem', () => {
  it('lê os quatro tipos de marcador e sabe qual norma é conferida', () => {
    const notas = notasDoTexto(PECA);
    expect(notas.map((n) => n.tipo)).toEqual(['norma', 'norma', 'sistema', 'anexo', 'base', 'norma']);
    const r = resumoDasNotas(PECA);
    expect(r.normasConferidas).toBe(2);
    expect(r.normasAConfirmar).toEqual(['Lei 14.133/2021, art. 65']);
    expect(r.fontesDoSistema).toBe(1);
    expect(r.anexos).toBe(1);
    expect(r.base).toBe(1);
  });
  it('vira link nota:// no preview e parêntese no documento exportado', () => {
    const md = marcarNotasComoLinks(PECA);
    expect(md).toContain('[Lei 14.133/2021, art. 136, I](nota://norma/');
    expect(md).toContain('[dado do sistema](nota://fonte/sistema)');
    expect(md).not.toContain('[[');
    const doc = textoParaExportacao(PECA);
    expect(doc).toContain('por apostila (Lei 14.133/2021, art. 136, I),');
    expect(doc).toContain('(Lei 14.133/2021, art. 65 — a confirmar)');
    expect(doc).toContain('(doc. anexo: Ofício 12/2026, p. 2)');
    expect(doc).toContain('(ref.: Acórdão 2.000/2020)');
    expect(doc).not.toContain('[[');
    expect(doc).not.toContain('nota://');
  });
});
