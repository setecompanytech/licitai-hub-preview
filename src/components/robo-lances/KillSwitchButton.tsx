import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { OctagonX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

type Props = {
  sessaoId?: string;
  licitacaoId?: string;
  onParada: () => void;
  disabled?: boolean;
};

export default function KillSwitchButton({ sessaoId, licitacaoId, onParada, disabled }: Props) {
  const { user } = useAuth();
  const { registrar } = useAuditLog();
  const [loading, setLoading] = useState(false);

  const handleKillSwitch = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Call centralized kill-switch endpoint
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/kill-switch', {
        body: {
          motivo: 'Parada emergencial acionada pelo operador',
        },
      });

      if (error) throw error;

      // 2. Update specific session if provided
      if (sessaoId) {
        await supabase
          .from('sessoes_lance_real')
          .update({
            parada_emergencial: true,
            parada_emergencial_em: new Date().toISOString(),
            parada_emergencial_por: user.email,
            status: 'encerrado',
          } as any)
          .eq('id', sessaoId);
      }

      // 3. Audit log
      await registrar('parada_emergencial', {
        motivo: 'Parada emergencial acionada pelo operador',
        sessao_id: sessaoId,
        resultado: data,
      }, {
        sessaoId,
        licitacaoId,
      });

      const encerradas = (data as any)?.sessoes_encerradas || 0;
      toast.warning(
        `🛑 PARADA EMERGENCIAL — ${encerradas} sessão(ões) encerrada(s). Agentes notificados.`,
        { duration: 10000 }
      );

      onParada();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao acionar parada emergencial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          disabled={disabled}
          className="gap-1.5 font-bold animate-pulse hover:animate-none"
        >
          <OctagonX className="w-4 h-4" />
          PARADA EMERGENCIAL
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <OctagonX className="w-5 h-5" />
            Confirmar Parada Emergencial
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Esta ação irá <strong>interromper imediatamente</strong> todas as operações automatizadas em curso:</p>
            <ul className="list-disc list-inside text-xs space-y-1 ml-2">
              <li>Todos os lances pendentes serão cancelados</li>
              <li>A sessão será encerrada com status "parada emergencial"</li>
              <li>O agente externo será notificado para cessar operações</li>
              <li>O evento será registrado na trilha de auditoria imutável</li>
            </ul>
            <p className="text-destructive font-semibold mt-2">Esta ação não pode ser desfeita.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleKillSwitch}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Interrompendo...' : '🛑 CONFIRMAR PARADA'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
