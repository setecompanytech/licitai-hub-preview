import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import * as nodeCrypto from 'node:crypto';
import nodePath from 'node:path';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';

/**
 * Sessão persistente do Chrome e aviso de pedido humano (16/09/2026).
 *
 * Todo envio ao robô era um login novo, e o gov.br pedia o clique do hCaptcha
 * na maioria deles. O perfil guardado deixa o gov.br lembrar da sessão; o aviso
 * faz o pedido de clique chegar a quem pode dar, em vez de expirar sem ninguém
 * ver (14/09, 20:07). Tudo aqui roda o texto gerado para a VPS.
 */

let arquivos: Record<string, string>;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(await (await generateAgentTemplate()).arrayBuffer());
  const entradas = await Promise.all(
    Object.keys(zip.files)
      .filter((n) => !zip.files[n].dir)
      .map(async (n) => [n, await zip.files[n].async('string')] as const),
  );
  arquivos = Object.fromEntries(entradas);
});

function ler(fim: string): string {
  const nome = Object.keys(arquivos).find((n) => n.endsWith(fim));
  if (!nome) throw new Error(`${fim} não está no ZIP`);
  return arquivos[nome];
}

function carregar<T>(fim: string, falso: Record<string, unknown>, env: Record<string, string> = {}): T {
  const mod = { exports: {} as T };
  const ctx = vm.createContext({
    require: (n: string) => falso[n] ?? {},
    module: mod,
    exports: mod.exports,
    process: { env },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  new vm.Script(ler(fim)).runInContext(ctx);
  return mod.exports;
}

type Interacao = {
  pedir: (id: string, p: Record<string, unknown>) => unknown;
  aoPedir: (fn: (id: string, p: Record<string, unknown>) => unknown) => void;
};

describe('pedido humano vira aviso', () => {
  it('quem escuta recebe o pedido na hora', () => {
    const interacao = carregar<Interacao>('src/interacao-humana.js', {});
    const recebidos: Array<[string, Record<string, unknown>]> = [];
    interacao.aoPedir((id, p) => { recebidos.push([id, p]); });
    interacao.pedir('s1', { tipo: 'captcha', mensagem: 'clique', expira_em: '2026-09-16T15:00:00Z' });
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0][0]).toBe('s1');
    expect(recebidos[0][1]).toMatchObject({ tipo: 'captcha', expira_em: '2026-09-16T15:00:00Z' });
  });

  it('um aviso que falha não derruba o pedido', () => {
    const interacao = carregar<Interacao & { pendente: (id: string) => unknown }>('src/interacao-humana.js', {});
    interacao.aoPedir(() => { throw new Error('webhook fora'); });
    interacao.aoPedir(() => Promise.reject(new Error('rede')));
    expect(() => interacao.pedir('s1', { tipo: 'captcha', mensagem: 'clique' })).not.toThrow();
    expect(interacao.pendente('s1')).toBeTruthy();
  });

  it('o session-manager manda o pedido ao webhook como pedido-humano', async () => {
    const interacao = carregar<Interacao>('src/interacao-humana.js', {});
    const chamadas: Array<{ tipo: string; dados: Record<string, unknown> }> = [];
    const { SessionManager } = carregar<{ SessionManager: new () => { sessions: Map<string, unknown> } }>(
      'src/session-manager.js',
      {
        './interacao-humana': interacao,
        './callback': {
          sendCallback: async (_s: unknown, tipo: string, dados: Record<string, unknown>) => { chamadas.push({ tipo, dados }); },
        },
        crypto: nodeCrypto,
        path: nodePath,
      },
    );
    const gerente = new SessionManager();
    gerente.sessions.set('s1', { sessao_id: 's1' });
    interacao.pedir('s1', { tipo: 'captcha', mensagem: 'clique no certificado', tela: 'gov.br', expira_em: 'x' });
    // pedido de sessão que este agente não conhece não vira aviso
    interacao.pedir('outra', { tipo: 'captcha', mensagem: 'clique' });
    expect(chamadas).toEqual([
      { tipo: 'pedido-humano', dados: { tipo: 'captcha', mensagem: 'clique no certificado', tela: 'gov.br', expira_em: 'x' } },
    ]);
  });
});

describe('qual perfil a sessão usa', () => {
  type Gerente = { perfilDaSessao: (c: Record<string, unknown>) => string | null; perfisEmUso: Set<string> };
  function gerente(env: Record<string, string> = {}): Gerente {
    const { SessionManager } = carregar<{ SessionManager: new () => Gerente }>(
      'src/session-manager.js',
      { './interacao-humana': { aoPedir: () => {} }, crypto: nodeCrypto, path: nodePath },
      env,
    );
    return new SessionManager();
  }
  const compras = { sessao_id: 's1', portal_id: 'comprasgov', credenciais_portal: { cpf: '01234567890' } };

  it('no Compras.gov, uma pasta por identidade — sem o CPF escrito no nome', () => {
    const pasta = gerente().perfilDaSessao(compras)!;
    expect(pasta).toMatch(/^perfis\/comprasgov-[0-9a-f]{16}$/);
    expect(pasta).not.toContain('01234567890');
    // a mesma identidade cai sempre na mesma pasta; outra identidade, noutra
    expect(gerente().perfilDaSessao(compras)).toBe(pasta);
    expect(gerente().perfilDaSessao({ ...compras, credenciais_portal: { cpf: '98765432100' } })).not.toBe(pasta);
  });

  it('portal fora da lista continua com perfil temporário', () => {
    expect(gerente().perfilDaSessao({ ...compras, portal_id: 'bll' })).toBeNull();
  });

  it('PERFIL_PERSISTENTE=false desliga', () => {
    expect(gerente({ PERFIL_PERSISTENTE: 'false' }).perfilDaSessao(compras)).toBeNull();
  });

  it('perfil já aberto por outra sessão: esta entra com perfil temporário', () => {
    const g = gerente();
    const pasta = g.perfilDaSessao(compras)!;
    g.perfisEmUso.add(pasta);
    expect(g.perfilDaSessao(compras)).toBeNull();
  });
});

describe('o Chrome com perfil persistente', () => {
  function browserJs(lancar: (cfg: Record<string, unknown>) => Promise<unknown>, prefsExistentes?: string) {
    const pagina = { setUserAgent: async () => {}, setViewport: async () => {}, close: async () => {} };
    const fechadas: string[] = [];
    const velha = (nome: string) => ({ close: async () => { fechadas.push(nome); } });
    const navegador = {
      newPage: async () => pagina,
      userAgent: async () => 'HeadlessChrome/153',
      // o Chrome restaurado reabre abas da última vez
      pages: async () => [velha('about:blank'), velha('compra antiga'), pagina],
    };
    const escritos: Record<string, string> = {};
    const lancamentos: Array<Record<string, unknown>> = [];
    const mod = carregar<{ launchBrowser: (c?: unknown, o?: unknown) => Promise<{ perfil: string | null }> }>(
      'src/browser.js',
      {
        puppeteer: {
          launch: async (cfg: Record<string, unknown>) => {
            lancamentos.push(cfg);
            await lancar(cfg);
            return navegador;
          },
        },
        fs: {
          existsSync: () => false,
          mkdirSync: () => {},
          readFileSync: () => {
            if (prefsExistentes === undefined) throw new Error('ENOENT');
            return prefsExistentes;
          },
          writeFileSync: (arq: string, conteudo: string) => { escritos[arq] = conteudo; },
        },
        path: nodePath,
        './certificado': { estado: () => ({ carregado: false }) },
      },
    );
    return { launchBrowser: mod.launchBrowser, lancamentos, escritos, fechadas };
  }

  it('abre com a pasta do perfil e devolve qual usou', async () => {
    const { launchBrowser, lancamentos } = browserJs(async () => {});
    const r = await launchBrowser(null, { perfil: 'perfis/comprasgov-abc' });
    expect(r.perfil).toBe('perfis/comprasgov-abc');
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].userDataDir).toBe('perfis/comprasgov-abc');
  });

  it('se o Chrome não abrir com o perfil, a sessão não cai: abre com perfil temporário', async () => {
    const { launchBrowser, lancamentos } = browserJs(async (cfg) => {
      if (cfg.userDataDir) throw new Error('The browser is already running for perfis/comprasgov-abc');
    });
    const r = await launchBrowser(null, { perfil: 'perfis/comprasgov-abc' });
    expect(r.perfil).toBeNull();
    expect(lancamentos).toHaveLength(2);
    expect(lancamentos[1].userDataDir).toBeUndefined();
  });

  it('liga "continuar de onde parei" no perfil, para o Chrome não apagar os cookies de sessão', async () => {
    // Medido na segunda rodada do teste (16/09, 13:23): o login do gov.br é o
    // cookie de sessão Session_Gov_Br_Prod, que o Chrome apaga ao fechar.
    const { launchBrowser, lancamentos, escritos } = browserJs(
      async () => {},
      JSON.stringify({ session: { restore_on_startup: 5 }, profile: { exit_type: 'Crashed', name: 'Pessoa 1' }, outra: 1 }),
    );
    await launchBrowser(null, { perfil: 'perfis/comprasgov-abc' });
    const prefs = JSON.parse(escritos['perfis/comprasgov-abc/Default/Preferences']);
    expect(prefs.session.restore_on_startup).toBe(1);
    expect(prefs.profile).toMatchObject({ exit_type: 'Normal', exited_cleanly: true, name: 'Pessoa 1' });
    expect(prefs.outra).toBe(1); // o resto das preferências fica como estava
    expect(lancamentos[0].args).toContain('--restore-last-session');
  });

  it('perfil novo, sem preferências ainda: cria o arquivo', async () => {
    const { launchBrowser, escritos } = browserJs(async () => {});
    await launchBrowser(null, { perfil: 'perfis/comprasgov-abc' });
    expect(JSON.parse(escritos['perfis/comprasgov-abc/Default/Preferences']).session.restore_on_startup).toBe(1);
  });

  it('fecha as abas que o Chrome reabriu — restaurar é para os cookies, não para as abas', async () => {
    const { launchBrowser, fechadas } = browserJs(async () => {});
    await launchBrowser(null, { perfil: 'perfis/comprasgov-abc' });
    expect(fechadas).toEqual(['about:blank', 'compra antiga']);
  });

  it('sem perfil pedido, é o de sempre', async () => {
    const { launchBrowser, lancamentos } = browserJs(async () => {});
    const r = await launchBrowser();
    expect(r.perfil).toBeNull();
    expect(lancamentos[0].userDataDir).toBeUndefined();
  });
});

describe('Compras.gov: sessão guardada e medição do login', () => {
  type Portal = {
    login: () => Promise<void>;
    _entrar: () => Promise<void>;
    _comoEntrou: string | null;
    perfilPersistente: boolean;
    sessaoId: string;
  };
  function portal() {
    const linhas: string[] = [];
    const { ComprasGovPortal } = carregar<{
      ComprasGovPortal: (new (page: unknown, cred: unknown) => Portal) & { pareceAreaLogada: (t: string) => boolean };
    }>('src/portals/comprasgov.js', {
      './base-portal': { BasePortal: class { constructor(public page: unknown, public credenciais: unknown) {} } },
      '../interacao-humana': {},
      fs: { mkdirSync: () => {}, appendFileSync: (_: string, l: string) => { linhas.push(l); } },
    });
    return { ComprasGovPortal, linhas };
  }

  it('reconhece a área logada do fornecedor, e não a tela de login', () => {
    const { ComprasGovPortal } = portal();
    expect(ComprasGovPortal.pareceAreaLogada('Área de Trabalho do Fornecedor Brasileiro\nPlacar de Licitações')).toBe(true);
    expect(ComprasGovPortal.pareceAreaLogada('Compras.gov.br\nAcesse sua Conta\nSelecione o perfil')).toBe(false);
  });

  type ComSso = Portal & {
    destinoDoSso: (ms?: number) => Promise<'login' | 'logado' | 'fora'>;
    adotarAbaViva: () => Promise<void>;
    textoDaTela: () => Promise<string>;
    page: { url: () => string; evaluate: () => Promise<boolean> };
  };

  it('volta logada do gov.br: espera a aba sair do acesso.gov.br e a área carregar', async () => {
    // Rodadas 4 e 5 do teste (16/09, 13:34 e 13:40): o gov.br lembrou do login,
    // mas a conferência pegou a aba ainda no acesso.gov.br (e o frameset ainda
    // vazio), e o robô foi procurar o botão de certificado.
    const { ComprasGovPortal } = portal();
    const p = new ComprasGovPortal({}, {}) as ComSso;
    const urls = ['https://sso.acesso.gov.br/authorize', 'https://sso.acesso.gov.br/login', 'https://www.comprasnet.gov.br/intro.htm'];
    let i = 0;
    let leituras = 0;
    p.page = { url: () => urls[Math.min(i, urls.length - 1)], evaluate: async () => false };
    p.adotarAbaViva = async () => { i += 1; };
    p.textoDaTela = async () => (++leituras < 2 ? '' : 'Área de Trabalho do Fornecedor Brasileiro');
    expect(await p.destinoDoSso(10000)).toBe('logado');
  }, 15000);

  it('tela de login do gov.br: decide na hora, sem esperar', async () => {
    const { ComprasGovPortal } = portal();
    const p = new ComprasGovPortal({}, {}) as ComSso;
    p.page = { url: () => 'https://sso.acesso.gov.br/login', evaluate: async () => true };
    p.adotarAbaViva = async () => {};
    p.textoDaTela = async () => '';
    const inicio = Date.now();
    expect(await p.destinoDoSso(10000)).toBe('login');
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it('saiu do gov.br para uma página que não é a área logada: "fora"', async () => {
    const { ComprasGovPortal } = portal();
    const p = new ComprasGovPortal({}, {}) as ComSso;
    p.page = { url: () => 'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp', evaluate: async () => false };
    p.adotarAbaViva = async () => {};
    p.textoDaTela = async () => 'Acesse sua Conta';
    expect(await p.destinoDoSso(1500)).toBe('fora');
  });

  it('cada login vira uma linha em logs/logins.jsonl, com o jeito que entrou', async () => {
    const { ComprasGovPortal, linhas } = portal();
    const p = new ComprasGovPortal({}, {});
    p.sessaoId = 's1';
    p.perfilPersistente = true;
    p._entrar = async () => { p._comoEntrou = 'sessao-reaproveitada'; };
    await p.login();
    const linha = JSON.parse(linhas[0]);
    expect(linha).toMatchObject({ portal: 'comprasgov', sessao_id: 's1', perfil_persistente: true, desfecho: 'sessao-reaproveitada' });
    expect(typeof linha.segundos).toBe('number');
    expect(linhas[0].endsWith('\n')).toBe(true);
  });

  it('login que falha também é medido, e o erro continua subindo', async () => {
    const { ComprasGovPortal, linhas } = portal();
    const p = new ComprasGovPortal({}, {});
    p._entrar = async () => { throw new Error('O login do gov.br nao foi concluido'); };
    await expect(p.login()).rejects.toThrow(/nao foi concluido/);
    expect(JSON.parse(linhas[0])).toMatchObject({ desfecho: 'falhou', perfil_persistente: false });
  });
});

/**
 * O vigia da sessão do Compras.gov (D12, 16/09/2026): confere de tempos em
 * tempos se o perfil continua logado — renovando a sessão e medindo quando ela
 * vence —, sem nunca disputar a pasta com uma disputa.
 */
describe('vigia da sessão', () => {
  type Vigia = {
    iniciar: () => boolean;
    parar: () => void;
    rodada: () => Promise<Array<[string, string]>>;
    conferir: (pasta: string) => Promise<string>;
    resumo: () => { ligado: boolean; intervalo_min: number; perfis: Array<{ perfil: string; ultimo: string }> };
  };
  type Gerente = { perfisEmUso: Set<string>; perfisDoVigia: Set<string> };

  function montar(
    destino: 'logado' | 'login' | 'fora',
    over: { cookiesMtime?: number; minutos?: number; perfilAbre?: boolean; page?: Record<string, unknown> } = {},
  ) {
    const linhas: string[] = [];
    const aberturas: string[] = [];
    let fechou = 0;
    const gerente: Gerente = { perfisEmUso: new Set(), perfisDoVigia: new Set() };
    let doVigiaDuranteConferencia = false;
    const { criarVigia } = carregar<{ criarVigia: (g: Gerente, o: Record<string, unknown>) => Vigia }>(
      'src/vigia-sessao.js',
      {
        fs: {
          readdirSync: () => ['comprasgov-aaaa', 'bll-bbbb'],
          statSync: () => ({ mtimeMs: over.cookiesMtime ?? 0 }),
          mkdirSync: () => {},
          appendFileSync: (_: string, l: string) => { linhas.push(l); },
        },
        path: nodePath,
      },
    );
    const vigia = criarVigia(gerente, {
      minutos: over.minutos ?? 20,
      dir: 'perfis',
      launchBrowser: async (_c: unknown, o: { perfil: string }) => {
        aberturas.push(o.perfil);
        doVigiaDuranteConferencia = gerente.perfisDoVigia.has(o.perfil);
        return { browser: { close: async () => { fechou += 1; } }, page: {}, perfil: over.perfilAbre === false ? null : o.perfil };
      },
      getPortal: () => ({
        aplicarAntiDeteccao: async () => {},
        loginUrl: 'https://sso.acesso.gov.br/authorize',
        page: { goto: async () => {}, ...over.page },
        destinoDoSso: async () => destino,
      }),
    });
    return { vigia, gerente, linhas, aberturas, fechou: () => fechou, doVigia: () => doVigiaDuranteConferencia };
  }

  it('confere só os perfis do Compras.gov, marca a pasta enquanto confere e fecha o Chrome', async () => {
    const m = montar('logado');
    const r = await m.vigia.rodada();
    expect(r).toEqual([['comprasgov-aaaa', 'logado']]);
    expect(m.aberturas).toEqual(['perfis/comprasgov-aaaa']);
    expect(m.doVigia()).toBe(true);
    expect(m.gerente.perfisDoVigia.size).toBe(0);
    expect(m.fechou()).toBe(1);
  });

  it('cada conferência vira linha em logs/logins.jsonl — é a medição de quanto a sessão dura', async () => {
    const m = montar('logado');
    await m.vigia.rodada();
    expect(JSON.parse(m.linhas[0])).toMatchObject({
      portal: 'comprasgov', sessao_id: null, perfil: 'comprasgov-aaaa', perfil_persistente: true, desfecho: 'vigia-logado',
    });
  });

  it('indefinido grava em que tela parou — sem os parâmetros do endereço, que podem levar token', async () => {
    const m = montar('fora', {
      page: {
        url: () => 'https://www.comprasnet.gov.br/seguro/loginPortal.asp?token=NAO-GRAVAR',
        title: async () => 'Compras.gov.br',
        evaluate: async () => true,
      },
    });
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('indefinido');
    const linha = JSON.parse(m.linhas[0]);
    expect(linha.desfecho).toBe('vigia-indefinido');
    expect(linha.detalhe).toBe('tela: www.comprasnet.gov.br/seguro/loginPortal.asp ("Compras.gov.br") · com captcha');
    expect(m.linhas[0]).not.toContain('NAO-GRAVAR');
  });

  it('indefinido com a página sem leitura ainda grava a linha', async () => {
    const m = montar('fora', { page: { url: () => { throw new Error('Target closed'); } } });
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('indefinido');
    expect(JSON.parse(m.linhas[0]).detalhe).toBe('tela: endereco ilegivel');
  });

  it('perfil em uso por uma disputa não é tocado', async () => {
    const m = montar('logado');
    m.gerente.perfisEmUso.add('perfis/comprasgov-aaaa');
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('em-uso');
    expect(m.aberturas).toHaveLength(0);
    expect(m.linhas).toHaveLength(0);
  });

  it('sessão vencida: registra e não volta a bater no gov.br até uma disputa logar de novo', async () => {
    const m = montar('login', { cookiesMtime: 0 });
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('vencida');
    expect(JSON.parse(m.linhas[0]).desfecho).toBe('vigia-vencida');
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('vencida-sem-novo-login');
    expect(m.aberturas).toHaveLength(1);
  });

  it('depois de uma disputa logar no perfil vencido, volta a conferir', async () => {
    const m = montar('login', { cookiesMtime: Date.now() + 60_000 });
    await m.vigia.conferir('perfis/comprasgov-aaaa');
    await m.vigia.conferir('perfis/comprasgov-aaaa');
    expect(m.aberturas).toHaveLength(2);
  });

  it('Chrome que não abre com o perfil não conta como sessão vencida', async () => {
    const m = montar('logado', { perfilAbre: false });
    expect(await m.vigia.conferir('perfis/comprasgov-aaaa')).toBe('perfil-indisponivel');
    expect(m.fechou()).toBe(1);
  });

  it('o /health mostra o último resultado por perfil; VIGIA_SESSAO_MIN=0 desliga', async () => {
    const m = montar('logado');
    await m.vigia.rodada();
    expect(m.vigia.resumo().perfis).toEqual([expect.objectContaining({ perfil: 'comprasgov-aaaa', ultimo: 'logado' })]);
    expect(montar('logado', { minutos: 0 }).vigia.iniciar()).toBe(false);
  });

  it('a disputa que chega durante a conferência espera o vigia soltar o perfil', async () => {
    const { SessionManager } = carregar<{
      SessionManager: new () => Gerente & { esperarVigiaSoltar: (p: string, ms?: number) => Promise<boolean> };
    }>('src/session-manager.js', { './interacao-humana': { aoPedir: () => {} }, crypto: nodeCrypto, path: nodePath });
    const g = new SessionManager();
    g.perfisDoVigia.add('perfis/comprasgov-aaaa');
    setTimeout(() => g.perfisDoVigia.delete('perfis/comprasgov-aaaa'), 700);
    const inicio = Date.now();
    expect(await g.esperarVigiaSoltar('perfis/comprasgov-aaaa', 5000)).toBe(true);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(600);
    g.perfisDoVigia.add('perfis/comprasgov-bbbb');
    expect(await g.esperarVigiaSoltar('perfis/comprasgov-bbbb', 600)).toBe(false);
  });
});
