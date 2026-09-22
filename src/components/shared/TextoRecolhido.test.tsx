import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextoRecolhido from './TextoRecolhido';

describe('TextoRecolhido — o texto longo dobra, não corta', () => {
  it('texto curto sai inteiro, sem botão; vazio vira travessão', () => {
    render(<TextoRecolhido texto="CARNE BOVINA MOÍDA" />);
    expect(screen.getByText('CARNE BOVINA MOÍDA')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    render(<TextoRecolhido texto="   " />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('texto longo vem recolhido com o inteiro no title, e "ver mais" abre', () => {
    const longo = 'A'.repeat(80) + ' ' + 'B'.repeat(80);
    render(<TextoRecolhido texto={longo} />);
    const botao = screen.getByRole('button', { name: 'ver mais' });
    expect(screen.getByTitle(longo)).toHaveClass('line-clamp-2');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'ver menos' })).toBeInTheDocument();
    expect(screen.queryByTitle(longo)).toBeNull();
  });
});
