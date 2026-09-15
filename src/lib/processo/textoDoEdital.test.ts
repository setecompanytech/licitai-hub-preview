import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lerTextoDoEdital` alimenta o checklist de habilitação e a proposta. O PNCP
 * continua sendo a primeira fonte; processo fora do portal cai no edital
 * anexado à pasta; e, sem edital em lugar nenhum, a mensagem diz o que fazer.
 */

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  lerEditalAnexado: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: h.invoke },
    storage: {
      from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://assinada/pncp' }, error: null }) }),
    },
  },
}));

vi.mock('@/lib/pdf-text-extractor', () => ({
  extractTextFromBlob: vi.fn(async () => 'Conteúdo do edital publicado no PNCP. '.repeat(10)),
}));

vi.mock('@/lib/processo/edital-anexado', () => ({ lerEditalAnexado: h.lerEditalAnexado }));

import { MENSAGEM_EDITAL_ILEGIVEL, MENSAGEM_SEM_EDITAL, lerTextoDoEdital } from './textoDoEdital';

const semFontePncp = () =>
  h.invoke.mockResolvedValue({ data: { success: false, error: 'Contratação sem coordenadas PNCP' }, error: null });

beforeEach(() => {
  h.invoke.mockReset();
  h.lerEditalAnexado.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) })));
});

describe('lerTextoDoEdital', () => {
  it('com PNCP devolve o texto do PNCP e nem consulta a pasta', async () => {
    h.invoke.mockImplementation(async (_fn: string, { body }: { body: { action: string } }) =>
      body.action === 'listar'
        ? { data: { success: true, arquivos: [{ sequencial: 1, titulo: 'Edital' }] }, error: null }
        : { data: { success: true, path: 'pncp/edital.pdf', nome: 'edital.pdf' }, error: null },
    );

    const r = await lerTextoDoEdital('lic-1');

    expect(r.lidos).toEqual(['edital.pdf']);
    expect(r.texto).toContain('===== DOCUMENTO: edital.pdf =====');
    expect(h.lerEditalAnexado).not.toHaveBeenCalled();
  });

  it('sem PNCP cai para o edital anexado à pasta', async () => {
    semFontePncp();
    const anexado = { texto: '===== DOCUMENTO: dispensa.pdf =====\nTexto', lidos: ['dispensa.pdf'], encontrados: 1 };
    h.lerEditalAnexado.mockResolvedValue(anexado);
    const aoProgredir = vi.fn();

    const r = await lerTextoDoEdital('lic-1', { limitePorArquivo: 30_000, aoProgredir });

    expect(r).toEqual({ texto: anexado.texto, lidos: anexado.lidos });
    expect(h.lerEditalAnexado).toHaveBeenCalledWith('lic-1', { limitePorArquivo: 30_000, aoProgredir });
  });

  it('PNCP que lista arquivos mas não devolve texto também cai para a pasta', async () => {
    h.invoke.mockImplementation(async (_fn: string, { body }: { body: { action: string } }) =>
      body.action === 'listar'
        ? { data: { success: true, arquivos: [{ sequencial: 1, titulo: 'Edital' }] }, error: null }
        : { data: { success: false }, error: null },
    );
    h.lerEditalAnexado.mockResolvedValue({ texto: 'texto anexado', lidos: ['edital.pdf'], encontrados: 1 });

    const r = await lerTextoDoEdital('lic-1');

    expect(r.lidos).toEqual(['edital.pdf']);
  });

  it('sem edital no PNCP nem na pasta lança a mensagem acionável', async () => {
    semFontePncp();
    h.lerEditalAnexado.mockResolvedValue({ texto: '', lidos: [], encontrados: 0 });

    await expect(lerTextoDoEdital('lic-1')).rejects.toThrow(MENSAGEM_SEM_EDITAL);
    expect(MENSAGEM_SEM_EDITAL).toBe('Nenhum edital localizado no PNCP nem anexado à pasta. Envie o edital em Anexos › Edital.');
  });

  it('edital anexado mas ilegível lança a mensagem de arquivo ilegível, não a de ausência', async () => {
    semFontePncp();
    h.lerEditalAnexado.mockResolvedValue({ texto: '', lidos: [], encontrados: 2 });

    await expect(lerTextoDoEdital('lic-1')).rejects.toThrow(MENSAGEM_EDITAL_ILEGIVEL);
  });
});
