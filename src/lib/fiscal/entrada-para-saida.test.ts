import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fichaDaMercadoria, completarFicha, NAO_HERDA_DA_ENTRADA } from './entrada-para-saida';
import { parseNFeXML, type NFeItemData } from '@/lib/parseNFe';

/**
 * A saída herdava da entrada o que nunca pode herdar.
 *
 * A cadeia do defeito atravessava dois arquivos distantes, e nenhum dos dois a
 * mencionava:
 *
 *   GestaoCompras      → gravava `produtos.cfop` com o CFOP da nota de ENTRADA
 *   FinPedidosAFaturar → lia `produtos.cfop` para pré-preencher a SAÍDA
 *
 * Resultado: comprava com 1.102 e vendia com 1.102. CFOP de entrada começa com
 * 1 ou 2, o de saída com 5 ou 6 — a SEFAZ rejeita (733), e quem não conferisse
 * o campo pré-preenchido transmitiria assim.
 *
 * Os casos de varredura de arquivo existem porque o defeito não mora em nenhum
 * dos dois lados: mora na ligação entre eles.
 */

const itemDaNota: NFeItemData = {
  n_item: 1,
  c_prod: 'FORN-9988',
  c_ean: '7891234567895',
  x_prod: 'Papel A4 75g',
  ncm: '48025590',
  cest: '2800100',
  cfop: '1102',
  u_com: 'CX',
  q_com: 10,
  v_un_com: 180,
  v_prod: 1800,
  v_desc: 0,
  cst_icms: '00',
  csosn: '',
  orig: '1',
  cst_pis: '01',
  cst_cofins: '01',
  p_icms: 18,
  p_pis: 1.65,
  p_cofins: 7.6,
  v_icms: 324,
  v_icms_st: 0,
  v_ipi: 0,
  v_pis: 29.7,
  v_cofins: 136.8,
  cst_ibs_cbs: '',
  c_class_trib: '',
  v_ibs: 0,
  v_cbs: 0,
  inf_ad_prod: '',
};

describe('o que a ficha do produto herda da nota de entrada', () => {
  it('leva o que descreve a mercadoria', () => {
    const ficha = fichaDaMercadoria(itemDaNota);
    expect(ficha.ncm).toBe('48025590');
    expect(ficha.cest).toBe('2800100');
    expect(ficha.codigo_ean).toBe('7891234567895');
    expect(ficha.origem_mercadoria).toBe('1'); // importado direto
    expect(ficha.unidade).toBe('CX');
  });

  it('NÃO leva o que descreve a operação do fornecedor', () => {
    const ficha = fichaDaMercadoria(itemDaNota) as Record<string, unknown>;
    for (const campo of NAO_HERDA_DA_ENTRADA) {
      expect(ficha[campo], `${campo} não pode atravessar a operação`).toBeUndefined();
    }
    // E o código do item no sistema do fornecedor não é o nosso código.
    expect(ficha['codigo']).toBeUndefined();
  });

  it('"SEM GTIN" não é código de barras', () => {
    // A SEFAZ exige esse literal quando o item não tem EAN. Gravá-lo faria a
    // saída transmitir a frase no lugar do código.
    expect(fichaDaMercadoria({ ...itemDaNota, c_ean: 'SEM GTIN' }).codigo_ean).toBeUndefined();
    expect(fichaDaMercadoria({ ...itemDaNota, c_ean: '' }).codigo_ean).toBeUndefined();
  });

  it('completa lacuna do cadastro, não sobrescreve conferência', () => {
    const jaCadastrado = { ncm: '48026900', cest: null, codigo_ean: '', origem_mercadoria: '0' };
    const lacunas = completarFicha(jaCadastrado, fichaDaMercadoria(itemDaNota));
    // NCM digitado à mão foi conferido numa tabela: a nota não o corrige.
    expect(lacunas).not.toHaveProperty('ncm');
    // Origem já preenchida também fica.
    expect(lacunas).not.toHaveProperty('origem_mercadoria');
    // O que estava vazio, preenche.
    expect(lacunas?.cest).toBe('2800100');
    expect(lacunas?.codigo_ean).toBe('7891234567895');
  });

  it('sem lacuna, não gera UPDATE', () => {
    const completo = {
      ncm: '48025590',
      cest: '2800100',
      codigo_ean: '7891234567895',
      origem_mercadoria: '1',
      unidade: 'CX',
    };
    expect(completarFicha(completo, fichaDaMercadoria(itemDaNota))).toBeNull();
  });
});

describe('a origem da mercadoria vem do XML', () => {
  it('lê `orig` de dentro do grupo de tributação do emitente', () => {
    // ICMSSN102 é o grupo de um emitente do Simples; ICMS00, de um do regime
    // normal. `orig` vive dentro do grupo escolhido, e a busca precisa achar
    // os dois sem enumerar os vinte que existem.
    const xml = (grupo: string, orig: string) => `<?xml version="1.0"?>
      <nfeProc><NFe><infNFe Id="NFe35240112345678000190550010000000011000000017">
        <det nItem="1"><prod>
          <cProd>X</cProd><cEAN>SEM GTIN</cEAN><xProd>Item</xProd>
          <NCM>48025590</NCM><CFOP>1102</CFOP><uCom>UN</uCom>
          <qCom>1</qCom><vUnCom>10</vUnCom><vProd>10</vProd>
        </prod><imposto><ICMS><${grupo}><orig>${orig}</orig></${grupo}></ICMS></imposto></det>
      </infNFe></NFe></nfeProc>`;

    expect(parseNFeXML(xml('ICMS00', '0')).itens[0].orig).toBe('0');
    expect(parseNFeXML(xml('ICMSSN102', '2')).itens[0].orig).toBe('2');
  });
});

describe('a ligação entre os dois lados', () => {
  it('a importação de NF-e não grava dado de operação na ficha do produto', () => {
    const fonte = readFileSync('src/pages/GestaoCompras.tsx', 'utf8');
    // O ponto exato do defeito era o objeto passado a `criarProdutoSeNovo`.
    expect(fonte).toContain('fichaDaMercadoria(m.item)');
    // A chamada não carrega mais dado de operação junto.
    expect(fonte).not.toMatch(/criarProdutoSeNovo\([^)]*\bcfop\b/s);
    expect(fonte).not.toMatch(/criarProdutoSeNovo\([^)]*\bp_icms\b/s);
    expect(fonte).not.toMatch(/criarProdutoSeNovo\([^)]*c_prod\b/s);

    // Nota para quem mexer aqui: `cfop: m.item.cfop` EXISTE neste arquivo, e
    // está certo — vai para `nfe_entrada_itens`, que é onde o dado da operação
    // deve morar. Proibir a linha no arquivo inteiro, como este caso fazia
    // antes, confundia o lugar errado com o dado errado. Que a ficha não
    // carrega CFOP, o primeiro bloco deste arquivo já prova.
  });

  it('a emissão de saída não lê CFOP nem alíquotas da ficha do produto', () => {
    const fonte = readFileSync('src/components/financeiro/FinPedidosAFaturar.tsx', 'utf8');
    const consulta = fonte.match(/from\('produtos'\)[\s\S]{0,200}?\.select\('([^']+)'\)/);
    expect(consulta, 'a consulta a produtos mudou de forma').not.toBeNull();
    const colunas = consulta![1].split(',').map((c) => c.trim());
    for (const proibida of ['cfop', 'cst_icms', 'csosn', 'p_icms', 'p_pis', 'p_cofins']) {
      expect(colunas, `${proibida} é da operação, não da mercadoria`).not.toContain(proibida);
    }
    expect(colunas).toContain('ncm');
    expect(colunas).toContain('origem_mercadoria');
  });
});
