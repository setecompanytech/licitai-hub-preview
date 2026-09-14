import { describe, it, expect } from 'vitest';
import {
  resolverAcao,
  erroDeColunaAusente,
  ehAgenteGerenciado,
  chaveParaOAgente,
  URL_AGENTE_GERENCIADO,
} from '../../supabase/functions/_shared/robo-acao';

/**
 * As decisões puras do `robo-lances-webhook`.
 *
 * O caso que obrigou este arquivo: três telas mandavam `action` no corpo e a
 * função só lia a URL — "parar" respondia 404 e a sessão seguia no portal.
 */

describe('resolverAcao', () => {
  it('lê a ação no último segmento da URL', () => {
    expect(resolverAcao('/robo-lances-webhook/parar-sessao', {})).toBe('parar-sessao');
  });

  it('o segmento da URL vence o corpo', () => {
    expect(resolverAcao('/robo-lances-webhook/parar-sessao', { action: 'kill-switch' })).toBe('parar-sessao');
  });

  it('não deixa o corpo do callback do agente desviar a ação', () => {
    expect(resolverAcao('/robo-lances-webhook/callback', { action: 'kill-switch', tipo: 'heartbeat' })).toBe('callback');
  });

  it('usa `body.action` quando a URL termina no nome da função', () => {
    expect(resolverAcao('/robo-lances-webhook', { action: 'focar-sessao' })).toBe('focar-sessao');
    expect(resolverAcao('/functions/v1/robo-lances-webhook/', { action: ' responder-humano ' })).toBe('responder-humano');
  });

  it('usa `body.action` quando não há segmento nenhum', () => {
    expect(resolverAcao('/', { action: 'parar-sessao' })).toBe('parar-sessao');
    expect(resolverAcao('', { action: 'parar-sessao' })).toBe('parar-sessao');
  });

  it('corpo sem ação textual resolve vazio — e a função responde "Ação desconhecida"', () => {
    expect(resolverAcao('/robo-lances-webhook', {})).toBe('');
    expect(resolverAcao('/robo-lances-webhook', { action: 42 })).toBe('');
    expect(resolverAcao('/robo-lances-webhook', null)).toBe('');
    expect(resolverAcao('/robo-lances-webhook', 'parar-sessao')).toBe('');
    expect(resolverAcao('/robo-lances-webhook', ['parar-sessao'])).toBe('');
  });
});

describe('erroDeColunaAusente', () => {
  it('reconhece coluna ausente pelo código do Postgres e do PostgREST', () => {
    expect(erroDeColunaAusente({ code: '42703', message: 'x' })).toBe(true);
    expect(erroDeColunaAusente({ code: 'PGRST204', message: 'x' })).toBe(true);
  });

  it('reconhece pela mensagem quando o código não vem', () => {
    expect(erroDeColunaAusente({ message: 'column "parada_solicitada_em" of relation "sessoes_lance_real" does not exist' })).toBe(true);
    expect(erroDeColunaAusente({ message: "Could not find the 'parada_confirmada_em' column of 'sessoes_lance_real' in the schema cache" })).toBe(true);
  });

  it('não confunde outros erros com coluna ausente', () => {
    expect(erroDeColunaAusente({ code: '42501', message: 'permission denied for table sessoes_lance_real' })).toBe(false);
    expect(erroDeColunaAusente(null)).toBe(false);
    expect(erroDeColunaAusente('column x does not exist')).toBe(false);
  });
});

describe('ehAgenteGerenciado', () => {
  it('reconhece o agente da plataforma pelo hostname', () => {
    expect(ehAgenteGerenciado(URL_AGENTE_GERENCIADO)).toBe(true);
    expect(ehAgenteGerenciado('https://agente.praefectus.com.br/')).toBe(true);
    expect(ehAgenteGerenciado('https://AGENTE.praefectus.com.br:8443/api')).toBe(true);
  });

  it('não aceita imitação nem endereço inválido', () => {
    expect(ehAgenteGerenciado('https://agente.praefectus.com.br.exemplo.com')).toBe(false);
    expect(ehAgenteGerenciado('http://203.0.113.10:3001')).toBe(false);
    expect(ehAgenteGerenciado('agente.praefectus.com.br')).toBe(false);
    expect(ehAgenteGerenciado('')).toBe(false);
    expect(ehAgenteGerenciado(undefined)).toBe(false);
  });
});

describe('chaveParaOAgente', () => {
  const gerenciado = { url_base: URL_AGENTE_GERENCIADO, api_key_hash: 'chave-antiga-da-linha' };
  const proprio = { url_base: 'http://203.0.113.10:3001', api_key_hash: 'chave-do-dono' };

  it('agente gerenciado usa o segredo do servidor, não a linha', () => {
    expect(chaveParaOAgente(gerenciado, 'segredo-do-servidor')).toBe('segredo-do-servidor');
  });

  it('sem o segredo, o agente gerenciado cai para a linha — o comportamento anterior', () => {
    expect(chaveParaOAgente(gerenciado, null)).toBe('chave-antiga-da-linha');
  });

  it('agente próprio sempre usa a chave que o dono cadastrou', () => {
    expect(chaveParaOAgente(proprio, 'segredo-do-servidor')).toBe('chave-do-dono');
  });

  it('sem agente ou sem chave, devolve vazio — e o callback recusa', () => {
    expect(chaveParaOAgente(null, 'segredo-do-servidor')).toBe('');
    expect(chaveParaOAgente({ url_base: 'http://203.0.113.10:3001', api_key_hash: null }, null)).toBe('');
  });
});
