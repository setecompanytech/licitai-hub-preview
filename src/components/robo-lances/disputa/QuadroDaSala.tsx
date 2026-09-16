import type { SessaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { dataHoraDeBrasilia } from '@/components/workspace/robo/formatos';
import { resumoDoQuadro, type EstadoNoQuadro } from '@/lib/robo/quadro-da-sala';

const STATUS_DE_SESSAO_VIVA = ['ativo', 'enviando', 'pausado'];

/**
 * Quadro de status no topo da aba Acompanhamento (D13, 16/09/2026).
 *
 * Uma linha com onde a empresa está no item que o robô acompanha, e outra com
 * o que o robô está fazendo — lidas de `sessoes_lance_real.estado_sala`, que o
 * robô atualiza a cada mudança ou a cada 30 s. É o que dispensa abrir a tela
 * remota para saber como a disputa vai; a tela remota continua existindo para
 * auditoria e captcha.
 *
 * A página relê a sessão a cada 15 s (`useDisputaDoRobo`), então o quadro
 * acompanha sem botão de atualizar.
 */
export default function QuadroDaSala({ sessao }: { sessao: SessaoCarregada | null }) {
  if (!sessao) return null;
  const bruto = sessao as SessaoCarregada & {
    estado_sala?: EstadoNoQuadro | null;
    estado_sala_em?: string | null;
    status?: string | null;
  };
  const viva = STATUS_DE_SESSAO_VIVA.includes(String(bruto.status));

  if (!bruto.estado_sala) {
    if (!viva) return null;
    return (
      <section aria-label="Situação da sala" className="g-cartao flex flex-col gap-1 p-4">
        <h3 className="g-titulo-secao text-foreground">Robô na sala</h3>
        <p className="g-corpo text-muted-foreground">O robô ainda não enviou o que está vendo na sala.</p>
      </section>
    );
  }

  const resumo = resumoDoQuadro(bruto.estado_sala, { estadoEm: bruto.estado_sala_em, sessaoViva: viva });
  const quando = dataHoraDeBrasilia(bruto.estado_sala_em, { segundos: true });

  return (
    <section aria-label="Situação da sala" className="g-cartao flex flex-col gap-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="g-titulo-secao text-foreground">{viva ? 'Robô na sala' : 'Última leitura da sala'}</h3>
        {quando && <span className="g-meta text-muted-foreground">atualizado {quando} • Brasília</span>}
      </div>
      {resumo.partes.length > 0 && <p className="g-corpo text-foreground tabular-nums">{resumo.partes.join(' · ')}</p>}
      {resumo.motivo && <p className="g-corpo text-muted-foreground">{resumo.motivo}</p>}
      {resumo.aviso && <p className="g-meta text-warning-ink">{resumo.aviso}</p>}
    </section>
  );
}
