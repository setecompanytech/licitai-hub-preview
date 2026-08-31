import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';

/**
 * O agente da VPS é gerado como texto dentro de template literals TypeScript.
 * O `tsc` só vê uma `string` — o conteúdo nunca é analisado como JavaScript.
 *
 * Foi assim que `src/portals/index.js` passou meses saindo com uma camada de
 * escape a mais (`\\\`` em vez de `` \` ``): o build passava, o ZIP baixava, e o
 * agente morria no `require('./portals')` da primeira linha do `index.js` — sem
 * subir rota nenhuma, nem as que já existiam.
 *
 * Estes testes leem o ZIP de verdade e compilam cada arquivo.
 */

let arquivos: Record<string, string>;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(await (await generateAgentTemplate()).arrayBuffer());
  const entradas = await Promise.all(
    Object.keys(zip.files)
      .filter((nome) => !zip.files[nome].dir)
      .map(async (nome) => [nome, await zip.files[nome].async('string')] as const),
  );
  arquivos = Object.fromEntries(entradas);
});

/** Localiza um arquivo pelo caminho relativo, ignorando a pasta raiz do ZIP. */
function ler(caminho: string): string {
  const chave = Object.keys(arquivos).find((n) => n.endsWith(caminho));
  if (!chave) throw new Error(`${caminho} não está no ZIP gerado`);
  return arquivos[chave];
}

describe('template do agente de lances', () => {
  it('gera JavaScript que compila, em todos os arquivos', () => {
    const js = Object.keys(arquivos).filter((n) => n.endsWith('.js'));
    expect(js.length).toBeGreaterThan(25);

    // `new vm.Script` compila sem executar: pega erro de sintaxe, não roda require.
    const quebrados = js.flatMap((nome) => {
      try {
        new vm.Script(arquivos[nome], { filename: nome });
        return [];
      } catch (e) {
        return [`${nome} — ${(e as Error).message}`];
      }
    });

    expect(quebrados).toEqual([]);
  });

  it('declara no /health exatamente as rotas que registra', () => {
    const index = ler('src/index.js');

    const declaradas = [...index.matchAll(/^\s*'((?:GET|POST) \/[^']*)',$/gm)]
      .map((m) => m[1])
      .sort();
    const registradas = [...index.matchAll(/app\.(get|post)\('([^']+)'/g)]
      .map((m) => `${m[1].toUpperCase()} ${m[2]}`)
      .sort();

    // Sem esta igualdade o Praefectus volta a ter de sondar o agente para
    // descobrir o que existe — e sondar o /kill-switch às cegas aborta disputa.
    expect(declaradas).toEqual(registradas);
    expect(registradas).toContain('POST /kill-switch');
    expect(registradas).toContain('POST /api/proposta/enviar');
  });

  it('carimba a mesma versão no package.json, no /health e no log de boot', () => {
    const versao = JSON.parse(ler('package.json')).version;
    const index = ler('src/index.js');

    // VPS e template ambos dizendo "2.1.0" sendo código diferente foi o que
    // escondeu a ausência do /kill-switch: o número não denunciava a diferença.
    expect(index).toContain(`version: '${versao}'`);
    expect(index).toContain(`Agente de Lances v${versao}`);
  });

  it('injeta o Supabase ativo no CALLBACK_URL do .env.example', () => {
    // O gerador substitui o literal de produção pela URL de `VITE_SUPABASE_URL`.
    // Fixar aqui um projeto quebraria em qualquer ambiente que aponte para outro
    // — e sob vitest o `define` do vite.config.ts não se aplica. O que precisa
    // valer é a substituição ter acontecido, seja qual for o destino.
    const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://uwtyuwktxalnpgrcbbgk.supabase.co';
    expect(ler('.env.example')).toContain(
      `CALLBACK_URL=${url}/functions/v1/robo-lances-webhook/callback`,
    );
  });

  it('não declara enviarProposta na classe base — o 501 depende disso', () => {
    // Um stub em BasePortal faria todos os 23 portais parecerem prontos, e a
    // falta do formulário só apareceria como 500 no meio de um pregão.
    expect(ler('src/portals/base-portal.js')).not.toMatch(/^\s*async enviarProposta\s*\(/m);
  });
});
