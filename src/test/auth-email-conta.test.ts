import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  emailDaConta, ehEmailSintetico, DOMINIO_SINTETICO,
} from '../../supabase/functions/accept-sector-invite/email-conta';

/**
 * Importa `email-conta.ts`, que não tem imports do Deno justamente para
 * permitir isto. O `index.ts` da edge function carrega uma cópia literal do
 * mesmo bloco — ver a paridade no fim deste arquivo.
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

describe('paridade entre email-conta.ts e a cópia dentro do index.ts', () => {
  /**
   * O index.ts da edge function não importa email-conta.ts: ele repete o bloco.
   * Isso existe para que a function tenha UM arquivo só — publicar pelo editor
   * do Dashboard obriga a recriar cada arquivo à mão, e esquecer o segundo
   * quebra o bundle com "Module not found".
   *
   * O preço é a chance de divergirem. Este teste cobra o preço: os testes acima
   * exercitam email-conta.ts, e este garante que o que roda em produção é
   * exatamente o mesmo texto.
   */
  const MARCADOR_INICIO = '// <<<email-conta:inicio>>>';
  const MARCADOR_FIM = '// <<<email-conta:fim>>>';

  // A partir da raiz do projeto: `import.meta.url` não é uma URL file: sob a
  // config de teste daqui, e readFileSync recusa qualquer outro esquema.
  const caminho = (arquivo: string) =>
    resolve(process.cwd(), 'supabase/functions/accept-sector-invite', arquivo);

  const bloco = (arquivo: string): string => {
    const texto = readFileSync(caminho(arquivo), 'utf8');
    const inicio = texto.indexOf(MARCADOR_INICIO);
    const fim = texto.indexOf(MARCADOR_FIM);
    if (inicio < 0 || fim < 0) {
      throw new Error(`Marcadores email-conta ausentes em ${arquivo} — não remova.`);
    }
    return texto.slice(inicio + MARCADOR_INICIO.length, fim).trim();
  };

  it('os dois blocos são idênticos caractere a caractere', () => {
    expect(bloco('index.ts')).toBe(bloco('email-conta.ts'));
  });

  it('o index.ts não voltou a importar email-conta.ts', () => {
    // O import é o que derrubava o deploy pelo Dashboard.
    const index = readFileSync(caminho('index.ts'), 'utf8');
    expect(index).not.toMatch(/from\s+['"]\.\/email-conta/);
  });
});
