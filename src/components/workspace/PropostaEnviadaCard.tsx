import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { podePromover } from '@/lib/licitacao/promocao-de-fase';
import { faixaDe, rotuloStatus } from '@/lib/licitacao/status';

/**
 * A proposta foi enviada? — o ato que tira o processo do radar.
 *
 * A aba Proposta monta o documento, mas o envio acontece no portal, fora do
 * sistema. Sem um lugar para dizer "enviei", o processo ficava em
 * "Monitorando" com o prazo vencido, e a agenda cobrava a situação de quem já
 * estava participando (19/09). Este cartão é esse lugar: um ato explícito, com
 * confirmação, porque o banco carimba `data_proposta_enviada` na primeira vez
 * e as metas do comercial contam participação a partir daí — não é um clique
 * para desfazer.
 *
 * Só promove a partir do radar (Monitorando, Em Análise). Processo já em jogo
 * ou decidido mostra a data registrada; arquivado não mostra nada.
 */
type Props = {
  licitacaoId: string;
  status: string | null;
  arquivadoEm: string | null;
  dataPropostaEnviada: string | null;
  /** O prontuário atualiza o cabeçalho sem recarregar a página. */
  aoRegistrar?: (novoStatus: string, dataEnvio: string) => void;
};

export default function PropostaEnviadaCard({
  licitacaoId, status, arquivadoEm, dataPropostaEnviada, aoRegistrar,
}: Props) {
  const { promoverFase } = useLicitacaoIntegration();
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (faixaDe(status ?? '', arquivadoEm) === 'arquivo') return null;

  const podeRegistrar = podePromover(status, arquivadoEm, 'Proposta Enviada');

  const registrar = async () => {
    setSalvando(true);
    const r = await promoverFase(licitacaoId, 'Proposta Enviada', 'Proposta registrada como enviada na aba Proposta');
    setSalvando(false);
    setConfirmando(false);
    if (r.erro) {
      toast.error(`A proposta não foi registrada: ${r.erro}`, { duration: 10000 });
      return;
    }
    const agora = new Date().toISOString();
    if (!r.promovido) {
      // Alguém moveu o card enquanto a tela estava aberta: nada a mudar, mas a
      // tela precisa refletir o que o banco já tem.
      toast.info(`O processo já está em ${rotuloStatus(r.de ?? '')} — a proposta já contava como enviada.`);
      aoRegistrar?.(r.de ?? 'Proposta Enviada', agora);
      return;
    }
    toast.success('Proposta registrada como enviada. O processo passou para Proposta Enviada.');
    aoRegistrar?.('Proposta Enviada', agora);
  };

  if (!podeRegistrar) {
    return (
      <Card className="flex flex-wrap items-center gap-3 border-l-4 border-l-success p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Proposta enviada</p>
          <p className="text-sm text-muted-foreground">
            {dataPropostaEnviada
              ? `Registrada em ${format(new Date(dataPropostaEnviada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              : `O processo está em ${rotuloStatus(status ?? '')}: a proposta conta como enviada`}
            {' · '}a fase segue pelo Kanban.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-wrap items-center gap-3 border-l-4 border-l-warning p-4">
        <Send className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Proposta ainda não registrada como enviada</p>
          <p className="text-sm text-muted-foreground">
            Depois de enviar a proposta no portal, registre aqui: o processo sai de{' '}
            {rotuloStatus(status ?? '')} para Proposta Enviada, e a agenda deixa de cobrar a situação dele.
          </p>
        </div>
        <Button size="sm" onClick={() => setConfirmando(true)} disabled={salvando}>
          {salvando
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Send className="h-4 w-4" aria-hidden="true" />}
          Registrar proposta enviada
        </Button>
      </Card>

      <AlertDialog open={confirmando} onOpenChange={(aberto) => !salvando && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar a proposta como enviada?</AlertDialogTitle>
            <AlertDialogDescription>
              O processo passa para Proposta Enviada e a data de hoje fica registrada como envio —
              é ela que as metas do comercial usam para contar participação. Confirme só depois de
              a proposta estar no portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Ainda não</AlertDialogCancel>
            <AlertDialogAction
              disabled={salvando}
              onClick={(e) => { e.preventDefault(); void registrar(); }}
            >
              {salvando ? 'Registrando…' : 'Sim, proposta enviada'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
