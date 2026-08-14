import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TIPOS_HABILITACAO, classificarTipo } from '@/lib/habilitacao/tipos';

describe('classificarTipo', () => {
  const CASOS: { entrada: string; esperado: string }[] = [
    { entrada: 'Certidão Negativa de Débitos relativos a Tributos Federais e à Dívida Ativa da União', esperado: 'cnd_federal' },
    { entrada: 'Certificado de Regularidade do FGTS - CRF', esperado: 'crf_fgts' },
    { entrada: 'Certidão Negativa de Débitos Trabalhistas (CNDT)', esperado: 'cndt_trabalhista' },
    { entrada: 'Prova de regularidade com a Fazenda Municipal do domicílio', esperado: 'cnd_municipal' },
    { entrada: 'Balanço patrimonial e demonstrações contábeis do último exercício', esperado: 'balanco' },
    { entrada: 'Certidão negativa de falência ou concordata', esperado: 'certidao_falencia' },
    { entrada: 'Atestado de capacidade técnica compatível com o objeto', esperado: 'atestado_tecnico' },
    { entrada: 'Ato constitutivo, estatuto ou contrato social em vigor', esperado: 'contrato_social' },
    { entrada: 'Declaração de que não emprega menor de 18 anos (inciso XXXIII)', esperado: 'decl_menor' },
    { entrada: 'Declaração de enquadramento como Microempresa - LC 123', esperado: 'decl_me_epp' },
  ];
  it.each(CASOS)('classifica "$entrada" → $esperado', ({ entrada, esperado }) => {
    expect(classificarTipo(entrada)?.id).toBe(esperado);
  });
  it('texto sem correspondência devolve null', () => {
    expect(classificarTipo('amostra do produto em embalagem original')).toBeNull();
  });
});

describe('espelho Deno (_shared/habilitacao-tipos.ts)', () => {
  it('as duas taxonomias têm os mesmos ids, na mesma ordem', () => {
    const espelho = readFileSync(
      path.resolve(__dirname, '../../supabase/functions/_shared/habilitacao-tipos.ts'),
      'utf8',
    );
    const idsEspelho = [...espelho.matchAll(/\{ id: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(idsEspelho).toEqual(TIPOS_HABILITACAO.map((t) => t.id));
  });
});
