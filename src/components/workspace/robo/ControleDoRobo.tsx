import { Clock } from 'lucide-react';
import SeloSituacao, { type TomSituacao } from '@/components/gestao/SeloSituacao';
import ListaDeCampos, { type Campo } from '@/components/gestao/ListaDeCampos';
import type { LanceConfirmado, ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { nomeDoPortal } from '@/lib/robo/portais';
import { ROTULO_DO_ESTADO_DO_ROBO, resumirErroParaCliente, type EstadoDoRobo } from '@/lib/robo/situacao-da-participacao';
import { BotaoDePararRobo, DialogoDeParada, SituacaoDaParada } from '@/components/robo-lances/disputa/ParadaDaSessao';
import { lerParada, useParadaDaSessao, type ParadaDaSessao } from '@/components/robo-lances/disputa/useParadaDaSessao';
import { NaoInformado } from './ValoresDoItem';
import { formatarMoeda, horaDeBrasilia } from './formatos';

/**
 * O robô nesta disputa — o bloco que fica SEMPRE à vista quando há sessão.
 *
 * Modo efetivo, estado, hora do último sinal, últimos lances confirmados,
 * limites e o botão de parar. Nada disso fica atrás de um clique porque é o
 * que alguém precisa ver de relance durante a sessão: se o robô está vivo, se
 * o sinal é de agora e como pará-lo.
 *
 * ── Dois lugares, uma parada ────────────────────────────────────────────────
 *
 * Mora na pasta do processo e na aba Acompanhamento da página da disputa
 * (`/robo-lances/disputa/:id`). Na página da disputa o botão de parar é a ação
 * principal do CABEÇALHO; ali este bloco recebe o pedido de parada de quem o
 * monta (`parada`) e esconde botão, confirmação e avisos
 * (`controlesDeParada={false}`) — dois botões de parar na mesma tela seriam
 * dois lugares para conferir se o pedido saiu. A lógica do pedido e dos dois
 * tempos da parada mora em `robo-lances/disputa/useParadaDaSessao.ts`.
 *
 * Nada aqui roda sozinho. Montar, desmontar, trocar de participação ou de
 * empresa não envia comando algum — só o clique confirmado no diálogo.
 */

const TOM_DO_ESTADO: Record<EstadoDoRobo, TomSituacao> = {
  sem_sessao: 'neutro',
  simulacao: 'neutro',
  enviando: 'ativo',
  operando: 'ativo',
  sinal_desatualizado: 'atencao',
  parada_solicitada: 'atencao',
  parado: 'neutro',
  erro: 'critico',
  desconhecido: 'indisponivel',
};

/** O que o robô FAZ de fato — não o que a configuração pediu. */
function modoEfetivo({ sessao, disputa, projecao }: ParticipacaoCarregada): string {
  if (sessao?.modo === 'simulacao') return 'Simulação — não envia ao portal';
  if (!projecao.lanceLiberadoNoPortal) return 'Somente monitoramento — envio indisponível';
  if (disputa.modo_automatico === true) return 'Real, com lances automáticos';
  if (disputa.modo_automatico === false) return 'Real, sem lances automáticos';
  return 'Real — automação não informada';
}

function descreverLance(lance: LanceConfirmado | null, vazio: string) {
  if (!lance) return <NaoInformado texto={vazio} />;
  const hora = horaDeBrasilia(lance.timestamp_lance);
  return (
    <span className="inline-flex flex-col items-end">
      <span className="tabular-nums">{formatarMoeda(lance.valor) ?? '—'}</span>
      {hora && <span className="g-meta font-normal text-muted-foreground">às {hora} • horário de Brasília</span>}
    </span>
  );
}

interface ControleDoRoboProps {
  participacao: ParticipacaoCarregada;
  recarregar: () => Promise<void>;
  /** Pedido de parada de quem monta o bloco. Ausente: o bloco cuida do próprio. */
  parada?: ParadaDaSessao;
  /** `false`: botão, confirmação e avisos da parada moram em outro lugar da tela. */
  controlesDeParada?: boolean;
}

export default function ControleDoRobo({
  participacao,
  recarregar,
  parada: paradaDeFora,
  controlesDeParada = true,
}: ControleDoRoboProps) {
  // Chamado sempre, antes de qualquer retorno — hook não pode ser condicional.
  const paradaPropria = useParadaDaSessao(participacao.sessao?.id ?? null, recarregar);
  const parada = paradaDeFora ?? paradaPropria;

  const { sessao, disputa, projecao, ultimoLanceProprio, melhorLanceInformado } = participacao;

  if (!sessao) {
    return (
      <section aria-label="Robô nesta disputa" className="g-cartao flex flex-col gap-1 p-4">
        <h3 className="g-titulo-secao text-foreground">Robô nesta disputa</h3>
        <p className="g-corpo text-muted-foreground">
          {ROTULO_DO_ESTADO_DO_ROBO.sem_sessao} — não há sessão aberta para esta participação. A sessão começa
          sozinha no horário agendado na disputa do robô de lances, ou por Ações › “Entrar agora”; abrir esta tela não inicia nada.
        </p>
      </section>
    );
  }

  const leitura = lerParada(sessao, projecao.estadoDoRobo, parada.pedido);
  const { estado } = leitura;
  const horaDoSinal = horaDeBrasilia(sessao.updated_at);
  const portal = sessao.portal_nome || disputa.portal;

  const campos: Campo[] = [
    { rotulo: 'Modo efetivo', valor: modoEfetivo(participacao) },
    {
      rotulo: 'Estado do robô',
      valor: <SeloSituacao tom={TOM_DO_ESTADO[estado]}>{ROTULO_DO_ESTADO_DO_ROBO[estado]}</SeloSituacao>,
    },
    { rotulo: 'Portal', valor: portal ? nomeDoPortal(portal) : <NaoInformado texto="Portal não informado" /> },
    {
      rotulo: 'Último sinal',
      valor: (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span>
            {horaDoSinal
              ? `Atualização recebida às ${horaDoSinal} • horário de Brasília`
              : 'Sem horário de atualização registrado'}
          </span>
          {projecao.estadoDoRobo === 'sinal_desatualizado' && (
            <span className="g-meta inline-flex items-center gap-1 font-normal text-warning-ink">
              <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Sem atualização recente
            </span>
          )}
        </span>
      ),
    },
    { rotulo: 'Seu último lance confirmado', valor: descreverLance(ultimoLanceProprio, 'Nenhum lance próprio registrado') },
    { rotulo: 'Menor lance lido na sala', valor: descreverLance(melhorLanceInformado, 'Não informado') },
    {
      rotulo: 'Limites',
      valor: (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span>
            {projecao.itensSemLimite === 0
              ? 'Todos os itens com limite'
              : `${projecao.itensSemLimite} ${projecao.itensSemLimite === 1 ? 'item sem limite' : 'itens sem limite'}`}
          </span>
          <span className="g-meta font-normal text-muted-foreground">
            {disputa.limites_confirmados_em
              ? `Confirmados pelo serviço às ${horaDeBrasilia(disputa.limites_confirmados_em)} • horário de Brasília`
              : 'Não confirmados pelo serviço'}
          </span>
        </span>
      ),
    },
  ];
  if (estado === 'erro' && sessao.erro) {
    // Frase do cliente, nunca o erro cru do agente — o texto completo fica no
    // Admin Praefectus › Robô de Lances.
    const erroDoCliente = resumirErroParaCliente(sessao.erro);
    campos.push({ rotulo: 'O que aconteceu', valor: `${erroDoCliente.texto} ${erroDoCliente.acao}.`, largo: true });
  }

  return (
    <section aria-label="Robô nesta disputa" className="g-cartao flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="g-titulo-secao text-foreground">Robô nesta disputa</h3>
        {controlesDeParada && leitura.podeParar && <BotaoDePararRobo parada={parada} />}
      </div>

      <ListaDeCampos campos={campos} />

      {controlesDeParada && <SituacaoDaParada leitura={leitura} parada={parada} />}
      {controlesDeParada && <DialogoDeParada parada={parada} />}
    </section>
  );
}
