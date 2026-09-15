import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * O envio de anexo da pasta do processo. O que se trava:
 *  - o caminho no storage e a linha em `processo_anexos` são os de sempre
 *    (é por eles que a extração por IA acha o edital);
 *  - falha no upload volta com a mensagem real e não toca a tabela;
 *  - falha no registro remove o arquivo que já subiu — nada de órfão no bucket.
 */

const estado = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  resultadoInsert: { data: null as unknown, error: null as unknown },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: estado.upload, remove: estado.remove }),
    },
    from: () => ({
      insert: (linha: unknown) => {
        estado.insert(linha);
        return { select: () => ({ single: () => Promise.resolve(estado.resultadoInsert) }) };
      },
    }),
  },
}));

import { enviarAnexoDoProcesso } from './anexos';

const arquivo = () => new File(['%PDF-1.4'], 'Edital Dispensa nº 12.pdf', { type: 'application/pdf' });

beforeEach(() => {
  estado.upload.mockReset().mockResolvedValue({ data: {}, error: null });
  estado.remove.mockReset().mockResolvedValue({ data: [], error: null });
  estado.insert.mockReset();
  estado.resultadoInsert = { data: { id: 'anexo-1' }, error: null };
});

describe('enviarAnexoDoProcesso', () => {
  it('sobe o arquivo no caminho da pasta e registra a linha', async () => {
    const r = await enviarAnexoDoProcesso({
      licitacaoId: 'lic-1',
      userId: 'u1',
      arquivo: arquivo(),
      categoria: 'edital',
      descricao: 'Termo de Referência',
      metadata: { tipo: 'termo_referencia' },
    });

    expect(r).toEqual({ ok: true, anexo: { id: 'anexo-1' } });
    const [path, , opcoes] = estado.upload.mock.calls[0];
    expect(path).toMatch(/^u1\/lic-1\/edital\/\d+_Edital_Dispensa_n__12\.pdf$/);
    expect(opcoes).toEqual({ upsert: false });
    expect(estado.insert).toHaveBeenCalledWith(expect.objectContaining({
      licitacao_id: 'lic-1',
      user_id: 'u1',
      categoria: 'edital',
      nome_arquivo: 'Edital Dispensa nº 12.pdf',
      storage_path: path,
      mime_type: 'application/pdf',
      origem: 'upload',
      descricao: 'Termo de Referência',
      metadata: { tipo: 'termo_referencia' },
    }));
    expect(estado.remove).not.toHaveBeenCalled();
  });

  it('falha no upload devolve a mensagem real e não grava na tabela', async () => {
    estado.upload.mockResolvedValue({ data: null, error: { message: 'The object exceeded the maximum allowed size' } });

    const r = await enviarAnexoDoProcesso({ licitacaoId: 'lic-1', userId: 'u1', arquivo: arquivo(), categoria: 'outros' });

    expect(r).toEqual({ ok: false, etapa: 'upload', erro: 'The object exceeded the maximum allowed size' });
    expect(estado.insert).not.toHaveBeenCalled();
    expect(estado.remove).not.toHaveBeenCalled();
  });

  it('falha no registro remove o arquivo enviado', async () => {
    estado.resultadoInsert = { data: null, error: { message: 'new row violates row-level security policy' } };

    const r = await enviarAnexoDoProcesso({ licitacaoId: 'lic-1', userId: 'u1', arquivo: arquivo(), categoria: 'habilitacao' });

    expect(r).toEqual({ ok: false, etapa: 'registro', erro: 'new row violates row-level security policy' });
    const [path] = estado.upload.mock.calls[0];
    expect(estado.remove).toHaveBeenCalledWith([path]);
  });
});
