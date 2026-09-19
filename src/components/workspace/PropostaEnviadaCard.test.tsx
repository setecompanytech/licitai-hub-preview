import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * O cartão que registra o envio da proposta (19/09). O que se trava: o ato é
 * explícito e confirmado — o banco carimba `data_proposta_enviada` e as metas
 * contam participação a partir daí —, só existe no radar, e arquivado não vê
 * nada.
 */
const estado = vi.hoisted(() => ({ promoverFase: vi.fn() }));

vi.mock('@/hooks/useLicitacaoIntegration', () => ({
  useLicitacaoIntegration: () => ({ promoverFase: estado.promoverFase }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PropostaEnviadaCard from './PropostaEnviadaCard';

const montar = (over: Partial<Parameters<typeof PropostaEnviadaCard>[0]> = {}) =>
  render(
    <PropostaEnviadaCard
      licitacaoId="lic-1"
      status="Monitorando"
      arquivadoEm={null}
      dataPropostaEnviada={null}
      {...over}
    />,
  );

beforeEach(() => {
  estado.promoverFase.mockReset();
});

describe('PropostaEnviadaCard', () => {
  it('no radar, oferece registrar o envio e diz de onde para onde o processo vai', () => {
    montar();

    expect(screen.getByRole('button', { name: /Registrar proposta enviada/ })).toBeInTheDocument();
    expect(screen.getByText(/sai de Monitorando para Proposta Enviada/)).toBeInTheDocument();
  });

  it('registrar pede confirmação e só então promove; o prontuário é avisado do novo status', async () => {
    estado.promoverFase.mockResolvedValue({ promovido: true, de: 'Monitorando' });
    const aoRegistrar = vi.fn();
    montar({ aoRegistrar });

    fireEvent.click(screen.getByRole('button', { name: /Registrar proposta enviada/ }));
    expect(estado.promoverFase).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: /Sim, proposta enviada/ }));

    await waitFor(() =>
      expect(estado.promoverFase).toHaveBeenCalledWith('lic-1', 'Proposta Enviada', expect.any(String)),
    );
    await waitFor(() => expect(aoRegistrar).toHaveBeenCalledWith('Proposta Enviada', expect.any(String)));
  });

  it('"Ainda não" fecha sem promover', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Registrar proposta enviada/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ainda não/ }));

    expect(estado.promoverFase).not.toHaveBeenCalled();
  });

  it('já em jogo, mostra a data carimbada e não oferece registrar', () => {
    montar({ status: 'Em Disputa', dataPropostaEnviada: '2026-09-15T13:00:00.000Z' });

    expect(screen.queryByRole('button', { name: /Registrar proposta enviada/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Registrada em 15\/09\/2026/)).toBeInTheDocument();
  });

  it('arquivado não vê o cartão', () => {
    const { container } = montar({ arquivadoEm: '2026-09-01T12:00:00.000Z' });

    expect(container).toBeEmptyDOMElement();
  });
});
