import { describe, it, expect } from 'vitest';
import { ANEXOS_SIMPLES, getAnexoById, type PartilhaFaixa } from '@/data/simples-nacional-anexos';

/**
 * Fase 1 do épico do Motor de Precificação Tributária — arquivo 1 de 8.
 * Ver docs/epico-motor-precificacao-tributaria.md, seção 6.
 *
 * ORÁCULO: a fixture legal abaixo, transcrita da Resolução CGSN nº 140/2018.
 * O código é o objeto sob teste, nunca a fonte da verdade.
 *
 * Por que não basta comparar as cópias entre si: as 6 cópias da tabela do Anexo I
 * espalhadas pelo repo são idênticas valor a valor, então um teste de igualdade
 * entre elas passa verde mesmo que todas carreguem o MESMO erro de transcrição —
 * que é o cenário mais provável num código que copiou a tabela por copy-paste.
 * O defeito real deste módulo (Anexo III somando 102%) foi achado por invariante
 * de soma, não por comparação entre cópias.
 */

// ─── Oráculo: Resolução CGSN nº 140/2018 ──────────────────────────────────────

type Partilha = PartilhaFaixa;

const p = (
  IRPJ: number, CSLL: number, COFINS: number, PIS: number,
  CPP: number, ICMS: number, ISS: number, IPI: number,
): Partilha => ({ IRPJ, CSLL, COFINS, PIS, CPP, ICMS, ISS, IPI });

/**
 * Partilha oficial, por anexo e faixa. Cada linha soma exatamente 100,00 — é a
 * repartição percentual de UMA alíquota efetiva entre os tributos que a compõem.
 *
 * CONFERÊNCIA HUMANA: estes números vieram de transcrição e devem ser conferidos
 * contra o texto publicado da Resolução antes de servirem de base para correção
 * de valor em produção. O teste `soma exatamente 100,00` é a rede de segurança
 * contra erro de digitação aqui, não substituto da conferência.
 */
const PARTILHA_LEGAL: Record<string, Record<number, Partilha>> = {
  // Anexo I — Comércio.                IRPJ  CSLL  COFINS   PIS    CPP   ICMS   ISS   IPI
  anexo_i: {
    1: p(5.50, 3.50, 12.74, 2.76, 41.50, 34.00, 0, 0),
    2: p(5.50, 3.50, 12.74, 2.76, 41.50, 34.00, 0, 0),
    3: p(5.50, 3.50, 12.74, 2.76, 42.00, 33.50, 0, 0),
    4: p(5.50, 3.50, 12.74, 2.76, 42.00, 33.50, 0, 0),
    5: p(5.50, 3.50, 12.74, 2.76, 42.00, 33.50, 0, 0),
    6: p(13.50, 10.00, 28.27, 6.13, 42.10, 0, 0, 0),
  },
  // Anexo II — Indústria. Único anexo com IPI.
  anexo_ii: {
    1: p(5.50, 3.50, 11.51, 2.49, 37.50, 32.00, 0, 7.50),
    2: p(5.50, 3.50, 11.51, 2.49, 37.50, 32.00, 0, 7.50),
    3: p(5.50, 3.50, 11.51, 2.49, 37.50, 32.00, 0, 7.50),
    4: p(5.50, 3.50, 11.51, 2.49, 37.50, 32.00, 0, 7.50),
    5: p(5.50, 3.50, 11.51, 2.49, 37.50, 32.00, 0, 7.50),
    6: p(8.50, 7.50, 20.96, 4.54, 23.50, 0, 0, 35.00),
  },
  // Anexo III — Serviços. IRPJ é 4,00 nas faixas 1-5; o código tem 6,00 (ver DIVERGENCIAS_CONHECIDAS).
  anexo_iii: {
    1: p(4.00, 3.50, 12.82, 2.78, 43.40, 0, 33.50, 0),
    2: p(4.00, 3.50, 14.05, 3.05, 43.40, 0, 32.00, 0),
    3: p(4.00, 3.50, 13.64, 2.96, 43.40, 0, 32.50, 0),
    4: p(4.00, 3.50, 13.64, 2.96, 43.40, 0, 32.50, 0),
    5: p(4.00, 3.50, 12.82, 2.78, 43.40, 0, 33.50, 0),
    6: p(35.00, 15.00, 16.03, 3.47, 30.50, 0, 0, 0),
  },
  // Anexo IV — CPP fora do DAS (recolhida à parte), por isso zero na partilha.
  anexo_iv: {
    1: p(18.80, 15.20, 17.67, 3.83, 0, 0, 44.50, 0),
    2: p(19.80, 15.20, 20.55, 4.45, 0, 0, 40.00, 0),
    3: p(20.80, 15.20, 19.73, 4.27, 0, 0, 40.00, 0),
    4: p(17.80, 19.20, 18.90, 4.10, 0, 0, 40.00, 0),
    5: p(18.80, 19.20, 18.08, 3.92, 0, 0, 40.00, 0),
    6: p(53.50, 21.50, 20.55, 4.45, 0, 0, 0, 0),
  },
  // Anexo V — Serviços sujeitos ao Fator R.
  anexo_v: {
    1: p(25.00, 15.00, 14.10, 3.05, 28.85, 0, 14.00, 0),
    2: p(23.00, 15.00, 14.10, 3.05, 27.85, 0, 17.00, 0),
    3: p(24.00, 15.00, 14.92, 3.23, 23.85, 0, 19.00, 0),
    4: p(21.00, 15.00, 15.74, 3.41, 23.85, 0, 21.00, 0),
    5: p(23.00, 12.50, 14.10, 3.05, 23.85, 0, 23.50, 0),
    6: p(35.00, 15.50, 16.44, 3.56, 29.50, 0, 0, 0),
  },
};

// ─── Divergências que o código carrega hoje ───────────────────────────────────

type Tributo = keyof Partilha;

type Divergencia = {
  anexo: string;
  faixa: number;
  tributo: Tributo;
  naLei: number;
  noCodigo: number;
  motivo: string;
};

/**
 * DEFEITO CONHECIDO — Anexo III, faixas 1 a 5, IRPJ 6,00 onde a lei diz 4,00.
 *
 * Não é cosmético: `composicao-engine.ts` importa `getPartilhaSimplesReal` e soma
 * as alíquotas resultantes no divisor do mark-up (`:268`). Com a partilha somando
 * 102% em vez de 100%, toda proposta de serviço no Simples sai com ~0,4% de
 * sobrepreço — mais que a margem de disputa de um pregão eletrônico.
 *
 * Este arquivo apenas CONGELA o estado atual. A correção sai no commit seguinte,
 * e o diff desta lista é a prova da mudança de valor: ao trocar 6,00 por 4,00 na
 * fonte, estas cinco entradas saem daqui e nenhuma outra asserção precisa mudar.
 */
const DIVERGENCIAS_CONHECIDAS: Divergencia[] = [
  { anexo: 'anexo_iii', faixa: 1, tributo: 'IRPJ', naLei: 4.0, noCodigo: 6.0, motivo: 'partilha soma 102%' },
  { anexo: 'anexo_iii', faixa: 2, tributo: 'IRPJ', naLei: 4.0, noCodigo: 6.0, motivo: 'partilha soma 102%' },
  { anexo: 'anexo_iii', faixa: 3, tributo: 'IRPJ', naLei: 4.0, noCodigo: 6.0, motivo: 'partilha soma 102%' },
  { anexo: 'anexo_iii', faixa: 4, tributo: 'IRPJ', naLei: 4.0, noCodigo: 6.0, motivo: 'partilha soma 102%' },
  { anexo: 'anexo_iii', faixa: 5, tributo: 'IRPJ', naLei: 4.0, noCodigo: 6.0, motivo: 'partilha soma 102%' },
];

// ─── Auxiliares ───────────────────────────────────────────────────────────────

const TRIBUTOS: Tributo[] = ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS', 'ISS', 'IPI'];
const FAIXAS = [1, 2, 3, 4, 5, 6];
const IDS = ['anexo_i', 'anexo_ii', 'anexo_iii', 'anexo_iv', 'anexo_v'];

/** Todas as 30 combinações anexo × faixa, para `it.each`. */
const LINHAS = IDS.flatMap((anexo) => FAIXAS.map((faixa) => ({ anexo, faixa })));

const somar = (part: Partilha): number => TRIBUTOS.reduce((s, t) => s + part[t], 0);

const divergenciasDa = (anexo: string, faixa: number) =>
  DIVERGENCIAS_CONHECIDAS.filter((d) => d.anexo === anexo && d.faixa === faixa);

/** A partilha legal com as divergências conhecidas aplicadas — o que o código deve ter HOJE. */
function esperadoNoCodigo(anexo: string, faixa: number): Partilha {
  const base = { ...PARTILHA_LEGAL[anexo][faixa] };
  for (const d of divergenciasDa(anexo, faixa)) base[d.tributo] = d.noCodigo;
  return base;
}

/** Quanto a soma do código se afasta de 100,00 por causa das divergências documentadas. */
function desvioDocumentado(anexo: string, faixa: number): number {
  return divergenciasDa(anexo, faixa).reduce((s, d) => s + (d.noCodigo - d.naLei), 0);
}

function partilhaDoCodigo(anexo: string, faixa: number): Partilha {
  const a = getAnexoById(anexo);
  if (!a) throw new Error(`Anexo ${anexo} não existe em ANEXOS_SIMPLES.`);
  const part = a.partilha[faixa];
  if (!part) throw new Error(`Anexo ${anexo} não tem partilha para a faixa ${faixa}.`);
  return part;
}

// ─── 1. O oráculo se valida ───────────────────────────────────────────────────

describe('fixture da Resolução CGSN 140/2018', () => {
  it.each(LINHAS)('$anexo faixa $faixa soma exatamente 100,00', ({ anexo, faixa }) => {
    expect(somar(PARTILHA_LEGAL[anexo][faixa])).toBeCloseTo(100, 9);
  });

  it('cobre os 5 anexos em 6 faixas cada', () => {
    expect(Object.keys(PARTILHA_LEGAL).sort()).toEqual([...IDS].sort());
    for (const anexo of IDS) {
      expect(Object.keys(PARTILHA_LEGAL[anexo]).map(Number).sort((a, b) => a - b)).toEqual(FAIXAS);
    }
  });
});

// ─── 2. O código contra o oráculo ─────────────────────────────────────────────

describe('partilha do código contra a lei', () => {
  it.each(LINHAS)('$anexo faixa $faixa bate com a lei (com as divergências documentadas)', ({ anexo, faixa }) => {
    expect(partilhaDoCodigo(anexo, faixa)).toEqual(esperadoNoCodigo(anexo, faixa));
  });

  it.each(LINHAS)('$anexo faixa $faixa soma 100,00 mais o desvio documentado', ({ anexo, faixa }) => {
    expect(somar(partilhaDoCodigo(anexo, faixa))).toBeCloseTo(100 + desvioDocumentado(anexo, faixa), 9);
  });
});

// ─── 3. As divergências conhecidas ────────────────────────────────────────────

describe('DEFEITO CONHECIDO — Anexo III com IRPJ 6,00', () => {
  it('cada divergência listada existe de fato e difere da lei', () => {
    for (const d of DIVERGENCIAS_CONHECIDAS) {
      expect(partilhaDoCodigo(d.anexo, d.faixa)[d.tributo]).toBe(d.noCodigo);
      expect(PARTILHA_LEGAL[d.anexo][d.faixa][d.tributo]).toBe(d.naLei);
      expect(d.noCodigo).not.toBe(d.naLei);
    }
  });

  it('o defeito está confinado ao IRPJ do Anexo III, faixas 1 a 5', () => {
    const fora = DIVERGENCIAS_CONHECIDAS.filter(
      (d) => d.anexo !== 'anexo_iii' || d.tributo !== 'IRPJ' || d.faixa === 6,
    );
    expect(fora).toEqual([]);
  });

  it('nenhuma faixa fora da lista diverge de 100,00', () => {
    const inesperadas = LINHAS.filter(({ anexo, faixa }) => {
      if (divergenciasDa(anexo, faixa).length > 0) return false;
      return Math.abs(somar(partilhaDoCodigo(anexo, faixa)) - 100) > 1e-9;
    });
    expect(inesperadas).toEqual([]);
  });
});

// ─── 4. Invariantes estruturais ───────────────────────────────────────────────

describe('estrutura dos anexos', () => {
  it.each(IDS)('%s tem 6 faixas e partilha para cada uma', (anexo) => {
    const a = getAnexoById(anexo)!;
    expect(a.faixas.map((f) => f.faixaNum)).toEqual(FAIXAS);
    expect(Object.keys(a.partilha).map(Number).sort((x, y) => x - y)).toEqual(FAIXAS);
  });

  it('ANEXOS_SIMPLES tem exatamente os 5 anexos, na ordem I..V', () => {
    expect(ANEXOS_SIMPLES.map((a) => a.id)).toEqual(IDS);
  });

  it('Anexo IV tem CPP zerada em todas as faixas — a CPP é recolhida fora do DAS', () => {
    // DEFEITO SUSPEITO (épico, seção 5.5): `getPartilhaSimplesReal` compensa esta
    // zeragem injetando 20 pontos percentuais fixos de "CPP (INSS separado)" na
    // mesma soma que alimenta o divisor do mark-up. São bases diferentes — 20% do
    // preço não é a CPP, que é ~26-28% da FOLHA. Aqui só congelamos; a correção
    // fica para a fase de domínio.
    for (const faixa of FAIXAS) expect(partilhaDoCodigo('anexo_iv', faixa).CPP).toBe(0);
  });

  it('só o Anexo II reparte IPI', () => {
    for (const anexo of IDS) {
      for (const faixa of FAIXAS) {
        const ipi = partilhaDoCodigo(anexo, faixa).IPI;
        if (anexo === 'anexo_ii') expect(ipi).toBeGreaterThan(0);
        else expect(ipi).toBe(0);
      }
    }
  });

  it('ICMS só nos anexos de mercadoria (I e II) e ISS só nos de serviço (III, IV e V)', () => {
    for (const anexo of IDS) {
      for (const faixa of FAIXAS) {
        const { ICMS, ISS } = partilhaDoCodigo(anexo, faixa);
        if (anexo === 'anexo_i' || anexo === 'anexo_ii') expect(ISS).toBe(0);
        else expect(ICMS).toBe(0);
      }
    }
  });

  it('a 6ª faixa nunca reparte ICMS nem ISS — acima do sublimite eles saem do DAS', () => {
    for (const anexo of IDS) {
      const { ICMS, ISS } = partilhaDoCodigo(anexo, 6);
      expect(ICMS).toBe(0);
      expect(ISS).toBe(0);
    }
  });
});
