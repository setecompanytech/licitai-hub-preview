import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ListaDeCampos from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import KillSwitchButton, { type ResultadoDoFreio } from '@/components/robo-lances/KillSwitchButton';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { DesfechoDoRobo, SessaoViva } from '@/components/robo-lances/usePedidosDoRobo';
import type { ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import ControleDoRobo from '@/components/workspace/robo/ControleDoRobo';
import { dataHoraDeBrasilia } from '@/components/workspace/robo/formatos';
import EventosDaDisputa, { type AbaDosEventos } from './EventosDaDisputa';
import type { ParadaDaSessao } from './useParadaDaSessao';

/**
 * Aba "Acompanhamento" — o que está acontecendo agora, e o que já aconteceu.
 *
 *   Robô nesta disputa — estado, último sinal em Brasília, portal, lances e
 *                        limites (`ControleDoRobo`, o mesmo bloco da pasta do
 *                        processo). O erro da sessão aparece em linguagem de
 *                        cliente (`resumirErroParaCliente`), nunca o texto do agente.
 *   Parada emergencial — só com sessão de pé; vale para TODAS as sessões.
 *   Pedidos do robô    — os desfechos dos pedidos a uma pessoa, desta disputa.
 *   Eventos            — mural e operações, com a largura inteira.
 *
 * O botão "Parar robô nesta disputa" NÃO está aqui: é a ação principal do
 * cabeçalho, e o bloco do robô recebe o mesmo pedido de parada para mostrar o
 * estado certo — dois botões de parar seriam dois lugares para conferir se o
 * pedido saiu.
 */
export default function AcompanhamentoDaDisputa({
  lance,
  participacao,
  situacaoPendente,
  erroDaSituacao,
  recarregar,
  parada,
  sessaoViva,
  desfechos,
  paradaEmergencial,
  aoParadaEmergencial,
  abaDosEventos,
  aoMudarAbaDosEventos,
  gatilhoDosEventos,
}: {
  lance: LanceConfig;
  participacao: ParticipacaoCarregada | null;
  situacaoPendente: boolean;
  erroDaSituacao: string | null;
  recarregar: () => Promise<void>;
  parada: ParadaDaSessao;
  sessaoViva: SessaoViva | null;
  desfechos: DesfechoDoRobo[];
  paradaEmergencial: boolean;
  aoParadaEmergencial: (resultado?: ResultadoDoFreio) => void;
  abaDosEventos: AbaDosEventos;
  aoMudarAbaDosEventos: (aba: AbaDosEventos) => void;
  gatilhoDosEventos: number;
}) {
  const sessoesDestaDisputa = new Set([participacao?.sessao?.id, sessaoViva?.sessao_id].filter(Boolean));
  const desfechosDestaDisputa = desfechos.filter((d) => sessoesDestaDisputa.has(d.sessao_id));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {participacao ? (
        <ControleDoRobo participacao={participacao} recarregar={recarregar} parada={parada} controlesDeParada={false} />
      ) : erroDaSituacao ? (
        <AvisoDeFalha aoTentarNovamente={() => void recarregar()}>
          Não foi possível ler a situação do robô nesta disputa: {erroDaSituacao}
        </AvisoDeFalha>
      ) : situacaoPendente ? (
        <div role="status" aria-busy="true" className="g-cartao flex flex-col gap-2 p-4">
          <span className="sr-only">Consultando a situação do robô nesta disputa…</span>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <section className="g-cartao flex flex-col items-start gap-2 p-4">
          <h3 className="g-titulo-secao text-foreground">Robô nesta disputa</h3>
          <p className="g-corpo text-muted-foreground">
            A situação do robô nesta disputa não foi lida. Ler de novo não inicia nem para nada.
          </p>
          <Button type="button" variant="outline" className="g-controle" onClick={() => void recarregar()}>
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Ler de novo
          </Button>
        </section>
      )}

      {/* O freio aparece só com sessão de pé: botão vermelho sem nada para
          parar treina a pessoa a ignorá-lo. */}
      {sessaoViva && (
        <section className="g-cartao flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="g-corpo min-w-0 text-muted-foreground">
            Para interromper <span className="font-medium text-foreground">todas</span> as sessões do robô que você
            opera — não só esta —, use a parada emergencial.
          </p>
          <KillSwitchButton
            sessaoId={sessaoViva.sessao_id}
            licitacaoId={lance.licitacaoId}
            onParada={aoParadaEmergencial}
            disabled={paradaEmergencial}
          />
        </section>
      )}

      {desfechosDestaDisputa.length > 0 && (
        <section className="g-cartao flex flex-col gap-2 p-4">
          <h3 className="g-titulo-secao text-foreground">Pedidos do robô a uma pessoa</h3>
          <ListaDeCampos
            campos={desfechosDestaDisputa.slice(0, 4).map((d) => ({
              rotulo: `${dataHoraDeBrasilia(d.em) ?? 'Horário não informado'} • Brasília`,
              valor: (
                <SeloSituacao tom={d.desfecho === 'atendido' ? 'sucesso' : 'atencao'}>
                  {d.tipo} · {d.desfecho}
                </SeloSituacao>
              ),
            }))}
          />
        </section>
      )}

      <EventosDaDisputa
        lance={lance}
        aba={abaDosEventos}
        aoMudarAba={aoMudarAbaDosEventos}
        gatilho={gatilhoDosEventos}
      />
    </div>
  );
}
