import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizarModalidade, rotuloModalidade, MODALIDADES } from '@/lib/metas/modalidades';

/**
 * Casos compartilhados entre as duas implementações da normalização.
 * Qualquer regra nova entra aqui uma vez só e é cobrada dos dois lados.
 */
const CASOS: { entrada: string | null | undefined; esperado: string }[] = [
  { entrada: 'Pregão Eletrônico', esperado: 'pregao_eletronico' },
  { entrada: 'Pregão - Eletrônico', esperado: 'pregao_eletronico' },
  { entrada: 'PREGAO ELETRONICO', esperado: 'pregao_eletronico' },
  { entrada: 'Pregão eletrônico (SRP)', esperado: 'pregao_eletronico' },
  { entrada: 'Pregão', esperado: 'pregao_eletronico' },
  { entrada: 'Pregão Presencial', esperado: 'pregao_presencial' },
  { entrada: 'Pregão - Presencial', esperado: 'pregao_presencial' },
  { entrada: 'Dispensa de Licitação', esperado: 'dispensa' },
  { entrada: 'DISPENSA ELETRONICA', esperado: 'dispensa' },
  { entrada: 'Inexigibilidade', esperado: 'inexigibilidade' },
  { entrada: 'Credenciamento', esperado: 'credenciamento' },
  { entrada: 'Tomada de Preços', esperado: 'tomada_precos' },
  { entrada: 'Convite', esperado: 'convite' },
  { entrada: 'Concorrência - Eletrônica', esperado: 'concorrencia' },
  { entrada: 'Concorrencia', esperado: 'concorrencia' },
  { entrada: 'Concurso', esperado: 'concurso' },
  { entrada: 'Leilão', esperado: 'leilao' },
  { entrada: 'Chamamento Público', esperado: 'outra' },
  { entrada: '', esperado: 'outra' },
  { entrada: null, esperado: 'outra' },
  { entrada: undefined, esperado: 'outra' },
];

// ─── Leitura da implementação SQL ─────────────────────────────────────────────

const SQL = readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/20260803000002_comercial_metas_ingestao.sql'),
  'utf8',
);

/** Tabela de acentos de `comercial_sem_acento`, extraída do próprio SQL. */
function lerTabelaDeAcentos(): { de: string; para: string } {
  const m = SQL.match(/translate\(\s*coalesce\(p_texto, ''\),\s*'([^']+)',\s*'([^']+)'/);
  if (!m) throw new Error('Não encontrei o translate de comercial_sem_acento no SQL.');
  return { de: m[1], para: m[2] };
}

type RegraSql =
  | { tipo: 'pregao_qualificado'; retorno: string; qualificadores: string[] }
  | { tipo: 'simples'; termo: string; retorno: string };

/** Regras de `comercial_normalizar_modalidade`, na ordem em que aparecem no SQL. */
function lerRegras(): { regras: RegraSql[]; fallback: string } {
  const corpo = SQL.split('CREATE OR REPLACE FUNCTION public.comercial_normalizar_modalidade')[1];
  if (!corpo) throw new Error('Não encontrei comercial_normalizar_modalidade no SQL.');
  const corpoFn = corpo.split('$$;')[0];

  const regras: RegraSql[] = [];

  const composta = corpoFn.match(
    /IF t LIKE '%pregao%' AND \(([^)]+)\) THEN\s*RETURN '([a-z_]+)'/,
  );
  if (composta) {
    const qualificadores = [...composta[1].matchAll(/'%([^%']+)%'/g)].map((q) => q[1]);
    regras.push({ tipo: 'pregao_qualificado', retorno: composta[2], qualificadores });
  }

  for (const m of corpoFn.matchAll(/IF t LIKE '%([a-z0-9 ]+)%'\s+THEN RETURN '([a-z_]+)'/g)) {
    regras.push({ tipo: 'simples', termo: m[1], retorno: m[2] });
  }

  const fb = corpoFn.match(/RETURN '([a-z_]+)';\s*END;/);
  return { regras, fallback: fb ? fb[1] : 'outra' };
}

/** Reexecuta em JS exatamente o que o SQL da migration faz. */
function normalizarComoNoSql(texto: string | null | undefined): string {
  const { de, para } = lerTabelaDeAcentos();
  const semAcento = [...(texto ?? '')]
    .map((c) => {
      const i = [...de].indexOf(c);
      return i >= 0 ? [...para][i] : c;
    })
    .join('');

  const t = semAcento.replace(/[^a-zA-Z0-9]+/g, ' ').toLowerCase().trim();
  if (t === '') return 'outra';

  const { regras, fallback } = lerRegras();
  for (const r of regras) {
    if (r.tipo === 'pregao_qualificado') {
      if (t.includes('pregao') && r.qualificadores.some((q) => t.includes(q))) return r.retorno;
    } else if (t.includes(r.termo)) {
      return r.retorno;
    }
  }
  return fallback;
}


describe('normalizarModalidade', () => {
  it('reconhece as grafias reais de pregão eletrônico vistas no banco', () => {
    const variantes = [
      'Pregão Eletrônico',
      'Pregão - Eletrônico',
      'PREGAO ELETRONICO',
      'pregao eletronico',
      'Pregão eletrônico (SRP)',
    ];
    for (const v of variantes) {
      expect(normalizarModalidade(v)).toBe('pregao_eletronico');
    }
  });

  it('separa pregão presencial de eletrônico', () => {
    expect(normalizarModalidade('Pregão Presencial')).toBe('pregao_presencial');
    expect(normalizarModalidade('Pregão - Presencial')).toBe('pregao_presencial');
  });

  it('trata pregão sem qualificador como eletrônico', () => {
    expect(normalizarModalidade('Pregão')).toBe('pregao_eletronico');
  });

  it('reconhece dispensa e inexigibilidade', () => {
    expect(normalizarModalidade('Dispensa de Licitação')).toBe('dispensa');
    expect(normalizarModalidade('DISPENSA ELETRONICA')).toBe('dispensa');
    expect(normalizarModalidade('Inexigibilidade')).toBe('inexigibilidade');
  });

  it('reconhece concorrência, inclusive a grafia do workspace', () => {
    expect(normalizarModalidade('Concorrência - Eletrônica')).toBe('concorrencia');
    expect(normalizarModalidade('Concorrencia')).toBe('concorrencia');
  });

  it('não confunde concorrência com concurso', () => {
    expect(normalizarModalidade('Concurso')).toBe('concurso');
    expect(normalizarModalidade('Concorrência')).toBe('concorrencia');
  });

  it('cai em "outra" para vazio, nulo e texto desconhecido', () => {
    expect(normalizarModalidade('')).toBe('outra');
    expect(normalizarModalidade(null)).toBe('outra');
    expect(normalizarModalidade(undefined)).toBe('outra');
    expect(normalizarModalidade('Chamamento Público')).toBe('outra');
  });
});

/**
 * A normalização vive em dois lugares por decisão de projeto: o SQL agrega, o
 * TS atende a interface e grava comercial_perdas.modalidade_codigo. Estes
 * testes leem o SQL do arquivo de migration e reexecutam suas regras, para os
 * dois espelhos não divergirem em silêncio — e sem precisar de banco.
 */
describe('paridade entre a normalização em TS e a em SQL', () => {
  it.each(CASOS)('$entrada → $esperado nas duas implementações', ({ entrada, esperado }) => {
    expect(normalizarModalidade(entrada)).toBe(esperado);
    expect(normalizarComoNoSql(entrada)).toBe(esperado);
  });

  it('todo código que o SQL devolve tem rótulo no catálogo do TS', () => {
    const { regras, fallback } = lerRegras();
    const codigosSql = new Set([...regras.map((r) => r.retorno), fallback]);
    const codigosTs = new Set(MODALIDADES.map((m) => m.codigo as string));
    for (const codigo of codigosSql) {
      expect(codigosTs.has(codigo), `"${codigo}" existe no SQL mas não em MODALIDADES`).toBe(true);
    }
  });

  it('o SQL trata pregão qualificado antes do pregão genérico', () => {
    const { regras } = lerRegras();
    const iQualificado = regras.findIndex((r) => r.tipo === 'pregao_qualificado');
    const iGenerico = regras.findIndex((r) => r.tipo === 'simples' && r.termo === 'pregao');
    expect(iQualificado).toBeGreaterThanOrEqual(0);
    expect(iGenerico).toBeGreaterThanOrEqual(0);
    expect(iQualificado).toBeLessThan(iGenerico);
  });
});

describe('rotuloModalidade', () => {
  it('traduz o código para o rótulo em português', () => {
    expect(rotuloModalidade('pregao_eletronico')).toBe('Pregão Eletrônico');
    expect(rotuloModalidade('dispensa')).toBe('Dispensa de Licitação');
  });

  it('devolve o próprio código quando não conhece', () => {
    expect(rotuloModalidade('modalidade_inexistente')).toBe('modalidade_inexistente');
  });
});
