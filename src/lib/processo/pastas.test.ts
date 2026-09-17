import { describe, expect, it } from 'vitest';
import { montarPastas, type CompromissoPessoal, type ProcessoDaEmpresa } from './pastas';

/**
 * O caso real de 17/09 (O S DISTRIBUIDORA): 31 processos no Kanban, 2 pastas
 * na aba Compromissos. A aba lia a tabela pessoal; o quadro lê a da empresa.
 */

const processo = (over: Partial<ProcessoDaEmpresa> & { id: string }): ProcessoDaEmpresa => ({
  numero: '86',
  orgao: 'TRIBUNAL SUPERIOR ELEITORAL',
  objeto: 'Tablets corporativos 5G',
  modalidade: 'Pregão - Eletrônico',
  ano_compra: '2026',
  valor_estimado: 338773.8,
  uf: 'PA',
  municipio: 'Belém',
  data_encerramento: '2026-09-24T09:00:00Z',
  status: 'Em Disputa',
  arquivado_em: null,
  ...over,
});

const compromisso = (over: Partial<CompromissoPessoal> & { id: string }): CompromissoPessoal => ({
  licitacao_id: null,
  numero: '86',
  orgao: 'TRIBUNAL SUPERIOR ELEITORAL',
  objeto: 'Tablets corporativos 5G',
  modalidade: 'Pregão - Eletrônico',
  valor_estimado: 338773.8,
  uf: 'PA',
  municipio: 'Belém',
  data_encerramento: '2026-09-24T09:00:00Z',
  status: 'interessado',
  ia_score: null,
  alerta_sistema: true,
  alerta_email: true,
  alerta_whatsapp: false,
  created_at: '2026-09-01T10:00:00Z',
  ...over,
});

describe('montarPastas', () => {
  it('todo processo do quadro vira pasta, mesmo sem compromisso pessoal', () => {
    const pastas = montarPastas(
      [processo({ id: 'l1' }), processo({ id: 'l2', numero: '126' }), processo({ id: 'l3', numero: '67' })],
      [compromisso({ id: 'c1', licitacao_id: 'l1' })],
    );

    expect(pastas).toHaveLength(3);
    expect(pastas.map((p) => p.licitacaoId).sort()).toEqual(['l1', 'l2', 'l3']);
  });

  it('marca a pasta do colega como sem compromisso próprio — quem olha não recebe os alertas dela', () => {
    const [minha, doColega] = montarPastas(
      [
        processo({ id: 'l1', data_encerramento: '2026-09-20T09:00:00Z' }),
        processo({ id: 'l2', data_encerramento: '2026-09-21T09:00:00Z' }),
      ],
      [compromisso({ id: 'c1', licitacao_id: 'l1', ia_score: 87 })],
    );

    expect(minha.compromissoId).toBe('c1');
    expect(minha.semCompromissoProprio).toBe(false);
    expect(minha.ia_score).toBe(87);

    expect(doColega.compromissoId).toBeNull();
    expect(doColega.semCompromissoProprio).toBe(true);
    expect(doColega.id).toBe('licitacao:l2');
    // Sem compromisso não há canal de alerta ligado — e isso não é "false",
    // é "não definido para esta pessoa".
    expect(doColega.alerta_sistema).toBeNull();
  });

  it('o arquivamento vem do processo, não da decisão pessoal', () => {
    const [ativa, arquivada] = montarPastas(
      [
        processo({ id: 'l1' }),
        processo({ id: 'l2', numero: '15', arquivado_em: '2026-09-10T14:26:25Z' }),
      ],
      [
        compromisso({ id: 'c1', licitacao_id: 'l1', status: 'arquivado' }),
        compromisso({ id: 'c2', licitacao_id: 'l2', status: 'interessado' }),
      ],
    );

    // Compromisso arquivado mas processo vivo: a pasta continua na mesa.
    expect(ativa.arquivada).toBe(false);
    // Processo arquivado no Kanban: a pasta sai, mesmo com o compromisso ativo.
    expect(arquivada.arquivada).toBe(true);
    expect(arquivada.situacao).toBe('arquivado');
  });

  it('compromisso sem processo continua na lista — é trabalho já começado', () => {
    const pastas = montarPastas([], [compromisso({ id: 'c9', licitacao_id: null, numero: 'DE 12/2026' })]);

    expect(pastas).toHaveLength(1);
    expect(pastas[0].licitacaoId).toBeNull();
    expect(pastas[0].compromissoId).toBe('c9');
  });

  it('dois compromissos para a mesma licitação rendem uma pasta, e vence o mais antigo', () => {
    const pastas = montarPastas(
      [processo({ id: 'l1' })],
      [
        compromisso({ id: 'novo', licitacao_id: 'l1', created_at: '2026-09-05T10:00:00Z', ia_score: 10 }),
        compromisso({ id: 'antigo', licitacao_id: 'l1', created_at: '2026-08-01T10:00:00Z', ia_score: 90 }),
      ],
    );

    expect(pastas).toHaveLength(1);
    expect(pastas[0].compromissoId).toBe('antigo');
    expect(pastas[0].ia_score).toBe(90);
  });

  it('ordena por prazo, com arquivadas no fim e sem prazo depois das com prazo', () => {
    const pastas = montarPastas(
      [
        processo({ id: 'sem', numero: '3', data_encerramento: null }),
        processo({ id: 'arq', numero: '4', data_encerramento: '2026-09-18T09:00:00Z', arquivado_em: '2026-09-11T00:00:00Z' }),
        processo({ id: 'longe', numero: '2', data_encerramento: '2026-09-30T09:00:00Z' }),
        processo({ id: 'perto', numero: '1', data_encerramento: '2026-09-18T09:00:00Z' }),
      ],
      [],
    );

    expect(pastas.map((p) => p.licitacaoId)).toEqual(['perto', 'longe', 'sem', 'arq']);
  });
});
