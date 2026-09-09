import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';
import { PORTAIS_ROBO } from '@/lib/robo/portais';

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

  it('o registro de portais do agente fala o mesmo vocabulário da tela', () => {
    // O defeito que este teste tranca: a tela chamava o portal de `compras-gov`
    // e o agente de `comprasgov`. Nada no caminho comparava os dois, então a
    // sessão era criada, gravada como "enviando", despachada — e só o agente
    // reclamava, com a linha já no banco. Um hífen.
    const registro = ler('src/portals/index.js');
    const doAgente = new Set(
      [...registro.matchAll(/^\s*'([^']+)':\s*\w+Portal,$/gm)].map((m) => m[1]),
    );

    expect(doAgente.size).toBeGreaterThan(20);

    const semModulo = PORTAIS_ROBO
      .filter((p) => !doAgente.has(p.agente))
      .map((p) => `${p.id} -> ${p.agente}`);

    expect(semModulo).toEqual([]);
  });

  it('o espelho Deno traduz exatamente o que a lista do app traduz', () => {
    // Duas cópias de um mapa só se mantêm iguais se algo quebrar quando não
    // estiverem. É o mesmo arranjo de `_shared/licitacao-status.ts`.
    const espelho = readFileSync(
      path.resolve(__dirname, '../../supabase/functions/_shared/robo-portais.ts'),
      'utf8',
    );

    const noEspelho = Object.fromEntries(
      [...espelho.matchAll(/^\s*"([^"]+)":\s*"([^"]+)",$/gm)].map((m) => [m[1], m[2]]),
    );
    const noApp = Object.fromEntries(PORTAIS_ROBO.map((p) => [p.id, p.agente]));

    expect(noEspelho).toEqual(noApp);
  });

  describe('certificado: só é "carregado" o que o Chrome consegue apresentar', () => {
    /**
     * Carrega `src/certificado.js` do ZIP com o mundo trocado, para medir a
     * decisão sem tocar em NSS de verdade.
     *
     * `certutil -L` lista certificados; `certutil -K` lista chaves privadas. O
     * módulo precisa cruzar os dois: `certutil -D` apaga o certificado e DEIXA
     * a chave órfã, e um estado que olhasse só as chaves diria "instalado"
     * sobre um certificado que já não existe — foi o que aconteceu ao limpar o
     * certificado de teste em 09/09/2026.
     */
    function carregar(opts: { certs: string[]; chaves: string[]; policy: boolean }) {
      const saidaL =
        'Certificate Nickname                    Trust Attributes\n' +
        '                                        SSL,S/MIME,JAR/XPI\n\n' +
        opts.certs.map((n) => `${n}                    u,u,u`).join('\n') + '\n';
      const saidaK =
        'certutil: Checking token "NSS Certificate DB"\n' +
        opts.chaves.map((n, i) => `< ${i}> rsa      abc${i}   ${n}`).join('\n') + '\n';

      const falso = {
        child_process: {
          execFileSync: (_bin: string, args: string[]) =>
            args.includes('-K') ? saidaK : saidaL,
        },
        fs: {
          existsSync: () => true,
          mkdirSync: () => undefined,
          writeFileSync: () => undefined,
          readFileSync: () =>
            opts.policy
              ? JSON.stringify({ AutoSelectCertificateForUrls: ['{"pattern":"x","filter":{}}'] })
              : (() => { throw new Error('sem policy'); })(),
        },
        path: { join: (...p: string[]) => p.join('/'), dirname: () => '/tmp', isAbsolute: () => true, resolve: (...p: string[]) => p.join('/') },
      } as Record<string, unknown>;

      const mod = { exports: {} as Record<string, unknown> };
      const ctx = vm.createContext({
        require: (n: string) => falso[n],
        module: mod,
        exports: mod.exports,
        process: { env: {} },
        console,
        JSON,
        Buffer,
      });
      new vm.Script(ler('src/certificado.js')).runInContext(ctx);
      return mod.exports as { estado: () => Record<string, unknown> };
    }

    it('chave órfã, sem certificado, não conta como instalado', () => {
      const est = carregar({ certs: [], chaves: ['ACME - Teste'], policy: true }).estado();
      expect(est.instalado_no_navegador).toBe(false);
      expect(est.carregado).toBe(false);
    });

    it('certificado sem chave privada não conta — não dá para assinar', () => {
      const est = carregar({ certs: ['ACME - Teste'], chaves: [], policy: true }).estado();
      expect(est.carregado).toBe(false);
    });

    it('com certificado, chave e policy, aí sim', () => {
      const est = carregar({ certs: ['ACME - Teste'], chaves: ['ACME - Teste'], policy: true }).estado();
      expect(est.carregado).toBe(true);
      expect(est.titulares).toEqual(['ACME - Teste']);
    });

    it('sem policy o Chrome abriria o diálogo de escolha — não é utilizável', () => {
      const est = carregar({ certs: ['ACME - Teste'], chaves: ['ACME - Teste'], policy: false }).estado();
      expect(est.carregado).toBe(false);
      expect(String(est.motivo)).toContain('policy');
    });
  });

  it('não declara enviarProposta na classe base — o 501 depende disso', () => {
    // Um stub em BasePortal faria todos os 23 portais parecerem prontos, e a
    // falta do formulário só apareceria como 500 no meio de um pregão.
    expect(ler('src/portals/base-portal.js')).not.toMatch(/^\s*async enviarProposta\s*\(/m);
  });
});
