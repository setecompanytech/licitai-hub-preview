import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalaAoVivo from '@/components/robo-lances/disputa/SalaAoVivo';
import type { SessaoCarregada } from '@/hooks/useParticipacoesDoRobo';

/**
 * A sala ao vivo dentro do Praefectus (02/10/2026).
 *
 * A diretriz: a pessoa não pode precisar do VNC para acompanhar a disputa. O
 * que estes testes guardam é que a tabela diga a verdade — sobretudo sobre o
 * cronômetro, que é estimado e precisa se declarar quando a leitura envelhece.
 */
const LIDO = '2026-10-02T12:00:00.000Z';

/** Dois itens do 37/2026, com os números reais dos prints de 01/10. */
const sessaoCom = (estado: Record<string, unknown>, lidoEm = LIDO, status = 'ativo') =>
  ({
    id: 's1',
    status,
    estado_sala: estado,
    estado_sala_em: lidoEm,
  } as unknown as SessaoCarregada);

const DOIS_ITENS = {
  por_item: {
    '1': {
      item: 1, fase: 'aberta', sou_lider: true, melhor_lance: 593.96, nosso_lance: 593.96,
      segundos_restantes: 600, decisao: { motivo_legivel: 'Já estamos em primeiro' },
    },
    '2': {
      item: 2, fase: 'aberta', sou_lider: false, melhor_lance: 493.9, nosso_lance: 1034.18,
      segundos_restantes: 20, posicao: 6, ja_lancaram: 6,
      decisao: { motivo_legivel: 'Lance de R$ 493,80 decidido' },
    },
  },
};

describe('SalaAoVivo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(LIDO));
  });
  afterEach(() => vi.useRealTimers());

  it('sem sessão, não renderiza nada', () => {
    const { container } = render(<SalaAoVivo sessao={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sem leitura da sala, não renderiza nada', () => {
    const { container } = render(<SalaAoVivo sessao={sessaoCom(null as never)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra um item por linha, com valores e o que o robô está fazendo', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS)} />);
    expect(screen.getByText('Lance de R$ 493,80 decidido')).toBeInTheDocument();
    expect(screen.getByText('Já estamos em primeiro')).toBeInTheDocument();
    expect(screen.getByText('6º lugar')).toBeInTheDocument();
    expect(screen.getByText('6 concorrentes lançaram')).toBeInTheDocument();
  });

  it('ORDENA por urgência: perdendo com o relógio acabando vem primeiro', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS)} />);
    const linhas = screen.getAllByRole('row').slice(1); // fora o cabeçalho
    expect(within(linhas[0]).getByText('2')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('1')).toBeInTheDocument();
  });

  it('o cronômetro DESCE com o tempo', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS)} />);
    expect(screen.getByText('00:20')).toBeInTheDocument();
    // act() porque o tique do relógio é um setState: sem ele, o timer avança e
    // o React não repinta.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('00:15')).toBeInTheDocument();
  });

  it('cada item tem o SEU cronômetro', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS)} />);
    expect(screen.getByText('00:20')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('leitura velha avisa que o tempo NÃO é de agora', () => {
    vi.setSystemTime(new Date(new Date(LIDO).getTime() + 300_000));
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS)} />);
    expect(screen.getByText(/não lê a sala há mais de 2 minutos/i)).toBeInTheDocument();
    // e não desconta: mostra o que foi lido
    expect(screen.getByText('00:20')).toBeInTheDocument();
  });

  it('sessão encerrada diz que a leitura é a última', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS, LIDO, 'encerrado')} />);
    expect(screen.getByRole('heading', { name: /A sala na última leitura/i })).toBeInTheDocument();
    expect(screen.getByText(/Sessão encerrada/i)).toBeInTheDocument();
  });

  it('sessão pausada aparece marcada', () => {
    render(<SalaAoVivo sessao={sessaoCom(DOIS_ITENS, LIDO, 'pausado')} />);
    expect(screen.getByText(/Robô pausado nesta disputa/i)).toBeInTheDocument();
  });

  it('item sem cronômetro mostra travessão, e não 00:00', () => {
    const semTempo = { por_item: { '1': { item: 1, fase: 'aguardando', segundos_restantes: null } } };
    render(<SalaAoVivo sessao={sessaoCom(semTempo)} />);
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
  });

  it('com empate, mostra a faixa em vez de inventar posição', () => {
    const empate = {
      por_item: { '1': { item: 1, fase: 'aberta', sou_lider: false, posicao: null, posicao_de: 4, posicao_ate: 7, empatados: 4 } },
    };
    render(<SalaAoVivo sessao={sessaoCom(empate)} />);
    expect(screen.getByText('Entre 4º e 7º (4 empatados)')).toBeInTheDocument();
  });
});
