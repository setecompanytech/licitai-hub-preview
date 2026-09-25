/**
 * O preço do plano no Stripe, achado pelo VALOR e pelo CICLO — nunca por id
 * gravado no código.
 *
 * Os doze `price_…` que viviam em `src/data/stripe-config.ts` (criados em
 * março pelo Lovable) sumiram do Stripe, e a tela de assinatura passou a dizer
 * "o plano selecionado não existe mais". Id gravado à mão envelhece: basta
 * alguém recriar o preço no painel, trocar a conta ou o modo (teste ×
 * produção) para o botão Assinar parar sem que nada no código tenha mudado.
 *
 * O que identifica o preço de um plano é o que a tela mostra: R$ 497,00 por
 * mês, R$ 1.341,90 por trimestre. Este módulo procura, entre os preços ATIVOS
 * da conta, o que cobra esse valor nesse ciclo. Valor diferente do site é
 * recusado com a diferença dita — nunca se cobra o que a tela não mostrou.
 *
 * Sem `Deno.*` de propósito: o vitest testa este arquivo
 * (`src/lib/assinatura/__tests__/precos-stripe.test.ts`).
 */

export type Ciclo = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type PlanoSlug = 'basico' | 'profissional' | 'enterprise';

export const PLANOS: PlanoSlug[] = ['basico', 'profissional', 'enterprise'];

export const NOME_DO_PLANO: Record<PlanoSlug, string> = {
  basico: 'Básico',
  profissional: 'Profissional',
  enterprise: 'Enterprise',
};

/** Espelho de `src/data/pricing-config.ts` — os dois mudam juntos. */
export const CICLOS: Record<Ciclo, { rotulo: string; meses: number; desconto: number; intervalo: 'month' | 'year'; vezes: number }> = {
  mensal: { rotulo: 'mensal', meses: 1, desconto: 0, intervalo: 'month', vezes: 1 },
  trimestral: { rotulo: 'trimestral', meses: 3, desconto: 0.10, intervalo: 'month', vezes: 3 },
  semestral: { rotulo: 'semestral', meses: 6, desconto: 0.15, intervalo: 'month', vezes: 6 },
  anual: { rotulo: 'anual', meses: 12, desconto: 0.20, intervalo: 'year', vezes: 1 },
};

export function ehCiclo(v: unknown): v is Ciclo {
  return typeof v === 'string' && v in CICLOS;
}

export function ehPlano(v: unknown): v is PlanoSlug {
  return typeof v === 'string' && (PLANOS as string[]).includes(v);
}

/** Centavos cobrados no ciclo: mensal × meses × (1 − desconto), ao centavo. */
export function centavosDoCiclo(precoMensal: number, ciclo: Ciclo): number {
  const c = CICLOS[ciclo];
  return Math.round(precoMensal * c.meses * (1 - c.desconto) * 100);
}

/** "R$ 1.341,90" a partir de centavos, sem depender de Intl. */
export function reais(centavos: number): string {
  const n = Math.round(centavos);
  const abs = Math.abs(n);
  const inteiro = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = String(abs % 100).padStart(2, '0');
  return `${n < 0 ? '-' : ''}R$ ${inteiro},${dec}`;
}

export type ProdutoStripe = {
  id: string;
  name?: string | null;
  active?: boolean;
  deleted?: boolean;
  metadata?: Record<string, string> | null;
};

export type PrecoStripe = {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  livemode?: boolean;
  nickname?: string | null;
  lookup_key?: string | null;
  created?: number;
  recurring?: { interval: 'day' | 'week' | 'month' | 'year'; interval_count: number } | null;
  product: string | ProdutoStripe;
};

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * O plano que o produto declara: `metadata.slug` manda; senão o nome
 * ("Praefectus Profissional" → profissional). Nada declarado → null.
 */
export function slugDoProduto(p: string | ProdutoStripe | null | undefined): PlanoSlug | null {
  if (!p || typeof p === 'string') return null;
  const meta = String(p.metadata?.slug ?? p.metadata?.plano ?? '').trim().toLowerCase();
  if (ehPlano(meta)) return meta;
  const nome = semAcento(p.name ?? '').toLowerCase();
  if (/\benterprise\b/.test(nome)) return 'enterprise';
  if (/\bprofissional\b/.test(nome)) return 'profissional';
  if (/\bbasico\b/.test(nome)) return 'basico';
  return null;
}

export function nomeDoProduto(p: string | ProdutoStripe | null | undefined): string {
  if (!p) return '';
  return typeof p === 'string' ? p : (p.name ?? p.id);
}

export function produtoAtivo(p: string | ProdutoStripe): boolean {
  if (typeof p === 'string') return true;
  return p.active !== false && p.deleted !== true;
}

/** O ciclo de um preço recorrente do Stripe; "month × 12" também é anual. */
export function cicloDoPreco(rec: PrecoStripe['recurring']): Ciclo | 'outro' | 'avulso' {
  if (!rec) return 'avulso';
  if (rec.interval === 'month' && rec.interval_count === 1) return 'mensal';
  if (rec.interval === 'month' && rec.interval_count === 3) return 'trimestral';
  if (rec.interval === 'month' && rec.interval_count === 6) return 'semestral';
  if (rec.interval === 'year' && rec.interval_count === 1) return 'anual';
  if (rec.interval === 'month' && rec.interval_count === 12) return 'anual';
  return 'outro';
}

export function casaOCiclo(rec: PrecoStripe['recurring'], ciclo: Ciclo): boolean {
  return cicloDoPreco(rec) === ciclo;
}

export type Escolha =
  | { ok: true; preco: PrecoStripe; motivo: 'valor_e_nome' | 'valor' }
  | { ok: false; erro: string; candidatos: PrecoStripe[] };

const maisNovo = (lista: PrecoStripe[]): PrecoStripe =>
  [...lista].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];

/**
 * Entre os preços da conta, o do plano × ciclo:
 *
 *  1. ativo, na moeda, no ciclo e com o valor esperado — havendo mais de um,
 *     o do produto cujo nome diz o plano; empate → o mais novo;
 *  2. valor certo só em produto de OUTRO plano → recusa (o valor não decide
 *     sozinho quando o nome contradiz);
 *  3. sem o valor, mas há preço ativo do produto do plano no ciclo → é
 *     divergência entre o site e o Stripe: recusa e diz os dois valores;
 *  4. nada → recusa listando o que existe nesse ciclo.
 */
export function escolherPreco(
  precos: PrecoStripe[],
  plano: PlanoSlug,
  ciclo: Ciclo,
  centavosEsperados: number,
  moeda = 'brl',
): Escolha {
  const rotulo = CICLOS[ciclo].rotulo;
  const nome = NOME_DO_PLANO[plano];
  const ativos = precos.filter((p) =>
    p.active && produtoAtivo(p.product) && p.currency.toLowerCase() === moeda.toLowerCase() && casaOCiclo(p.recurring, ciclo));
  const doValor = ativos.filter((p) => p.unit_amount === centavosEsperados);
  const doPlano = ativos.filter((p) => slugDoProduto(p.product) === plano);

  const valorENome = doValor.filter((p) => slugDoProduto(p.product) === plano);
  if (valorENome.length > 0) return { ok: true, preco: maisNovo(valorENome), motivo: 'valor_e_nome' };

  if (doValor.length > 0) {
    const semNome = doValor.filter((p) => slugDoProduto(p.product) === null);
    if (semNome.length > 0) return { ok: true, preco: maisNovo(semNome), motivo: 'valor' };
    return {
      ok: false,
      candidatos: doValor,
      erro: `O preço de ${reais(centavosEsperados)} ${rotulo} no Stripe é do produto "${nomeDoProduto(doValor[0].product)}", não do plano ${nome}.`,
    };
  }

  if (doPlano.length > 0) {
    const p = maisNovo(doPlano);
    return {
      ok: false,
      candidatos: doPlano,
      erro: `O site mostra ${reais(centavosEsperados)} para ${nome} ${rotulo}, mas no Stripe o preço ativo desse plano é ${reais(p.unit_amount ?? 0)} (${p.id}). Acerte um dos dois antes de cobrar.`,
    };
  }

  const existentes = ativos.length === 0
    ? `Não há preço ativo ${rotulo} em ${moeda.toUpperCase()} na conta.`
    : `Ativos nesse ciclo: ${ativos.map((p) => `${nomeDoProduto(p.product)} ${reais(p.unit_amount ?? 0)}`).join('; ')}.`;
  return {
    ok: false,
    candidatos: ativos,
    erro: `Nenhum preço ativo no Stripe para ${nome} ${rotulo} (${reais(centavosEsperados)}). ${existentes}`,
  };
}

export type LinhaDaResolucao = {
  plano: PlanoSlug;
  ciclo: Ciclo;
  esperado_centavos: number;
  esperado: string;
  price_id: string | null;
  motivo: string;
};

/** Os 3 planos × 4 ciclos, cada um com o preço achado ou o motivo de faltar. */
export function tabelaDeResolucao(
  precos: PrecoStripe[],
  planos: Array<{ slug: string; preco_mensal: number }>,
): LinhaDaResolucao[] {
  const linhas: LinhaDaResolucao[] = [];
  for (const slug of PLANOS) {
    const plano = planos.find((p) => p.slug === slug);
    for (const ciclo of Object.keys(CICLOS) as Ciclo[]) {
      if (!plano) {
        linhas.push({ plano: slug, ciclo, esperado_centavos: 0, esperado: '—', price_id: null, motivo: `Plano ${NOME_DO_PLANO[slug]} não está ativo na tabela planos.` });
        continue;
      }
      const esperado = centavosDoCiclo(Number(plano.preco_mensal), ciclo);
      const escolha = escolherPreco(precos, slug, ciclo, esperado);
      linhas.push({
        plano: slug,
        ciclo,
        esperado_centavos: esperado,
        esperado: reais(esperado),
        price_id: escolha.ok === true ? escolha.preco.id : null,
        motivo: escolha.ok === true
          ? (escolha.motivo === 'valor_e_nome' ? 'valor e nome do produto' : 'valor')
          : escolha.erro,
      });
    }
  }
  return linhas;
}

/** Produção, teste ou desconhecido — pelo prefixo, sem revelar a chave. */
export function modoDaChave(chave: string | null | undefined): 'producao' | 'teste' | 'desconhecido' {
  if (!chave) return 'desconhecido';
  if (/^(sk|rk)_live_/.test(chave)) return 'producao';
  if (/^(sk|rk)_test_/.test(chave)) return 'teste';
  return 'desconhecido';
}
