import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ANEXOS_SIMPLES, getAnexoById } from '@/data/simples-nacional-anexos';

/**
 * Fase 1 do épico do Motor de Precificação Tributária — arquivo 2 de 8.
 * Ver docs/epico-motor-precificacao-tributaria.md, seção 6.
 *
 * Cobre três coisas, nesta ordem de autoridade:
 *   1. as 30 faixas do código contra a fixture legal (a lei é o oráculo);
 *   2. as 6 cópias da tabela do Anexo I entre si (corolário, nunca a fonte);
 *   3. a guarda estática do numeric(5,4) — cruza o DEFAULT_CONFIG do hook com a
 *      precisão declarada na migration, para que mudar um sem o outro falhe.
 *
 * As 4 cópias que vivem dentro de .tsx são módulo-privadas e não podem ser
 * importadas: são lidas do fonte com readFileSync, mesmo mecanismo que o
 * metas-modalidades usa para cobrar paridade da implementação em SQL.
 */

const RAIZ = path.resolve(__dirname, '../..');
const ler = (rel: string) => readFileSync(path.resolve(RAIZ, rel), 'utf8');

// ─── Oráculo: faixas da Resolução CGSN nº 140/2018 ────────────────────────────

type Faixa = { min: number; max: number; aliquota: number; deducao: number };

const f = (min: number, max: number, aliquota: number, deducao: number): Faixa =>
  ({ min, max, aliquota, deducao });

/**
 * CONFERÊNCIA HUMANA pendente contra o texto publicado da Resolução — mesma
 * ressalva do arquivo 1. O teste de contiguidade abaixo é rede contra erro de
 * digitação nos limites, não substituto da conferência das alíquotas.
 */
const FAIXAS_LEGAIS: Record<string, Faixa[]> = {
  anexo_i: [
    f(0, 180_000, 4.0, 0),
    f(180_000.01, 360_000, 7.3, 5_940),
    f(360_000.01, 720_000, 9.5, 13_860),
    f(720_000.01, 1_800_000, 10.7, 22_500),
    f(1_800_000.01, 3_600_000, 14.3, 87_300),
    f(3_600_000.01, 4_800_000, 19.0, 378_000),
  ],
  anexo_ii: [
    f(0, 180_000, 4.5, 0),
    f(180_000.01, 360_000, 7.8, 5_940),
    f(360_000.01, 720_000, 10.0, 13_860),
    f(720_000.01, 1_800_000, 11.2, 22_500),
    f(1_800_000.01, 3_600_000, 14.7, 85_500),
    f(3_600_000.01, 4_800_000, 30.0, 720_000),
  ],
  anexo_iii: [
    f(0, 180_000, 6.0, 0),
    f(180_000.01, 360_000, 11.2, 9_360),
    f(360_000.01, 720_000, 13.5, 17_640),
    f(720_000.01, 1_800_000, 16.0, 35_640),
    f(1_800_000.01, 3_600_000, 21.0, 125_640),
    f(3_600_000.01, 4_800_000, 33.0, 648_000),
  ],
  anexo_iv: [
    f(0, 180_000, 4.5, 0),
    f(180_000.01, 360_000, 9.0, 8_100),
    f(360_000.01, 720_000, 10.2, 12_420),
    f(720_000.01, 1_800_000, 14.0, 39_780),
    f(1_800_000.01, 3_600_000, 22.0, 183_780),
    f(3_600_000.01, 4_800_000, 33.0, 828_000),
  ],
  anexo_v: [
    f(0, 180_000, 15.5, 0),
    f(180_000.01, 360_000, 18.0, 4_500),
    f(360_000.01, 720_000, 19.5, 9_900),
    f(720_000.01, 1_800_000, 20.5, 17_100),
    f(1_800_000.01, 3_600_000, 23.0, 62_100),
    f(3_600_000.01, 4_800_000, 30.5, 540_000),
  ],
};

const IDS = ['anexo_i', 'anexo_ii', 'anexo_iii', 'anexo_iv', 'anexo_v'];
const LINHAS = IDS.flatMap((anexo) => [1, 2, 3, 4, 5, 6].map((faixa) => ({ anexo, faixa })));

// ─── Extrator genérico de tabela de faixas a partir do fonte ──────────────────

/**
 * Os 6 sítios declaram a mesma tabela com nomes de campo diferentes
 * (`inicio`/`min`/`limiteInf`, `parcelaDeduzir`/`deducao`) e, num deles, com
 * separador numérico do JS (`180_000`). Um extrator só resolve os 6: pega os
 * pares `chave: número` de cada literal e traduz os apelidos.
 */
const APELIDOS: Record<string, keyof Faixa> = {
  min: 'min', inicio: 'min', limiteInf: 'min',
  max: 'max', fim: 'max', limiteSup: 'max',
  aliquota: 'aliquota',
  deducao: 'deducao', parcelaDeduzir: 'deducao',
};

/**
 * Corpo do array literal da constante. Dois desvios reais do fonte precisam de
 * tratamento: `const ANEXO_I: readonly FaixaSimples[] = Object.freeze([...])`
 * traz um `[]` vazio da anotação de tipo antes do array de verdade, e em
 * `simples-nacional-anexos.ts` a tabela está sob a chave `faixas`, depois de um
 * outro array (`tributosPrincipais`) no mesmo objeto.
 */
function corpoDoArray(fonte: string, constante: string, chave?: string): string {
  const decl = fonte.indexOf(`const ${constante}`);
  if (decl < 0) throw new Error(`Constante ${constante} não encontrada.`);

  let abre: number;
  if (chave) {
    const k = fonte.indexOf(`${chave}:`, decl);
    if (k < 0) throw new Error(`Chave ${chave} não encontrada em ${constante}.`);
    abre = fonte.indexOf('[', k);
  } else {
    // Pula colchetes vazios — são anotação de tipo, não dado.
    abre = fonte.indexOf('[', decl);
    while (abre >= 0 && fonte[abre + 1] === ']') abre = fonte.indexOf('[', abre + 2);
  }
  if (abre < 0) throw new Error(`Array de ${constante} não encontrado.`);

  let nivel = 0;
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === '[') nivel++;
    else if (fonte[i] === ']') {
      nivel--;
      if (nivel === 0) return fonte.slice(abre + 1, i);
    }
  }
  throw new Error(`Colchete de ${constante} não fecha.`);
}

function extrairFaixas(fonte: string, constante: string, chave?: string): Faixa[] {
  const corpo = corpoDoArray(fonte, constante, chave);
  const literais = corpo.match(/\{[^{}]*\}/g) ?? [];
  return literais.map((lit, idx) => {
    const faixa: Partial<Faixa> = {};
    for (const [, chave, valor] of lit.matchAll(/(\w+)\s*:\s*(-?[\d_]+(?:\.[\d_]+)?)\b/g)) {
      const campo = APELIDOS[chave];
      if (campo) faixa[campo] = Number(valor.replace(/_/g, ''));
    }
    const faltando = (['min', 'max', 'aliquota', 'deducao'] as const).filter((c) => faixa[c] === undefined);
    if (faltando.length) {
      throw new Error(`${constante}[${idx}] sem os campos: ${faltando.join(', ')}`);
    }
    return faixa as Faixa;
  });
}

// ─── Inventário das cópias do Anexo I ─────────────────────────────────────────

const COPIAS_ANEXO_I: { arquivo: string; constante: string; chave?: string }[] = [
  { arquivo: 'src/data/simples-nacional-anexos.ts', constante: 'ANEXO_I', chave: 'faixas' },
  { arquivo: 'src/lib/financeiro/simples-nacional-2026.ts', constante: 'ANEXO_I' },
  { arquivo: 'src/components/configuracoes/ApuracaoRegimeTributario.tsx', constante: 'SIMPLES_FAIXAS' },
  { arquivo: 'src/components/precificacao/CalculadoraTributaria.tsx', constante: 'SIMPLES_FAIXAS' },
  { arquivo: 'src/components/contratos/ContratoCustos.tsx', constante: 'SIMPLES_FAIXAS' },
  { arquivo: 'src/components/proposta/SimplesNacionalCalculadora.tsx', constante: 'FAIXAS_ANEXO_I' },
];

/** Varre src/ atrás de arquivos que carreguem a assinatura da tabela do Anexo I. */
function sitiosComTabelaDoAnexoI(): string[] {
  const achados: string[] = [];
  const visitar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visitar(p);
      else if (/\.tsx?$/.test(e.name)) {
        // `types.ts` é gerado e os testes citam os números de propósito —
        // nenhum dos dois é sítio de decisão.
        if (p.includes(`integrations${path.sep}supabase`)) continue;
        if (p.includes(`${path.sep}test${path.sep}`)) continue;
        const conteudo = readFileSync(p, 'utf8').replace(/_/g, '');
        // Deduções da 3ª e da 6ª faixa: par distintivo do Anexo I.
        if (conteudo.includes('13860') && conteudo.includes('378000')) {
          achados.push(path.relative(RAIZ, p).split(path.sep).join('/'));
        }
      }
    }
  };
  visitar(path.resolve(RAIZ, 'src'));
  return achados.sort();
}

// ─── 1. As faixas do código contra a lei ──────────────────────────────────────

describe('faixas do Simples contra a CGSN 140/2018', () => {
  it.each(LINHAS)('$anexo faixa $faixa bate com a lei', ({ anexo, faixa }) => {
    const doCodigo = getAnexoById(anexo)!.faixas.find((x) => x.faixaNum === faixa)!;
    const naLei = FAIXAS_LEGAIS[anexo][faixa - 1];
    expect({
      min: doCodigo.min,
      max: doCodigo.max,
      aliquota: doCodigo.aliquota,
      deducao: doCodigo.deducao,
    }).toEqual(naLei);
  });

  it('a fixture legal cobre os 5 anexos em 6 faixas', () => {
    expect(Object.keys(FAIXAS_LEGAIS).sort()).toEqual([...IDS].sort());
    for (const anexo of IDS) expect(FAIXAS_LEGAIS[anexo]).toHaveLength(6);
  });
});

// ─── 2. Invariantes estruturais das faixas ────────────────────────────────────

describe('estrutura das faixas', () => {
  it.each(IDS)('%s: as faixas sobem sem se sobrepor', (anexo) => {
    const fx = getAnexoById(anexo)!.faixas;
    for (let i = 0; i < fx.length; i++) {
      expect(fx[i].min).toBeLessThan(fx[i].max);
      if (i > 0) expect(fx[i].min).toBeGreaterThan(fx[i - 1].max);
    }
  });

  it.each(IDS)('%s: entre uma faixa e a seguinte sobra um vão de 1 centavo', (anexo) => {
    // DEFEITO ESTRUTURAL CONHECIDO, herdado da própria redação da lei: a faixa
    // seguinte começa em `max + 0,01`, então um RBT12 como 180.000,005 não cai em
    // faixa nenhuma. Quem consome isso reage de forma diferente — o motor de
    // simples-nacional-2026 devolve a 6ª faixa em silêncio e o de anexos devolve
    // `null`. As duas reações são congeladas nos arquivos 3 e 4.
    const fx = getAnexoById(anexo)!.faixas;
    for (let i = 1; i < fx.length; i++) {
      expect(fx[i].min - fx[i - 1].max).toBeCloseTo(0.01, 9);
    }
  });

  it.each(IDS)('%s: começa em zero e termina no teto de R$ 4.800.000', (anexo) => {
    const fx = getAnexoById(anexo)!.faixas;
    expect(fx[0].min).toBe(0);
    expect(fx[fx.length - 1].max).toBe(4_800_000);
  });

  it.each(IDS)('%s: alíquota nominal e dedução nunca decrescem', (anexo) => {
    const fx = getAnexoById(anexo)!.faixas;
    for (let i = 1; i < fx.length; i++) {
      expect(fx[i].aliquota).toBeGreaterThan(fx[i - 1].aliquota);
      expect(fx[i].deducao).toBeGreaterThan(fx[i - 1].deducao);
    }
  });

  it('a 1ª faixa nunca deduz — é a única em que a efetiva é a nominal', () => {
    for (const anexo of IDS) expect(getAnexoById(anexo)!.faixas[0].deducao).toBe(0);
  });
});

// ─── 3. As 6 cópias da tabela do Anexo I ──────────────────────────────────────

describe('cópias da tabela do Anexo I', () => {
  const canonica = FAIXAS_LEGAIS.anexo_i;

  it.each(COPIAS_ANEXO_I)('$arquivo ($constante) reproduz a tabela legal', ({ arquivo, constante, chave }) => {
    expect(extrairFaixas(ler(arquivo), constante, chave)).toEqual(canonica);
  });

  it('o inventário de cópias está completo', () => {
    // Tripwire: se alguém criar a 7ª cópia, este teste aponta o arquivo novo.
    // A saída certa NÃO é acrescentá-lo à lista — é importar a tabela canônica.
    expect(sitiosComTabelaDoAnexoI()).toEqual(COPIAS_ANEXO_I.map((c) => c.arquivo).sort());
  });

  it('as 6 são idênticas entre si — consolidar não muda número em produção', () => {
    // Registrado porque é a licença para a fase de consolidação: unificar as 6
    // numa só é refatoração pura. Note que esta asserção sozinha teria poder ZERO
    // de detecção se todas carregassem o mesmo erro — por isso a autoridade está
    // na comparação com FAIXAS_LEGAIS acima, e esta é só corolário.
    const tabelas = COPIAS_ANEXO_I.map((c) => extrairFaixas(ler(c.arquivo), c.constante, c.chave));
    for (const t of tabelas) expect(t).toEqual(tabelas[0]);
  });
});

// ─── 4. Outros sítios que codificam parâmetro do Simples ──────────────────────

describe('sítios avulsos com parâmetro do Simples', () => {
  it('relatorio-contabil-data rotula de "Simples Nacional" a tabela do Anexo III', () => {
    // Não é cópia do Anexo I: são as alíquotas e deduções do Anexo III sob um
    // rótulo genérico. Quando a consolidação chegar aqui, precisa decidir qual
    // anexo o relatório deve usar — hoje a escolha está implícita.
    const fonte = ler('src/data/relatorio-contabil-data.ts');
    const iii = FAIXAS_LEGAIS.anexo_iii;
    for (const faixa of iii) {
      expect(fonte).toContain(`deducao: ${faixa.deducao}`);
    }
    expect(fonte).toContain("nome: 'Simples Nacional'");
  });

  it('RelatorioContabil decide elegibilidade anualizando o mês, não pelo RBT12', () => {
    // DEFEITO SUSPEITO: `receitaBruta * 12` supõe doze meses iguais. Um ano com
    // sazonalidade cruza o teto sem que a conta perceba. Congelado aqui para a
    // fase de consolidação revisitar junto com as três fontes de RBT12.
    expect(ler('src/pages/RelatorioContabil.tsx')).toContain('cenario.receitaBruta * 12 <= 4800000');
  });
});

// ─── 5. Guarda estática do numeric(5,4) ───────────────────────────────────────

const MIGRATION_CONFIG = 'supabase/migrations/20260425194132_9068ae31-35fa-436b-bdcc-1fe5038e86c5.sql';

type Coluna = { nome: string; precisao: number; escala: number; padraoSql: number };

/** Colunas numéricas de `financeiro_config_tributaria`, lidas da migration. */
function colunasDaMigration(): Coluna[] {
  const fonte = ler(MIGRATION_CONFIG);
  const bloco = fonte.split('CREATE TABLE IF NOT EXISTS public.financeiro_config_tributaria')[1];
  if (!bloco) throw new Error('Bloco da financeiro_config_tributaria não encontrado na migration.');
  const corpo = bloco.split(');')[0];
  const achados: Coluna[] = [];
  for (const [, nome, p, s, padrao] of corpo.matchAll(
    /(\w+)\s+numeric\((\d+),(\d+)\)\s+DEFAULT\s+([\d.]+)/g,
  )) {
    achados.push({ nome, precisao: Number(p), escala: Number(s), padraoSql: Number(padrao) });
  }
  return achados;
}

/** Valores do DEFAULT_CONFIG do hook, lidos do fonte. */
function padroesDoHook(): Record<string, number> {
  const fonte = ler('src/hooks/useApuracaoTributaria.ts');
  const bloco = fonte.split('const DEFAULT_CONFIG')[1]?.split('};')[0];
  if (!bloco) throw new Error('DEFAULT_CONFIG não encontrado no hook.');
  const out: Record<string, number> = {};
  for (const [, chave, valor] of bloco.matchAll(/(\w+):\s*(-?[\d.]+),/g)) out[chave] = Number(valor);
  return out;
}

/** Maior valor que cabe em numeric(p,s). */
const tetoDe = (p: number, s: number) => 10 ** (p - s) - 10 ** -s;

/**
 * DEFEITO CONHECIDO — três colunas `numeric(5,4)` (teto 9,9999) com DEFAULT
 * percentual. O DDL passa porque o Postgres não avalia a default expression na
 * criação, mas nenhum INSERT funciona, nem um que OMITA as colunas. É por isso
 * que `financeiro_config_tributaria` estava com zero linhas.
 *
 * Sai na fase de consolidação, com ALTER TYPE para numeric(7,4) + CHECK 0..100.
 * Quando sair, esta lista esvazia e nenhuma outra asserção muda.
 */
const COLUNAS_QUE_ESTOURAM = ['aliquota_irpj', 'adicional_irpj', 'aliquota_icms'];

describe('precisão das colunas de alíquota', () => {
  const colunas = colunasDaMigration();
  const hook = padroesDoHook();

  it('a migration declara as 9 alíquotas e as 4 presunções', () => {
    expect(colunas.filter((c) => c.nome.startsWith('aliquota_') || c.nome === 'adicional_irpj')).toHaveLength(9);
    expect(colunas.filter((c) => c.nome.startsWith('presuncao_'))).toHaveLength(4);
  });

  it.each(colunasDaMigration())('$nome: o DEFAULT do SQL cabe em numeric($precisao,$escala)', (c) => {
    const cabe = c.padraoSql <= tetoDe(c.precisao, c.escala);
    expect(cabe).toBe(!COLUNAS_QUE_ESTOURAM.includes(c.nome));
  });

  it('o DEFAULT_CONFIG do hook concorda com o DEFAULT do SQL, coluna a coluna', () => {
    // Sem isto, corrigir um lado e esquecer o outro passa despercebido.
    for (const c of colunas) {
      if (hook[c.nome] === undefined) continue;
      expect(hook[c.nome]).toBe(c.padraoSql);
    }
  });

  it('cada estouro documentado é real e vale para os dois lados', () => {
    for (const nome of COLUNAS_QUE_ESTOURAM) {
      const c = colunas.find((x) => x.nome === nome);
      expect(c, `coluna ${nome} sumiu da migration`).toBeDefined();
      expect(c!.padraoSql).toBeGreaterThan(tetoDe(c!.precisao, c!.escala));
      expect(hook[nome]).toBeGreaterThan(tetoDe(c!.precisao, c!.escala));
    }
  });

  it('a alíquota efetiva persistida tem casa para uma dízima', () => {
    // AlEf = Alíq − PD/RBT12 é genericamente dízima; numeric(7,4) guarda 4 casas
    // de ponto percentual. É o argumento que eliminou basis point da convenção.
    expect(ler(MIGRATION_CONFIG)).toContain('aliquota_efetiva_simples numeric(7,4)');
  });
});

describe('sanidade do extrator', () => {
  it('reconhece os três dialetos de nome de campo', () => {
    expect(extrairFaixas('const A = [{ inicio: 0, fim: 10, aliquota: 1, parcelaDeduzir: 2 }];', 'A'))
      .toEqual([f(0, 10, 1, 2)]);
    expect(extrairFaixas('const A = [{ min: 0, max: 10, aliquota: 1, deducao: 2 }];', 'A'))
      .toEqual([f(0, 10, 1, 2)]);
    expect(extrairFaixas('const A = [{ limiteInf: 0, limiteSup: 1_0, aliquota: 1, deducao: 2 }];', 'A'))
      .toEqual([f(0, 10, 1, 2)]);
  });

  it('quebra em vez de devolver tabela incompleta', () => {
    expect(() => extrairFaixas('const A = [{ min: 0, max: 10 }];', 'A')).toThrow(/aliquota, deducao/);
    expect(() => extrairFaixas('const B = [];', 'A')).toThrow(/não encontrada/);
  });

  it('ANEXOS_SIMPLES continua com os 5 anexos', () => {
    expect(ANEXOS_SIMPLES.map((a) => a.id)).toEqual(IDS);
  });
});
