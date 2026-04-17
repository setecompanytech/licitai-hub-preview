import { useState } from 'react';
import { Loader2, RefreshCw, FileSearch, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useEditalAutoIngest } from '@/hooks/useEditalAutoIngest';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  licitacaoId: string | null;
  /** Texto do botão. Default: "Ler edital automaticamente". */
  label?: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'secondary';
  onCompleted?: () => void;
}

/**
 * Botão de leitura automática do edital — funciona como "primeira extração"
 * ou "reextração" (com confirmação se já houver itens).
 */
export default function ReextrairEditalButton({ licitacaoId, label, size = 'sm', variant = 'outline', onCompleted }: Props) {
  const { user } = useAuth();
  const { status, running, trigger } = useEditalAutoIngest(licitacaoId);
  const [confirming, setConfirming] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  const isRunning = running || status?.status === 'running';
  const labelText = label ?? (status?.status === 'success' ? 'Reextrair edital' : 'Ler edital automaticamente');

  const handleClick = async () => {
    if (!licitacaoId || !user) return;
    // Verifica itens existentes
    const { count } = await supabase
      .from('licitacao_itens')
      .select('id', { count: 'exact', head: true })
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id);
    if ((count ?? 0) > 0) {
      setExistingCount(count ?? 0);
      setConfirming(true);
    } else {
      const ok = await trigger(licitacaoId, { replace: false });
      if (ok) onCompleted?.();
    }
  };

  const handleConfirmReplace = async () => {
    setConfirming(false);
    const ok = await trigger(licitacaoId!, { replace: true });
    if (ok) onCompleted?.();
  };

  const handleConfirmKeep = async () => {
    setConfirming(false);
    const ok = await trigger(licitacaoId!, { replace: false });
    if (ok) onCompleted?.();
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size={size} variant={variant} onClick={handleClick} disabled={!licitacaoId || isRunning}>
          {isRunning
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{status?.etapa ? `Lendo: ${status.etapa}` : 'Lendo edital…'}</>
            : <><FileSearch className="w-4 h-4 mr-2" />{labelText}</>}
        </Button>

        {status?.status === 'success' && (
          <Badge variant="outline" className="gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {status.total_itens} itens · {status.fonte}
          </Badge>
        )}
        {status?.status === 'failed' && (
          <Badge variant="outline" className="gap-1 text-xs">
            <AlertCircle className="w-3 h-3 text-warning" />
            Falha — use upload manual
          </Badge>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existem {existingCount} itens neste processo</AlertDialogTitle>
            <AlertDialogDescription>
              Como deseja proceder com a nova leitura automática do edital?
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li><strong>Substituir tudo</strong>: apaga os itens atuais e importa do edital.</li>
                <li><strong>Manter e adicionar</strong>: mantém o que existe e acrescenta os novos.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={handleConfirmKeep}>
              <RefreshCw className="w-4 h-4 mr-2" />Manter e adicionar
            </Button>
            <AlertDialogAction onClick={handleConfirmReplace}>Substituir tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
