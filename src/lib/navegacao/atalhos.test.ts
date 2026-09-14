import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Um atalho de teclado, um destino.
 *
 * Ctrl+K é a tecla mais disputada do sistema, e a disputa era real: a busca
 * global (`GlobalSearch`, montada em toda tela interna pelo `AppLayout`) e a
 * paleta do Financeiro (`FinCommandPalette`, montada dentro de `/financeiro`)
 * escutavam as duas o mesmo `keydown`. Dentro do Financeiro, um Ctrl+K abria
 * DOIS diálogos empilhados, e qual ficava por cima dependia da ordem de
 * montagem — não de escolha de ninguém.
 *
 * O comando de 13/09 pede, por escrito, "evite conflito com atalhos já
 * existentes". Este caso é a varredura que garante isso, porque o conflito não
 * mora em nenhum dos dois arquivos: mora no fato de ambos existirem.
 */

/** Quem escuta `keydown` procurando a tecla K com Ctrl ou Meta. */
const ARQUIVOS_QUE_ESCUTAM_TECLA = [
  'src/components/search/GlobalSearch.tsx',
  'src/components/financeiro/FinCommandPalette.tsx',
  'src/components/layout/MenuDeFerramentas.tsx',
];

const fonte = (caminho: string) => readFileSync(caminho, 'utf8');

describe('atalhos de teclado — um gesto, um destino', () => {
  it('só a busca global responde a Ctrl+K sozinho', () => {
    const comCtrlK = ARQUIVOS_QUE_ESCUTAM_TECLA.filter((caminho) => {
      const s = fonte(caminho);
      // Casa o K sem Shift: `e.key === 'k'` minúsculo. Com Shift o navegador
      // reporta 'K' maiúsculo, que é outro gesto.
      return /e\.key === ['"]k['"]/.test(s) && !/shiftKey/.test(s);
    });
    expect(comCtrlK).toEqual(['src/components/search/GlobalSearch.tsx']);
  });

  it('a paleta do Financeiro deixou de disputar a tecla', () => {
    const s = fonte('src/components/financeiro/FinCommandPalette.tsx');
    expect(s).not.toMatch(/e\.key === ['"]k['"]/);
    // E não ficou órfã: segue alcançável por evento.
    expect(s).toContain('praefectus:abrir-paleta-financeiro');
  });

  it('o diretório usa Shift para não colidir com a busca', () => {
    const s = fonte('src/components/layout/MenuDeFerramentas.tsx');
    expect(s).toMatch(/shiftKey/);
    expect(s).toContain('praefectus:abrir-ferramentas');
  });

  it('cada sobreposição tem um evento próprio de abertura', () => {
    // Três camadas, três nomes. Reusar um evento faria uma abrir a outra.
    const eventos = [
      ['src/components/search/GlobalSearch.tsx', 'praefectus:abrir-busca'],
      ['src/components/layout/MenuDeFerramentas.tsx', 'praefectus:abrir-ferramentas'],
      ['src/components/financeiro/FinCommandPalette.tsx', 'praefectus:abrir-paleta-financeiro'],
    ] as const;
    for (const [caminho, evento] of eventos) {
      expect(fonte(caminho), `${caminho} não escuta ${evento}`).toContain(evento);
    }
    expect(new Set(eventos.map(([, e]) => e)).size).toBe(3);
  });
});
