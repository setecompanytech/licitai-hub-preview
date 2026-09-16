import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import * as vm from 'node:vm';
import * as nodeCrypto from 'node:crypto';
import nodePath from 'node:path';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';

/**
 * Um Chrome por conta, uma aba por pregão (Fase 7, 16/09/2026).
 *
 * Duas disputas da mesma conta ao mesmo tempo: a segunda abria outro Chrome
 * com perfil temporário — login do zero, captcha, e risco de derrubar a sessão
 * da primeira. Agora ela entra numa aba do Chrome já logado. Tudo aqui roda o
 * texto gerado para a VPS, com navegador e portal de mentira.
 */

let sessionManagerJs: string;
let basePortalJs: string;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(await (await generateAgentTemplate()).arrayBuffer());
  const ler = async (fim: string) => {
    const nome = Object.keys(zip.files).find((n) => n.endsWith(fim));
    if (!nome) throw new Error(`${fim} não está no ZIP`);
    return zip.files[nome].async('string');
  };
  sessionManagerJs = await ler('src/session-manager.js');
  basePortalJs = await ler('src/portals/base-portal.js');
});

type Aba = { id: string; fechada: boolean; close: () => Promise<void>; isClosed: () => boolean; url: () => string; mainFrame: () => unknown; bringToFront: () => Promise<void> };
type Chrome = { abas: Aba[]; fechado: boolean; newPage: () => Promise<Aba>; close: () => Promise<void>; on: () => void; process: () => { pid: number }; isConnected: () => boolean; pages: () => Promise<Aba[]> };
type Sessao = Record<string, unknown> & { status: string; browser?: Chrome; page?: Aba; portal?: Record<string, unknown> };
type Gerente = {
  createSession: (c: Record<string, unknown>) => Promise<Sessao>;
  endSession: (id: string, motivo?: string) => unknown;
  killAll: (motivo?: string) => number;
  sessions: Map<string, Sessao>;
  navegadores: Map<string, unknown>;
};

function aba(id: string, url = 'https://cnetmobile.estaleiro.serpro.gov.br/compra/' + id): Aba {
  const a: Aba = {
    id,
    fechada: false,
    close: async () => { a.fechada = true; },
    isClosed: () => a.fechada,
    url: () => url,
    mainFrame: () => ({ detached: false }),
    bringToFront: async () => {},
  };
  return a;
}

function montar(env: Record<string, string> = {}) {
  const chromes: Chrome[] = [];
  let contador = 0;
  const novoChrome = (): Chrome => {
    const c: Chrome = {
      abas: [],
      fechado: false,
      newPage: async () => { const a = aba('aba-' + ++contador); c.abas.push(a); return a; },
      close: async () => { c.fechado = true; },
      on: () => {},
      process: () => ({ pid: 1000 + chromes.length }),
      isConnected: () => !c.fechado,
      pages: async () => c.abas.filter((a) => !a.fechada),
    };
    chromes.push(c);
    return c;
  };
  const falso: Record<string, unknown> = {
    './browser': {
      launchBrowser: async (_cnpj: unknown, opcoes: { perfil?: string | null }) => {
        const c = novoChrome();
        const primeira = await c.newPage();
        return { browser: c, page: primeira, perfil: opcoes.perfil || null };
      },
    },
    './callback': { sendCallback: async () => {} },
    './portals': {
      getPortal: (_id: string, page: Aba) => ({ page, login: async () => {}, navegarParaDisputa: async () => {}, lerMensagensChat: async () => [] }),
    },
    './estrategia': { decidirLance: () => ({ acao: 'aguardar', motivo: 'teste' }), conferirItens: () => ({}), proximaLeituraMs: () => 30_000 },
    './interacao-humana': { aoPedir: () => {}, encerrar: () => {} },
    os: { totalmem: () => 16e9, freemem: () => 8e9 },
    fs: { mkdirSync: () => {} },
    path: nodePath,
    crypto: nodeCrypto,
  };
  const mod = { exports: {} as { SessionManager: new () => Gerente } };
  const ctx = vm.createContext({
    require: (n: string) => falso[n],
    module: mod,
    exports: mod.exports,
    process: { env: { GRAVADOR_INTERVALO_S: '0', MAX_SESSOES_PARALELAS: '8', ...env } },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
    setInterval: (f: () => void, ms: number) => setInterval(f, ms),
    clearInterval: (t: ReturnType<typeof setInterval>) => clearInterval(t),
    Date, Math, Number, JSON, Set, Map, Promise, Array, Object, String,
  });
  new vm.Script(sessionManagerJs).runInContext(ctx);
  return { gerente: new mod.exports.SessionManager(), chromes };
}

const disputa = (id: string, cpf = '01234567890') => ({
  sessao_id: id,
  portal_id: 'comprasgov',
  edital: '07/2026',
  credenciais_portal: { cpf },
  itens: [{ numero: 1, valor_minimo: 60 }],
  intervalo_segundos: 30,
});

describe('um Chrome por conta, uma aba por pregão', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a segunda disputa da mesma conta entra numa aba nova do Chrome já aberto', async () => {
    const { gerente, chromes } = montar();
    const a = await gerente.createSession(disputa('a'));
    const b = await gerente.createSession(disputa('b'));

    expect(chromes).toHaveLength(1);
    expect(b.browser).toBe(a.browser);
    expect(b.page).not.toBe(a.page);
    expect(a.status).toBe('ativo');
    expect(b.status).toBe('ativo');
    gerente.killAll('fim do teste');
  });

  it('encerrar uma disputa fecha só a aba dela; o Chrome fecha com a última', async () => {
    const { gerente, chromes } = montar();
    const a = await gerente.createSession(disputa('a'));
    const b = await gerente.createSession(disputa('b'));

    gerente.endSession('a', 'teste');
    expect(a.page!.fechada).toBe(true);
    expect(b.page!.fechada).toBe(false);
    expect(chromes[0].fechado).toBe(false);

    gerente.endSession('b', 'teste');
    expect(chromes[0].fechado).toBe(true);
    expect(gerente.navegadores.size).toBe(0);
  });

  it('depois que o Chrome da conta fecha, a próxima disputa abre outro', async () => {
    const { gerente, chromes } = montar();
    await gerente.createSession(disputa('a'));
    gerente.endSession('a');
    await gerente.createSession(disputa('b'));
    expect(chromes).toHaveLength(2);
    gerente.killAll('fim do teste');
  });

  it('contas diferentes continuam em Chromes separados', async () => {
    const { gerente, chromes } = montar();
    await gerente.createSession(disputa('a', '01234567890'));
    await gerente.createSession(disputa('b', '98765432100'));
    expect(chromes).toHaveLength(2);
    gerente.killAll('fim do teste');
  });

  it('UMA_ABA_POR_PREGAO=false volta ao Chrome separado com perfil temporário', async () => {
    const { gerente, chromes } = montar({ UMA_ABA_POR_PREGAO: 'false' });
    await gerente.createSession(disputa('a'));
    const b = await gerente.createSession(disputa('b'));
    expect(chromes).toHaveLength(2);
    expect(b.perfil).toBeNull();
    gerente.killAll('fim do teste');
  });

  it('o freio de emergência fecha tudo', async () => {
    const { gerente, chromes } = montar();
    await gerente.createSession(disputa('a'));
    await gerente.createSession(disputa('b'));
    expect(gerente.killAll('freio')).toBe(2);
    expect(chromes[0].fechado).toBe(true);
  });

  it('a aba morta de uma disputa nunca adota a aba viva da outra', async () => {
    const { gerente } = montar();
    const a = await gerente.createSession(disputa('a'));
    const b = await gerente.createSession(disputa('b'));

    const mod = { exports: {} as { BasePortal: new (page: unknown, cred: unknown) => Record<string, unknown> & { adotarAbaViva: (m: string) => Promise<boolean>; page: unknown } } };
    new vm.Script(basePortalJs).runInNewContext({
      module: mod, exports: mod.exports, require: () => ({}), console: { log: () => {}, warn: () => {}, error: () => {} }, process: { env: {} },
    });
    const portal = new mod.exports.BasePortal(b.page, {});
    const chrome = b.browser!;
    (b.page as Aba & { browser?: () => Chrome }).browser = () => chrome;
    portal.abasDeOutrasSessoes = () => new Set([a.page]);

    b.page!.fechada = true; // a aba da disputa b morreu
    await portal.adotarAbaViva('teste');

    expect(portal.page).not.toBe(a.page); // não pegou a do pregão a
    expect(chrome.abas.length).toBe(3); // abriu uma nova
    gerente.killAll('fim do teste');
  });
});
