import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Props = {
  licitacaoId?: string | null;
  /** Quais fontes limpar — todas por padrão */
  fontes?: Array<'licitacao_itens' | 'catalogo_itens_precificados' | 'composicoes_custo'>;
  onCleared?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
};

const FONTE_LABEL: Record<string, string> = {
  licitacao_itens: 'itens extraídos do edital',
  catalogo_itens_precificados: 'itens precificados',
  composicoes_custo: 'composições de custo da proposta',
};

export default function LimparItensExtraidosButton({
  licitacaoId,
  fontes = ['licitacao_itens', 'catalogo_itens_precificados', 'composicoes_custo'],
  onCleared,
  variant = 'outline',
  size = 'sm',
  label = 'Limpar histórico',
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!user || !licitacaoId) {
      toast.error('Selecione um processo licitatório primeiro.');
      return;
    }
    setLoading(true);
    let totalRemovido = 0;
    try {
      for (const fonte of fontes) {
        const { error, count } = await supabase
          .from(fonte as any)
          .delete({ count: 'exact' })
          .eq('licitacao_id', licitacaoId)
          .eq('user_id', user.id);
        if (!error && typeof count === 'number') totalRemovido += count;
      }
      toast.success(
        totalRemovido > 0
          ? `Histórico limpo: ${totalRemovido} registro(s) removido(s).`
          : 'Nenhum registro encontrado para limpar.',
      );
      onCleared?.();
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Não foi possível limpar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={!licitacaoId}>
          <Trash2 aria-hidden="true" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar histórico de extrações?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Esta ação removerá <strong>permanentemente</strong> os dados deste processo licitatório nas fontes:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {fontes.map((f) => (
                  <li key={f}>{FONTE_LABEL[f] || f}</li>
                ))}
              </ul>
              {/* Tinta suave do trio warning (fundo/tinta/linha) em vez de
                  texto âmbar solto: o aviso é um bloco, e a cor do texto
                  sozinha mudava de contraste conforme a superfície. */}
              <p className="rounded-md border border-warning-line bg-warning-tint p-3 text-sm text-warning-ink">
                Use esta opção se houver itens incorretos vindos de outros processos. Após limpar, basta executar a extração novamente para popular com os dados corretos.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={loading}
            className={buttonVariants({ variant: 'destructive' })}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
            Confirmar limpeza
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
