/**
 * Tabela empilhada no celular (22/09/2026) — a parte que não depende do React.
 *
 * "Não reproduzir o desktop em miniatura" (comando de 13/09): uma tabela de
 * seis colunas em 390px não é uma tabela, é uma barra de rolagem — e, com a
 * rolagem presa ao contêiner, coluna escondida parece coluna cortada ("FUNDA /
 * ESTAD" no print de 22/09). `TabelaGestao` já vira cartões no celular; as
 * oitenta telas que usam a `ui/table` crua não tinham tradução.
 *
 * Aqui a tradução é genérica: no celular, quando a tabela não cabe, cada linha
 * vira um bloco e cada célula ganha o título da própria coluna em
 * `data-rotulo`, lido do cabeçalho, que o CSS de `.tabela-empilhada`
 * (index.css) desenha à esquerda do valor. Tabela que cabe continua tabela.
 */
export const CLASSE_TABELA_EMPILHADA = 'tabela-empilhada';

/** O mesmo limite de `useIsMobile` (menos de 768px). */
export const CONSULTA_DE_CELULAR = '(max-width: 767px)';

const ROTULO = 'data-rotulo';
const ROTULO_AUTOMATICO = 'data-rotulo-automatico';
const CABECALHO_NO_CORPO = 'data-cabecalho-empilhado';

function textoDaCelula(celula: HTMLTableCellElement): string {
  return (celula.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * A linha que dá nome às colunas: a última do `thead` (a de baixo, quando há
 * grupos) ou, sem `thead`, a primeira do corpo se ela for só de `th`.
 */
export function linhaDeTitulos(tabela: HTMLTableElement): HTMLTableRowElement | null {
  const cabecalho = tabela.tHead;
  if (cabecalho && cabecalho.rows.length > 0) return cabecalho.rows[cabecalho.rows.length - 1];
  const primeira = tabela.tBodies[0]?.rows[0];
  if (primeira && primeira.cells.length > 0 && Array.from(primeira.cells).every((c) => c.tagName === 'TH')) {
    return primeira;
  }
  return null;
}

/**
 * Dá a cada célula do corpo o título da própria coluna, em `data-rotulo`.
 *
 * Célula com `colSpan` (a linha "nenhum registro", o total) fica sem rótulo e
 * ocupa a largura toda; rótulo escrito à mão pela tela (`data-rotulo` sem a
 * marca de automático) é respeitado. Coluna de cabeçalho vazio (caixa de
 * seleção, ações) também fica sem rótulo: o conteúdo já se explica.
 */
export function rotularCelulas(tabela: HTMLTableElement): void {
  const linha = linhaDeTitulos(tabela);
  const titulos: string[] = [];
  if (linha) {
    for (const celula of Array.from(linha.cells)) {
      const texto = textoDaCelula(celula);
      for (let i = 0; i < Math.max(1, celula.colSpan); i++) titulos.push(texto);
    }
    if (linha.parentElement?.tagName === 'TBODY') linha.setAttribute(CABECALHO_NO_CORPO, '');
  }
  for (const corpo of Array.from(tabela.tBodies)) {
    for (const registro of Array.from(corpo.rows)) {
      if (registro === linha) continue;
      let coluna = 0;
      for (const celula of Array.from(registro.cells)) {
        const largura = Math.max(1, celula.colSpan);
        const manual = celula.hasAttribute(ROTULO) && !celula.hasAttribute(ROTULO_AUTOMATICO);
        if (!manual) {
          const titulo = largura === 1 ? (titulos[coluna] ?? '') : '';
          if (titulo) {
            celula.setAttribute(ROTULO, titulo);
            celula.setAttribute(ROTULO_AUTOMATICO, '');
          } else {
            celula.removeAttribute(ROTULO);
            celula.removeAttribute(ROTULO_AUTOMATICO);
          }
        }
        coluna += largura;
      }
    }
  }
}

/** A tabela não cabe na caixa de rolagem? Um pixel de folga contra arredondamento. */
export function precisaEmpilhar(caixa: { scrollWidth: number; clientWidth: number }): boolean {
  return caixa.scrollWidth > caixa.clientWidth + 1;
}
