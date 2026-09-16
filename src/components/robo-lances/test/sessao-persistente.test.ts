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
  function browserJs(lancar: (cfg: Record<string, unknown>) => Promise<unknown>) {
    const pagina = { setUserAgent: async () => {}, setViewport: async () => {} };
    const navegador = { newPage: async () => pagina, userAgent: async () => 'HeadlessChrome/153' };
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
        fs: { existsSync: () => false, mkdirSync: () => {} },
        path: nodePath,
        './certificado': { estado: () => ({ carregado: false }) },
      },
    );
    return { launchBrowser: mod.launchBrowser, lancamentos };
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
