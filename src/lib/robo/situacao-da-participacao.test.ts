import { describe, expect, it } from 'vitest';
import {
  resumirErroParaCliente,
  estadoDoRobo,
  lanceLiberadoNoPortal,
  projetarParticipacao,
  type DisputaParaProjecao,
  type SessaoParaProjecao,
} from './situacao-da-participacao';

/**
 * As quatro abas são PROJEÇÕES de estado verificado, e o estado do robô é
 * outra coisa. O que estes casos prendem:
 *
 *  - disputa marcada à mão não se passa por fase confirmada pelo portal;
 *  - simulação nunca aparece em "Em disputa";
 *  - parada solicitada não é parada confirmada;
 *  - "operando" com sinal velho não é "operando";
 *  - certame em disputa com robô parado é um estado legítimo.
 */

const AGORA = new Date('2026-09-14T13:00:00Z');
const opcoes = { agora: AGORA, portaisComLanceLiberado: [] as string[] };

const disputa = (over: Partial<DisputaParaProjecao> = {}): DisputaParaProjecao => ({
  id: 'd-1',
  licitacao_id: 'l-1',
  portal: 'Compras.gov.br',
  status: 'aguardando',
  valor_inicial: 1000,
  valor_minimo: 0,
  itens: [{ numero: 1, valorMinimo: 800 }],
  precificacao_versao_id: 'v-3',
  ...over,
});

const sessao = (over: Partial<SessaoParaProjecao> = {}): SessaoParaProjecao => ({
  id: 's-1',
  status: 'ativo',
  modo: 'real',
  updated_at: '2026-09-14T12:59:30Z',
  ...over,
});

describe('abas do painel', () => {
  it('sem limites aprovados fica em Cadastradas, dizendo o que falta', () => {
    const p = projetarParticipacao(disputa({ precificacao_versao_id: null }), null, opcoes);
    expect(p.aba).toBe('cadastradas');
    expect(p.pendenciaPrincipal).toMatch(/sem versão aprovada/);
    expect(p.proximaAcao).toBe('Aprovar limites na Precificação');
  });

  it('item sem limite também não é "configurada"', () => {
    const p = projetarParticipacao(disputa({ itens: [{ valorMinimo: 800 }, { valorMinimo: 0 }] }), null, opcoes);
    expect(p.aba).toBe('cadastradas');
    expect(p.itensSemLimite).toBe(1);
  });

  it('portal, preço inicial, limites e versão aprovada → Configuradas', () => {
    const p = projetarParticipacao(disputa(), null, opcoes);
    expect(p.aba).toBe('configuradas');
    expect(p.estadoDoRobo).toBe('sem_sessao');
  });

  it('Em disputa pelo agente, com a fonte declarada', () => {
    const p = projetarParticipacao(disputa(), sessao(), opcoes);
    expect(p.aba).toBe('em_disputa');
    expect(p.faseInformadaPor).toBe('agente');
    expect(p.estadoDoRobo).toBe('operando');
  });

  it('marcação manual aparece em Em disputa, mas nunca como confirmada pelo portal', () => {
    const p = projetarParticipacao(disputa({ status: 'ativo' }), null, opcoes);
    expect(p.aba).toBe('em_disputa');
    expect(p.faseInformadaPor).toBe('marcacao_manual');
  });

  it('simulação não é disputa', () => {
    const p = projetarParticipacao(disputa(), sessao({ modo: 'simulacao' }), opcoes);
    expect(p.aba).not.toBe('em_disputa');
    expect(p.estadoDoRobo).toBe('simulacao');
  });

  it('certame em disputa com o robô parado é legítimo', () => {
    const p = projetarParticipacao(
      disputa({ status: 'ativo' }),
      sessao({ status: 'encerrado', parada_solicitada_em: '2026-09-14T12:50:00Z', parada_confirmada_em: '2026-09-14T12:50:04Z' }),
      opcoes,
    );
    expect(p.aba).toBe('em_disputa');
    expect(p.estadoDoRobo).toBe('parado');
  });

  it('parar o robô NÃO encerra o certame: sem resultado do agente, não vai para Encerradas', () => {
    const p = projetarParticipacao(disputa(), sessao({ status: 'encerrado', resultado: null }), opcoes);
    expect(p.aba).not.toBe('encerradas');
  });

  it('parada de emergência é do robô: o certame não vai para Encerradas', () => {
    // O callback `sessao-encerrada` grava resultado 'parada_emergencial' quando
    // uma pessoa interrompe. O pregão continua acontecendo no portal.
    const p = projetarParticipacao(
      disputa({ status: 'ativo' }),
      sessao({ status: 'encerrado', resultado: 'parada_emergencial' }),
      opcoes,
    );
    expect(p.aba).toBe('em_disputa');
    expect(p.estadoDoRobo).toBe('parado');
  });

  it('Encerradas registra quem informou o encerramento', () => {
    expect(projetarParticipacao(disputa(), sessao({ status: 'encerrado', resultado: 'encerrada' }), opcoes).faseInformadaPor)
      .toBe('agente');
    expect(projetarParticipacao(disputa({ status: 'encerrado' }), null, opcoes).faseInformadaPor)
      .toBe('marcacao_manual');
  });
});

describe('estado do robô', () => {
  it('parada solicitada sem confirmação não é "parado"', () => {
    const s = sessao({ parada_solicitada_em: '2026-09-14T12:59:50Z' });
    expect(estadoDoRobo(s, AGORA)).toBe('parada_solicitada');
    const p = projetarParticipacao(disputa(), s, opcoes);
    expect(p.pendenciaPrincipal).toMatch(/ainda não confirmou/);
  });

  it('sinal mais velho que o limite deixa de ser "operando"', () => {
    const velha = sessao({ updated_at: '2026-09-14T12:50:00Z' });
    expect(estadoDoRobo(velha, AGORA, 120)).toBe('sinal_desatualizado');
    expect(estadoDoRobo(velha, AGORA, 900)).toBe('operando');
  });

  it('status que o código não conhece não vira "operando"', () => {
    expect(estadoDoRobo(sessao({ status: 'pausado' }), AGORA)).toBe('desconhecido');
  });
});

describe('capacidade do portal', () => {
  it('sem portal liberado, a pendência é declarada — nunca simula envio', () => {
    const p = projetarParticipacao(disputa(), null, opcoes);
    expect(p.lanceLiberadoNoPortal).toBe(false);
    expect(p.pendenciaPrincipal).toMatch(/somente monitoramento/);
  });

  it('casa o portal ignorando acento, caixa e pontuação', () => {
    expect(lanceLiberadoNoPortal('Compras.gov.br', ['comprasgovbr'])).toBe(true);
    expect(lanceLiberadoNoPortal(null, ['comprasgovbr'])).toBe(false);
  });
});

describe('erro em linguagem de cliente', () => {
  it('"Signal timed out." vira falta de resposta do portal', () => {
    expect(resumirErroParaCliente('Signal timed out.')).toEqual({
      texto: 'O portal não respondeu a tempo.',
      acao: 'Tentar de novo mais tarde',
    });
  });

  it('processo não encontrado vence a menção à conta vencida no mesmo texto', () => {
    const bruto =
      'Processo "TESTE-001" nao encontrado em Seus Processos do Portal de Compras Publicas. ' +
      'Obs.: o portal informa que o acesso esta vencido desde 17/04/2026, com 0 creditos.';
    const r = resumirErroParaCliente(bruto);
    expect(r.texto).toBe('O processo não foi localizado na conta do portal.');
    // Nada da conta usada nos bastidores chega ao cliente.
    expect(r.texto).not.toMatch(/credit|vencid|17\/04/i);
  });

  it('credencial, certificado e conta têm ação própria; o resto vai ao suporte', () => {
    expect(resumirErroParaCliente('Login falhou: senha incorreta').acao).toBe('Revisar o acesso ao portal');
    expect(resumirErroParaCliente('Certificado .pfx rejeitado').acao).toBe('Revisar o certificado digital');
    expect(resumirErroParaCliente('Conta com assinatura expirada').acao).toBe('Verificar a conta no portal');
    expect(resumirErroParaCliente('ECONNRESET 10.0.0.3:3500').acao).toBe('Falar com o suporte');
    expect(resumirErroParaCliente(null).acao).toBe('Falar com o suporte');
  });

  it('a pendência do painel usa o texto traduzido, nunca o erro cru', () => {
    const p = projetarParticipacao(
      disputa(),
      sessao({ status: 'erro', erro: 'Signal timed out.' }),
      opcoes,
    );
    expect(p.pendenciaPrincipal).toBe('O portal não respondeu a tempo.');
    expect(p.proximaAcao).toBe('Tentar de novo mais tarde');
  });
});

