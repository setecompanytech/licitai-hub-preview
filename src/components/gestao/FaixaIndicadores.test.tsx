import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FaixaIndicadores from './FaixaIndicadores';
import { estiloDoValor } from './estilo-do-valor';

/**
 * O valor do KPI cabe no cartão (22/09): "R$ 22.581.888,00" virava
 * "R$ 22.581.888…" com cinco cartões na tela de Gestão de Contratos. O
 * componente entrega ao CSS o número de caracteres (`--chars`), e a regra
 * `.valor-kpi` (index.css) encolhe a fonte até o número caber. Aqui se
 * prende o contrato entre os dois: a contagem existe, está certa e só
 * existe para valor de texto.
 */
describe('FaixaIndicadores — o valor cabe no cartão', () => {
  it('valor de texto ou número leva o próprio tamanho em --chars', () => {
    render(
      <FaixaIndicadores
        itens={[
          { rotulo: 'Valor total', valor: 'R$ 22.581.888,00' },
          { rotulo: 'Contratos', valor: 2 },
        ]}
      />,
    );
    const dinheiro = screen.getByText('R$ 22.581.888,00');
    expect(dinheiro.className).toContain('valor-kpi');
    expect(dinheiro.getAttribute('style')).toContain('--chars: 16');
    expect(screen.getByText('2').getAttribute('style')).toContain('--chars: 1');
  });

  it('valor que não é texto, vazio ou ausente não ganha contagem', () => {
    expect(estiloDoValor(<span>x</span>)).toBeUndefined();
    expect(estiloDoValor('')).toBeUndefined();
    expect(estiloDoValor('   ')).toBeUndefined();
    render(<FaixaIndicadores itens={[{ rotulo: 'Saldo', valor: null, razaoIndisponivel: 'Saldo ainda não apurado' }]} />);
    // Ausente continua "—" com a razão, nunca zero.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Saldo ainda não apurado')).toBeInTheDocument();
  });
});
