import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trophy, XCircle, Archive } from 'lucide-react';

/**
 * Arquivar pergunta o desfecho — quando ainda não há um registrado.
 *
 * Arquivar era a única forma de encerrar um processo sem dizer o que aconteceu.
 * Pelo Kanban, mover para "Perdida" exige motivo em três camadas (diálogo,
 * NOT NULL e gatilho); por Compromissos, o mesmo encerramento saía sem
 * pergunta nenhuma. Depois de arquivado, um certame ganho e um perdido na
 * habilitação ficavam indistinguíveis — e é justamente essa diferença que
 * alimenta metas, bonificação e a leitura de por que se perde.
 *
 * "Não participamos" continua sendo saída legítima e sem justificativa: forçar
 * motivo onde não houve disputa faria a pessoa inventar um, e dado inventado é
 * pior que dado ausente.
 */

export type DesfechoArquivamento = 'vencida' | 'perdida' | 'sem_disputa';

type Props = {
  aberto: boolean;
  numero: string | null;
  objeto: string | null;
  onFechar: () => void;
  onEscolher: (desfecho: DesfechoArquivamento) => void;
};

export default function ArquivarProcessoDialog({
  aberto, numero, objeto, onFechar, onEscolher,
}: Props) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AlertDialogContent className="sm:max-w-[520px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Como este processo terminou?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {numero ? `${numero} — ` : ''}{objeto || 'Processo'}
              </p>
              <p>
                O desfecho fica registrado no processo e é o que permite saber
                depois quanto do que foi disputado virou contrato.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-left"
            onClick={() => onEscolher('vencida')}
          >
            <Trophy className="w-4 h-4 mr-3 text-success shrink-0" />
            <span>
              <span className="font-medium block">Vencemos</span>
              <span className="text-xs text-muted-foreground">
                Marca como Vencida e arquiva. O contrato pode ser cadastrado depois.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-left"
            onClick={() => onEscolher('perdida')}
          >
            <XCircle className="w-4 h-4 mr-3 text-destructive shrink-0" />
            <span>
              <span className="font-medium block">Não vencemos</span>
              <span className="text-xs text-muted-foreground">
                Pede o motivo — é o que alimenta a análise do comercial.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3 text-left"
            onClick={() => onEscolher('sem_disputa')}
          >
            <Archive className="w-4 h-4 mr-3 text-muted-foreground shrink-0" />
            <span>
              <span className="font-medium block">Não participamos</span>
              <span className="text-xs text-muted-foreground">
                Só sai da mesa. Sem desfecho a registrar.
              </span>
            </span>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
