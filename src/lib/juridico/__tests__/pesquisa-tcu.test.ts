import { describe, it, expect } from 'vitest';
import { FILTROS_TCU_INICIAIS, citacaoDoAcordao, corpoDaPesquisa, fichasAtivas, identificadorDoResumo, pesquisaTcuValida, resumoDaPagina, segmentosDoFragmento } from '../pesquisa-tcu';

describe('pesquisa ao vivo no TCU — a tela', () => {
  it('corpo do POST: campos em branco viram nulo, página e tamanho fixos; sem termo a relevância vira "mais recentes"', () => {
    const c = corpoDaPesquisa({ ...FILTROS_TCU_INICIAIS, termo: ' atestado ', ano: '2025', colegiado: ['Plenário'], pagina: 3 });
    expect(c).toMatchObject({ acao: 'pesquisar', termo: 'atestado', ordem: 'relevancia', pagina: 3, porPagina: 20 });
    expect(c.filtros).toMatchObject({ ano: '2025', colegiado: ['Plenário'], numero: null, relator: null, dataDe: null });
    expect(corpoDaPesquisa({ ...FILTROS_TCU_INICIAIS, relator: 'Zymler' }).ordem).toBe('recentes');
    expect(corpoDaPesquisa({ ...FILTROS_TCU_INICIAIS, relator: 'Zymler', ordem: 'antigos' }).ordem).toBe('antigos');
  });
  it('validação: nada preenchido não vale; só um filtro vale; ano torto e período invertido não valem', () => {
    expect(pesquisaTcuValida(FILTROS_TCU_INICIAIS)).toContain('Informe um termo');
    expect(pesquisaTcuValida({ ...FILTROS_TCU_INICIAIS, numero: '2991' })).toBeNull();
    expect(pesquisaTcuValida({ ...FILTROS_TCU_INICIAIS, ano: '25' })).toContain('4 dígitos');
    expect(pesquisaTcuValida({ ...FILTROS_TCU_INICIAIS, dataDe: '2025-12-01', dataAte: '2025-01-01' })).toContain('depois');
  });
  it('trecho com <em> vira segmentos com destaque, sem HTML', () => {
    expect(segmentosDoFragmento('...seu <em>atestado</em> de capacidade &amp; <b>técnica</b>...')).toEqual([
      { texto: '...seu ', destaque: false }, { texto: 'atestado', destaque: true }, { texto: ' de capacidade & técnica...', destaque: false },
    ]);
    expect(segmentosDoFragmento('sem marca')).toEqual([{ texto: 'sem marca', destaque: false }]);
  });
  it('identificador e resumo da página', () => {
    expect(identificadorDoResumo({ tipo: 'ACÓRDÃO DE RELAÇÃO', numero: '2991', ano: '2025', colegiado: 'Plenário' })).toBe('Acórdão 2991/2025-Plenário');
    expect(resumoDaPagina(20536, 2)).toBe('20.536 acórdão(s) · página 2 de 1.027');
    expect(resumoDaPagina(0, 1)).toBe('0 acórdão(s) · página 1 de 1');
  });
  it('fichas: cada filtro em uso vira uma ficha que sabe se limpar', () => {
    const f = { ...FILTROS_TCU_INICIAIS, ano: '2025', colegiado: ['Plenário', 'Primeira Câmara'], tipo: ['ACÓRDÃO'], dataDe: '2025-01-01', processo: '021.706/2025-5' };
    const fichas = fichasAtivas(f);
    expect(fichas.map((c) => c.rotulo)).toEqual(['ano 2025', 'Plenário', 'Primeira Câmara', 'TC 021.706/2025-5', 'acórdão', 'sessão 01/01/2025 a hoje']);
    expect(fichas.find((c) => c.rotulo === 'Plenário')!.limpar).toEqual({ colegiado: ['Primeira Câmara'] });
    expect(fichas.find((c) => c.chave === 'periodo')!.limpar).toEqual({ dataDe: '', dataAte: '' });
    expect(fichasAtivas(FILTROS_TCU_INICIAIS)).toEqual([]);
  });
  it('citação pronta para a peça, com o nome do relator em caixa normal', () => {
    expect(citacaoDoAcordao({ tipo: 'ACÓRDÃO', numero: '2418', ano: '2026', colegiado: 'Plenário', relator: 'BENJAMIN ZYMLER', data_sessao_br: '09/09/2026', processo: '015.392/2026-0' }))
      .toBe('Acórdão 2418/2026-Plenário, rel. Min. Benjamin Zymler, sessão de 09/09/2026 (TC 015.392/2026-0)');
    expect(citacaoDoAcordao({ tipo: 'ACÓRDÃO', numero: '1', ano: '2020', colegiado: 'Segunda Câmara', relator: 'VITAL DO RÊGO', data_sessao_br: null, processo: null })).toBe('Acórdão 1/2020-Segunda Câmara, rel. Min. Vital do Rêgo');
  });
});
