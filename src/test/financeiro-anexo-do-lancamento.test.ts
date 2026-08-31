import { describe, it, expect } from 'vitest';
import { perfilDoAnexo, exigeDocumento } from '@/lib/financeiro/anexo-do-lancamento';

describe('perfilDoAnexo', () => {
  it('documento com chave nacional promete a leitura', () => {
    for (const t of ['nfe', 'nfce', 'cte']) {
      const p = perfilDoAnexo(t);
      expect(p.leChave).toBe(true);
      expect(p.leXml).toBe(true);
    }
  });

  it('NFS-e não promete leitura por chave — ela é municipal e não tem uma', () => {
    const p = perfilDoAnexo('nfse');
    expect(p.leChave).toBe(false);
    expect(p.ajuda).toContain('municipal');
  });

  it('boleto e guia falam de cobrança, não de NF-e', () => {
    for (const t of ['boleto', 'darf', 'das']) {
      expect(perfilDoAnexo(t).titulo).toContain('boleto');
      expect(perfilDoAnexo(t).leXml).toBe(false);
    }
  });

  it('PIX, TED e DOC pedem comprovante', () => {
    for (const t of ['pix', 'ted', 'doc']) {
      expect(perfilDoAnexo(t).titulo).toContain('comprovante');
    }
  });

  it('todo perfil aceita imagem — recibo se fotografa', () => {
    for (const t of ['nfe', 'nfse', 'boleto', 'recibo', 'pix', 'outro', null]) {
      expect(perfilDoAnexo(t).aceita).toContain('.jpg');
      expect(perfilDoAnexo(t).aceita).toContain('.png');
    }
  });

  it('só quem tem XML fiscal aceita .xml', () => {
    expect(perfilDoAnexo('nfe').aceita).toContain('.xml');
    expect(perfilDoAnexo('boleto').aceita).not.toContain('.xml');
    expect(perfilDoAnexo('pix').aceita).not.toContain('.xml');
  });

  it('sem tipo informado, o texto é genérico e não promete nada específico', () => {
    const p = perfilDoAnexo(null);
    expect(p.titulo).toBe('Anexar o documento');
    expect(p.ajuda).toContain('Escolhendo o tipo');
  });

  it('caixa alta e espaço não mudam o perfil', () => {
    expect(perfilDoAnexo('  NFE  ').titulo).toBe(perfilDoAnexo('nfe').titulo);
  });
});

describe('exigeDocumento', () => {
  it('nota fiscal exige: o arquivo É o documento, com guarda de cinco anos', () => {
    expect(exigeDocumento('nfe')).toBe(true);
    expect(exigeDocumento('nfse')).toBe(true);
  });

  it('tarifa e comprovante não exigem — cobrar de tudo vira ruído', () => {
    expect(exigeDocumento('pix')).toBe(false);
    expect(exigeDocumento('boleto')).toBe(false);
    expect(exigeDocumento(null)).toBe(false);
  });
});
