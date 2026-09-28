import { describe, it, expect, vi } from 'vitest';
import {
  dataSolr, facetasDoTcu, filtroDoTcu, guardarAcordao, identificadorDoAcordao, pesquisarTcu, processoFormatado, resumirAcordao, termoDoTcu, textoLimpoDoTcu, textoParaBase,
  type AcordaoCompleto, type EscritorDaBase,
} from '../../../../supabase/functions/_shared/tcu-pesquisa';

/** Um documento resumido como o portal devolve (lido ao vivo em 27/09/2026). */
const RESUMIDO = {
  KEY: 'ACORDAO-COMPLETO-2738924', TIPO: 'ACÓRDÃO DE RELAÇÃO', TITULO: 'ACÓRDÃO DE RELAÇÃO 2991/2025 ATA 50/2025 - PLENÁRIO',
  FRAGMENTO1: '...inabilitada sob o fundamento de que seu <em>atestado</em> de capacidade técnica não continha...', FRAGMENTO2: '',
  NUMACORDAO: '2991', ANOACORDAO: '2025', NUMATA: '50/2025', COLEGIADO: 'Plenário', DATASESSAO: '08/12/2025', PROC: '2170620255', RELATOR: 'BRUNO DANTAS', SITUACAO: 'OFICIALIZADO',
  URLARQUIVO: 'https://contas.tcu.gov.br/sisdoc/ObterDocumentoSisdoc?codVersao=editavel&codArqCatalogado=32375971', URLARQUIVOPDF: 'https://contas.tcu.gov.br/sisdoc/ObterDocumentoSisdoc?codArqCatalogado=32375971',
};

describe('gramática do filtro da Pesquisa Integrada do TCU', () => {
  it('cada campo no formato do portal, na ordem do formulário', () => {
    expect(filtroDoTcu({ numero: '2.991', ano: 2025, colegiado: 'Plenário', relator: 'Bruno Dantas' })).toBe('NUMACORDAO:"2991" ANOACORDAO:"2025" RELATOR:"Bruno Dantas" COLEGIADO:"Plenário"');
    expect(filtroDoTcu({ colegiado: ['Plenário', 'Primeira Câmara'], tipo: ['ACÓRDÃO'] })).toBe('COLEGIADO:("Plenário" OU "Primeira Câmara") COPIATIPO:"ACÓRDÃO"');
    expect(filtroDoTcu({ processo: '021.706/2025-5', anoProcesso: '2025', entidade: 'Prefeitura de Barcarena' })).toBe('PROC:"0217062025 5" ANOPROCESSO:"2025" ENTIDADE:"Prefeitura de Barcarena"'.replace('0217062025 5', '02170620255'));
  });
  it('período da sessão vira DTRELEVANCIA:[AAAAMMDD to AAAAMMDD], com * no lado aberto', () => {
    expect(filtroDoTcu({ dataDe: '2025-01-01', dataAte: '2025-03-31' })).toBe('DTRELEVANCIA:[20250101 to 20250331]');
    expect(filtroDoTcu({ dataDe: '01/01/2025' })).toBe('DTRELEVANCIA:[20250101 to *]');
    expect(filtroDoTcu({ dataAte: '2025-03-31' })).toBe('DTRELEVANCIA:[* to 20250331]');
    expect(dataSolr('não é data')).toBeNull();
  });
  it('vazio é vazio; aspas dentro do valor caem; número inválido some', () => {
    expect(filtroDoTcu({})).toBe('');
    expect(filtroDoTcu({ termo: 'ignorado', numero: 'abc', relator: 'Bruno "X" Dantas' })).toBe('RELATOR:"Bruno X Dantas"');
    expect(termoDoTcu('')).toBe('*');
    expect(termoDoTcu('  atestado   adj capacidade ')).toBe('atestado adj capacidade');
  });
});

describe('leitura do que o portal devolve', () => {
  it('resumo: identificador no padrão da base, data ISO, processo TC formatado, links', () => {
    const r = resumirAcordao(RESUMIDO);
    expect(identificadorDoAcordao(r)).toBe('Acórdão 2991/2025-Plenário');
    expect(r).toMatchObject({ key: 'ACORDAO-COMPLETO-2738924', numero: '2991', ano: '2025', colegiado: 'Plenário', relator: 'BRUNO DANTAS', data_sessao: '2025-12-08', data_sessao_br: '08/12/2025', numero_ata: '50/2025', processo: '021.706/2025-5', situacao: 'OFICIALIZADO' });
    expect(r.fragmentos).toEqual([RESUMIDO.FRAGMENTO1]);
    expect(r.url_portal).toContain('KEY:ACORDAO-COMPLETO-2738924');
    expect(identificadorDoAcordao({ numero: '12', ano: '1999', colegiado: 'Segunda Câmara', tipo: 'DECISÃO' })).toBe('Decisão 12/1999-Segunda Câmara');
  });
  it('processo: já formatado fica; dígitos viram nnn.nnn/aaaa-d; lixo volta como veio', () => {
    expect(processoFormatado(' 031.502/2022-9 ')).toBe('031.502/2022-9');
    expect(processoFormatado('2170620255')).toBe('021.706/2025-5');
    expect(processoFormatado('')).toBeNull();
    expect(processoFormatado('12')).toBe('12');
  });
  it('facetas: lista achatada [valor, quantidade…] vira pares; ano do mais novo para o mais velho', () => {
    const f = facetasDoTcu([
      { nome: 'COPIATIPO', itens: ['ACÓRDÃO', 718, 'ACÓRDÃO DE RELAÇÃO', 105] },
      { nome: 'COPIACOLEGIADO', itens: ['Plenário', 331, 'Primeira Câmara', 245] },
      { nome: 'COPIARELATOR', itens: null },
      { nome: 'ANOACORDAO', itens: ['2024', 10, '2025', 823] },
      { nome: 'OUTRA', itens: ['x', 1] },
    ]);
    expect(f.tipo).toEqual([{ valor: 'ACÓRDÃO', quantidade: 718 }, { valor: 'ACÓRDÃO DE RELAÇÃO', quantidade: 105 }]);
    expect(f.colegiado[1]).toEqual({ valor: 'Primeira Câmara', quantidade: 245 });
    expect(f.relator).toEqual([]);
    expect(f.ano.map((a) => a.valor)).toEqual(['2025', '2024']);
  });
  it('HTML do portal vira texto: parágrafos em linhas, notas de rodapé fora, entidades resolvidas', () => {
    expect(textoLimpoDoTcu('<p class="paragraph">VISTOS, relatados[footnoteRef:2] &amp; discutidos</p><p>9.1. conhecer &nbsp;do recurso</p>')).toBe('VISTOS, relatados & discutidos\n9.1. conhecer do recurso');
  });
  it('pesquisa: monta a URL como o portal, com cabeçalhos de navegador, e recusa a página do firewall', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      expect(u.startsWith('https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/documentosResumidos?')).toBe(true);
      const q = new URL(u).searchParams;
      expect(q.get('termo')).toBe('atestado');
      expect(q.get('filtro')).toBe('ANOACORDAO:"2025"');
      expect(q.get('ordenacao')).toBe('DTRELEVANCIA desc, NUMACORDAOINT desc, COPIACOLEGIADO desc,KEY asc');
      expect(q.get('quantidade')).toBe('20');
      expect(q.get('inicio')).toBe('40');
      expect((init?.headers as Record<string, string>)['User-Agent']).toContain('Mozilla');
      return new Response(JSON.stringify({ quantidadeEncontrada: 823, inicio: 40, documentos: [RESUMIDO], facetas: { campos: [{ nome: 'ANOACORDAO', itens: ['2025', 823] }] }, mensagemAlerta: null, spell: null }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await pesquisarTcu({ termo: 'atestado', filtro: 'ANOACORDAO:"2025"', ordem: 'recentes', quantidade: 20, inicio: 40 }, fetchFn);
    expect(r.total).toBe(823);
    expect(r.documentos[0].numero).toBe('2991');
    expect(r.facetas.ano).toEqual([{ valor: '2025', quantidade: 823 }]);

    const bloqueado = (async () => new Response('<html><head><title>Requisição rejeitada</title></head><body>firewall</body></html>', { status: 200 })) as unknown as typeof fetch;
    await expect(pesquisarTcu({ termo: 'x' }, bloqueado)).rejects.toThrow(/firewall/);
  });
});

describe('guardar na base', () => {
  const completo: AcordaoCompleto = {
    ...resumirAcordao(RESUMIDO), sumario: 'LICITAÇÃO. ATESTADO. REPRESENTAÇÃO.', acordao: 'VISTOS… 9.1. conhecer.', voto: 'Voto do relator.', relatorio: 'Relatório.', assunto: 'Representação', entidade: 'Prefeitura X', tipo_processo: 'REPRESENTAÇÃO (RP)', unidade_tecnica: 'AudContratações',
  };
  it('texto para a base: cabeçalho com relator, sessão, ata, processo; sumário, acórdão e voto inteiros', () => {
    const t = textoParaBase(completo);
    expect(t).toContain('ACÓRDÃO DE RELAÇÃO 2991/2025 ATA 50/2025 - PLENÁRIO');
    expect(t).toContain('Relator: BRUNO DANTAS · Sessão: 08/12/2025 · Ata: 50/2025 · Processo: 021.706/2025-5');
    expect(t).toContain('\n\nSUMÁRIO\nLICITAÇÃO. ATESTADO.');
    expect(t).toContain('\n\nVOTO\nVoto do relator.');
  });
  const fakeDb = (existente: { id: string; versao_hash: string } | null) => {
    const chamadas: Array<{ op: string; registro?: Record<string, unknown> }> = [];
    const db: EscritorDaBase = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: existente, error: null }) }) }) }) }),
        insert: (r) => { chamadas.push({ op: 'insert', registro: r }); return { select: () => ({ single: async () => ({ data: { id: 'novo-id' }, error: null }) }) }; },
        update: (r) => { chamadas.push({ op: 'update', registro: r }); return { eq: async () => ({ error: null }) }; },
      }),
    };
    return { db, chamadas };
  };
  it('novo: insere com fonte tcu, identificador padrão, detalhe com key, processo, origem e texto_completo', async () => {
    const { db, chamadas } = fakeDb(null);
    const r = await guardarAcordao(db, completo, { guardado_por: 'u1', origem: 'pesquisa-integrada' });
    expect(r).toEqual({ id: 'novo-id', identificador: 'Acórdão 2991/2025-Plenário', situacao: 'novo' });
    expect(chamadas[0].op).toBe('insert');
    expect(chamadas[0].registro).toMatchObject({ fonte: 'tcu', tipo: 'acordao', identificador: 'Acórdão 2991/2025-Plenário', dispositivo: null, data_publicacao: '2025-12-08', ementa: 'LICITAÇÃO. ATESTADO. REPRESENTAÇÃO.' });
    expect(chamadas[0].registro!.detalhe).toMatchObject({ key: 'ACORDAO-COMPLETO-2738924', processo: '021.706/2025-5', origem: 'pesquisa-integrada', guardado_por: 'u1', texto_completo: true });
    expect(String(chamadas[0].registro!.versao_hash)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('já na base só com o sumário (hash diferente): atualiza; hash igual: nada', async () => {
    const a = fakeDb({ id: 'velho', versao_hash: 'outro' });
    expect(await guardarAcordao(a.db, completo, { origem: 'redacao' })).toEqual({ id: 'velho', identificador: 'Acórdão 2991/2025-Plenário', situacao: 'atualizado' });
    expect(a.chamadas[0].op).toBe('update');
    const hash = String(a.chamadas[0].registro!.versao_hash);
    const b = fakeDb({ id: 'velho', versao_hash: hash });
    expect((await guardarAcordao(b.db, completo, { origem: 'redacao' })).situacao).toBe('igual');
    expect(b.chamadas).toEqual([]);
  });
});
