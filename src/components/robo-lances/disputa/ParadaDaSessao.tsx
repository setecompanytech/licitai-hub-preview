import { useId } from 'react';
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
import { AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { horaDeBrasilia } from '@/components/workspace/robo/formatos';
import { cn } from '@/lib/utils';
import type { LeituraDaParada, ParadaDaSessao } from './useParadaDaSessao';

/**
 * As três peças de "parar o robô nesta disputa": o botão, a confirmação e o
 * que a tela diz depois. Ver `useParadaDaSessao` para os dois tempos da parada.
 *
 * Eram parte de `workspace/robo/ControleDoRobo.tsx`; a pasta do processo e o
 * cabeçalho da página da disputa usam as mesmas.
 */

/** O botão — desabilitado, com o motivo à vista, para quem só acompanha. */
export function BotaoDePararRobo({ parada, className }: { parada: ParadaDaSessao; className?: string }) {
  const idMotivo = useId();
  return (
    <div className={cn('flex flex-col items-stretch gap-1 sm:items-end', className)}>
      <Button
        type="button"
        variant="outline"
        className="g-controle border-destructive-line text-destructive-ink hover:border-destructive-line hover:bg-destructive-tint hover:text-destructive-ink"
        disabled={!parada.podeOperar || parada.parando}
        aria-describedby={!parada.podeOperar ? idMotivo : undefined}
        onClick={() => parada.definirConfirmando(true)}
      >
        {parada.parando ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Square aria-hidden="true" className="h-4 w-4" />
        )}
        Parar robô nesta disputa
      </Button>
      {!parada.podeOperar && (
        <p id={idMotivo} className="g-meta max-w-xs text-muted-foreground sm:text-right">
          Seu papel nesta empresa é de acompanhamento — parar o robô exige operador ou administrador.
        </p>
      )}
    </div>
  );
}

/** A confirmação — diz, antes do clique final, o que parar NÃO desfaz. */
export function DialogoDeParada({ parada }: { parada: ParadaDaSessao }) {
  return (
    <AlertDialog open={parada.confirmando} onOpenChange={(aberto) => !parada.parando && parada.definirConfirmando(aberto)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Parar o robô nesta disputa?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>
                O pedido vai ao serviço de execução, que precisa confirmar o encerramento. Até a confirmação, a
                tela mostra “aguardando confirmação”.
              </p>
              <p className="font-medium text-foreground">
                Parar o robô não cancela lances já aceitos pelo portal — eles continuam valendo na disputa.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={parada.parando}>Voltar sem parar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void parada.confirmarParada()}
            disabled={parada.parando || !parada.podeOperar}
          >
            {parada.parando && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            Confirmar parada
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** O que aconteceu com a parada. Não desenha nada quando não há o que dizer. */
export function SituacaoDaParada({ leitura, parada }: { leitura: LeituraDaParada; parada: ParadaDaSessao }) {
  const { estado, confirmadaEm, solicitadaEm, pedidoDaSessao } = leitura;
  const confirmadaComHora = estado === 'parado' && !!confirmadaEm;
  const confirmadaSemHora = estado === 'parado' && !confirmadaEm && pedidoDaSessao?.estado === 'confirmada';
  const solicitada = estado === 'parada_solicitada';
  const falhou = pedidoDaSessao?.estado === 'falhou' && estado !== 'parado';

  if (!confirmadaComHora && !confirmadaSemHora && !solicitada && !falhou) return null;

  return (
    <>
      {confirmadaComHora && (
        <p role="status" className="g-corpo inline-flex items-center gap-1.5 text-success-ink">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Parada confirmada às {horaDeBrasilia(confirmadaEm)} • horário de Brasília
        </p>
      )}
      {confirmadaSemHora && (
        <p role="status" className="g-corpo inline-flex items-center gap-1.5 text-success-ink">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Parada confirmada pelo serviço
        </p>
      )}
      {solicitada && (
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
      {falhou && (
        <AvisoDeFalha
          aoTentarNovamente={parada.podeOperar ? () => parada.definirConfirmando(true) : undefined}
          rotulo="Pedir parada de novo"
        >
          O pedido de parada não foi aceito — o robô pode continuar operando. {pedidoDaSessao?.motivo}
        </AvisoDeFalha>
      )}
    </>
  );
}
