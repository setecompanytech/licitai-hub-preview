import { describe, expect, it } from 'vitest';
import {
  TODOS_OS_PORTAIS,
  campoDeBrasiliaParaIso,
  isoParaCampoDeBrasilia,
  nomeDoPortalDoAviso,
  ordenarAvisos,
  payloadDoAviso,
  rascunhoNovo,
  situacaoDoAviso,
  validarAviso,
  type AvisoDoPortal,
} from './avisos';

/**
 * As regras dos avisos sem tela. A situação precisa bater com a policy do
 * banco ("Clientes leem avisos vigentes"): se a gestão disser "vigente" de um
 * aviso que o cliente não lê, a operação acha que avisou e não avisou.
 */

const AGORA = new Date('2026-09-14T15:00:00.000Z');

const aviso = (parcial: Partial<AvisoDoPortal>): AvisoDoPortal => ({
  id: 'a',
  portal_id: null,
  severidade: 'atencao',
  titulo: 'T',
  mensagem: 'M',
  ativo: true,
  inicio_em: '2026-09-14T12:00:00.000Z',
  fim_em: null,
  ...parcial,
});

describe('situação do aviso — espelho da policy do banco', () => {
  it('ativo, começou e sem fim: vigente', () => {
    expect(situacaoDoAviso(aviso({}), AGORA)).toBe('vigente');
  });

  it('início no futuro: agendado', () => {
    expect(situacaoDoAviso(aviso({ inicio_em: '2026-09-15T12:00:00.000Z' }), AGORA)).toBe('agendado');
  });

  it('fim já passou: encerrado — e o instante exato do fim já não é vigente', () => {
    expect(situacaoDoAviso(aviso({ fim_em: '2026-09-14T14:00:00.000Z' }), AGORA)).toBe('encerrado');
    expect(situacaoDoAviso(aviso({ fim_em: AGORA.toISOString() }), AGORA)).toBe('encerrado');
  });

  it('desativado vence o calendário', () => {
    expect(situacaoDoAviso(aviso({ ativo: false }), AGORA)).toBe('inativo');
    expect(situacaoDoAviso(aviso({ ativo: false, inicio_em: '2099-01-01T00:00:00.000Z' }), AGORA)).toBe('inativo');
  });

  it('ordena o que o cliente lê agora primeiro', () => {
    const ordem = ordenarAvisos(
      [
        aviso({ id: 'enc', fim_em: '2026-09-14T13:00:00.000Z' }),
        aviso({ id: 'ina', ativo: false }),
        aviso({ id: 'age', inicio_em: '2026-09-20T12:00:00.000Z' }),
        aviso({ id: 'vig' }),
      ],
      AGORA,
    ).map((l) => l.aviso.id);
    expect(ordem).toEqual(['vig', 'age', 'ina', 'enc']);
  });
});

describe('horário de Brasília', () => {
  it('lê o campo como −03:00, qualquer que seja o fuso da máquina', () => {
    expect(campoDeBrasiliaParaIso('2026-09-20T10:00')).toBe('2026-09-20T13:00:00.000Z');
    expect(campoDeBrasiliaParaIso('2026-09-20T22:30')).toBe('2026-09-21T01:30:00.000Z');
  });

  it('ida e volta devolve o mesmo campo', () => {
    expect(isoParaCampoDeBrasilia(campoDeBrasiliaParaIso('2026-12-31T23:59'))).toBe('2026-12-31T23:59');
  });

  it('recusa data que não existe em vez de corrigi-la', () => {
    expect(campoDeBrasiliaParaIso('2026-02-31T10:00')).toBeNull();
    expect(campoDeBrasiliaParaIso('')).toBeNull();
  });
});

describe('formulário', () => {
  const valido = { ...rascunhoNovo(AGORA), titulo: ' Instabilidade ', mensagem: ' Texto ' };

  it('título e mensagem são obrigatórios', () => {
    const erros = validarAviso({ ...valido, titulo: '  ', mensagem: '' });
    expect(Object.keys(erros).sort()).toEqual(['mensagem', 'titulo']);
  });

  it('fim precisa ser depois do início', () => {
    expect(validarAviso({ ...valido, inicio: '2026-09-20T10:00', fim: '2026-09-20T10:00' }).fim).toBeTruthy();
    expect(validarAviso({ ...valido, inicio: '2026-09-20T10:00', fim: '2026-09-20T10:01' })).toEqual({});
  });

  it('"Todos os portais" vai ao banco como nulo, e o texto sem espaço sobrando', () => {
    expect(payloadDoAviso({ ...valido, portal: TODOS_OS_PORTAIS, inicio: '2026-09-20T10:00' })).toEqual({
      portal_id: null,
      severidade: 'atencao',
      titulo: 'Instabilidade',
      mensagem: 'Texto',
      ativo: true,
      inicio_em: '2026-09-20T13:00:00.000Z',
      fim_em: null,
    });
    expect(payloadDoAviso({ ...valido, portal: 'bll' }).portal_id).toBe('bll');
  });

  it('nome do portal vem do vocabulário único', () => {
    expect(nomeDoPortalDoAviso(null)).toBe('Todos os portais');
    expect(nomeDoPortalDoAviso('compras-gov')).toBe('Compras.gov.br');
  });
});
