import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TutorialDoRobo from './TutorialDoRobo';
import { PASSOS_DO_TUTORIAL, PORTAIS_NO_TUTORIAL } from '@/lib/robo/tutorial-do-robo';

/**
 * O "?" do Robô de lances (17/09/2026): discreto, com nome acessível, e o
 * tutorial em três abas — o que o robô faz, o passo a passo e um cartão por
 * portal, com o que cada portal tem de lance hoje.
 *
 * Radix troca de aba no `mouseDown` (não no `click`), por isso o evento abaixo.
 */
const abrirAba = (nome: string) => fireEvent.mouseDown(screen.getByRole('tab', { name: nome }), { button: 0 });

describe('TutorialDoRobo', () => {
  it('o "?" abre o tutorial em "Como funciona", com as estratégias de cada item', async () => {
    render(<TutorialDoRobo />);

    fireEvent.click(screen.getByRole('button', { name: 'Tutorial do robô de lances' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Como o robô de lances funciona' });
    expect(within(dialogo).getByRole('tab', { name: 'Como funciona', selected: true })).toBeInTheDocument();
    expect(within(dialogo).getByText('O robô entra sozinho')).toBeInTheDocument();
    expect(within(dialogo).getByText('Melhor preço')).toBeInTheDocument();
    expect(within(dialogo).getByText('Iminência')).toBeInTheDocument();
    expect(within(dialogo).getByText('Desempatar no 1º lugar')).toBeInTheDocument();
  });

  it('passo a passo: todos os passos, na ordem, cada um dizendo onde fica', async () => {
    render(<TutorialDoRobo />);
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial do robô de lances' }));
    await screen.findByRole('dialog');

    abrirAba('Passo a passo');

    const passos = await screen.findAllByText(/^Onde: /);
    expect(passos).toHaveLength(PASSOS_DO_TUTORIAL.length);
    expect(screen.getByText('Ligue o robô da empresa')).toBeInTheDocument();
    expect(screen.getByText('Marque a data e a hora da sessão')).toBeInTheDocument();
  });

  it('um cartão por portal: robô com login no Compras.gov e no Portal de Compras Públicas, API nos demais', async () => {
    render(<TutorialDoRobo />);
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial do robô de lances' }));
    await screen.findByRole('dialog');

    abrirAba('Portais');

    expect(await screen.findByRole('heading', { name: 'Compras.gov.br' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portal de Compras Públicas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Demais portais' })).toBeInTheDocument();
    expect(screen.getByText('Robô com login gov.br')).toBeInTheDocument();
    expect(screen.getByText('Robô com login')).toBeInTheDocument();
    expect(screen.getByText('Integração por API')).toBeInTheDocument();
    expect(screen.getByText('Lance automático liberado')).toBeInTheDocument();
    expect(screen.getByText(/Lance automático ainda não liberado/)).toBeInTheDocument();
  });

  it('só o Compras.gov aparece com lance liberado no texto', () => {
    // Quando outro portal ganhar lance, esta linha muda junto — de propósito.
    expect(PORTAIS_NO_TUTORIAL.filter((p) => p.lance.liberado).map((p) => p.id)).toEqual(['compras-gov']);
  });
});
