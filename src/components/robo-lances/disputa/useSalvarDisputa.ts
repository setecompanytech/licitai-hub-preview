import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import { gravarDisputa } from './disputa-do-robo';

/**
 * Salvar a disputa vinda do `ConfigurarLanceDialog` — "Nova sessão" na lista e
 * "Editar parâmetros" na página da disputa.
 *
 * O aviso de sucesso só sai DEPOIS de o banco responder. Até 14/09/2026 a tela
 * dizia "Nova disputa adicionada!" antes da gravação terminar, e a lista a
 * mostrava mesmo quando o banco recusava — a estratégia sumia ao recarregar,
 * que é justamente a queixa da véspera de pregão.
 *
 * Devolve `true` só com a disputa gravada: é o que autoriza a lista a abrir a
 * página da disputa nova.
 */
export function useSalvarDisputa() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { processoId } = useProcessoAtivo();
  const empresaAtivaId = empresaAtiva?.id ?? null;

  return useCallback(
    async (
      lance: LanceConfig,
      { nova, empresaId }: { nova: boolean; /** Editando: a empresa DONA da disputa, não a ativa. */ empresaId?: string | null },
    ): Promise<boolean> => {
      const empresa = empresaId ?? empresaAtivaId;
      // Sem empresa não há onde gravar: `empresa_id` é NOT NULL e a RLS é por
      // membro da empresa. Pular a gravação calado era dizer "salvo" ao nada.
      if (!user || !empresa) {
        toast.error('Selecione uma empresa ativa antes de salvar a disputa.', { duration: 10000 });
        return false;
      }
      const resultado = await gravarDisputa(lance, { empresaId: empresa, userId: user.id, processoId: processoId ?? null });
      if (!resultado.ok) {
        toast.error(`Disputa não foi salva: ${resultado.motivo}`, { duration: 12000 });
        return false;
      }
      toast.success(nova ? 'Nova disputa adicionada!' : 'Disputa atualizada!');
      return true;
    },
    [user, empresaAtivaId, processoId],
  );
}
