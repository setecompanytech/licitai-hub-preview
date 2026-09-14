import type { ReactNode } from 'react';
import { Power, PowerOff } from 'lucide-react';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import SeloSituacao from '@/components/gestao/SeloSituacao';
import LigarDesligarRobo from './LigarDesligarRobo';
import SituacaoDoRoboEmLinha from './SituacaoDoRoboEmLinha';
import type { EstadoDoRoboDaEmpresa, LinhaDoRoboDaEmpresa } from './useRoboDaEmpresa';

/**
 * O topo da tela do robô, na versão do cliente.
 *
 * Responde, antes de qualquer clique, às duas perguntas que a empresa faz ao
 * abrir a tela: "o meu robô está ligado?" e "ele está disponível agora?". São
 * perguntas diferentes — o robô pode estar ligado pela empresa e indisponível
 * por um problema nosso —, e por isso vão em dois elementos: o selo diz o que a
 * EMPRESA escolheu; a linha ao lado diz o que o SERVIDOR respondeu.
 *
 * Continua sobre `CabecalhoPagina`, que registra a trilha da tela; o título é
 * passado aqui porque a tela do cliente e a da plataforma não se chamam igual.
 */
type Props = {
  empresaId: string | null | undefined;
  estado: EstadoDoRoboDaEmpresa;
  podeOperar: boolean;
  aoAlterarLigado: (linha: LinhaDoRoboDaEmpresa) => void;
  aoRelerLigado: () => void;
  /** O botão do modo de operação — montado na página, que decide o nível. */
  modo: ReactNode;
  /** Exportar e Nova sessão. */
  acoes: ReactNode;
};

export default function CabecalhoDoRobo({
  empresaId,
  estado,
  podeOperar,
  aoAlterarLigado,
  aoRelerLigado,
  modo,
  acoes,
}: Props) {
  const selo = estado.carregando ? (
    <SeloSituacao tom="indisponivel">Consultando o robô…</SeloSituacao>
  ) : !estado.confirmado ? (
    <SeloSituacao tom="indisponivel" explicacao="A leitura de ligado/desligado não respondeu.">
      Ligado ou desligado: não confirmado
    </SeloSituacao>
  ) : estado.ligado ? (
    <SeloSituacao
      tom="sucesso"
      icone={Power}
      explicacao={
        estado.migracaoPendente
          ? 'Considerado ligado: o controle de liga/desliga ainda não foi ativado no banco.'
          : 'O robô pode iniciar sessões para esta empresa.'
      }
    >
      Robô ligado
    </SeloSituacao>
  ) : (
    <SeloSituacao tom="neutro" icone={PowerOff} explicacao="Nenhuma sessão nova é iniciada enquanto o robô estiver desligado.">
      Robô desligado
    </SeloSituacao>
  );

  return (
    <CabecalhoPagina
      denso
      titulo="Robô de lances"
      descricao="Configure a proposta e os lances de cada disputa. O robô participa pelos portais com o acesso da sua empresa."
      acoes={acoes}
    >
      <div
        data-faixa="estado-do-robo"
        className="g-cartao flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {selo}
            {modo}
          </div>
          {/* A única linha que acompanha sozinha (60 s) — ver `useSituacaoDoRobo`. */}
          <SituacaoDoRoboEmLinha empresaId={empresaId} acompanhar />
          {!estado.ligado && estado.confirmado && estado.alteradoEm && (
            <p className="g-meta text-muted-foreground">
              Desligado em{' '}
              {new Date(estado.alteradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília)
              {estado.motivo ? ` — ${estado.motivo}` : ''}
            </p>
          )}
        </div>
        <LigarDesligarRobo
          empresaId={empresaId}
          estado={estado}
          podeOperar={podeOperar}
          aoAlterar={aoAlterarLigado}
          aoTentarLerDeNovo={aoRelerLigado}
        />
      </div>
    </CabecalhoPagina>
  );
}
