import { describe, it, expect } from 'vitest';
import { FILTROS_INICIAIS, facetasPorNome, parametrosDaPesquisa, pesquisaValida, rotuloDoRegistro } from '../pesquisa-normativa';

describe('pesquisa normativa', () => {
  it('parâmetros: em branco vira nulo, sem termo a ordem cai para a data, página vira deslocamento', () => {
    const p = parametrosDaPesquisa({ ...FILTROS_INICIAIS, termo: '  ', fonte: 'tcu', dataDe: '2026-09-01', dataAte: '', pagina: 3 });
    expect(p).toMatchObject({ p_termo: null, p_fonte: 'tcu', p_data_de: '2026-09-01', p_data_ate: null, p_ordem: 'data', p_limite: 20, p_deslocamento: 40 });
    expect(parametrosDaPesquisa({ ...FILTROS_INICIAIS, termo: 'reajuste' }).p_ordem).toBe('relevancia');
  });
  it('validação: vazio total não vale; termo curto não vale; período invertido não vale; fonte + período vale', () => {
    expect(pesquisaValida(FILTROS_INICIAIS)).toContain('Informe um termo');
    expect(pesquisaValida({ ...FILTROS_INICIAIS, termo: 'ab' })).toContain('3 letras');
    expect(pesquisaValida({ ...FILTROS_INICIAIS, fonte: 'tcu', dataDe: '2026-09-30', dataAte: '2026-09-01' })).toContain('depois');
    expect(pesquisaValida({ ...FILTROS_INICIAIS, fonte: 'tcu', dataDe: '2026-09-01' })).toBeNull();
    expect(pesquisaValida({ ...FILTROS_INICIAIS, termo: 'atestado' })).toBeNull();
  });
  it('rótulos: Planalto com artigo; TCU com relator, sessão, ata; DOU com órgão, seção, edição e página', () => {
    expect(rotuloDoRegistro({ fonte: 'planalto', identificador: 'Lei 14.133/2021', dispositivo: 'art. 67', titulo: null, data_publicacao: null, detalhe: { lei: 'Lei 14.133/2021', artigo: '67' }, atualizado_em: '2026-09-27T21:20:00Z' }))
      .toEqual({ titulo: 'Lei 14.133/2021, art. 67', meta: ['texto compilado lido em 27/09/2026'] });
    expect(rotuloDoRegistro({ fonte: 'tcu', identificador: 'Acórdão 1610/2025-Plenário', dispositivo: null, titulo: 'ACÓRDÃO 1610/2025', data_publicacao: '2025-07-23', detalhe: { relator: 'BENJAMIN ZYMLER', situacao: 'OFICIALIZADO', numero_ata: '27/2025', colegiado: 'Plenário' }, atualizado_em: '2026-09-27T21:20:00Z' }))
      .toEqual({ titulo: 'Acórdão 1610/2025-Plenário', meta: ['Relator: BENJAMIN ZYMLER', 'Sessão de 23/07/2025', 'Ata 27/2025', 'oficializado'] });
    expect(rotuloDoRegistro({ fonte: 'dou', identificador: 'PORTARIA Nº 156', dispositivo: null, titulo: 'PORTARIA Nº 156, DE 22 DE SETEMBRO DE 2026', data_publicacao: '2026-09-25', detalhe: { orgao: 'Senado Federal/Diretoria-Geral', secao: 'DO1', pagina: 120, edicao: '184' }, atualizado_em: '2026-09-27T21:20:00Z' }))
      .toEqual({ titulo: 'PORTARIA Nº 156, DE 22 DE SETEMBRO DE 2026', meta: ['Senado Federal/Diretoria-Geral', 'DOU DO1 de 25/09/2026, edição 184, p. 120'] });
  });
  it('facetas agrupadas por nome e ordenadas por quantidade', () => {
    const f = facetasPorNome([
      { faceta: 'fonte', valor: 'tcu', quantidade: 3 }, { faceta: 'fonte', valor: 'planalto', quantidade: 12 },
      { faceta: 'ano', valor: '2025', quantidade: 2 }, { faceta: 'colegiado', valor: null, quantidade: 1 },
    ]);
    expect(f.fonte.map((x) => x.valor)).toEqual(['planalto', 'tcu']);
    expect(f.ano).toEqual([{ valor: '2025', quantidade: 2 }]);
    expect(f.colegiado).toBeUndefined();
  });
});
