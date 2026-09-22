import { describe, expect, it } from 'vitest';
import {
  abertasPorVaga, fraseDaSolicitacao, linhaParaGravar, situacaoDaSolicitacao, solicitacaoAberta,
  validarSolicitacao, type SolicitacaoDeDocumento,
} from './solicitacoes';

/**
 * A vaga mostra "solicitada em DD/MM, prazo DD/MM" até o PDF chegar. O que
 * este arquivo trava: a situação sai do prazo contado por DATA (sem hora e
 * sem fuso), a aberta mais recente é a que vale, e a validação recusa prazo
 * no passado e e-mail torto antes de gravar.
 */
const HOJE = new Date(2026, 8, 23); // 23/09/2026, meia-noite local

const base = (extra: Partial<SolicitacaoDeDocumento> = {}): SolicitacaoDeDocumento => ({
  id: 's1',
  empresa_id: 'e1',
  documento_nome: 'Certidão Negativa de Débitos Municipais',
  orgao: 'Prefeitura Municipal de Belém · Secretaria de Finanças',
  email_destino: 'sefin@belem.pa.gov.br',
  solicitada_em: '2026-09-22T15:30:00.000Z',
  protocolo: null,
  prazo_resposta: '2026-10-07',
  observacao: null,
  user_id: 'u1',
  created_at: '2026-09-22T15:30:00.000Z',
  encerrada_em: null,
  ...extra,
});

describe('situacaoDaSolicitacao', () => {
  it('aguarda dentro do prazo, avisa no dia, cobra depois, e encerrada é encerrada', () => {
    expect(situacaoDaSolicitacao(base(), HOJE)).toBe('aguardando');
    expect(situacaoDaSolicitacao(base({ prazo_resposta: '2026-09-23' }), HOJE)).toBe('prazo_hoje');
    expect(situacaoDaSolicitacao(base({ prazo_resposta: '2026-09-20' }), HOJE)).toBe('prazo_vencido');
    expect(situacaoDaSolicitacao(base({ prazo_resposta: '2026-09-20', encerrada_em: '2026-09-21T10:00:00Z' }), HOJE)).toBe('encerrada');
  });

  it('sem prazo informado, só aguarda — não inventa vencimento', () => {
    expect(situacaoDaSolicitacao(base({ prazo_resposta: null }), HOJE)).toBe('aguardando');
  });
});

describe('fraseDaSolicitacao — a frase que a vaga mostra', () => {
  it('diz quando pediu e até quando espera', () => {
    expect(fraseDaSolicitacao(base(), HOJE)).toBe('Solicitada em 22/09, prazo 07/10');
  });

  it('diz o atraso quando o prazo passou, e o protocolo quando o órgão deu um', () => {
    expect(fraseDaSolicitacao(base({ prazo_resposta: '2026-09-20', protocolo: ' 2026/1234 ' }), HOJE))
      .toBe('Solicitada em 22/09, prazo 20/09 — vencido há 3 dias, protocolo 2026/1234');
    expect(fraseDaSolicitacao(base({ prazo_resposta: '2026-09-22' }), HOJE))
      .toBe('Solicitada em 22/09, prazo 22/09 — vencido há 1 dia');
    expect(fraseDaSolicitacao(base({ prazo_resposta: '2026-09-23' }), HOJE))
      .toBe('Solicitada em 22/09, prazo 23/09 — vence hoje');
  });

  it('sem prazo, diz que não há prazo — não uma data em branco', () => {
    expect(fraseDaSolicitacao(base({ prazo_resposta: null }), HOJE)).toBe('Solicitada em 22/09, sem prazo informado');
  });
});

describe('solicitacaoAberta / abertasPorVaga', () => {
  const lista = [
    base({ id: 'velha', solicitada_em: '2026-08-01T10:00:00Z', encerrada_em: '2026-08-20T10:00:00Z' }),
    base({ id: 'aberta-antiga', solicitada_em: '2026-09-10T10:00:00Z' }),
    base({ id: 'aberta-nova', solicitada_em: '2026-09-22T10:00:00Z' }),
    base({ id: 'outra-vaga', documento_nome: 'Inscrição Municipal (cadastro de contribuintes)', solicitada_em: '2026-09-15T10:00:00Z' }),
  ];

  it('a aberta mais recente é a que vale; encerrada não conta', () => {
    expect(solicitacaoAberta(lista, 'Certidão Negativa de Débitos Municipais')?.id).toBe('aberta-nova');
    expect(solicitacaoAberta(lista, 'Certidão Negativa de Falência')).toBeNull();
    expect(solicitacaoAberta([lista[0]], 'Certidão Negativa de Débitos Municipais')).toBeNull();
  });

  it('uma por vaga, chaveada pelo nome exato', () => {
    const mapa = abertasPorVaga(lista);
    expect(Object.keys(mapa).sort()).toEqual([
      'Certidão Negativa de Débitos Municipais',
      'Inscrição Municipal (cadastro de contribuintes)',
    ]);
    expect(mapa['Certidão Negativa de Débitos Municipais'].id).toBe('aberta-nova');
    expect(mapa['Inscrição Municipal (cadastro de contribuintes)'].id).toBe('outra-vaga');
  });
});

describe('validarSolicitacao / linhaParaGravar', () => {
  it('aceita o mínimo: o órgão', () => {
    expect(validarSolicitacao({ orgao: 'Secretaria de Finanças' }, HOJE)).toEqual([]);
  });

  it('recusa órgão vazio, e-mail torto e prazo no passado, dizendo por quê', () => {
    const erros = validarSolicitacao({ orgao: '  ', emailDestino: 'sefin@', prazoResposta: '2026-09-22' }, HOJE);
    expect(erros).toHaveLength(3);
    expect(erros.join(' ')).toMatch(/órgão/);
    expect(erros.join(' ')).toMatch(/e-mail/);
    expect(erros.join(' ')).toMatch(/anterior a hoje/);
    expect(validarSolicitacao({ orgao: 'x', prazoResposta: '07/10/2026' }, HOJE)).toEqual(['O prazo de resposta precisa ser uma data.']);
    expect(validarSolicitacao({ orgao: 'x', prazoResposta: '2026-02-31' }, HOJE)).toEqual(['O prazo de resposta precisa ser uma data.']);
  });

  it('o prazo de hoje ainda vale', () => {
    expect(validarSolicitacao({ orgao: 'x', prazoResposta: '2026-09-23' }, HOJE)).toEqual([]);
  });

  it('a linha sai limpa: espaços fora, vazio vira nulo, a vaga pelo nome exato', () => {
    const linha = linhaParaGravar(
      { orgao: '  Secretaria de Finanças ', emailDestino: '', prazoResposta: '2026-10-07', observacao: '  ' },
      { empresaId: 'e1', userId: 'u1', documentoNome: 'Certidão Negativa de Débitos Municipais', agora: new Date('2026-09-23T12:00:00Z') },
    );
    expect(linha).toEqual({
      empresa_id: 'e1',
      user_id: 'u1',
      documento_nome: 'Certidão Negativa de Débitos Municipais',
      orgao: 'Secretaria de Finanças',
      email_destino: null,
      prazo_resposta: '2026-10-07',
      observacao: null,
      solicitada_em: '2026-09-23T12:00:00.000Z',
    });
  });
});
