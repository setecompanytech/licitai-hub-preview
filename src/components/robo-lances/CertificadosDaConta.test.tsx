import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * A lista de certificados por empresa — os "slots" (02/10/2026).
 *
 * A régua (qual situação, qual frase, qual ordem) tem os seus 20 testes em
 * `lib/robo/__tests__/certificados-da-conta.test.ts`. Aqui ficam só as coisas
 * que a lib não alcança e que já foram defeito neste módulo:
 *
 *  - falha de leitura NÃO vira lista vazia (lista vazia diz "nenhuma empresa",
 *    e afirmar isso quando a leitura falhou esconde o problema);
 *  - o botão de cada empresa trava só a linha dela, não a tela;
 *  - `somenteLeitura` esconde os botões e diz por quê;
 *  - o pedido de instalação leva a EMPRESA — era o elo que faltava para o
 *    certificado ir para a base certa no agente.
 */

const dubles = vi.hoisted(() => ({
  certificados: { data: null as unknown, error: null as unknown },
  chamadas: [] as Array<{ fn: string; body: unknown }>,
  linkGerado: { data: { upload_url: 'https://exemplo/certificado-upload?token=x' } as unknown, error: null as unknown },
  instalacao: { data: { instalado: true } as unknown, error: null as unknown },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (fn: string, opcoes?: { body?: unknown }) => {
        dubles.chamadas.push({ fn, body: opcoes?.body });
        if (fn.endsWith('certificados-das-empresas')) return Promise.resolve(dubles.certificados);
        if (fn === 'gerar-link-certificado') return Promise.resolve(dubles.linkGerado);
        if (fn.endsWith('instalar-certificado')) return Promise.resolve(dubles.instalacao);
        return Promise.resolve({ data: null, error: null });
      },
    },
  },
}));

const toasts = vi.hoisted(() => ({ sucesso: [] as string[], erro: [] as string[] }));
vi.mock('sonner', () => ({
  toast: {
    success: (m: string) => toasts.sucesso.push(m),
    error: (m: string) => toasts.erro.push(m),
  },
}));

import CertificadosDaConta from './CertificadosDaConta';

const EMPRESA_PRONTA = {
  empresa_id: 'santa-rosa',
  razao_social: 'Grupo Santa Rosa',
  cnpj: '24687187000101',
  enviado_em: '2026-10-01T11:56:00.000Z',
  instalado_em: '2026-10-01T11:57:00.000Z',
  tem_senha: true,
  link_aberto: false,
};

const EMPRESA_SEM_NADA = {
  empresa_id: 'baqplast',
  razao_social: 'BAQPLAST',
  cnpj: '11222333000144',
  enviado_em: null,
  instalado_em: null,
  tem_senha: false,
  link_aberto: false,
};

beforeEach(() => {
  dubles.chamadas = [];
  toasts.sucesso = [];
  toasts.erro = [];
  dubles.certificados = { data: { certificados: [EMPRESA_PRONTA, EMPRESA_SEM_NADA] }, error: null };
  dubles.linkGerado = { data: { upload_url: 'https://exemplo/certificado-upload?token=x' }, error: null };
  dubles.instalacao = { data: { instalado: true }, error: null };
  // `navigator.clipboard` não existe no jsdom; o componente trata a ausência,
  // mas sem o duble o await rejeitaria antes do catch em alguns ambientes.
  Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
});

describe('a lista, por empresa', () => {
  it('mostra cada empresa com a situação e o resumo honesto', async () => {
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText('Grupo Santa Rosa')).toBeInTheDocument());
    expect(screen.getByText('BAQPLAST')).toBeInTheDocument();
    expect(screen.getByText('No robô')).toBeInTheDocument();
    expect(screen.getByText('Sem certificado')).toBeInTheDocument();
    // O resumo NÃO diz "tudo certo" com uma empresa pendente.
    expect(screen.getByText('1 de 2 empresas prontas para disputar')).toBeInTheDocument();
  });

  it('a pendente vem ANTES da pronta', async () => {
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText('BAQPLAST')).toBeInTheDocument());
    const nomes = screen.getAllByRole('listitem').map((li) => li.textContent || '');
    expect(nomes[0]).toContain('BAQPLAST');
    expect(nomes[1]).toContain('Grupo Santa Rosa');
  });

  it('não afirma que o certificado é VÁLIDO — a validade não é lida', async () => {
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText(/No robô desde 01\/10\/2026/)).toBeInTheDocument());
    expect(screen.queryByText(/válido|vence em/i)).not.toBeInTheDocument();
  });
});

describe('falha de leitura', () => {
  it('NÃO vira "nenhuma empresa" — oferece tentar de novo', async () => {
    dubles.certificados = { data: null, error: { message: 'non-2xx status code' } };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument());
    expect(screen.queryByText(/Nenhuma empresa nesta conta/)).not.toBeInTheDocument();
  });

  it('o motivo do corpo vence o "non-2xx"', async () => {
    dubles.certificados = {
      data: { erro: 'Não foi possível ler as empresas: permissão negada' },
      error: { message: 'non-2xx status code' },
    };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText(/permissão negada/)).toBeInTheDocument());
  });

  it('conta sem empresa diz isso, e explica', async () => {
    dubles.certificados = { data: { certificados: [] }, error: null };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText(/Nenhuma empresa nesta conta/)).toBeInTheDocument());
  });
});

describe('registrar e instalar', () => {
  it('o link de envio leva a empresa DAQUELA linha', async () => {
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText('BAQPLAST')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /registrar certificado/i }));
    await waitFor(() => {
      const chamada = dubles.chamadas.find((c) => c.fn === 'gerar-link-certificado');
      expect(chamada?.body).toEqual({ empresa_id: 'baqplast' });
    });
  });

  it('instalar no robô leva a empresa — o elo que faltava', async () => {
    dubles.certificados = {
      data: { certificados: [{ ...EMPRESA_PRONTA, instalado_em: null }] },
      error: null,
    };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByRole('button', { name: /instalar no robô/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /instalar no robô/i }));
    await waitFor(() => {
      const chamada = dubles.chamadas.find((c) => c.fn.endsWith('instalar-certificado'));
      expect(chamada?.body).toEqual({ empresa_id: 'santa-rosa' });
    });
  });

  it('o botão "Instalar no robô" só aparece quando falta instalar', async () => {
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText('Grupo Santa Rosa')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /instalar no robô/i })).not.toBeInTheDocument();
  });

  it('falha na instalação mostra o motivo, não um "ok" falso', async () => {
    dubles.certificados = {
      data: { certificados: [{ ...EMPRESA_PRONTA, instalado_em: null }] },
      error: null,
    };
    dubles.instalacao = { data: { instalado: false, motivo: 'O robô está fora do ar.' }, error: null };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByRole('button', { name: /instalar no robô/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /instalar no robô/i }));
    await waitFor(() => expect(toasts.erro).toContain('O robô está fora do ar.'));
    expect(toasts.sucesso).toHaveLength(0);
  });

  it('o botão de uma empresa não trava o da outra', async () => {
    // Uma promessa que não resolve: o botão clicado fica ocupado, o outro não.
    dubles.linkGerado = new Promise(() => { }) as unknown as { data: unknown; error: unknown };
    render(<CertificadosDaConta />);
    await waitFor(() => expect(screen.getByText('BAQPLAST')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /registrar certificado/i }));
    expect(screen.getByRole('button', { name: /registrar certificado/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /enviar outro/i })).not.toBeDisabled();
  });
});

describe('somenteLeitura', () => {
  it('esconde os botões e diz de quem é a alçada', async () => {
    render(<CertificadosDaConta somenteLeitura />);
    await waitFor(() => expect(screen.getByText('Grupo Santa Rosa')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /registrar certificado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar outro/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o administrador da empresa registra ou troca/)).toBeInTheDocument();
  });
});
