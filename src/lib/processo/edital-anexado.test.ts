import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Processo fora do PNCP só tem o edital que a pessoa anexou à pasta. A leitura
 * precisa (1) pôr o edital antes do TR e dos anexos, inclusive nos anexos
 * antigos sem `metadata.tipo`; (2) não parar num arquivo ilegível; (3) devolver
 * vazio, sem lançar, quando a pasta não tem nada — quem decide a mensagem é
 * `lerTextoDoEdital`, que conhece as duas fontes.
 */

const h = vi.hoisted(() => ({
  linhas: [] as Array<Record<string, unknown>>,
  textos: {} as Record<string, string | Error>,
  filtros: [] as Array<[string, unknown]>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn((coluna: string, valor: unknown) => {
        h.filtros.push([coluna, valor]);
        return b;
      }),
      order: vi.fn(() => Promise.resolve({ data: h.linhas, error: null })),
      // `temEditalAnexado` aguarda o builder direto (head + count)
      then: (resolve: (v: unknown) => void) => resolve({ count: h.linhas.length, error: null }),
    };
    return b;
  };
  return {
    supabase: {
      from: vi.fn(() => builder()),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://assinada/${path}` }, error: null })),
        })),
      },
    },
  };
});

vi.mock('@/lib/pdf-text-extractor', () => ({
  extractTextFromBlob: vi.fn(async (_blob: Blob, nome: string) => {
    const t = h.textos[nome];
    if (t instanceof Error) throw t;
    return t ?? '';
  }),
}));

import { lerEditalAnexado, temEditalAnexado } from './edital-anexado';

const LONGO = 'Texto do documento com conteúdo suficiente. '.repeat(10);

const anexo = (nome: string, created_at: string, tipo?: string, descricao: string | null = null) => ({
  id: nome,
  nome_arquivo: nome,
  storage_path: `user-1/lic-1/edital/${nome}`,
  descricao,
  metadata: tipo ? { tipo } : {},
  created_at,
});

beforeEach(() => {
  h.linhas = [];
  h.textos = {};
  h.filtros = [];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) })));
});

describe('lerEditalAnexado', () => {
  // Tipo declarado e tipo lido do nome pesam igual (edital → TR → anexo → sem pista):
  // um "edital" antigo sem marcação não fica atrás de um anexo só porque este foi marcado.
  // Dentro do mesmo tipo, o mais recente vem primeiro.
  it('ordena por tipo (declarado ou lido do nome) e, no mesmo tipo, pelo mais recente', async () => {
    h.linhas = [
      anexo('planilha-precos.xlsx', '2026-09-15T10:00:00Z'),
      anexo('anexo-ii-modelo.pdf', '2026-09-14T10:00:00Z', 'anexo_edital'),
      anexo('Termo de Referencia.pdf', '2026-09-13T10:00:00Z'),
      anexo('tr-assinado.pdf', '2026-09-12T10:00:00Z', 'termo_referencia'),
      anexo('scan-001.pdf', '2026-09-11T10:00:00Z', undefined, 'Edital da dispensa'),
      anexo('dispensa-paradigma.pdf', '2026-09-10T10:00:00Z', 'edital'),
    ];
    for (const l of h.linhas) h.textos[String(l.nome_arquivo)] = LONGO;

    const r = await lerEditalAnexado('lic-1');

    expect(r.lidos).toEqual([
      'scan-001.pdf', // sem tipo, descrição "Edital da dispensa" → edital, mais recente
      'dispensa-paradigma.pdf', // edital declarado
      'Termo de Referencia.pdf', // sem tipo, nome de TR → termo de referência, mais recente
      'tr-assinado.pdf', // TR declarado
      'anexo-ii-modelo.pdf', // anexo declarado
      'planilha-precos.xlsx', // sem pista nenhuma
    ]);
    expect(r.texto.startsWith('===== DOCUMENTO: scan-001.pdf =====')).toBe(true);
    expect(h.filtros).toEqual(expect.arrayContaining([['licitacao_id', 'lic-1'], ['categoria', 'edital']]));
  });

  it('ignora arquivo ilegível e curto demais, e segue lendo os outros', async () => {
    h.linhas = [
      anexo('edital-escaneado.pdf', '2026-09-15T10:00:00Z', 'edital'),
      anexo('capa.pdf', '2026-09-14T10:00:00Z', 'anexo_edital'),
      anexo('termo.pdf', '2026-09-13T10:00:00Z', 'termo_referencia'),
    ];
    h.textos = {
      'edital-escaneado.pdf': new Error('PDF sem camada de texto'),
      'capa.pdf': 'Capa',
      'termo.pdf': LONGO,
    };

    const r = await lerEditalAnexado('lic-1', { limitePorArquivo: 50 });

    expect(r.lidos).toEqual(['termo.pdf']);
    expect(r.encontrados).toBe(3);
    expect(r.texto).toBe(`===== DOCUMENTO: termo.pdf =====\n${LONGO.slice(0, 50)}`);
  });

  it('sem anexos na pasta Edital devolve vazio, sem baixar nada', async () => {
    const r = await lerEditalAnexado('lic-1');
    expect(r).toEqual({ texto: '', lidos: [], encontrados: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('temEditalAnexado', () => {
  it('diz se a pasta Edital tem algum arquivo', async () => {
    expect(await temEditalAnexado('lic-1')).toBe(false);
    h.linhas = [anexo('edital.pdf', '2026-09-15T10:00:00Z', 'edital')];
    expect(await temEditalAnexado('lic-1')).toBe(true);
  });
});
