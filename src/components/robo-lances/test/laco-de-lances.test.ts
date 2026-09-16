import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import * as vm from 'node:vm';
import JSZip from 'jszip';
import { generateAgentTemplate } from '@/lib/agente-template-generator';

/**
 * O laço de lances do agente, rodado a partir do MESMO texto que vai para a VPS.
 *
 * `estrategia.test.ts` prova a decisão; este prova que o laço a usa do
 * jeito certo — que é onde moravam os dois defeitos de 16/09/2026: o laço
 * encerrava a sessão em `max_lances` RODADAS antes de decidir qualquer coisa
 * (20 rodadas a 30 s = o robô saía da sala em 10 minutos), e usava o piso e o
 * valor da disputa inteira em vez dos do item.
 *
 * O portal é de mentira e o relógio é simulado; o resto é o arquivo gerado.
 */

type Chamada = { tipo: string; dados: Record<string, unknown> };
type Sessao = Record<string, unknown> & { status: string; rodada: number };
type Gerente = {
  _startBiddingLoop: (s: Sessao) => void;
  pauseSession: (id: string) => unknown;
  resumeSession: (id: string) => unknown;
  sessions: Map<string, Sessao>;
};

let sessionManagerJs: string;
let estrategiaJs: string;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(await (await generateAgentTemplate()).arrayBuffer());
  const ler = async (fim: string) => {
    const nome = Object.keys(zip.files).find((n) => n.endsWith(fim));
    if (!nome) throw new Error(`${fim} não está no ZIP`);
    return zip.files[nome].async('string');
  };
  sessionManagerJs = await ler('src/session-manager.js');
  estrategiaJs = await ler('src/estrategia.js');
});

function montar(liberar: boolean) {
  const chamadas: Chamada[] = [];

  const estrategia = { exports: {} as { PORTAIS_COM_LANCE_LIBERADO: string[] } };
  new vm.Script(estrategiaJs).runInNewContext({ module: estrategia, exports: estrategia.exports });
  if (liberar) estrategia.exports.PORTAIS_COM_LANCE_LIBERADO.push('__teste__');

  const falso: Record<string, unknown> = {
    './browser': { launchBrowser: async () => ({}) },
    './callback': {
      sendCallback: async (_s: unknown, tipo: string, dados: Record<string, unknown>) => {
        chamadas.push({ tipo, dados });
      },
    },
    './portals': { getPortal: () => ({}) },
    './estrategia': estrategia.exports,
    './interacao-humana': { aoPedir: () => {}, encerrar: () => {} },
    os: { totalmem: () => 8e9, freemem: () => 4e9 },
    fs: {},
    path: {},
    crypto: {},
  };
  const mod = { exports: {} as { SessionManager: new () => Gerente } };
  const ctx = vm.createContext({
    require: (n: string) => falso[n],
    module: mod,
    exports: mod.exports,
    process: { env: {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    // Resolvidos na hora da chamada, para o relógio simulado do vitest valer
    // também dentro do contexto.
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    clearTimeout: (t: ReturnType<typeof setTimeout>) => clearTimeout(t),
    setInterval: (f: () => void, ms: number) => setInterval(f, ms),
    clearInterval: (t: ReturnType<typeof setInterval>) => clearInterval(t),
    Date,
    Math,
    Number,
    JSON,
    Set,
    Map,
    Promise,
  });
  new vm.Script(sessionManagerJs).runInContext(ctx);
  const gerente = new mod.exports.SessionManager();
  return { gerente, chamadas };
}

function portalFalso(over: Record<string, unknown> = {}) {
  const enviados: number[] = [];
  const portal = {
    lerMensagensChat: async () => [],
    lerMelhorLance: async () => 90,
    souLider: async () => false,
    nossoLance: async () => 100,
    enviarLance: async (v: number) => { enviados.push(v); },
    verificarResultado: async () => 'aceito',
    screenshot: async () => {},
    ...over,
  };
  return { portal, enviados };
}

function sessao(portal: unknown, over: Record<string, unknown> = {}): Sessao {
  return {
    sessao_id: 's1',
    status: 'ativo',
    rodada: 0,
    created_at: new Date(),
    portal_id: '__teste__',
    portal,
    valor_atual: 500, // valor inicial da DISPUTA — não do item
    valor_minimo: 1,  // piso da DISPUTA — o item tem o seu
    decremento_min: 5,
    intervalo_segundos: 30,
    max_lances: 20,
    itens: [{ numero: 1, valor_minimo: 60, estrategia: 'melhor_preco' }],
    ...over,
  };
}

describe('laço de lances', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('com a trava fechada, NÃO sai da sala ao passar de max_lances rodadas', async () => {
    const { gerente } = montar(false);
    const { portal, enviados } = portalFalso();
    const s = sessao(portal, { max_lances: 20 });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 25);

    expect(s.rodada).toBe(25);
    expect(s.status).toBe('ativo');
    expect(enviados).toEqual([]);
    s.status = 'encerrado';
  });

  it('o teto conta lances enviados, e o encerramento diz o motivo', async () => {
    const { gerente, chamadas } = montar(true);
    let melhor = 90;
    const { portal, enviados } = portalFalso({
      lerMelhorLance: async () => melhor,
      // cada lance nosso é coberto por outro concorrente antes da rodada seguinte
      enviarLance: async (v: number) => { enviados.push(v); melhor = v - 1; },
      nossoLance: async () => null,
    });
    const s = sessao(portal, { max_lances: 2 });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 3);

    expect(enviados).toEqual([85, 79]);
    expect(s.status).toBe('encerrado');
    const fim = chamadas.find((c) => c.tipo === 'sessao-encerrada');
    expect(fim?.dados.motivo).toMatch(/Teto de 2 lances/);
    expect(fim?.dados.lances_enviados).toBe(2);
  });

  it('usa o piso do ITEM, não o da disputa', async () => {
    const { gerente, chamadas } = montar(true);
    // 90 − 5 = 85; com o piso do item (60) dá lance. Com melhor 64, o próximo
    // (59) furaria o piso do item — e o da disputa (1) teria deixado passar.
    const { portal, enviados } = portalFalso({ lerMelhorLance: async () => 64, nossoLance: async () => 70 });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(enviados).toEqual([]);
    expect(s.status).toBe('encerrado');
    expect(chamadas.find((c) => c.tipo === 'sessao-encerrada')?.dados.motivo).toMatch(/piso de R\$ 60\.00/);
  });

  it('o nosso valor vem do portal, não do valor inicial da disputa', async () => {
    const { gerente } = montar(true);
    // Disputa com valor inicial 500; no portal o nosso é 80 e o melhor é 90.
    // Com o valor da disputa, o robô cobriria 90; com o do portal, não há o que
    // cobrir (o nosso já é melhor — leitura incoerente com souLider=false).
    const { portal, enviados } = portalFalso({ nossoLance: async () => 80 });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(enviados).toEqual([]);
    expect(s.status).toBe('ativo');
    s.status = 'encerrado';
  });

  it('a estratégia do item chega à decisão', async () => {
    const { gerente, chamadas } = montar(true);
    const { portal, enviados } = portalFalso();
    const s = sessao(portal, { itens: [{ numero: 1, valor_minimo: 60, estrategia: 'iminencia' }] });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(enviados).toEqual([]);
    const aviso = chamadas.find((c) => c.tipo === 'rodada-sem-lance');
    expect(aviso?.dados.motivo).toMatch(/iminencia/i);
    expect(aviso?.dados.estrategia).toBe('iminencia');
    s.status = 'encerrado';
  });

  it('a margem de desempate do item chega à decisão', async () => {
    // Nosso lance no portal: 100; 1º colocado: 90 — distância de R$ 10.
    const perto = montar(true);
    const p1 = portalFalso();
    const s1 = sessao(p1.portal, { itens: [{ numero: 1, valor_minimo: 60, estrategia: 'desempatar_1o', margem_desempate: 15 }] });
    perto.gerente.sessions.set('s1', s1);
    perto.gerente._startBiddingLoop(s1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(p1.enviados).toEqual([85]);
    s1.status = 'encerrado';

    const longe = montar(true);
    const p2 = portalFalso();
    const s2 = sessao(p2.portal, { itens: [{ numero: 1, valor_minimo: 60, estrategia: 'desempatar_1o', margem_desempate: 5 }] });
    longe.gerente.sessions.set('s1', s2);
    longe.gerente._startBiddingLoop(s2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(p2.enviados).toEqual([]);
    expect(longe.chamadas.find((c) => c.tipo === 'rodada-sem-lance')?.dados.motivo).toMatch(/nao persegue/);
    s2.status = 'encerrado';
  });

  it('o intervalo mínimo lido do portal vira o passo quando não há decremento', async () => {
    const { gerente } = montar(true);
    const { portal, enviados } = portalFalso({ nossoLance: async () => null });
    const s = sessao(portal, { decremento_min: 0, detalhesDoItem: { intervalo_minimo: 0.01 } });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(enviados).toEqual([89.99]);
    s.status = 'encerrado';
  });

  it('na iminência lida da sala, a leitura acelera para 3 s', async () => {
    const { gerente } = montar(false);
    const lidas: number[] = [];
    const { portal } = portalFalso({
      lerSala: async () => ({ fase: 'aberta', segundosRestantes: 90 }),
      lerMelhorLance: async () => { lidas.push(Date.now()); return 90; },
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 + 3_000 * 4);

    expect(lidas.length).toBe(5);
    s.status = 'encerrado';
  });

  it('a sessão esquecida acaba no limite de horas, com motivo', async () => {
    const { gerente, chamadas } = montar(false);
    const { portal } = portalFalso();
    const s = sessao(portal, { created_at: new Date(Date.now() - 11 * 3600 * 1000) });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(s.status).toBe('encerrado');
    expect(chamadas.find((c) => c.tipo === 'sessao-encerrada')?.dados.motivo).toMatch(/limite de seguranca/);
  });

  it('pausar e retomar no meio de uma rodada não deixa dois laços vivos', async () => {
    const { gerente } = montar(false);
    let emCurso = 0;
    let maximo = 0;
    const { portal } = portalFalso({
      lerMelhorLance: async () => {
        emCurso++;
        maximo = Math.max(maximo, emCurso);
        await new Promise((r) => setTimeout(r, 5_000));
        emCurso--;
        return 90;
      },
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(31_000); // rodada 1 em curso (leitura de 5 s)
    gerente.pauseSession('s1');
    gerente.resumeSession('s1');
    await vi.advanceTimersByTimeAsync(30_000 * 6);

    expect(maximo).toBe(1);
    // uma rodada por 35 s (30 de espera + 5 de leitura), não o dobro
    expect(s.rodada).toBeLessThanOrEqual(7);
    s.status = 'encerrado';
  });
});
