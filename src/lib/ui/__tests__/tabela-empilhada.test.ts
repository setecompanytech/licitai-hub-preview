import { describe, it, expect } from 'vitest';
import { linhaDeTitulos, precisaEmpilhar, rotularCelulas } from '../tabela-empilhada';

/**
 * A pilha do celular precisa de um rótulo por célula, e o rótulo vem do
 * cabeçalho: este arquivo prende como ele é lido (última linha do `thead`,
 * ou a primeira do corpo quando só há `th`), o que fica sem rótulo (colSpan,
 * título vazio) e o que não se sobrescreve (rótulo escrito à mão).
 */
function tabela(html: string): HTMLTableElement {
  const caixa = document.createElement('div');
  caixa.innerHTML = html;
  return caixa.querySelector('table') as HTMLTableElement;
}

const rotulos = (t: HTMLTableElement, linha: number) =>
  Array.from(t.tBodies[0].rows[linha].cells).map((c) => c.getAttribute('data-rotulo'));

describe('rotularCelulas', () => {
  it('cada célula do corpo recebe o título da própria coluna', () => {
    const t = tabela(`<table>
      <thead><tr><th>Identificação</th><th> Órgão </th><th class="text-right">Valor estimado</th></tr></thead>
      <tbody><tr><td>PE 38/2026</td><td>FUNDAÇÃO ESTADUAL</td><td>R$ 1,00</td></tr></tbody>
    </table>`);
    rotularCelulas(t);
    expect(rotulos(t, 0)).toEqual(['Identificação', 'Órgão', 'Valor estimado']);
  });

  it('célula com colSpan e coluna de título vazio ficam sem rótulo', () => {
    const t = tabela(`<table>
      <thead><tr><th></th><th>Nome</th><th>Ações</th></tr></thead>
      <tbody>
        <tr><td><input type="checkbox" /></td><td>Ana</td><td><button>Abrir</button></td></tr>
        <tr><td colspan="3">Nenhum registro</td></tr>
      </tbody>
    </table>`);
    rotularCelulas(t);
    expect(rotulos(t, 0)).toEqual([null, 'Nome', 'Ações']);
    expect(rotulos(t, 1)).toEqual([null]);
  });

  it('cabeçalho agrupado usa a linha de baixo; colSpan no cabeçalho repete o título', () => {
    const t = tabela(`<table>
      <thead>
        <tr><th colspan="2">Período</th><th>Total</th></tr>
        <tr><th>Início</th><th>Fim</th><th>Valor</th></tr>
      </thead>
      <tbody><tr><td>01/01</td><td>31/01</td><td>10</td></tr></tbody>
    </table>`);
    rotularCelulas(t);
    expect(rotulos(t, 0)).toEqual(['Início', 'Fim', 'Valor']);

    const so = tabela(`<table>
      <thead><tr><th colspan="2">Período</th><th>Valor</th></tr></thead>
      <tbody><tr><td>01/01</td><td>31/01</td><td>10</td></tr></tbody>
    </table>`);
    rotularCelulas(so);
    expect(rotulos(so, 0)).toEqual(['Período', 'Período', 'Valor']);
  });

  it('sem thead, a primeira linha só de th vira cabeçalho e é marcada para sumir da pilha', () => {
    const t = tabela(`<table><tbody>
      <tr><th>Conta</th><th>Saldo</th></tr>
      <tr><td>Itaú</td><td>R$ 5,00</td></tr>
    </tbody></table>`);
    expect(linhaDeTitulos(t)).toBe(t.tBodies[0].rows[0]);
    rotularCelulas(t);
    expect(t.tBodies[0].rows[0].hasAttribute('data-cabecalho-empilhado')).toBe(true);
    expect(rotulos(t, 1)).toEqual(['Conta', 'Saldo']);
  });

  it('rótulo escrito à mão pela tela é respeitado; o automático é refeito quando o cabeçalho muda', () => {
    const t = tabela(`<table>
      <thead><tr><th>Nome</th><th>Valor</th></tr></thead>
      <tbody><tr><td data-rotulo="Fornecedor">Ana</td><td>10</td></tr></tbody>
    </table>`);
    rotularCelulas(t);
    expect(rotulos(t, 0)).toEqual(['Fornecedor', 'Valor']);
    t.tHead!.rows[0].cells[1].textContent = 'Total';
    rotularCelulas(t);
    expect(rotulos(t, 0)).toEqual(['Fornecedor', 'Total']);
  });
});

describe('precisaEmpilhar', () => {
  it('só quando a tabela passa da caixa, com um pixel de folga', () => {
    expect(precisaEmpilhar({ scrollWidth: 1200, clientWidth: 390 })).toBe(true);
    expect(precisaEmpilhar({ scrollWidth: 391, clientWidth: 390 })).toBe(false);
    expect(precisaEmpilhar({ scrollWidth: 390, clientWidth: 390 })).toBe(false);
  });
});
