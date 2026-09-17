import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  it('cadastro de proposta PAUSADO: a rota responde 501 antes de abrir o navegador, e as duas listas estão vazias', () => {
    const index = ler('src/index.js');
    const rota = index.slice(index.indexOf("app.post('/api/proposta/enviar'"));
    const trava = rota.indexOf('if (!podeCadastrarProposta(portal))');
    expect(trava).toBeGreaterThan(0);
    // Nada de Chrome, login ou portal antes da trava (17/09/2026: um clique na
    // tela antiga não pode levar o robô a uma compra real).
    expect(rota.indexOf('launchBrowser(')).toBeGreaterThan(trava);
    expect(rota.indexOf('.login()')).toBeGreaterThan(trava);

    const mod = { exports: {} as { PORTAIS_COM_PROPOSTA_EM_TESTE: string[]; PORTAIS_COM_PROPOSTA_LIBERADA: string[]; podeCadastrarProposta: (p: string) => boolean; podeSalvarProposta: (p: string) => boolean } };
    new vm.Script(ler('src/estrategia.js')).runInNewContext({ module: mod, exports: mod.exports });
    expect(mod.exports.PORTAIS_COM_PROPOSTA_EM_TESTE).toEqual([]);
    expect(mod.exports.PORTAIS_COM_PROPOSTA_LIBERADA).toEqual([]);
    expect(mod.exports.podeCadastrarProposta('comprasgov')).toBe(false);
    expect(mod.exports.podeSalvarProposta('comprasgov')).toBe(false);
    expect(index).toContain('portais_com_proposta_liberada: PORTAIS_COM_PROPOSTA_LIBERADA');
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
      path.resolve(__dirname, '../../../../supabase/functions/_shared/robo-portais.ts'),
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

  it('a rota /sessao/iniciar repassa os itens — campo não nomeado é descartado', () => {
    // ISTO ACONTECEU, em 10/09/2026, e passou por todas as outras verificações.
    //
    // A rota desestrutura uma lista FIXA do `req.body` e repassa campo a campo
    // ao createSession. O que não estiver nomeado ali some em silêncio: sem
    // erro, sem log, sem teste vermelho. A edge function mandava os itens, o
    // session-manager sabia usá-los, o módulo do portal sabia registrá-los —
    // e esta linha no meio jogava tudo fora.
    //
    // O `tsc` não vê (é string), o lint não vê, o build passa. Só um teste que
    // lê o texto gerado pega. Por isso ele existe.
    const index = ler('src/index.js');

    const destructuring = index.match(/const \{([\s\S]*?)\} = req\.body;/);
    expect(destructuring, 'não achei a desestruturação do req.body').toBeTruthy();
    expect(destructuring![1]).toMatch(/\bitens\b/);
    expect(destructuring![1]).toMatch(/\btipo_disputa\b/);
    // 16/09/2026: o CNPJ da empresa e como o robo responde "somos o lider".
    // Terceiro campo a atravessar esta lista — e o terceiro que ela descartaria.
    expect(destructuring![1]).toMatch(/\bcnpj_empresa\b/);
    expect(index).toMatch(/cnpj_empresa:\s*cnpj_empresa/);

    // Nomear na desestruturação não basta — tem que CHEGAR ao createSession.
    const chamada = index.match(/createSession\(\{([\s\S]*?)\}\);/);
    expect(chamada, 'não achei a chamada do createSession').toBeTruthy();
    expect(chamada![1]).toMatch(/itens:/);
    expect(chamada![1]).toMatch(/tipo_disputa:/);
  });

  it('o alvo da disputa chega ao módulo do portal e ao /health', () => {
    // As duas pontas do caminho que os itens percorrem depois da rota. Piso
    // ausente é estado próprio: nulo não é zero, e o robô não deve dar lance
    // num item que ninguém avaliou.
    expect(ler('src/portals/portal-compras.js')).toMatch(/async navegarParaDisputa\(edital, alvo\)/);
    expect(ler('src/session-manager.js')).toMatch(/itens_recebidos/);
    expect(ler('src/session-manager.js')).toMatch(/itens_sem_piso/);
  });
});

/**
 * A página da compra no Compras.gov, lida pelo texto.
 *
 * O texto abaixo é o que o gravador capturou em 16/09/2026, 11:00:55, na
 * compra 7/2026 da SEDUC/PA (UASG 925315), com o item 1 expandido — cortado
 * para caber, sem mudar uma linha do que sobrou. É a prova de que o leitor
 * acha o modo de disputa e o intervalo mínimo na tela real, e não num formato
 * imaginado.
 */
describe('Compras.gov: modo de disputa e intervalo mínimo, pelo texto da compra', () => {
  const CAPTURA_7_2026 = [
    'Compras eletrônicas',
    'Acompanhar Contratação',
    '',
    'Pregão Eletrônico N° 7/2026 (SRP) (Lei 14.133/2021)',
    '',
    'UASG 925315 - SECRETARIA DE ESTADO DE EDUCACAO - PA',
    '',
    'Critério julgamento: Menor Preço / Maior Desconto',
    'Modo disputa: Aberto',
    'Contratação na etapa de seleção de fornecedores ',
    'Itens',
    '1 NOTEBOOK',
    'Sem benefícios ME/EPP',
    'Aguardando julgamento',
    'Qtde solicitada',
    'Valor estimado (unitário)',
    '34207',
    'Sigiloso',
    'Descrição detalhada',
    'alimentação: bivolt automática, armazenamento hdd: sem disco hdd, tela: até 14',
    'Quantidade mínima',
    '34207',
    'Critério de julgamento',
    'Menor Preço',
    'Orçamento sigiloso',
    'Sim',
    'Intervalo mínimo entre Lances',
    'R$ 0,0100',
    'Tratamento diferenciado',
    'Sem benefícios ME/EPP (Art. 4º, lei 14.133/2021)',
    'Aplicabilidade margem de preferência',
    'Não',
    '2 NOTEBOOK',
    'Sem benefícios ME/EPP',
    'Aguardando julgamento',
    'Qtde solicitada',
    'Valor estimado (unitário)',
    '64390',
    'Sigiloso',
    '4 MONITOR COMPUTADOR',
    'Item de participação aberta',
    'Aguardando julgamento',
    '5 MONITOR COMPUTADOR',
    'Cota reservada ME/EPP do item 4',
    'Aguardando julgamento',
    '1',
    '2',
    '3',
    'Voltar para pesquisa',
    'Ocultar detalhes do item',
  ].join('\n');

  type Detalhes = {
    encontrado: boolean;
    modo: string | null;
    modo_texto: string | null;
    tratamento: string | null;
    situacao: string | null;
    intervalo_minimo: number | null;
    intervalo_minimo_percentual: number | null;
  };
  let Portal: {
    detalhesDoItemNoTexto: (texto: string, numero: number) => Detalhes;
    situacoesDosItensNoTexto: (texto: string) => Record<string, string>;
    modoDeDisputa: (texto: string) => string | null;
  };

  beforeAll(() => {
    const mod = { exports: {} as Record<string, unknown> };
    const falso: Record<string, unknown> = {
      './base-portal': { BasePortal: class {} },
      '../interacao-humana': {},
    };
    const ctx = vm.createContext({ require: (n: string) => falso[n] ?? {}, module: mod, exports: mod.exports, console });
    new vm.Script(ler('src/portals/comprasgov.js')).runInContext(ctx);
    Portal = mod.exports.ComprasGovPortal as typeof Portal;
  });

  it('lê o modo e o intervalo do item expandido, como estavam na tela', () => {
    const d = Portal.detalhesDoItemNoTexto(CAPTURA_7_2026, 1);
    expect(d.encontrado).toBe(true);
    expect(d.modo).toBe('aberto');
    expect(d.modo_texto).toBe('Aberto');
    expect(d.intervalo_minimo).toBe(0.01);
    expect(d.intervalo_minimo_percentual).toBeNull();
    expect(d.tratamento).toBe('Sem benefícios ME/EPP');
    expect(d.situacao).toBe('Aguardando julgamento');
  });

  it('não empresta o intervalo de um item para outro', () => {
    // O item 2 não estava expandido: o intervalo do item 1 está logo acima
    // dele no texto, e não pode ser atribuído a ele.
    const d = Portal.detalhesDoItemNoTexto(CAPTURA_7_2026, 2);
    expect(d.encontrado).toBe(true);
    expect(d.intervalo_minimo).toBeNull();
  });

  it('reconhece os outros tratamentos como cabeçalho de item', () => {
    expect(Portal.detalhesDoItemNoTexto(CAPTURA_7_2026, 4).tratamento).toBe('Item de participação aberta');
    // A situação de todos os itens da página, de uma vez (16/09/2026: é o que
    // encerra o item quando o portal já passou da fase de lances).
    expect(Portal.situacoesDosItensNoTexto(CAPTURA_7_2026)).toEqual({
      1: 'Aguardando julgamento', 2: 'Aguardando julgamento', 4: 'Aguardando julgamento', 5: 'Aguardando julgamento',
    });
    expect(Portal.detalhesDoItemNoTexto(CAPTURA_7_2026, 5).tratamento).toBe('Cota reservada ME/EPP do item 4');
  });

  it('número de paginação não é item', () => {
    // "1", "2", "3" soltos no fim são os botões de página.
    expect(Portal.detalhesDoItemNoTexto(CAPTURA_7_2026, 3).encontrado).toBe(false);
  });

  it('descrição que começa por número não vira cabeçalho de outro item', () => {
    const texto = CAPTURA_7_2026.replace(
      'alimentação: bivolt automática, armazenamento hdd: sem disco hdd, tela: até 14',
      '2 unidades por caixa',
    );
    const d = Portal.detalhesDoItemNoTexto(texto, 1);
    expect(d.intervalo_minimo).toBe(0.01);
  });

  it('intervalo em percentual e valores com milhar', () => {
    const pct = CAPTURA_7_2026.replace('R$ 0,0100', '0,50 %');
    expect(Portal.detalhesDoItemNoTexto(pct, 1).intervalo_minimo_percentual).toBe(0.5);
    const milhar = CAPTURA_7_2026.replace('R$ 0,0100', 'R$ 1.250,00');
    expect(Portal.detalhesDoItemNoTexto(milhar, 1).intervalo_minimo).toBe(1250);
  });

  it('os três modos da lei', () => {
    expect(Portal.modoDeDisputa('Aberto')).toBe('aberto');
    expect(Portal.modoDeDisputa('Aberto e Fechado')).toBe('aberto_fechado');
    expect(Portal.modoDeDisputa('Fechado e Aberto')).toBe('fechado_aberto');
    expect(Portal.modoDeDisputa('')).toBeNull();
  });
});

/**
 * A lista de propostas de um item, lida pelo texto da página pública.
 *
 * Fixture: `fixtures/propostas-7-2026.json`, texto real capturado pelo robô em
 * 16/09/2026 no pregão 7/2026 (razões sociais de terceiros trocadas por
 * FORNECEDOR). No item 5, 6 das 13 propostas estavam "Desclassificada", três
 * delas no topo da lista — e o leitor antigo tomava a primeira como melhor
 * lance. A BAQPLAST (22.920.524/0001-33) tem proposta nos dois itens.
 */
describe('Compras.gov: propostas do item e desclassificadas', () => {
  const BAQPLAST = '22.920.524/0001-33';
  type Proposta = { cnpj: string; valor: number; desclassificada: boolean; posicao: number | null; me_epp: boolean; uf: string | null };
  let Portal: {
    new (page: unknown, cred: unknown): {
      itemAlvo: number; compraId: string; cnpjEmpresa: string; credenciais: Record<string, unknown>;
      lerPropostasDoItem: (n: number) => Promise<Proposta[]>;
      melhorLanceDoItem: (n: number) => Promise<number | null>;
      souLiderNoItem: (n: number, cnpj: string) => Promise<boolean | null>;
      nossoLance: (n?: number) => Promise<number | null>;
      resumoDaClassificacao: (n?: number) => Promise<Record<string, unknown> | null>;
    };
    propostasNoTexto: (t: string) => Proposta[];
  };
  let item1: string;
  let item5: string;

  beforeAll(() => {
    const mod = { exports: {} as Record<string, unknown> };
    const ctx = vm.createContext({
      require: (n: string) => (n === './base-portal' ? { BasePortal: class { constructor(public page: unknown, public credenciais: unknown) {} } } : {}),
      module: mod, exports: mod.exports, process: { env: {} }, console: { log: () => {}, warn: () => {} },
    });
    new vm.Script(ler('src/portals/comprasgov.js')).runInContext(ctx);
    Portal = mod.exports.ComprasGovPortal as typeof Portal;
    const fx = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures/propostas-7-2026.json'), 'utf8'));
    item1 = fx.item_1_1104.join('\n');
    item5 = fx.item_5_1315.join('\n');
  });

  function portalCom(texto: string) {
    const p = new Portal({}, {});
    p.itemAlvo = 1;
    p.compraId = '92531505000072026';
    p.cnpjEmpresa = BAQPLAST;
    p.lerPropostasDoItem = async () => Portal.propostasNoTexto(texto);
    return p;
  }

  it('lê as 13 propostas do item 5 e marca as 6 desclassificadas', () => {
    const ps = Portal.propostasNoTexto(item5);
    expect(ps).toHaveLength(13);
    expect(ps.filter((p) => p.desclassificada)).toHaveLength(6);
    expect(ps.slice(0, 3).every((p) => p.desclassificada)).toBe(true);
  });

  it('a posição conta só as válidas — desclassificada fica sem posição', () => {
    const ps = Portal.propostasNoTexto(item5);
    const validas = ps.filter((p) => !p.desclassificada);
    expect(validas.map((p) => p.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(validas[0]).toMatchObject({ cnpj: '40.557.194/0001-45', valor: 2785 });
    expect(ps.find((p) => p.cnpj === BAQPLAST)).toMatchObject({ desclassificada: true, posicao: null, valor: 3598.8 });
  });

  it('o melhor lance é o da melhor proposta VÁLIDA, não o topo da lista', async () => {
    expect(await portalCom(item5).melhorLanceDoItem(5)).toBe(2785); // e não 2000
    expect(await portalCom(item1).melhorLanceDoItem(1)).toBe(3100);
  });

  it('empresa com proposta válida fora do 1º: não é líder, e o valor dela é lido', async () => {
    const p = portalCom(item1);
    expect(Portal.propostasNoTexto(item1).find((x) => x.cnpj === BAQPLAST)).toMatchObject({ posicao: 8, valor: 4999.7 });
    expect(await p.souLiderNoItem(1, BAQPLAST)).toBe(false);
    expect(await p.nossoLance()).toBe(4999.7);
  });

  it('proposta da empresa desclassificada: nem "líder" nem "não líder" — o robô aguarda', async () => {
    const p = portalCom(item5);
    expect(await p.souLiderNoItem(5, BAQPLAST)).toBeNull();
    expect(await p.nossoLance()).toBeNull();
  });

  it('empresa que é a melhor válida é líder, mesmo com desclassificadas acima', async () => {
    const p = portalCom(item5);
    expect(await p.souLiderNoItem(5, '40.557.194/0001-45')).toBe(true);
  });

  it('resumo da classificação por item: posição da empresa, válidas e desclassificadas', async () => {
    expect(await portalCom(item1).resumoDaClassificacao(1)).toMatchObject({ tem_proposta: true, posicao: 8, nossa_desclassificada: false });
    expect(await portalCom(item5).resumoDaClassificacao(5)).toMatchObject({ validas: 7, desclassificadas: 6, tem_proposta: true, nossa_desclassificada: true });
  });

  it('leitura que não trouxe proposta nenhuma é "não sei", e não "a empresa não tem proposta"', async () => {
    // 16/09, 16:48:22: a aba fechou no meio da leitura e o item 1 virou "sem proposta" na tela.
    expect(await portalCom('').resumoDaClassificacao(1)).toBeNull();
  });
});

/**
 * O lance só sai no campo DO ITEM, com o botão ao lado dele (16/09/2026, ao
 * liberar o lance no Compras.gov). A versão de fevereiro digitava em qualquer
 * campo com "valor" e clicava em qualquer botão com "enviar" ou "registrar" —
 * inclusive "Registrar intenção de recurso". A tela abaixo é montada no jsdom;
 * o `page` de mentira roda as funções do módulo gerado contra ela.
 */
describe('Compras.gov: lance só no campo do item', () => {
  type PortalDeLance = {
    enviarLance: (valor: number, numero: number | null) => Promise<boolean>;
    verificarResultado: (numero: number, valor: number) => Promise<string>;
    digitarConferindo: (sel: string, valor: string) => Promise<void>;
  };
  let Portal: new (page: unknown, cred: unknown) => PortalDeLance;
  const cliques: string[] = [];
  const originais: Record<string, PropertyDescriptor | undefined> = {};

  beforeAll(() => {
    originais.offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    originais.innerText = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
    // O jsdom não faz layout: sem isto, nada é "visível" e nenhum texto é lido.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.parentNode; } });
    Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });

    class BasePortal {
      constructor(public page: unknown, public credenciais: unknown) {}
      async adotarAbaViva() {}
      async delayHumano() {}
      async screenshot() { return null; }
      formatarMoeda(v: number) { return v.toFixed(2).replace('.', ','); }
    }
    const mod = { exports: {} as Record<string, unknown> };
    const ctx = vm.createContext({
      require: (n: string) => (n === './base-portal' ? { BasePortal } : {}),
      module: mod, exports: mod.exports, process: { env: {} }, console: { log: () => {}, warn: () => {} },
      document, Error, Number,
      // Resolvidos na hora da chamada, para o relógio simulado valer aqui dentro.
      setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
      Date: { now: () => Date.now() },
    });
    new vm.Script(ler('src/portals/comprasgov.js')).runInContext(ctx);
    Portal = mod.exports.ComprasGovPortal as typeof Portal;
  });

  afterAll(() => {
    for (const [nome, d] of Object.entries(originais)) {
      if (d) Object.defineProperty(HTMLElement.prototype, nome, d);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[nome];
    }
    document.body.innerHTML = '';
  });

  function telaCom(html: string) {
    document.body.innerHTML = html;
    cliques.length = 0;
    document.querySelectorAll('button').forEach((b, i) => {
      b.addEventListener('click', () => cliques.push(b.getAttribute('data-nome') || `botao-${i}`));
    });
    const page = {
      evaluate: async (fn: (a: unknown) => unknown, arg: unknown) => fn(arg),
      click: async (sel: string) => { (document.querySelector(sel) as HTMLElement).click(); },
      once: () => {},
    };
    const p = new Portal(page, {});
    p.digitarConferindo = async (sel, valor) => { (document.querySelector(sel) as HTMLInputElement).value = valor; };
    return p;
  }

  const SALA = `
    <div><h3>Item 1 - Notebook</h3><input formcontrolname="valorLance"><button data-nome="lance-1">Enviar lance</button></div>
    <div><h3>Item 12 - Monitor</h3><input formcontrolname="valorLance"><button data-nome="lance-12">Enviar lance</button></div>
    <div><h3>Item 2 - Televisor</h3><input formcontrolname="valorLance"><button data-nome="lance-2">Enviar lance</button></div>
    <button data-nome="recurso">Registrar intenção de recurso</button>`;

  it('digita e clica só no bloco do item pedido — o item 1 não é o 12', async () => {
    const p = telaCom(SALA);
    await p.enviarLance(4999.7, 1);
    const campos = [...document.querySelectorAll('input')] as HTMLInputElement[];
    expect(campos.map((c) => c.value)).toEqual(['4999,70', '', '']);
    expect(cliques).toEqual(['lance-1']);

    const q = telaCom(SALA);
    await q.enviarLance(3100, 12);
    expect(([...document.querySelectorAll('input')] as HTMLInputElement[]).map((c) => c.value)).toEqual(['', '3100,00', '']);
    expect(cliques).toEqual(['lance-12']);
  });

  it('tela sem campo de lance (a página pública): não digita nem clica em nada', async () => {
    const p = telaCom(`
      <div><h3>Item 1</h3><input placeholder="Valor da proposta"><button data-nome="enviar-generico">Enviar</button></div>
      <button data-nome="recurso">Registrar intenção de recurso</button>`);
    await expect(p.enviarLance(4999.7, 1)).rejects.toMatchObject({ codigo: 'sem-campo-de-lance' });
    expect(cliques).toEqual([]);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('item sem bloco próprio, ou botão ambíguo: recusa em vez de arriscar', async () => {
    const semItem = telaCom(`<div><h3>Item 3</h3><input formcontrolname="valorLance"><button>Enviar lance</button></div>`);
    await expect(semItem.enviarLance(10, 1)).rejects.toMatchObject({ codigo: 'sem-campo-de-lance' });
    expect(cliques).toEqual([]);

    const doisBotoes = telaCom(`<div><h3>Item 1</h3><input formcontrolname="valorLance"><button>Enviar lance</button><button>Enviar</button></div>`);
    await expect(doisBotoes.enviarLance(10, 1)).rejects.toMatchObject({ codigo: 'sem-campo-de-lance' });
    expect(cliques).toEqual([]);
  });

  it('confirmação: frase de lance aceito ou recusado; sem frase, "sem confirmação" — "sucesso" solto não vale', async () => {
    vi.useFakeTimers();
    try {
      let p = telaCom('<p>Lance registrado para o item 1.</p>');
      expect(await p.verificarResultado(1, 10)).toBe('aceito');
      p = telaCom('<p>Lance recusado. O valor não respeita o intervalo mínimo.</p>');
      expect(await p.verificarResultado(1, 10)).toMatch(/^recusado: lance recusado/);
      p = telaCom('<p>Operação realizada com sucesso</p>');
      const pendente = p.verificarResultado(1, 10);
      await vi.advanceTimersByTimeAsync(7000);
      expect(await pendente).toMatch(/^sem confirmacao/);
    } finally {
      vi.useRealTimers();
    }
  });
});
