import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  pendenciasDaDisputa,
  perfilDoComprasGov,
  qualLembrete,
  quandoEmBrasilia,
  sessaoDoPerfil,
  sessoesVencidasParaAvisar,
  textoDaSessaoVencida,
  textoDoLembrete,
  type EntradaDaProntidao,
} from '../../../../supabase/functions/_shared/robo-prontidao';

/**
 * Lembrete de prontidão da disputa agendada (Fase 8): véspera e 1 hora antes,
 * com a checagem do que faria o robô não entrar ou entrar sem disputar.
 */

// Sessão do 7/2026: 14/09/2026 às 09:00 em Brasília (12:00 UTC).
const SESSAO = new Date('2026-09-14T12:00:00Z');
const antes = (min: number) => new Date(SESSAO.getTime() - min * 60_000);

const PRONTA: EntradaDaProntidao = {
  itens: [{ valorMinimo: 3000, estrategia: 'melhor_preco' }],
  roboDaEmpresa: 'ligado',
  temAgente: true,
  temCredencial: true,
  portalConhecido: true,
  precisaUasg: true,
  uasg: '925315',
  sessaoGovBr: 'logado',
  lanceLiberado: true,
};

describe('qualLembrete', () => {
  const nenhum = { vespera: null, umaHora: null };

  it('véspera nas últimas 24 horas; 1 hora antes na última hora; nada a 15 minutos ou menos', () => {
    expect(qualLembrete(SESSAO, antes(25 * 60), nenhum)).toBeNull();
    expect(qualLembrete(SESSAO, antes(24 * 60), nenhum)).toBe('vespera');
    expect(qualLembrete(SESSAO, antes(61), nenhum)).toBe('vespera');
    expect(qualLembrete(SESSAO, antes(60), nenhum)).toBe('uma-hora');
    expect(qualLembrete(SESSAO, antes(16), nenhum)).toBe('uma-hora');
    expect(qualLembrete(SESSAO, antes(15), nenhum)).toBeNull();
    expect(qualLembrete(SESSAO, antes(-5), nenhum)).toBeNull();
  });

  it('cada lembrete sai uma vez só', () => {
    expect(qualLembrete(SESSAO, antes(120), { vespera: '2026-09-13T12:00:00Z', umaHora: null })).toBeNull();
    expect(qualLembrete(SESSAO, antes(30), { vespera: '2026-09-13T12:00:00Z', umaHora: '2026-09-14T11:00:00Z' })).toBeNull();
  });

  it('cadastrada a 40 minutos da sessão: vai o de 1 hora, não o da véspera', () => {
    expect(qualLembrete(SESSAO, antes(40), nenhum)).toBe('uma-hora');
  });
});

describe('pendenciasDaDisputa', () => {
  it('disputa pronta: nada pendente', () => {
    expect(pendenciasDaDisputa(PRONTA)).toEqual([]);
  });

  it('o que impede o robô de entrar é grave', () => {
    const p = pendenciasDaDisputa({
      ...PRONTA,
      roboDaEmpresa: 'desligado',
      temCredencial: false,
      uasg: '',
      itens: [],
      sessaoGovBr: 'vencida',
      sessaoConferidaAs: '14:41',
    });
    expect(p.map((x) => x.chave)).toEqual(['robo-desligado', 'sem-credencial', 'sem-uasg', 'sem-itens', 'gov-br-vencida']);
    expect(p.every((x) => x.grave)).toBe(true);
    expect(p[4].texto).toContain('conferida às 14:41');
  });

  it('item sem piso, desempate sem margem e trava de lance só avisam', () => {
    const p = pendenciasDaDisputa({
      ...PRONTA,
      itens: [
        { valorMinimo: null, estrategia: 'melhor_preco' },
        { valorMinimo: 100, estrategia: 'desempatar_1o', margemDesempate: null },
      ],
      lanceLiberado: false,
    });
    expect(p.map((x) => [x.chave, x.grave])).toEqual([
      ['itens-sem-piso', false],
      ['desempate-sem-margem', false],
      ['lance-travado', false],
    ]);
    expect(p[0].texto).toBe('1 item está sem piso — o robô não disputa item sem valor mínimo');
  });

  it('quem cadastrou saiu da empresa: grave, porque o agendador não despacha', () => {
    const p = pendenciasDaDisputa({ ...PRONTA, donoForaDaEmpresa: true });
    expect(p.map((x) => [x.chave, x.grave])).toEqual([['dono-fora-da-empresa', true]]);
  });

  it('o piso geral da disputa cobre o item sem piso próprio', () => {
    expect(pendenciasDaDisputa({ ...PRONTA, itens: [{ valorMinimo: null }], valorMinimoGeral: 2500 })).toEqual([]);
  });

  it('portal desconhecido não cobra credencial; portal fora do Compras.gov não cobra UASG', () => {
    const p = pendenciasDaDisputa({ ...PRONTA, portalConhecido: false, temCredencial: false, precisaUasg: false, uasg: null });
    expect(p.map((x) => x.chave)).toEqual(['portal-desconhecido']);
  });
});

describe('textoDoLembrete', () => {
  it('véspera, tudo pronto', () => {
    const t = textoDoLembrete({ qual: 'vespera', edital: '07/2026', portalNome: 'Compras.gov.br', inicioSessao: SESSAO, agora: antes(20 * 60), pendencias: [] });
    expect(t.tipo).toBe('lembrete');
    expect(t.titulo).toBe('🗓️ Pregão amanhã às 09:00 — 07/2026');
    expect(t.mensagem).toBe(
      'Amanhã às 09:00 é a sessão do pregão 07/2026 (Compras.gov.br). O robô entra sozinho às 08:45. Conferido: robô ligado, credencial do portal cadastrada e itens prontos.',
    );
  });

  it('1 hora antes, com pendência grave e aviso', () => {
    const pendencias = pendenciasDaDisputa({ ...PRONTA, roboDaEmpresa: 'desligado', lanceLiberado: false });
    const t = textoDoLembrete({ qual: 'uma-hora', edital: '07/2026', inicioSessao: SESSAO, agora: antes(60), pendencias });
    expect(t.tipo).toBe('alerta');
    expect(t.titulo).toBe('⚠️ Pregão hoje às 09:00 com pendência — 07/2026');
    expect(t.mensagem).toContain('Antes, resolva: o robô da empresa está desligado');
    expect(t.mensagem).toContain('Atenção: o envio de lances ainda não foi liberado');
    expect(t.mensagem).not.toContain('Conferido:');
  });

  it('com o vigia confirmando, o "Conferido" diz que a sessão do gov.br está ativa', () => {
    const t = textoDoLembrete({ qual: 'uma-hora', edital: '07/2026', inicioSessao: SESSAO, agora: antes(60), pendencias: [], sessaoGovBr: 'logado', sessaoConferidaAs: '15:19' });
    expect(t.mensagem).toContain('Conferido: robô ligado, credencial do portal cadastrada, sessão do gov.br ativa (conferida às 15:19) e itens prontos.');
  });

  it('1 hora antes, pronto', () => {
    const t = textoDoLembrete({ qual: 'uma-hora', edital: '07/2026', inicioSessao: SESSAO, agora: antes(60), pendencias: [] });
    expect(t.titulo).toBe('⏰ Pregão em 1 hora — 07/2026');
  });
});

describe('quandoEmBrasilia', () => {
  it('o dia é o de Brasília, não o de UTC', () => {
    // 01:30 UTC do dia 15 ainda é 22:30 do dia 14 em Brasília.
    expect(quandoEmBrasilia(new Date('2026-09-15T01:30:00Z'), new Date('2026-09-14T12:00:00Z'))).toBe('hoje');
    expect(quandoEmBrasilia(new Date('2026-10-23T12:00:00Z'), new Date('2026-09-14T12:00:00Z'))).toBe('em 23/10');
  });
});

describe('sessão do gov.br pelo vigia', () => {
  it('o perfil tem o mesmo nome que o agente calcula', async () => {
    const login = '00000000000';
    const esperado = 'comprasgov-' + createHash('sha256').update('comprasgov:' + login).digest('hex').slice(0, 16);
    expect(await perfilDoComprasGov(login)).toBe(esperado);
  });

  it('lê o último resultado do perfil', () => {
    const vigia = { perfis: [{ perfil: 'comprasgov-abc', ultimo: 'logado', em: '2026-09-16T18:19:31.275Z' }, { perfil: 'comprasgov-def', ultimo: 'vencida-sem-novo-login', em: '2026-09-16T18:00:00Z' }] };
    expect(sessaoDoPerfil(vigia, 'comprasgov-abc').estado).toBe('logado');
    expect(sessaoDoPerfil(vigia, 'comprasgov-def').estado).toBe('vencida');
    expect(sessaoDoPerfil(vigia, 'comprasgov-xyz')).toEqual({ estado: 'sem-conferencia', em: null });
    expect(sessaoDoPerfil(null, 'comprasgov-abc').estado).toBe('sem-conferencia');
  });
});

describe('sessão do gov.br vencida, avisada assim que o vigia vê', () => {
  const vigia = {
    perfis: [
      { perfil: 'comprasgov-abc', ultimo: 'vencida', em: '2026-09-16T19:00:00.000Z' },
      { perfil: 'comprasgov-def', ultimo: 'logado', em: '2026-09-16T19:00:00.000Z' },
      { perfil: 'comprasgov-ghi', ultimo: 'vencida-sem-novo-login', em: '2026-09-16T18:20:00.000Z' },
    ],
  };

  it('só as vencidas, e cada conferência vencida uma vez', () => {
    expect(sessoesVencidasParaAvisar(vigia, new Set()).map((v) => v.chave)).toEqual([
      'comprasgov-abc@2026-09-16T19:00:00.000Z',
      'comprasgov-ghi@2026-09-16T18:20:00.000Z',
    ]);
    expect(sessoesVencidasParaAvisar(vigia, new Set(['comprasgov-abc@2026-09-16T19:00:00.000Z'])).map((v) => v.perfil)).toEqual(['comprasgov-ghi']);
    expect(sessoesVencidasParaAvisar(null, new Set())).toEqual([]);
  });

  it('o texto diz quando venceu, o que fazer e a próxima disputa', () => {
    const t = textoDaSessaoVencida({
      conferidaEm: new Date('2026-09-16T19:00:00Z'),
      agora: new Date('2026-09-16T19:05:00Z'),
      proxima: { edital: '07/2026', inicioSessao: new Date('2026-09-17T12:00:00Z') },
    });
    expect(t.titulo).toBe('🔐 Sessão do gov.br venceu — Compras.gov.br');
    expect(t.mensagem).toBe(
      'O vigia do robô encontrou a sessão do gov.br vencida na conferência das 16:00. Na próxima entrada, o robô vai pedir a confirmação do acesso pela tela remota (clique em "Seu certificado digital"). Próxima disputa: 07/2026, amanhã às 09:00 — o robô entra às 08:45. Fique de olho nesse horário.',
    );
    expect(textoDaSessaoVencida({ conferidaEm: new Date('2026-09-16T19:00:00Z'), agora: new Date('2026-09-16T19:05:00Z') }).mensagem).toContain('Nenhuma disputa agendada');
  });
});
