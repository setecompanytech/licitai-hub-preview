import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TextoExpansivel from './TextoExpansivel';

/**
 * O modo `texto` (17/09): o próprio texto é o botão. O que se trava é o
 * contrato de acessibilidade — botão de verdade, `aria-expanded`, dica — e que
 * texto curto não vira botão nenhum.
 */

const LONGO = 'Recurso orçamentário estadual disponível e devidamente vinculado à despesa que será realizada no exercício corrente. '.repeat(2);

describe('TextoExpansivel — modo texto', () => {
  it('texto longo vira botão fechado em duas linhas, com dica do que o clique faz', () => {
    render(<TextoExpansivel texto={LONGO} linhas={2} modo="texto" limiarPorLinha={40} />);

    const botao = screen.getByRole('button', { expanded: false });
    expect(botao).toHaveAttribute('title', 'Clique para ler o texto inteiro');
    // O clamp fica no span interno, não no botão.
    expect(botao.querySelector('span.line-clamp-2')).not.toBeNull();
    expect(botao).toHaveTextContent('clique para ler o texto inteiro');
  });

  it('clicar em cima abre o texto inteiro; clicar de novo recolhe', () => {
    render(<TextoExpansivel texto={LONGO} linhas={2} modo="texto" limiarPorLinha={40} />);
    const botao = screen.getByRole('button');

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(botao.querySelector('span.line-clamp-2')).toBeNull();
    expect(botao).toHaveAttribute('title', 'Clique para recolher');

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao.querySelector('span.line-clamp-2')).not.toBeNull();
  });

  it('texto curto não vira botão — é só o texto', () => {
    render(<TextoExpansivel texto="Sim" linhas={2} modo="texto" limiarPorLinha={40} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Sim')).toBeInTheDocument();
  });

  it('o modo padrão continua com o botão separado abaixo do texto', () => {
    render(<TextoExpansivel texto={LONGO} linhas={2} />);

    expect(screen.getByRole('button', { name: 'Ver descrição completa' })).toBeInTheDocument();
  });
});
