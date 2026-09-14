import { useId, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SeloSituacao, { AvisoDeFalha, type TomSituacao } from '@/components/gestao/SeloSituacao';
import ListaDeCampos, { type Campo } from '@/components/gestao/ListaDeCampos';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import type { LanceConfirmado, ParticipacaoCarregada } from '@/hooks/useParticipacoesDoRobo';
import { solicitarParada, type ResultadoDaParada } from '@/lib/robo/comandos';
import { ROTULO_DO_ESTADO_DO_ROBO, type EstadoDoRobo } from '@/lib/robo/situacao-da-participacao';
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
 * ── Parar tem dois tempos ───────────────────────────────────────────────────
 *
 * A PraeFectus pede; o agente encerra. `solicitarParada` só devolve
 * `confirmada` com evidência do agente — e a tela segue a mesma disciplina:
 * pedido sem confirmação é "Parada solicitada — aguardando confirmação",
 * nunca "Parado". O pedido local sobrepõe a leitura do banco de propósito:
 * antes da migration de 14/09, parar gravava `encerrado` ANTES de o agente
 * responder, e a projeção leria isso como "parado".
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
}

export default function ControleDoRobo({ participacao, recarregar }: ControleDoRoboProps) {
  const { podeOperar } = usePapelEmpresa();
  const idMotivo = useId();
  const [confirmando, setConfirmando] = useState(false);
  const [parando, setParando] = useState(false);
  const [pedido, setPedido] = useState<ResultadoDaParada | null>(null);

  const { sessao, disputa, projecao, ultimoLanceProprio, melhorLanceInformado } = participacao;

  if (!sessao) {
    return (
      <section aria-label="Robô nesta disputa" className="g-cartao flex flex-col gap-1 p-4">
        <h3 className="g-titulo-secao text-foreground">Robô nesta disputa</h3>
        <p className="g-corpo text-muted-foreground">
          {ROTULO_DO_ESTADO_DO_ROBO.sem_sessao} — não há sessão aberta para esta participação. A sessão é
          iniciada no Robô de Lances; esta aba não inicia nada sozinha.
        </p>
      </section>
    );
  }

  // O pedido é da sessão em que foi feito: trocar de participação não carrega
  // o "aguardando confirmação" de uma para a outra.
  const pedidoDaSessao = pedido?.sessaoId === sessao.id ? pedido : null;

  let estado: EstadoDoRobo = projecao.estadoDoRobo;
  if (sessao.parada_confirmada_em || pedidoDaSessao?.estado === 'confirmada') estado = 'parado';
  else if (pedidoDaSessao?.estado === 'solicitada') estado = 'parada_solicitada';

  const podeParar = estado !== 'parado' && estado !== 'sem_sessao';
  const horaDoSinal = horaDeBrasilia(sessao.updated_at);
  const confirmadaEm = sessao.parada_confirmada_em ?? pedidoDaSessao?.confirmadaEm ?? null;
  const solicitadaEm = sessao.parada_solicitada_em ?? pedidoDaSessao?.solicitadaEm ?? null;

  const confirmarParada = async () => {
    if (!podeOperar) return;
    setParando(true);
    try {
      setPedido(await solicitarParada(sessao.id));
    } finally {
      setParando(false);
      setConfirmando(false);
    }
    // Relê mesmo quando falhou: a verdade do banco pode ter mudado no meio.
    await recarregar();
  };

  const campos: Campo[] = [
    { rotulo: 'Modo efetivo', valor: modoEfetivo(participacao) },
    {
      rotulo: 'Estado do robô',
      valor: <SeloSituacao tom={TOM_DO_ESTADO[estado]}>{ROTULO_DO_ESTADO_DO_ROBO[estado]}</SeloSituacao>,
    },
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
    campos.push({ rotulo: 'Erro informado pelo serviço', valor: sessao.erro, largo: true });
  }

  return (
    <section aria-label="Robô nesta disputa" className="g-cartao flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="g-titulo-secao text-foreground">Robô nesta disputa</h3>
        {podeParar && (
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button
              type="button"
              variant="outline"
              className="g-controle border-destructive-line text-destructive-ink hover:border-destructive-line hover:bg-destructive-tint hover:text-destructive-ink"
              disabled={!podeOperar || parando}
              aria-describedby={!podeOperar ? idMotivo : undefined}
              onClick={() => setConfirmando(true)}
            >
              {parando ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Square aria-hidden="true" className="h-4 w-4" />
              )}
              Parar robô nesta disputa
            </Button>
            {!podeOperar && (
              <p id={idMotivo} className="g-meta max-w-xs text-muted-foreground sm:text-right">
                Seu papel nesta empresa é de acompanhamento — parar o robô exige operador ou administrador.
              </p>
            )}
          </div>
        )}
      </div>

      <ListaDeCampos campos={campos} />

      {estado === 'parado' && confirmadaEm && (
        <p role="status" className="g-corpo inline-flex items-center gap-1.5 text-success-ink">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Parada confirmada às {horaDeBrasilia(confirmadaEm)} • horário de Brasília
        </p>
      )}
      {estado === 'parado' && !confirmadaEm && pedidoDaSessao?.estado === 'confirmada' && (
        <p role="status" className="g-corpo inline-flex items-center gap-1.5 text-success-ink">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Parada confirmada pelo serviço
        </p>
      )}
      {estado === 'parada_solicitada' && (
        <p role="status" className="g-corpo inline-flex items-start gap-1.5 text-warning-ink">
          <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {solicitadaEm
              ? `Pedido registrado às ${horaDeBrasilia(solicitadaEm)} • horário de Brasília. `
              : 'Pedido enviado ao serviço. '}
            O encerramento só vale quando o agente confirmar.
            {pedidoDaSessao?.motivo ? ` ${pedidoDaSessao.motivo}` : ''}
          </span>
        </p>
      )}
      {pedidoDaSessao?.estado === 'falhou' && estado !== 'parado' && (
        <AvisoDeFalha aoTentarNovamente={podeOperar ? () => setConfirmando(true) : undefined} rotulo="Pedir parada de novo">
          O pedido de parada não foi aceito — o robô pode continuar operando. {pedidoDaSessao.motivo}
        </AvisoDeFalha>
      )}

      <AlertDialog open={confirmando} onOpenChange={(aberto) => !parando && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar o robô nesta disputa?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <p>
                  O pedido vai ao serviço de execução, que precisa confirmar o encerramento. Até a
                  confirmação, a tela mostra “aguardando confirmação”.
                </p>
                <p className="font-medium text-foreground">
                  Parar o robô não cancela lances já aceitos pelo portal — eles continuam valendo na disputa.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={parando}>Voltar sem parar</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmarParada} disabled={parando || !podeOperar}>
              {parando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Confirmar parada
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
