import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { avaliarCreditoIcms, sugerirFinalidade } from '@/lib/fiscal/credito-icms';

/**
 * O passo 3 da importação de NF-e passou a perguntar PARA QUE a compra serve,
 * e a gravar a resposta junto do item.
 *
 * Até 13/09 os itens de uma nota viviam num `jsonb` sem chave estrangeira, e a
 * única linha persistente do casamento item↔produto era o movimento de
 * estoque — que guarda quantidade e preço e perde todo o resto. Não havia onde
 * registrar a finalidade, que é o parâmetro do crédito de ICMS.
 *
 * A tela não é capturável (exige empresa e plano que a conta de teste não
 * tem), então estes casos leem o código: verificam que o fluxo grava os itens,
 * que grava TODOS eles e não só os que viraram estoque, e que a classificação
 * do crédito é congelada no lançamento em vez de recalculada na leitura.
 */
const fonte = () => readFileSync('src/pages/GestaoCompras.tsx', 'utf8');

describe('o passo 3 grava a finalidade da compra', () => {
  it('escreve os itens na tabela própria, não só no jsonb da nota', () => {
    const s = fonte();
    expect(s).toContain("from('nfe_entrada_itens'");
    // Upsert pela posição do item: reimportar a nota corrige, não duplica.
    expect(s).toContain("onConflict: 'nfe_entrada_id,n_item'");
  });

  it('grava TODOS os itens da nota, não só os que viraram estoque', () => {
    const s = fonte();
    // A lista parte de `nfeItemMaps` inteiro. Partir de `toCreate` (os que
    // viram movimento) faria o item marcado "não registrar" sumir da
    // escrituração, embora conste da nota.
    expect(s).toMatch(/const itensDaEntrada = nfeItemMaps\.map/);
  });

  it('congela a classificação do crédito no lançamento', () => {
    const s = fonte();
    expect(s).toContain('credito_icms_situacao: credito.situacao');
    expect(s).toContain('credito_icms_fundamento');
  });

  it('registra de onde veio a finalidade', () => {
    const s = fonte();
    // Sem isto não dá para separar o que alguém conferiu do que o sistema
    // sugeriu — e uma classificação fiscal sugerida não é uma classificação.
    expect(s).toContain('finalidade_origem: m.finalidadeOrigem');
    expect(s).toContain("finalidadeOrigem: 'manual'");
  });

  it('o CFOP da entrada vai para o item, não para a ficha do produto', () => {
    const s = fonte();
    // No item: sim, é dado da operação e a escrituração precisa dele.
    expect(s).toContain('cfop: m.item.cfop');
    // No produto: não — era o que fazia a venda sair com o CFOP da compra.
    expect(s).not.toMatch(/criarProdutoSeNovo\([^)]*cfop/s);
  });

  it('o casamento item↔produto tenta o código de barras, não só o código', () => {
    const s = fonte();
    // `c_prod` é o código no sistema do FORNECEDOR e quase nunca bate com o
    // nosso `PRD%`. O EAN é do produto e é o mesmo dos dois lados.
    expect(s).toContain('montarMapaDoItem');
    const helper = s.slice(s.indexOf('const montarMapaDoItem'), s.indexOf('// ── Entrega → estoque'));
    expect(helper).toContain('codigo_ean === item.c_ean');
  });
});

describe('o que a tela mostra sobre o crédito', () => {
  it('uma compra de uso e consumo no regime normal avisa que não credita', () => {
    const r = avaliarCreditoIcms('uso_consumo', 'lucro_presumido');
    expect(r.situacao).toBe('vedado');
    expect(r.resumo).toMatch(/uso e consumo/i);
  });

  it('a nota que declara uso e consumo vence o cadastro que diz revenda', () => {
    // CFOP 1.556 é compra para uso e consumo. Se o produto está cadastrado
    // como revenda, quem classificou a OPERAÇÃO foi quem emitiu a nota.
    const sugestao = sugerirFinalidade('1556', '00');
    expect(sugestao.finalidade).toBe('uso_consumo');
    expect(avaliarCreditoIcms(sugestao.finalidade, 'lucro_real').situacao).toBe('vedado');
  });
});
