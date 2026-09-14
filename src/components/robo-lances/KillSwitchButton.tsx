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
import { causaDoErro } from '@/lib/robo/comandos';
import { toast } from 'sonner';

/** O que o freio devolve a quem o chamou — para a tela reler o que mudou. */
export type ResultadoDoFreio = {
  /** Toda sessão alvo teve a parada confirmada pelo agente. */
  confirmada: boolean;
  /** Sessões com parada solicitada e ainda sem confirmação. */
  aguardando: number;
};

type Props = {
  sessaoId?: string;
  licitacaoId?: string;
  /**
   * Chamado DEPOIS que o servidor respondeu. Serve para a tela reler as
   * listas — não para pedir outra parada: o freio já pediu a de todas.
   */
  onParada: (resultado?: ResultadoDoFreio) => void;
  disabled?: boolean;
};

type RespostaDoFreio = {
  // Contrato de 14/09/2026
  sessoes_alvo?: number;
  sessoes_confirmadas?: number;
  sessoes_aguardando?: number;
  observacoes?: string[];
  // Contrato anterior — o servidor pode ainda não ter sido reimplantado
  sessoes_encerradas?: number;
  agente_parou?: boolean;
  // Comum aos dois
  agentes_total?: number;
  agentes_confirmaram?: number;
  agentes_notificados?: Array<{ agente: string; ok: boolean; detalhe?: string | null }>;
};

export default function KillSwitchButton({ sessaoId, licitacaoId, onParada, disabled }: Props) {
  const { user } = useAuth();
  const { registrar } = useAuditLog();
  const [loading, setLoading] = useState(false);

  const handleKillSwitch = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // O servidor faz o que exige autoridade: escolhe as sessões que você pode
      // operar, grava a lápide e a marca de emergência ANTES de chamar os
      // agentes, e só marca "encerrado" a sessão cujo agente confirmou.
      //
      // O navegador não escreve em sessão nenhuma. Antes gravava a marca de
      // emergência direto na linha — e o colega da empresa, sem permissão nela,
      // recebia erro justamente no freio.
      const { data, error } = await supabase.functions.invoke('robo-lances-webhook/kill-switch', {
        body: { motivo: 'Parada emergencial acionada pelo operador' },
      });
      if (error) throw new Error(await causaDoErro(error as { message?: string; context?: unknown }));

      const r = (data ?? {}) as RespostaDoFreio;

      await registrar('parada_emergencial', {
        motivo: 'Parada emergencial acionada pelo operador',
        sessao_id: sessaoId,
        resultado: data,
      }, {
        sessaoId,
        licitacaoId,
      });

      // Freio que mente é pior que freio ausente: o aviso diz o que o AGENTE
      // confirmou, sessão por sessão — não o que foi pedido.
      const contratoAntigo = r.sessoes_alvo === undefined;
      const alvo = contratoAntigo ? r.sessoes_encerradas ?? 0 : r.sessoes_alvo ?? 0;
      const confirmadas = contratoAntigo ? (r.agente_parou ? alvo : 0) : r.sessoes_confirmadas ?? 0;
      const aguardando = Math.max(alvo - confirmadas, 0);
      const total = r.agentes_total ?? 0;
      const confirmaram = r.agentes_confirmaram ?? 0;

      if (alvo === 0) {
        toast.info('Nenhuma sessão ativa do robô para parar.', { duration: 8000 });
      } else if (aguardando === 0) {
        toast.warning(
          `🛑 Parada confirmada — ${confirmadas} sessão(ões) encerrada(s) pelo agente. ` +
          'Lances já aceitos pelo portal não são cancelados.',
          { duration: 12000 },
        );
      } else {
        const motivo =
          r.agentes_notificados?.find((a) => !a.ok)?.detalhe ||
          (total === 0 ? 'nenhum agente configurado' : 'o agente não respondeu');
        toast.error(
          `🛑 Parada SOLICITADA — ${aguardando} de ${alvo} sessão(ões) aguardando confirmação ` +
          (total > 0 ? `(${confirmaram} de ${total} agente(s) confirmaram; ${motivo}). ` : `(${motivo}). `) +
          'O robô pode continuar operando no portal — intervenha manualmente agora.',
          { duration: 30000 },
        );
      }
      (r.observacoes ?? []).forEach((o) => toast.warning(o, { duration: 15000 }));

      onParada({ confirmada: alvo > 0 && aguardando === 0, aguardando });
    } catch (err) {
      console.error(err);
      toast.error(
        `Erro ao acionar parada emergencial: ${(err as Error)?.message || 'sem resposta do serviço'}. ` +
        'O robô pode continuar operando — tente de novo ou intervenha no portal.',
        { duration: 20000 },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* Sem `animate-pulse`: um botão piscando o tempo todo é alerta
            desproporcional à condição — a maior parte do tempo nada está errado. */}
        <Button variant="destructive" disabled={disabled} className="font-semibold">
          <OctagonX className="w-4 h-4" aria-hidden="true" />
          Parada emergencial
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <OctagonX className="w-5 h-5" aria-hidden="true" />
            Confirmar parada emergencial
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Esta ação pede a <strong>interrupção imediata</strong> das operações automatizadas em curso:</p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-2">
              <li>Cada agente é avisado para parar de enviar lances</li>
              <li>
                <strong>Lances já aceitos pelo portal não são cancelados</strong> —
                parar o robô não desfaz o que o pregão já registrou
              </li>
              <li>
                Vale para <strong>todas as sessões ativas que você pode operar</strong> —
                inclusive as de <strong>outras disputas</strong> e as iniciadas por colegas da empresa
              </li>
              <li>
                Uma sessão só aparece como parada quando o agente <strong>confirmar</strong>;
                sem confirmação ela fica "aguardando confirmação"
              </li>
              <li>O evento é registrado na trilha de auditoria</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleKillSwitch}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Pedindo a parada…' : 'Confirmar parada emergencial'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
