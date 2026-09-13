import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import TrilhaDoTopo from './TrilhaDoTopo';
import { ProvedorDeTrilha } from './contexto-trilha';

/**
 * Quando a trilha subiu para a faixa branca, `CabecalhoPagina` continuou
 * desenhando a dele dentro da página: toda tela interna passou a ter DUAS
 * trilhas, uma sobre a outra, dizendo a mesma coisa. É a navegação duplicada
 * que o comando de 13/09 proíbe, e ninguém percebe olhando um arquivo só — o
 * defeito nasce da soma de dois componentes que funcionam bem sozinhos.
 *
 * Estes casos são a soma.
 */
const montar = (ui: React.ReactNode, rota = '/gestao-contratos') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <ProvedorDeTrilha>
        <TrilhaDoTopo />
        {ui}
      </ProvedorDeTrilha>
    </MemoryRouter>,
  );

describe('trilha — uma por tela, na faixa', () => {
  it('existe UMA trilha quando a página também traz cabeçalho', () => {
    montar(<CabecalhoPagina />);
    expect(screen.getAllByLabelText('Trilha de navegação')).toHaveLength(1);
    expect(screen.queryByLabelText('Você está em')).toBeNull();
  });

  it('a faixa deriva da rota quando a página não declara nada', () => {
    montar(<CabecalhoPagina />);
    expect(screen.getByText('Gestão de Processos')).toBeTruthy();
  });

  it('a trilha declarada pela página vence a derivada da rota', () => {
    montar(
      <CabecalhoPagina
        titulo="ATA 022/2024"
        trilha={[
          { rotulo: 'Painel', para: '/dashboard' },
          { rotulo: 'Contratos', para: '/gestao-contratos' },
          { rotulo: 'ATA 022/2024' },
        ]}
      />,
    );
    // "Painel" é podado: a marca, dois centímetros à esquerda, já leva lá.
    expect(screen.queryByText('Painel')).toBeNull();
    expect(screen.getByText('ATA 022/2024', { selector: 'span[aria-current="page"]' })).toBeTruthy();
  });

  it('a faixa volta para a rota quando a página de detalhe sai de cena', () => {
    const { rerender } = montar(
      <CabecalhoPagina titulo="ATA 022/2024" trilha={[{ rotulo: 'ATA 022/2024' }]} />,
    );
    rerender(
      <MemoryRouter initialEntries={['/gestao-contratos']}>
        <ProvedorDeTrilha>
          <TrilhaDoTopo />
          <CabecalhoPagina />
        </ProvedorDeTrilha>
      </MemoryRouter>,
    );
    expect(screen.getByText('Gestão de Processos')).toBeTruthy();
  });
});
