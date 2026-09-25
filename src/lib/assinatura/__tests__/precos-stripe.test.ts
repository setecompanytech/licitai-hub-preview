import { describe, it, expect } from 'vitest';
import {
  casaOCiclo, centavosDoCiclo, cicloDoPreco, escolherPreco, modoDaChave, reais, slugDoProduto,
  tabelaDeResolucao, type PrecoStripe,
} from '../../../../supabase/functions/_shared/precos-stripe';

/**
 * O módulo compartilhado das funções de borda, testado aqui porque não usa
 * `Deno.*`: é ele que decide qual preço do Stripe o botão Assinar cobra.
 */

const erroDe = (e: ReturnType<typeof escolherPreco>): string => (e.ok === false ? e.erro : '');

const preco = (
  id: string, produto: string, valor: number, interval: 'month' | 'year', vezes: number,
  extra: Partial<PrecoStripe> & { produtoAtivo?: boolean; slug?: string } = {},
): PrecoStripe => ({
  id,
  active: extra.active ?? true,
  currency: extra.currency ?? 'brl',
  unit_amount: valor,
  created: extra.created ?? 1,
  recurring: { interval, interval_count: vezes },
  product: { id: `prod_${produto}`, name: produto, active: extra.produtoAtivo ?? true, metadata: extra.slug ? { slug: extra.slug } : null },
});

describe('o valor de cada ciclo, em centavos', () => {
  it('aplica os descontos de 10, 15 e 20% ao centavo', () => {
    expect(centavosDoCiclo(197, 'mensal')).toBe(19700);
    expect(centavosDoCiclo(197, 'trimestral')).toBe(53190);
    expect(centavosDoCiclo(197, 'semestral')).toBe(100470);
    expect(centavosDoCiclo(197, 'anual')).toBe(189120);
    expect(centavosDoCiclo(497, 'trimestral')).toBe(134190);
    expect(centavosDoCiclo(997, 'anual')).toBe(957120);
  });
  it('escreve em reais sem depender do Intl', () => {
    expect(reais(19700)).toBe('R$ 197,00');
    expect(reais(134190)).toBe('R$ 1.341,90');
    expect(reais(957120)).toBe('R$ 9.571,20');
    expect(reais(5)).toBe('R$ 0,05');
  });
});

describe('o plano que o produto declara', () => {
  it('lê o nome, com ou sem acento, e a metadata manda', () => {
    expect(slugDoProduto({ id: 'p', name: 'Praefectus Profissional' })).toBe('profissional');
    expect(slugDoProduto({ id: 'p', name: 'PRAEFECTUS Básico' })).toBe('basico');
    expect(slugDoProduto({ id: 'p', name: 'Plano Basico mensal' })).toBe('basico');
    expect(slugDoProduto({ id: 'p', name: 'Enterprise' })).toBe('enterprise');
    expect(slugDoProduto({ id: 'p', name: 'Assinatura', metadata: { slug: 'enterprise' } })).toBe('enterprise');
    expect(slugDoProduto({ id: 'p', name: 'Consultoria' })).toBeNull();
    expect(slugDoProduto('prod_x')).toBeNull();
    expect(slugDoProduto(null)).toBeNull();
  });
  it('reconhece o ciclo do preço, inclusive 12 meses escritos como month × 12', () => {
    expect(cicloDoPreco({ interval: 'month', interval_count: 1 })).toBe('mensal');
    expect(cicloDoPreco({ interval: 'month', interval_count: 3 })).toBe('trimestral');
    expect(cicloDoPreco({ interval: 'month', interval_count: 6 })).toBe('semestral');
    expect(cicloDoPreco({ interval: 'year', interval_count: 1 })).toBe('anual');
    expect(cicloDoPreco({ interval: 'month', interval_count: 12 })).toBe('anual');
    expect(cicloDoPreco({ interval: 'week', interval_count: 2 })).toBe('outro');
    expect(cicloDoPreco(null)).toBe('avulso');
    expect(casaOCiclo({ interval: 'month', interval_count: 1 }, 'anual')).toBe(false);
  });
});

describe('a escolha do preço pelo valor e pelo ciclo', () => {
  const conta: PrecoStripe[] = [
    preco('price_b1', 'Praefectus Básico', 19700, 'month', 1),
    preco('price_p1', 'Praefectus Profissional', 49700, 'month', 1),
    preco('price_p1_velho', 'Praefectus Profissional', 49700, 'month', 1, { active: false }),
    preco('price_p3', 'Praefectus Profissional', 134190, 'month', 3),
    preco('price_e1', 'Praefectus Enterprise', 99700, 'month', 1),
    preco('price_e12', 'Praefectus Enterprise', 957120, 'month', 12),
    preco('price_arq', 'Produto arquivado', 49700, 'month', 1, { produtoAtivo: false }),
  ];

  it('acha pelo valor e pelo nome, ignorando inativos e produtos arquivados', () => {
    const r = escolherPreco(conta, 'profissional', 'mensal', 49700);
    expect(r.ok && r.preco.id).toBe('price_p1');
    expect(r.ok && r.motivo).toBe('valor_e_nome');
    const t = escolherPreco(conta, 'profissional', 'trimestral', 134190);
    expect(t.ok && t.preco.id).toBe('price_p3');
    const a = escolherPreco(conta, 'enterprise', 'anual', 957120);
    expect(a.ok && a.preco.id).toBe('price_e12');
  });

  it('com dois preços iguais do mesmo plano, fica o mais novo', () => {
    const lista = [
      preco('price_antigo', 'Básico', 19700, 'month', 1, { created: 10 }),
      preco('price_novo', 'Básico', 19700, 'month', 1, { created: 20 }),
    ];
    const r = escolherPreco(lista, 'basico', 'mensal', 19700);
    expect(r.ok && r.preco.id).toBe('price_novo');
  });

  it('produto sem plano no nome vale pelo valor; produto de OUTRO plano com o valor certo é recusado', () => {
    const semNome = [preco('price_x', 'Assinatura mensal', 49700, 'month', 1)];
    const r = escolherPreco(semNome, 'profissional', 'mensal', 49700);
    expect(r.ok && r.motivo).toBe('valor');
    const outro = [preco('price_y', 'Praefectus Básico', 49700, 'month', 1)];
    const e = escolherPreco(outro, 'profissional', 'mensal', 49700);
    expect(e.ok).toBe(false);
    expect(erroDe(e)).toMatch(/não do plano Profissional/);
  });

  it('valor diferente do site é divergência, dita com os dois valores', () => {
    const lista = [preco('price_p1', 'Praefectus Profissional', 59700, 'month', 1)];
    const r = escolherPreco(lista, 'profissional', 'mensal', 49700);
    expect(r.ok).toBe(false);
    expect(erroDe(r)).toMatch(/site mostra R\$ 497,00/);
    expect(erroDe(r)).toMatch(/R\$ 597,00 \(price_p1\)/);
  });

  it('sem nada no ciclo, diz que não há; com outros, lista o que existe', () => {
    const r = escolherPreco(conta, 'basico', 'semestral', 100470);
    expect(erroDe(r)).toMatch(/Não há preço ativo semestral em BRL/);
    const s = escolherPreco(conta, 'basico', 'trimestral', 53190);
    expect(erroDe(s)).toMatch(/Ativos nesse ciclo: Praefectus Profissional R\$ 1.341,90/);
  });

  it('moeda diferente não conta', () => {
    const lista = [preco('price_usd', 'Praefectus Básico', 19700, 'month', 1, { currency: 'usd' })];
    expect(escolherPreco(lista, 'basico', 'mensal', 19700).ok).toBe(false);
  });

  it('a tabela cobre 3 planos × 4 ciclos e diz o que falta', () => {
    const tabela = tabelaDeResolucao(conta, [
      { slug: 'basico', preco_mensal: 197 }, { slug: 'profissional', preco_mensal: 497 }, { slug: 'enterprise', preco_mensal: 997 },
    ]);
    expect(tabela).toHaveLength(12);
    expect(tabela.filter((l) => l.price_id).map((l) => l.price_id)).toEqual(['price_b1', 'price_p1', 'price_p3', 'price_e1', 'price_e12']);
    const falta = tabela.find((l) => l.plano === 'basico' && l.ciclo === 'anual');
    expect(falta?.esperado).toBe('R$ 1.891,20');
    expect(falta?.motivo).toMatch(/Nenhum preço ativo/);
    const semPlano = tabelaDeResolucao(conta, [{ slug: 'basico', preco_mensal: 197 }]);
    expect(semPlano.find((l) => l.plano === 'enterprise')?.motivo).toMatch(/não está ativo na tabela planos/);
  });
});

describe('o modo da chave, sem revelar a chave', () => {
  it('produção, teste ou desconhecido', () => {
    expect(modoDaChave('sk_live_abc')).toBe('producao');
    expect(modoDaChave('rk_test_abc')).toBe('teste');
    expect(modoDaChave('899477ae')).toBe('desconhecido');
    expect(modoDaChave(null)).toBe('desconhecido');
  });
});
