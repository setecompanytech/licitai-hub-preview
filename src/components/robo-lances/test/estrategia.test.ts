import { describe, it, expect, beforeAll } from 'vitest';
import * as vm from 'node:vm';
import { ESTRATEGIA_FILES } from '@/lib/agent-template/estrategia';
import { ESTRATEGIAS_DO_ITEM } from '@/lib/robo/estrategia-do-item';

/**
 * A decisão de preço do robô, exercitada a partir do MESMO texto que vai para o
 * ZIP do agente — não de uma reescrita em TypeScript. Testar uma cópia provaria
 * que a cópia funciona.
 *
 * A auditoria de 02/09/2026 achou aqui o defeito mais caro do sistema: o robô
 * lia "o melhor lance da sessão", que quando lideramos é o NOSSO, e o cobria.
 * Sem concorrente nenhum, descia o próprio preço até o piso.
 */

type Decisao = { acao: 'lance' | 'aguardar' | 'encerrar'; valor: number | null; motivo: string };
let decidirLance: (estado: Record<string, unknown>) => Decisao;
let podeEnviarLance: (portalId: string) => boolean;
let liberados: string[];
type Conferencia = {
  leu: boolean;
  ok: boolean | null;
  faltando: number[];
  sobrando: number[];
  divergencias: Array<{ numero: number; nosso: number; portal: number }>;
  resumo: string;
};
let conferirItens: (nossos: unknown[], doPortal: unknown[]) => Conferencia;

beforeAll(() => {
  const codigo = ESTRATEGIA_FILES['src/estrategia.js'];
  const module = {
    exports: {} as {
      decidirLance: typeof decidirLance;
      podeEnviarLance: typeof podeEnviarLance;
      conferirItens: typeof conferirItens;
      PORTAIS_COM_LANCE_LIBERADO: string[];
    },
  };
  new vm.Script(codigo, { filename: 'estrategia.js' }).runInNewContext({ module, exports: module.exports });
  decidirLance = module.exports.decidirLance;
  podeEnviarLance = module.exports.podeEnviarLance;
  liberados = module.exports.PORTAIS_COM_LANCE_LIBERADO;
  conferirItens = module.exports.conferirItens;
});

/**
 * Disputa saudável: não lideramos, há concorrente à frente, longe do piso.
 *
 * `portalId` usa um id liberado à força pelos testes desta suíte — a lista real
 * (PORTAIS_COM_LANCE_LIBERADO) está vazia de propósito, e é o bloco
 * "trava de liberação" abaixo que garante isso.
 */
function cenario(over: Record<string, unknown> = {}) {
  return {
    portalId: '__teste__',
    valorAtual: 100,
    valorMinimo: 50,
    melhorLance: 90,
    souLider: false,
    decrementoMin: 5,
    decrementoPercentual: 1,
    rodada: 1,
    maxLances: 20,
    ...over,
  };
}

describe('decidirLance', () => {
  // A lista é a trava de produção e está vazia. Para exercitar a estratégia em
  // si, os testes abaixo liberam um portal fictício; o comportamento da trava
  // é testado no bloco seguinte, com a lista intacta.
  beforeAll(() => {
    if (!liberados.includes('__teste__')) liberados.push('__teste__');
  });

  it('cobre o lance do concorrente com o decremento configurado', () => {
    const d = decidirLance(cenario());
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(85); // 90 − 5
  });

  it('NÃO cobre o próprio lance quando já estamos liderando', () => {
    // O defeito da auditoria. Liderando, o melhor lance da sessão é o nosso;
    // cobri-lo baixa o preço sozinho até o piso, sem concorrente nenhum.
    const d = decidirLance(cenario({ souLider: true, melhorLance: 90, valorAtual: 90 }));
    expect(d.acao).toBe('aguardar');
    expect(d.valor).toBeNull();
    expect(d.motivo).toMatch(/liderando/i);
  });

  it('não dá lance quando a leitura do portal falha', () => {
    // Antes caía em `melhorLance || valorAtual` e dava lance às cegas.
    for (const leitura of [null, undefined, NaN]) {
      const d = decidirLance(cenario({ melhorLance: leitura }));
      expect(d.acao).toBe('aguardar');
      expect(d.valor).toBeNull();
    }
  });

  it('não dá lance quando o portal não diz quem lidera', () => {
    // `souLider` desconhecido é diferente de false: sem saber, a guarda de
    // liderança perde o efeito e o robô voltaria a poder cobrir a si mesmo.
    for (const lider of [null, undefined]) {
      const d = decidirLance(cenario({ souLider: lider }));
      expect(d.acao).toBe('aguardar');
      expect(d.motivo).toMatch(/liderando/i);
    }
  });

  it('encerra ao alcançar o piso, e nunca dá lance nele', () => {
    const d = decidirLance(cenario({ melhorLance: 54, valorMinimo: 50, decrementoMin: 5 }));
    expect(d.acao).toBe('encerrar');
    expect(d.motivo).toMatch(/piso/i);
  });

  it('nunca devolve valor abaixo do piso, em nenhuma combinação', () => {
    for (const melhor of [51, 55, 60, 80, 200]) {
      for (const dec of [1, 5, 25, 100]) {
        const d = decidirLance(cenario({ melhorLance: melhor, valorMinimo: 50, decrementoMin: dec }));
        if (d.acao === 'lance') expect(d.valor!).toBeGreaterThan(50);
      }
    }
  });

  it('encerra ao atingir o teto de lances ENVIADOS', () => {
    const d = decidirLance(cenario({ lancesEnviados: 20, maxLances: 20 }));
    expect(d.acao).toBe('encerrar');
    expect(d.motivo).toMatch(/teto/i);
  });

  it('rodada de leitura não conta como lance', () => {
    // O laço contava rodadas: 20 leituras a 30 s e o robô saía da sala em 10
    // minutos sem ter dado lance nenhum.
    const d = decidirLance(cenario({ rodada: 500, lancesEnviados: 3, maxLances: 20 }));
    expect(d.acao).toBe('lance');
  });

  it('sem teto, disputa até o piso', () => {
    for (const teto of [null, undefined, 0]) {
      const d = decidirLance(cenario({ lancesEnviados: 999, maxLances: teto }));
      expect(d.acao).toBe('lance');
    }
  });

  it('aguarda quando o melhor lance não é melhor que o nosso', () => {
    const d = decidirLance(cenario({ melhorLance: 110, valorAtual: 100 }));
    expect(d.acao).toBe('aguardar');
  });

  it('usa o decremento percentual sobre o lance do concorrente, não sobre o nosso', () => {
    // O código antigo calculava a porcentagem sobre `valor_atual`, o que dava um
    // passo maior ou menor que o pretendido conforme a distância do concorrente.
    const d = decidirLance(cenario({ melhorLance: 200, valorAtual: 400, decrementoMin: 0, decrementoPercentual: 10 }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(180); // 200 − 10% de 200
  });

  it('aguarda quando nenhum decremento válido foi configurado', () => {
    // Zero explícito não vira 1% por conta própria: quem configurou zero não
    // disse de quanto descer, e inventar o passo é decidir preço no chute.
    for (const cfg of [
      { decrementoMin: 0, decrementoPercentual: 0 },
      { decrementoMin: undefined, decrementoPercentual: undefined },
      { decrementoMin: -5, decrementoPercentual: 0 },
    ]) {
      const d = decidirLance(cenario(cfg));
      expect(d.acao).toBe('aguardar');
      expect(d.motivo).toMatch(/decremento/i);
    }
  });

  it('arredonda para centavos — portal recusa fração de centavo', () => {
    const d = decidirLance(
      cenario({ valorAtual: 120, melhorLance: 100, decrementoMin: 0, decrementoPercentual: 3.333 }),
    );
    expect(d.acao).toBe('lance');
    expect(String(d.valor)).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(d.valor).toBe(96.67); // 100 − 3,333
  });

  it('toda decisão vem com motivo legível', () => {
    const casos = [
      cenario(),
      cenario({ souLider: true }),
      cenario({ melhorLance: null }),
      cenario({ lancesEnviados: 99 }),
      cenario({ melhorLance: 51, valorMinimo: 50 }),
      cenario({ estrategia: 'iminencia' }),
      cenario({ fase: 'fechada', elegivel: true }),
      cenario({ valorMinimo: null }),
    ];
    for (const c of casos) {
      const d = decidirLance(c);
      expect(d.motivo.length).toBeGreaterThan(10);
    }
  });

  it('não disputa sem piso — o piso é obrigatório', () => {
    // Sem esta guarda, `novoValor <= null` virava comparação com zero e o
    // robô podia descer até um centavo.
    for (const piso of [null, undefined, 0, -1, NaN]) {
      const d = decidirLance(cenario({ valorMinimo: piso }));
      expect(d.acao).toBe('aguardar');
      expect(d.valor).toBeNull();
      expect(d.motivo).toMatch(/piso/i);
    }
  });

  it('empate perdido (mesmo valor, fora do 1º) é coberto', () => {
    // O portal dá o 1º lugar a quem registrou primeiro o mesmo valor.
    const d = decidirLance(cenario({ valorAtual: 90, melhorLance: 90, souLider: false }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(85);
  });

  it('sem lance nosso ainda (valorAtual vazio) cobre normalmente', () => {
    const d = decidirLance(cenario({ valorAtual: null }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(85);
  });
});

describe('estratégia por item', () => {
  beforeAll(() => {
    if (!liberados.includes('__teste__')) liberados.push('__teste__');
  });

  it('item sem estratégia escolhida segue como melhor preço — o comportamento de antes', () => {
    for (const estrategia of [undefined, null, '']) {
      const d = decidirLance(cenario({ estrategia }));
      expect(d.acao).toBe('lance');
      expect(d.valor).toBe(85);
    }
  });

  it('estratégia desconhecida aguarda, e não vira melhor preço por conta própria', () => {
    const d = decidirLance(cenario({ estrategia: 'desempatar_1o' }));
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toMatch(/desempatar_1o/);
  });

  it('iminência: fora dos 2 minutos finais, aguarda', () => {
    const d = decidirLance(cenario({ estrategia: 'iminencia', fase: 'aberta', segundosRestantes: 300 }));
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toMatch(/iminencia/i);
    expect(d.motivo).toContain('300');
  });

  it('iminência: nos 2 minutos finais, cobre', () => {
    for (const s of [120, 60, 1]) {
      const d = decidirLance(cenario({ estrategia: 'iminencia', fase: 'aberta', segundosRestantes: s }));
      expect(d.acao).toBe('lance');
      expect(d.valor).toBe(85);
    }
  });

  it('iminência: sem o tempo restante lido, NÃO chuta — aguarda', () => {
    const d = decidirLance(cenario({ estrategia: 'iminencia', fase: null, segundosRestantes: null }));
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toMatch(/tempo restante/i);
  });

  it('iminência: o encerramento aleatório do aberto e fechado já é iminência', () => {
    const d = decidirLance(cenario({ estrategia: 'iminencia', fase: 'encerramento_aleatorio', segundosRestantes: null }));
    expect(d.acao).toBe('lance');
  });

  it('iminência não passa por cima da liderança nem da leitura', () => {
    expect(decidirLance(cenario({ estrategia: 'iminencia', segundosRestantes: 30, souLider: true })).acao).toBe('aguardar');
    expect(decidirLance(cenario({ estrategia: 'iminencia', segundosRestantes: 30, melhorLance: null })).acao).toBe('aguardar');
    expect(decidirLance(cenario({ estrategia: 'iminencia', segundosRestantes: 30, melhorLance: 54 })).acao).toBe('encerrar');
  });
});

describe('a tela e o agente falam as mesmas estratégias', () => {
  it('todo id que a tela oferece o agente conhece, e vice-versa', () => {
    // Um id que só a tela conhece faria o robô aguardar em toda rodada, com a
    // pessoa achando que escolheu uma estratégia válida.
    const module = { exports: {} as { ESTRATEGIAS: string[] } };
    new vm.Script(ESTRATEGIA_FILES['src/estrategia.js']).runInNewContext({ module, exports: module.exports });
    expect(ESTRATEGIAS_DO_ITEM.map((e) => e.id).sort()).toEqual([...module.exports.ESTRATEGIAS].sort());
  });
});

describe('intervalo mínimo do edital', () => {
  beforeAll(() => {
    if (!liberados.includes('__teste__')) liberados.push('__teste__');
  });

  it('sem decremento configurado, usa o intervalo do edital como passo', () => {
    const d = decidirLance(cenario({ decrementoMin: 0, decrementoPercentual: 0, intervaloMinimo: 0.01 }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(89.99);
    expect(d.motivo).toMatch(/intervalo minimo do edital/);
  });

  it('decremento menor que o intervalo do edital sobe para o intervalo — senão o portal recusa', () => {
    const d = decidirLance(cenario({ decrementoMin: 0.5, intervaloMinimo: 2 }));
    expect(d.valor).toBe(88);
  });

  it('decremento maior que o intervalo é respeitado', () => {
    const d = decidirLance(cenario({ decrementoMin: 5, intervaloMinimo: 0.01 }));
    expect(d.valor).toBe(85);
  });

  it('intervalo em percentual incide sobre o melhor lance', () => {
    const d = decidirLance(cenario({ decrementoMin: 0, decrementoPercentual: 0, intervaloMinimoPercentual: 1 }));
    expect(d.valor).toBe(89.1); // 90 − 1% de 90
  });

  it('o arredondamento nunca encolhe o passo abaixo do intervalo', () => {
    // 100 − 0,3333 = 99,6667 → arredondado daria 99,67 (passo de 0,33, abaixo
    // do intervalo); tem de ir para 99,66.
    const d = decidirLance(cenario({ valorAtual: 120, melhorLance: 100, decrementoMin: 0, decrementoPercentual: 0, intervaloMinimo: 0.3333 }));
    expect(d.valor).toBe(99.66);
    expect(100 - d.valor!).toBeGreaterThanOrEqual(0.3333);
  });

  it('o intervalo do edital não fura o piso', () => {
    const d = decidirLance(cenario({ melhorLance: 52, valorMinimo: 50, decrementoMin: 0, intervaloMinimo: 3 }));
    expect(d.acao).toBe('encerrar');
    expect(d.motivo).toMatch(/piso/i);
  });
});

describe('fases da disputa', () => {
  beforeAll(() => {
    if (!liberados.includes('__teste__')) liberados.push('__teste__');
  });

  it('fase não lida (null) não bloqueia melhor preço — é a situação de hoje', () => {
    expect(decidirLance(cenario({ fase: null })).acao).toBe('lance');
  });

  it('encerrada encerra; suspensa e aguardando esperam', () => {
    expect(decidirLance(cenario({ fase: 'encerrada' })).acao).toBe('encerrar');
    expect(decidirLance(cenario({ fase: 'suspensa' })).acao).toBe('aguardar');
    expect(decidirLance(cenario({ fase: 'aguardando' })).acao).toBe('aguardar');
  });

  it('fase com nome desconhecido aguarda', () => {
    const d = decidirLance(cenario({ fase: 'intervalo' }));
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toContain('intervalo');
  });

  it('fechado e aberto: fora dos classificados para a etapa aberta, encerra', () => {
    const d = decidirLance(cenario({ fase: 'aberta', elegivel: false }));
    expect(d.acao).toBe('encerrar');
  });

  it('lance final fechado: só com elegibilidade confirmada', () => {
    expect(decidirLance(cenario({ fase: 'fechada', elegivel: null, lanceFinalFechado: 70 })).acao).toBe('aguardar');
    expect(decidirLance(cenario({ fase: 'fechada', elegivel: false, lanceFinalFechado: 70 })).acao).toBe('aguardar');
  });

  it('lance final fechado: sem valor escolhido pela empresa, o robô não inventa', () => {
    const d = decidirLance(cenario({ fase: 'fechada', elegivel: true }));
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toMatch(/empresa/);
  });

  it('lance final fechado: dá o valor configurado, uma vez só, nunca abaixo do piso', () => {
    const d = decidirLance(cenario({ fase: 'fechada', elegivel: true, lanceFinalFechado: 70 }));
    expect(d.acao).toBe('lance');
    expect(d.valor).toBe(70);
    expect(decidirLance(cenario({ fase: 'fechada', elegivel: true, lanceFinalFechado: 70, lanceFechadoEnviado: true })).acao).toBe('aguardar');
    expect(decidirLance(cenario({ fase: 'fechada', elegivel: true, lanceFinalFechado: 40 })).acao).toBe('aguardar');
  });

  it('lance final fechado não depende de estarmos atrás — o líder também dá o seu', () => {
    const d = decidirLance(cenario({ fase: 'fechada', elegivel: true, lanceFinalFechado: 70, souLider: true }));
    expect(d.acao).toBe('lance');
  });
});

describe('proximaLeituraMs — ritmo da leitura', () => {
  let proximaLeituraMs: (e: Record<string, unknown>) => number;
  beforeAll(() => {
    const module = { exports: {} as { proximaLeituraMs: typeof proximaLeituraMs } };
    new vm.Script(ESTRATEGIA_FILES['src/estrategia.js'], { filename: 'estrategia.js' }).runInNewContext({ module, exports: module.exports });
    proximaLeituraMs = module.exports.proximaLeituraMs;
  });

  it('fora da iminência, o intervalo configurado', () => {
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'aberta', segundosRestantes: 500 })).toBe(30000);
    expect(proximaLeituraMs({ intervaloSegundos: 30 })).toBe(30000);
  });

  it('na iminência e no lance final fechado, a cada 3 s', () => {
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'aberta', segundosRestantes: 90 })).toBe(3000);
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'encerramento_aleatorio' })).toBe(3000);
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'fechada' })).toBe(3000);
  });

  it('chegando na iminência, a próxima leitura cai no começo dela', () => {
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'aberta', segundosRestantes: 130 })).toBe(10000);
  });

  it('suspensa não acelera a leitura', () => {
    expect(proximaLeituraMs({ intervaloSegundos: 30, fase: 'suspensa', segundosRestantes: 60 })).toBe(30000);
  });

  it('intervalo inválido cai em 30 s, nunca em zero', () => {
    for (const i of [0, -5, null, undefined, NaN]) {
      expect(proximaLeituraMs({ intervaloSegundos: i })).toBe(30000);
    }
  });
});

describe('trava de liberação por portal', () => {
  it('nasce vazia — nenhum portal envia lance sem alguém liberar', () => {
    // Se este teste falhar, alguém liberou um portal. Isso é permitido, mas
    // tem de ser deliberado: confira se o souLider() daquele portal foi
    // conferido contra a tela real de uma disputa.
    const reais = liberados.filter((p) => p !== '__teste__');
    expect(reais).toEqual([]);
  });

  it('portal fora da lista aguarda, mesmo com tudo o mais perfeito', () => {
    // O atalho perigoso é escrever `async souLider() { return false; }` no
    // portal: uma linha, passa num diff, e faz o robô cobrir o próprio lance.
    // A trava vem ANTES de qualquer outra checagem justamente por isso.
    const d = decidirLance({
      portalId: 'comprasgov',
      valorAtual: 100,
      valorMinimo: 50,
      melhorLance: 90,
      souLider: false,
      decrementoMin: 5,
      rodada: 1,
      maxLances: 20,
    });
    expect(d.acao).toBe('aguardar');
    expect(d.motivo).toMatch(/não está liberado|nao esta liberado/i);
  });

  it('sem portalId também aguarda — não existe padrão permissivo', () => {
    const d = decidirLance({ valorAtual: 100, valorMinimo: 50, melhorLance: 90, souLider: false, decrementoMin: 5, rodada: 1, maxLances: 20 });
    expect(d.acao).toBe('aguardar');
  });

  it('podeEnviarLance responde pela lista, não por adivinhação', () => {
    expect(podeEnviarLance('bll')).toBe(false);
    expect(podeEnviarLance('__teste__')).toBe(true); // liberado pelo bloco acima
  });
});

/**
 * A conferência dos itens contra o que o portal publicou.
 *
 * A tela monta os itens do NOSSO lado — Precificação, Proposta, extração do
 * edital — e nada disso conversa com o portal. Sem esta comparação, um número
 * errado só aparece durante o pregão, quando não há mais o que fazer.
 */
describe('conferirItens', () => {
  const doPortal = [
    { numero: 1, descricao: 'Caneta', valor_referencia: 2.5, quantidade: 100 },
    { numero: 2, descricao: 'Papel A4', valor_referencia: 25, quantidade: 50 },
    { numero: 3, descricao: 'Clipe', valor_referencia: 4, quantidade: 30 },
  ];

  it('não afirma nada quando não conseguiu ler o portal', () => {
    // O caso mais importante: lista vazia do portal é "não li", não "nada
    // existe". Acusar 3 itens de faltarem seria culpar o usuário por uma
    // falha nossa de leitura.
    const r = conferirItens([{ numero: 1 }], []);
    expect(r.leu).toBe(false);
    expect(r.ok).toBeNull();
    expect(r.faltando).toHaveLength(0);
  });

  it('aprova quando os itens que enviamos existem no portal', () => {
    const r = conferirItens([{ numero: 1 }, { numero: 2 }], doPortal);
    expect(r.leu).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.faltando).toHaveLength(0);
  });

  it('acusa item que enviamos e não existe no portal', () => {
    const r = conferirItens([{ numero: 1 }, { numero: 99 }], doPortal);
    expect(r.ok).toBe(false);
    expect(r.faltando).toEqual([99]);
    expect(r.resumo).toContain('99');
  });

  it('disputar parte do edital NÃO é erro', () => {
    // Escolher 1 item de um edital com 3 é decisão comercial rotineira. Se
    // isso reprovasse, o aviso seria ignorado no primeiro pregão grande.
    const r = conferirItens([{ numero: 1 }], doPortal);
    expect(r.ok).toBe(true);
    expect(r.sobrando).toEqual([2, 3]);
  });

  it('aponta valor de referência diferente do publicado', () => {
    const r = conferirItens(
      [{ numero: 2, valor_estimado_orgao: 30 }],
      doPortal,
    );
    expect(r.ok).toBe(false);
    expect(r.divergencias).toEqual([{ numero: 2, nosso: 30, portal: 25 }]);
  });

  it('tolera diferença de centavo — arredondamento não é divergência', () => {
    const r = conferirItens(
      [{ numero: 2, valor_estimado_orgao: 25.1 }],
      doPortal,
    );
    expect(r.divergencias).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('não inventa divergência quando um dos lados não tem valor', () => {
    const r = conferirItens([{ numero: 1 }], doPortal);
    expect(r.divergencias).toHaveLength(0);
  });
});
