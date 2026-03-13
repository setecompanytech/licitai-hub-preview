import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AuditEvento =
  | 'sessao_criada'
  | 'sessao_iniciada'
  | 'sessao_pausada'
  | 'sessao_encerrada'
  | 'lance_enviado'
  | 'lance_concorrente'
  | 'aceite_termos'
  | 'nivel_alterado'
  | 'parada_emergencial'
  | 'limite_atingido'
  | 'autorizacao_lance'
  | '2fa_verificado'
  | 'estrategia_aprovada'
  | 'alerta_risco'
  | 'replay_solicitado';

export function useAuditLog() {
  const { user } = useAuth();

  const registrar = useCallback(async (
    evento: AuditEvento,
    detalhes: Record<string, unknown> = {},
    opts?: {
      sessaoId?: string;
      licitacaoId?: string;
      nivelAutomacao?: number;
      valorLance?: number;
      rodada?: number;
    }
  ) => {
    if (!user) return;

    try {
      await supabase.from('audit_log_lances' as any).insert({
        user_id: user.id,
        sessao_id: opts?.sessaoId || null,
        licitacao_id: opts?.licitacaoId || null,
        nivel_automacao: opts?.nivelAutomacao || 1,
        evento,
        detalhes,
        valor_lance: opts?.valorLance || null,
        rodada: opts?.rodada || null,
        ip_address: null, // captured server-side ideally
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error('Erro ao registrar auditoria:', err);
    }
  }, [user]);

  const buscarHistorico = useCallback(async (sessaoId?: string, limit = 200) => {
    if (!user) return [];

    let query = supabase
      .from('audit_log_lances' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessaoId) {
      query = query.eq('sessao_id', sessaoId);
    }

    const { data } = await query;
    return (data || []) as unknown as Array<{
      id: string;
      evento: string;
      detalhes: Record<string, unknown>;
      valor_lance: number | null;
      rodada: number | null;
      nivel_automacao: number;
      created_at: string;
    }>;
  }, [user]);

  return { registrar, buscarHistorico };
}
