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
  endSessionPorTeste?: () => void;
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
    // Interruptor da disputa: só true explícito libera lance (16/09/2026).
    modo_automatico: true,
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

  it('modo automático desligado na disputa: acompanha, e nenhum lance sai', async () => {
    const { gerente, chamadas } = montar(true);
    const { portal, enviados } = portalFalso();
    const s = sessao(portal, { modo_automatico: false });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 3);

    expect(enviados).toEqual([]);
    const estado = chamadas.find((c) => c.tipo === 'estado-da-sala');
    expect((estado?.dados.decisao as { motivo: string }).motivo).toMatch(/modo automatico desligado/i);
    s.status = 'encerrado';
  });

  it('sem o campo de lance do item na tela: avisa uma vez, não conta lance e tenta de novo depois de 1 minuto', async () => {
    const { gerente, chamadas } = montar(true);
    let tentativas = 0;
    const { portal } = portalFalso({
      enviarLance: async () => {
        tentativas += 1;
        const e = new Error('campo de lance do item 1 nao encontrado nesta tela') as Error & { codigo?: string };
        e.codigo = 'sem-campo-de-lance';
        throw e;
      },
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    // A primeira rodada é na hora; as seguintes, a cada 30 s — mas o envio
    // só é tentado de novo 1 minuto depois: em 0 s, 60 s e 120 s.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tentativas).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000 * 4);
    expect(tentativas).toBe(3);

    const avisos = chamadas.filter((c) => c.tipo === 'lance-recusado');
    expect(avisos).toHaveLength(1);
    expect(String(avisos[0].dados.resultado)).toMatch(/nao enviado: campo de lance do item 1/);
    expect(chamadas.some((c) => c.tipo === 'lance-enviado')).toBe(false);
    expect(chamadas.some((c) => c.tipo === 'erro')).toBe(false);
    expect(s.lances_enviados ?? 0).toBe(0);
    s.status = 'encerrado';
  });

  it('lance sem confirmação do portal não conta nem vira valor atual', async () => {
    const { gerente, chamadas } = montar(true);
    const { portal, enviados } = portalFalso({
      verificarResultado: async () => 'sem confirmacao do portal — a proxima leitura da sala mostra se o lance entrou',
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 1);

    expect(enviados).toEqual([85]);
    expect(chamadas.some((c) => c.tipo === 'lance-enviado')).toBe(false);
    expect(chamadas.find((c) => c.tipo === 'lance-recusado')?.dados.valor).toBe(85);
    expect(s.lances_enviados ?? 0).toBe(0);
    s.status = 'encerrado';
  });

  it('a fase de lances acabou no portal: lê a sala uma vez, depois encerra com a situação como motivo', async () => {
    const { gerente, chamadas } = montar(true);
    let leiturasDeSituacao = 0;
    const { portal } = portalFalso({
      lerSituacoesDosItens: async () => { leiturasDeSituacao += 1; return { 1: 'Aguardando julgamento' }; },
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 3);

    expect(chamadas.some((c) => c.tipo === 'estado-da-sala')).toBe(true);
    expect(leiturasDeSituacao).toBe(1);
    expect(s.status).toBe('encerrado');
    expect(chamadas.find((c) => c.tipo === 'sessao-encerrada')?.dados.motivo).toMatch(/fase de lances terminou no portal \(situacao: Aguardando julgamento\)/);
  });

  it('item ainda em disputa no portal: segue, e a situação é relida só a cada 3 minutos', async () => {
    const { gerente } = montar(true);
    let leiturasDeSituacao = 0;
    const { portal } = portalFalso({
      lerSituacoesDosItens: async () => { leiturasDeSituacao += 1; return { 1: 'Em disputa' }; },
      souLider: async () => true,
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 8);

    expect(s.status).toBe('ativo');
    expect(leiturasDeSituacao).toBe(2);
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
    const estado = chamadas.find((c) => c.tipo === 'estado-da-sala');
    expect((estado?.dados.decisao as { motivo: string }).motivo).toMatch(/iminencia/i);
    expect(estado?.dados.estrategia).toBe('iminencia');
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
    const estadoLonge = longe.chamadas.find((c) => c.tipo === 'estado-da-sala');
    expect((estadoLonge?.dados.decisao as { motivo: string }).motivo).toMatch(/nao persegue/);
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

  it('o estado da sala chega ao Praefectus com posição, liderança e decisão', async () => {
    const { gerente, chamadas } = montar(false);
    const { portal } = portalFalso({
      resumoDaClassificacao: async () => ({ validas: 13, desclassificadas: 0, tem_proposta: true, posicao: 8, nossa_desclassificada: false }),
      nossoLance: async () => 4999.7,
      lerMelhorLance: async () => 3100,
    });
    const s = sessao(portal, { detalhesDoItem: { modo_texto: 'Aberto', intervalo_minimo: 0.01 } });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    const estado = chamadas.find((c) => c.tipo === 'estado-da-sala')?.dados;
    expect(estado).toMatchObject({
      item: 1, melhor_lance: 3100, nosso_lance: 4999.7, posicao: 8, sou_lider: false,
      propostas_validas: 13, modo: 'Aberto', intervalo_minimo: 0.01, estrategia: 'melhor_preco',
    });
    expect((estado?.decisao as { acao: string }).acao).toBe('aguardar'); // trava fechada
    s.status = 'encerrado';
  });

  it('estado igual não é reenviado a cada rodada — só quando muda, ou a cada 30 s', async () => {
    const { gerente, chamadas } = montar(false);
    let melhor = 90;
    const { portal } = portalFalso({
      lerSala: async () => ({ fase: 'aberta', segundosRestantes: 90 }), // iminência: rodada a cada 3 s
      lerMelhorLance: async () => melhor,
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 + 3_000 * 5); // 6 rodadas, estado igual
    expect(chamadas.filter((c) => c.tipo === 'estado-da-sala')).toHaveLength(1);

    melhor = 85; // mudou
    await vi.advanceTimersByTimeAsync(3_000);
    expect(chamadas.filter((c) => c.tipo === 'estado-da-sala')).toHaveLength(2);
    s.status = 'encerrado';
  });

  it('lance de concorrente só quando o melhor lance MUDA — nunca a cada rodada', async () => {
    const { gerente, chamadas } = montar(false);
    let melhor = 90;
    const { portal } = portalFalso({ lerMelhorLance: async () => melhor, nossoLance: async () => 100 });
    const s = sessao(portal, { valor_atual: 500 });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 4); // 4 rodadas com o mesmo melhor lance
    expect(chamadas.filter((c) => c.tipo === 'lance-concorrente')).toHaveLength(0);

    melhor = 88;
    await vi.advanceTimersByTimeAsync(30_000);
    const concorrentes = chamadas.filter((c) => c.tipo === 'lance-concorrente');
    expect(concorrentes).toHaveLength(1);
    expect(concorrentes[0].dados).toMatchObject({ valor: 88, metadata: expect.objectContaining({ anterior: 90 }) });
    s.status = 'encerrado';
  });

  it('melhor lance que mudou para o NOSSO não é lance de concorrente', async () => {
    const { gerente, chamadas } = montar(false);
    let melhor = 90;
    let lider = false;
    const { portal } = portalFalso({ lerMelhorLance: async () => melhor, souLider: async () => lider });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);
    await vi.advanceTimersByTimeAsync(30_000);
    melhor = 85;
    lider = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(chamadas.filter((c) => c.tipo === 'lance-concorrente')).toHaveLength(0);
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

  it('pregão com vários itens: cada item com o seu piso, a sua estratégia e o seu lance', async () => {
    const { gerente, chamadas } = montar(true);
    const lidos: Array<number | null> = [];
    const enviadosPorItem: Array<[number, number | null]> = [];
    const melhor: Record<number, number> = { 1: 90, 2: 300 };
    const { portal } = portalFalso({
      lerMelhorLance: async (n: number) => { lidos.push(n); return melhor[n]; },
      nossoLance: async (n: number) => (n === 1 ? 100 : 320),
      souLider: async () => false,
      enviarLance: async (v: number, n: number) => { enviadosPorItem.push([v, n]); melhor[n] = v; },
    });
    const s = sessao(portal, {
      itens: [
        { numero: 1, valor_minimo: 60, estrategia: 'melhor_preco' },
        { numero: 2, valor_minimo: 250, estrategia: 'iminencia' },
      ],
    });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);

    // Os dois itens foram lidos na mesma rodada.
    expect(lidos).toEqual([1, 2]);
    // Item 1 (melhor preço) cobre 90 − 5; item 2 (iminência, sem tempo lido) aguarda.
    expect(enviadosPorItem).toEqual([[85, 1]]);
    const estados = chamadas.filter((c) => c.tipo === 'estado-da-sala').map((c) => [c.dados.item, (c.dados.decisao as { acao: string }).acao]);
    expect(estados).toEqual([[1, 'lance'], [2, 'aguardar']]);
    expect(chamadas.find((c) => c.tipo === 'lance-enviado')?.dados.item).toBe(1);
    s.status = 'encerrado';
  });

  it('um item que chega ao piso sai da disputa; a sessão segue com os outros e só encerra quando todos acabam', async () => {
    const { gerente, chamadas } = montar(true);
    const melhor: Record<number, number> = { 1: 64, 2: 300 };
    const { portal } = portalFalso({
      lerMelhorLance: async (n: number) => melhor[n],
      nossoLance: async (n: number) => (n === 1 ? 70 : 320),
      enviarLance: async () => {},
    });
    const s = sessao(portal, {
      itens: [
        { numero: 1, valor_minimo: 60 },
        { numero: 2, valor_minimo: 250, estrategia: 'iminencia' },
      ],
    });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(s.status).toBe('ativo'); // item 1 acabou no piso, item 2 segue
    await vi.advanceTimersByTimeAsync(30_000);
    const lidosNaRodada2 = chamadas.filter((c) => c.tipo === 'estado-da-sala' && c.dados.item === 1);
    expect(lidosNaRodada2).toHaveLength(1); // item encerrado não é mais lido

    melhor[2] = 254; // agora o item 2 também chegaria ao piso
    s.itens = [{ numero: 1, valor_minimo: 60 }, { numero: 2, valor_minimo: 250 }];
    await vi.advanceTimersByTimeAsync(30_000);
    expect(s.status).toBe('encerrado');
    const motivo = String(chamadas.find((c) => c.tipo === 'sessao-encerrada')?.dados.motivo);
    expect(motivo).toMatch(/^Todos os itens encerraram — item 1: .*piso de R\$ 60\.00.*; item 2: .*piso de R\$ 250\.00/);
  });

  it('o teto de lances é da disputa inteira, somando os itens', async () => {
    const { gerente, chamadas } = montar(true);
    const melhor: Record<number, number> = { 1: 90, 2: 300 };
    const { portal } = portalFalso({
      lerMelhorLance: async (n: number) => melhor[n],
      nossoLance: async () => null,
      enviarLance: async (v: number, n: number) => { melhor[n] = v - 1; },
    });
    const s = sessao(portal, {
      max_lances: 2,
      itens: [
        { numero: 1, valor_minimo: 60, preco_venda: 100 },
        { numero: 2, valor_minimo: 200, preco_venda: 320 },
      ],
    });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 * 2);

    expect(s.status).toBe('encerrado');
    expect(chamadas.filter((c) => c.tipo === 'lance-enviado').map((c) => c.dados.item)).toEqual([1, 2]);
    expect(chamadas.find((c) => c.tipo === 'sessao-encerrada')?.dados.motivo).toMatch(/Teto de 2 lances/);
  });

  it('com vários itens, o estado de um não apaga a comparação do outro', async () => {
    const { gerente, chamadas } = montar(false);
    const { portal } = portalFalso({ lerSala: async () => ({ fase: 'aberta', segundosRestantes: 90 }) });
    const s = sessao(portal, { itens: [{ numero: 1, valor_minimo: 60 }, { numero: 2, valor_minimo: 60 }] });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000 + 3_000 * 4); // 5 rodadas, estados iguais
    expect(chamadas.filter((c) => c.tipo === 'estado-da-sala').map((c) => c.dados.item)).toEqual([1, 2]);
    s.status = 'encerrado';
  });

  it('sessão encerrada no meio da leitura de um item: nada do que foi lido depois vai ao Praefectus', async () => {
    const { gerente, chamadas } = montar(true);
    const { portal, enviados } = portalFalso({
      lerMelhorLance: async () => {
        // o encerramento chega enquanto a página do item carrega
        gerente.endSessionPorTeste?.();
        await new Promise((r) => setTimeout(r, 1_000));
        return null;
      },
      resumoDaClassificacao: async () => ({ validas: 0, desclassificadas: 0, tem_proposta: false, posicao: null, nossa_desclassificada: false }),
    });
    const s = sessao(portal);
    gerente.sessions.set('s1', s);
    (gerente as unknown as { endSessionPorTeste: () => void }).endSessionPorTeste = () => { gerente.sessions.get('s1')!.status = 'encerrado'; };
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(31_000);

    expect(chamadas.filter((c) => c.tipo === 'estado-da-sala')).toHaveLength(0);
    expect(enviados).toEqual([]);
  });

  it('com um item em disputa, o que aguarda é lido no máximo a cada minuto — a rodada fica curta', async () => {
    const { gerente } = montar(false);
    const lidos: number[] = [];
    const { portal } = portalFalso({
      lerSala: async (n: number) => (n === 1 ? { fase: 'aberta', segundosRestantes: 90 } : { fase: 'aguardando' }),
      lerMelhorLance: async (n: number) => { lidos.push(n); return 90; },
    });
    const s = sessao(portal, { itens: [{ numero: 1, valor_minimo: 60 }, { numero: 2, valor_minimo: 60 }] });
    gerente.sessions.set('s1', s);
    gerente._startBiddingLoop(s);

    await vi.advanceTimersByTimeAsync(30_000); // 1ª rodada: sem fase conhecida ainda, lê os dois
    expect(lidos).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(3_000 * 10); // 10 rodadas rápidas (iminência do item 1)
    expect(lidos.filter((n) => n === 1)).toHaveLength(11);
    expect(lidos.filter((n) => n === 2)).toHaveLength(1); // o 2 ainda não completou 1 minuto
    await vi.advanceTimersByTimeAsync(3_000 * 11); // passa de 1 minuto desde a leitura do 2
    expect(lidos.filter((n) => n === 2)).toHaveLength(2);
    s.status = 'encerrado';
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
