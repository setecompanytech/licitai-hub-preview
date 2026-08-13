import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  normalizarStatus,
  faixaDe,
  ehDecidido,
  prazoPerdidoNoRadar,
  aparenciaStatus,
  STATUS_PROCESSO,
  STATUS_DECIDIDOS,
  RESULTADOS_ENCERRADORES,
  DIAS_CARENCIA_ARQUIVAMENTO,
  DIAS_RETENCAO_ARQUIVO,
} from '@/lib/licitacao/status';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.resolve(raiz, p), 'utf8');

describe('normalizarStatus', () => {
  const CASOS: { entrada: string | null | undefined; esperado: string }[] = [
    // Grafias que o Kanban grava (canônicas)
    { entrada: 'Monitorando', esperado: 'Monitorando' },
    { entrada: 'Em Análise', esperado: 'Em Análise' },
    { entrada: 'Proposta Enviada', esperado: 'Proposta Enviada' },
    { entrada: 'Em Disputa', esperado: 'Em Disputa' },
    { entrada: 'Vencida', esperado: 'Vencida' },
    { entrada: 'Homologada', esperado: 'Homologada' },
    { entrada: 'Perdida', esperado: 'Perdida' },
    { entrada: 'Arquivada', esperado: 'Arquivada' },

    // Minúsculas do painel antigo
    { entrada: 'monitorando', esperado: 'Monitorando' },
    { entrada: 'analisando', esperado: 'Em Análise' },
    { entrada: 'proposta', esperado: 'Proposta Enviada' },
    { entrada: 'enviada', esperado: 'Proposta Enviada' },
    { entrada: 'vencida', esperado: 'Vencida' },
    { entrada: 'perdida', esperado: 'Perdida' },

    // Masculinos que o cleanup antigo procurava e ninguém gravava — a raiz de D1
    { entrada: 'Homologado', esperado: 'Homologada' },
    { entrada: 'Contrato Assinado', esperado: 'Homologada' },

    // Vindos do PNCP / resultado
    { entrada: 'Publicado', esperado: 'Monitorando' },
    { entrada: 'novo', esperado: 'Monitorando' },
    { entrada: 'Vencedor', esperado: 'Vencida' },
    { entrada: 'adjudicada', esperado: 'Vencida' },
    { entrada: 'Perdedor', esperado: 'Perdida' },

    // Vazios e desconhecidos entram pelo topo do funil
    { entrada: '', esperado: 'Monitorando' },
    { entrada: '   ', esperado: 'Monitorando' },
    { entrada: null, esperado: 'Monitorando' },
    { entrada: undefined, esperado: 'Monitorando' },
    { entrada: 'coisa que ninguém escreveu', esperado: 'Monitorando' },
  ];

  it.each(CASOS)('normaliza $entrada → $esperado', ({ entrada, esperado }) => {
    expect(normalizarStatus(entrada)).toBe(esperado);
  });

  it('é idempotente: normalizar duas vezes não muda o resultado', () => {
    for (const s of STATUS_PROCESSO) {
      expect(normalizarStatus(normalizarStatus(s))).toBe(normalizarStatus(s));
    }
  });

  it('sempre devolve um status que o mapa de aparência conhece', () => {
    for (const { entrada } of CASOS) {
      expect(aparenciaStatus(entrada || '').label).toBeTruthy();
    }
  });
});

describe('faixaDe', () => {
  it('separa as quatro faixas do painel', () => {
    expect(faixaDe('Monitorando', null)).toBe('radar');
    expect(faixaDe('Em Análise', null)).toBe('radar');
    expect(faixaDe('Proposta Enviada', null)).toBe('em_jogo');
    expect(faixaDe('Em Disputa', null)).toBe('em_jogo');
    expect(faixaDe('Vencida', null)).toBe('decidido');
    expect(faixaDe('Homologada', null)).toBe('decidido');
    expect(faixaDe('Perdida', null)).toBe('decidido');
  });

  it('arquivado_em vence o status — este é o eixo de visibilidade', () => {
    // O caso de D3: um processo homologado e arquivado está no Arquivo e
    // continua homologado por baixo.
    expect(faixaDe('Homologada', '2026-01-10T00:00:00Z')).toBe('arquivo');
    expect(faixaDe('Monitorando', '2026-01-10T00:00:00Z')).toBe('arquivo');
  });
});

describe('ehDecidido', () => {
  it('reconhece desfecho pelo status', () => {
    expect(ehDecidido('Homologada')).toBe(true);
    expect(ehDecidido('Perdida')).toBe(true);
    expect(ehDecidido('Vencida')).toBe(true);
  });

  it('reconhece desfecho que só existe na coluna resultado', () => {
    // Deserto/Fracassado/Revogado/Anulado nunca foram valores de `status` — o
    // cleanup antigo os procurava lá e por isso nunca arquivava nada.
    expect(ehDecidido('Monitorando', 'Deserto')).toBe(true);
    expect(ehDecidido('Monitorando', 'Fracassado')).toBe(true);
    expect(ehDecidido('Em Análise', 'Revogado')).toBe(true);
    expect(ehDecidido('Em Análise', 'Anulado')).toBe(true);
  });

  it('processo em andamento não é decidido', () => {
    expect(ehDecidido('Monitorando')).toBe(false);
    expect(ehDecidido('Em Disputa', null)).toBe(false);
    expect(ehDecidido('Proposta Enviada', '')).toBe(false);
  });
});

describe('prazoPerdidoNoRadar', () => {
  const ontem = new Date(Date.now() - 86_400_000).toISOString();
  const amanha = new Date(Date.now() + 86_400_000).toISOString();

  it('sinaliza só quem ficou parado no Radar com prazo vencido', () => {
    expect(prazoPerdidoNoRadar('Monitorando', ontem, null)).toBe(true);
    expect(prazoPerdidoNoRadar('Em Análise', ontem, null)).toBe(true);
  });

  it('não sinaliza quem avançou, quem está no prazo ou quem já foi arquivado', () => {
    expect(prazoPerdidoNoRadar('Proposta Enviada', ontem, null)).toBe(false);
    expect(prazoPerdidoNoRadar('Monitorando', amanha, null)).toBe(false);
    expect(prazoPerdidoNoRadar('Monitorando', ontem, '2026-02-01T00:00:00Z')).toBe(false);
    expect(prazoPerdidoNoRadar('Monitorando', null, null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guardas contra a divergência que causou D1.
//
// O vocabulário existe em três lugares que não conseguem se importar entre si:
// o TS do app, o TS do Deno (edge functions) e o SQL das migrations. Estes
// testes cobram que as cópias digam a mesma coisa — que é exatamente o que
// falhou quando o Kanban gravava 'Homologada' e o cleanup procurava
// 'Homologado'.
// ─────────────────────────────────────────────────────────────────────────────
describe('espelho Deno (_shared/licitacao-status.ts)', () => {
  const espelho = ler('supabase/functions/_shared/licitacao-status.ts');

  const listaDo = (nome: string): string[] => {
    const m = espelho.match(new RegExp(`${nome}\\s*=\\s*\\[([^\\]]+)\\]`));
    if (!m) throw new Error(`Não encontrei ${nome} no espelho Deno.`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };

  const numeroDo = (nome: string): number => {
    const m = espelho.match(new RegExp(`${nome}\\s*=\\s*(\\d+)`));
    if (!m) throw new Error(`Não encontrei ${nome} no espelho Deno.`);
    return Number(m[1]);
  };

  it('STATUS_DECIDIDOS é idêntico ao do app', () => {
    expect(listaDo('STATUS_DECIDIDOS')).toEqual([...STATUS_DECIDIDOS]);
  });

  it('RESULTADOS_ENCERRADORES é idêntico ao do app', () => {
    expect(listaDo('RESULTADOS_ENCERRADORES')).toEqual([...RESULTADOS_ENCERRADORES]);
  });

  it('os prazos de carência e retenção são idênticos aos do app', () => {
    expect(numeroDo('DIAS_CARENCIA_ARQUIVAMENTO')).toBe(DIAS_CARENCIA_ARQUIVAMENTO);
    expect(numeroDo('DIAS_RETENCAO_ARQUIVO')).toBe(DIAS_RETENCAO_ARQUIVO);
  });
});

describe('edge function licitacoes-cleanup', () => {
  const fn = ler('supabase/functions/licitacoes-cleanup/index.ts');
  /** Só o código: os comentários citam os literais antigos para explicar o defeito. */
  const codigo = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('não reintroduz os literais que nunca casavam com nada', () => {
    // 'Homologado' no masculino e 'Contrato Assinado' jamais foram gravados em
    // `status` por nenhuma tela. Procurá-los ali era o defeito.
    expect(codigo).not.toMatch(/'Homologado'/);
    expect(codigo).not.toMatch(/'Contrato Assinado'/);
  });

  it('importa o vocabulário do espelho em vez de redeclará-lo', () => {
    expect(fn).toMatch(/from ["']\.\.\/_shared\/licitacao-status\.ts["']/);
  });

  it('respeita a carência antes de arquivar', () => {
    expect(fn).toMatch(/DIAS_CARENCIA_ARQUIVAMENTO/);
    expect(fn).toMatch(/lt\(['"]updated_at['"]/);
  });
});

describe('trigger SQL de derivação dos eixos', () => {
  const sql = ler('supabase/migrations/20260813000002_licitacoes_eixos_fase_desfecho.sql');

  it('cobre no SQL os mesmos resultados encerradores do app', () => {
    const m = sql.match(/v_result IN \(([^)]+)\)/);
    expect(m).toBeTruthy();
    const noSql = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    // 'Perdedor' e 'Vencedor' são tratados à parte no SQL (viram Perdido/Ganho),
    // então a lista literal é a dos encerramentos neutros.
    const esperado = RESULTADOS_ENCERRADORES
      .filter((r) => r !== 'Perdedor')
      .map((r) => r.toLowerCase())
      .sort();
    expect(noSql).toEqual(esperado);
  });

  it('só lê OLD em UPDATE — OLD em INSERT levanta exceção no Postgres', () => {
    const usaOld = /NEW\.desfecho\s*:=\s*OLD\.desfecho/.test(sql);
    expect(usaOld).toBe(true);
    expect(sql).toMatch(/TG_OP\s*=\s*'UPDATE'/);
  });
});
