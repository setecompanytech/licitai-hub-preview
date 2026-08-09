import { describe, it, expect } from 'vitest';
import {
  emailDaConta, ehEmailSintetico, DOMINIO_SINTETICO,
} from '../../supabase/functions/accept-sector-invite/email-conta';

/**
 * Importa o arquivo REAL da edge function, não uma cópia. Ele não tem imports
 * do Deno justamente para permitir isto — a regra testada aqui é a que roda
 * em produção.
 */

describe('emailDaConta — sub-endereçamento no e-mail do setor', () => {
  const setor = 'comercial@gruposantarosa.com.br';

  it('gera o endereço confirmado no teste real do HostGator', () => {
    expect(emailDaConta('01', setor)).toBe('comercial+01@gruposantarosa.com.br');
  });

  it('usa o login como tag, preservando a caixa do setor', () => {
    expect(emailDaConta('COMERCIAL-01', setor))
      .toBe('comercial+comercial-01@gruposantarosa.com.br');
  });

  it('normaliza o login para minúsculas — o Auth trata e-mail sem caixa', () => {
    expect(emailDaConta('Joao.Silva', setor)).toBe('comercial+joao.silva@gruposantarosa.com.br');
  });

  it('dois logins diferentes geram endereços diferentes', () => {
    expect(emailDaConta('01', setor)).not.toBe(emailDaConta('02', setor));
  });

  it('descarta tag anterior em vez de empilhar', () => {
    // comercial+antigo+novo@ é recusado por muitos servidores
    expect(emailDaConta('novo', 'comercial+antigo@x.com.br')).toBe('comercial+novo@x.com.br');
  });

  it('aceita subdomínio', () => {
    expect(emailDaConta('01', 'setor@mail.empresa.com.br')).toBe('setor+01@mail.empresa.com.br');
  });
});

describe('emailDaConta — quedas para o domínio sintético', () => {
  const sintetico = (login: string) => `${login}@${DOMINIO_SINTETICO}`;

  it('e-mail do setor ausente', () => {
    expect(emailDaConta('01', null)).toBe(sintetico('01'));
    expect(emailDaConta('01', '')).toBe(sintetico('01'));
  });

  it('e-mail sem arroba', () => {
    expect(emailDaConta('01', 'comercial')).toBe(sintetico('01'));
  });

  it('domínio sem ponto seria recusado pelo Auth', () => {
    expect(emailDaConta('01', 'comercial@01')).toBe(sintetico('01'));
    expect(emailDaConta('01', 'comercial@localhost')).toBe(sintetico('01'));
  });

  it('domínio malformado com ponto na borda', () => {
    expect(emailDaConta('01', 'comercial@.com')).toBe(sintetico('01'));
    expect(emailDaConta('01', 'comercial@empresa.')).toBe(sintetico('01'));
  });

  it('arroba sem parte local', () => {
    expect(emailDaConta('01', '@empresa.com.br')).toBe(sintetico('01'));
  });

  it('login vazio é erro de programação, não queda silenciosa', () => {
    expect(() => emailDaConta('', 'comercial@x.com.br')).toThrow();
    expect(() => emailDaConta('   ', 'comercial@x.com.br')).toThrow();
  });
});

describe('ehEmailSintetico', () => {
  it('reconhece o domínio reservado', () => {
    expect(ehEmailSintetico('comercial-01@praefectus.invalid')).toBe(true);
    expect(ehEmailSintetico('COMERCIAL-01@PRAEFECTUS.INVALID')).toBe(true);
  });

  it('não confunde endereço real', () => {
    expect(ehEmailSintetico('comercial+01@gruposantarosa.com.br')).toBe(false);
    expect(ehEmailSintetico('joao@empresa.com.br')).toBe(false);
  });

  it('trata nulo e vazio', () => {
    expect(ehEmailSintetico(null)).toBe(false);
    expect(ehEmailSintetico('')).toBe(false);
  });
});
