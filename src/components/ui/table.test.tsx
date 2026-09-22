import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

/**
 * A `ui/table` no celular (22/09): a tabela que não cabe vira pilha de
 * registros com o título de cada coluna; a que cabe, e a do desktop,
 * continuam tabela. O jsdom não faz layout: as larguras são forjadas.
 */
const larguras = { scrollWidth: 0, clientWidth: 0 };
const matchMediaOriginal = window.matchMedia;
let celular = false;

function forjarLarguras(scrollWidth: number, clientWidth: number) {
  larguras.scrollWidth = scrollWidth;
  larguras.clientWidth = clientWidth;
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => larguras.scrollWidth });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => larguras.clientWidth });
  window.matchMedia = ((query: string) => ({
    matches: celular && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  celular = false;
});

function montar() {
  return render(
    <Table className="min-w-[900px]">
      <TableHeader>
        <TableRow>
          <TableHead>Identificação</TableHead>
          <TableHead>Órgão</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>PE 38/2026</TableCell>
          <TableCell>FUNDAÇÃO ESTADUAL</TableCell>
          <TableCell className="text-right">R$ 1,00</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('Table — pilha no celular', () => {
  it('no celular, a tabela que não cabe empilha e cada célula ganha o título da coluna', () => {
    celular = true;
    forjarLarguras(1200, 390);
    montar();
    const caixa = screen.getByRole('table').parentElement as HTMLElement;
    expect(caixa.className).toContain('tabela-empilhada');
    expect(screen.getByText('FUNDAÇÃO ESTADUAL').getAttribute('data-rotulo')).toBe('Órgão');
    expect(screen.getByText('R$ 1,00').getAttribute('data-rotulo')).toBe('Valor');
  });

  it('no celular, a tabela que cabe continua tabela', () => {
    celular = true;
    forjarLarguras(360, 390);
    montar();
    const caixa = screen.getByRole('table').parentElement as HTMLElement;
    expect(caixa.className).not.toContain('tabela-empilhada');
    expect(screen.getByText('FUNDAÇÃO ESTADUAL').hasAttribute('data-rotulo')).toBe(false);
  });

  it('no desktop nada muda, mesmo com a tabela mais larga que a caixa — ela rola', () => {
    celular = false;
    forjarLarguras(1200, 900);
    montar();
    const caixa = screen.getByRole('table').parentElement as HTMLElement;
    expect(caixa.className).not.toContain('tabela-empilhada');
    expect(caixa.className).toContain('overflow-auto');
    expect(caixa.className).not.toContain('contain-text');
  });
});
