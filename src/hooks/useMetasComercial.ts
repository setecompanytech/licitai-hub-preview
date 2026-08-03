import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

/**
 * Acesso às tabelas do módulo de Metas do Comercial.
 *
 * As tabelas `comercial_*` são novas e ainda não estão em
 * `src/integrations/supabase/types.ts` (arquivo gerado). Até a próxima geração
 * de tipos, as chamadas usam `as never`/`as any` — mesmo recurso já adotado em
 * `MeusCompromissos.tsx` para `processos_exclusao_log`.
 */

export function useEmpresaId() {
  const { empresaAtiva } = useEmpresa();
  return empresaAtiva?.id ?? null;
}

export type MetasConfig = {
  id: string;
  empresa_id: string;
  janela_historica_meses: number;
  alerta_dias_limite: number;
  alerta_percentual_minimo: number;
  min_amostra_ticket: number;
};

export type ValorAlvo = {
  id: string;
  empresa_id: string;
  modalidade_codigo: string;
  valor_alvo: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  user_id: string | null;
};

export type MotivoPerda = {
  id: string;
  empresa_id: string;
  codigo: string;
  label: string;
  ativo: boolean;
  ordem: number;
};

// ─── Configuração geral ───────────────────────────────────────────────────────

export function useMetasConfig() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ['comercial-metas-config', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comercial_metas_config' as never)
        .select('*')
        .eq('empresa_id', empresaId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MetasConfig | null) ?? null;
    },
  });
}

export function useSalvarMetasConfig() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<MetasConfig, 'id' | 'empresa_id'>>) => {
      if (!empresaId) throw new Error('Selecione uma empresa ativa.');
      const { error } = await supabase
        .from('comercial_metas_config' as never)
        .upsert({ empresa_id: empresaId, ...patch } as never, { onConflict: 'empresa_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comercial-metas-config'] });
      toast.success('Parâmetros salvos.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Valores-alvo por modalidade ──────────────────────────────────────────────

export function useValoresAlvo() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ['comercial-valores-alvo', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comercial_valores_alvo' as never)
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('modalidade_codigo', { ascending: true })
        .order('vigencia_inicio', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ValorAlvo[];
    },
  });
}

export function useSalvarValorAlvo() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      modalidade_codigo: string;
      valor_alvo: number;
      vigencia_inicio: string;
      vigencia_fim?: string | null;
      user_id?: string | null;
    }) => {
      if (!empresaId) throw new Error('Selecione uma empresa ativa.');
      const payload = {
        empresa_id: empresaId,
        modalidade_codigo: input.modalidade_codigo,
        valor_alvo: input.valor_alvo,
        vigencia_inicio: input.vigencia_inicio,
        vigencia_fim: input.vigencia_fim ?? null,
        user_id: input.user_id ?? null,
      };
      const q = input.id
        ? supabase.from('comercial_valores_alvo' as never).update(payload as never).eq('id', input.id)
        : supabase.from('comercial_valores_alvo' as never).insert(payload as never);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comercial-valores-alvo'] });
      toast.success('Valor-alvo salvo.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirValorAlvo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('comercial_valores_alvo' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comercial-valores-alvo'] });
      toast.success('Valor-alvo removido.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Motivos de perda ─────────────────────────────────────────────────────────

export function useMotivosPerda(apenasAtivos = false) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ['comercial-motivos-perda', empresaId, apenasAtivos],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from('comercial_motivos_perda' as never)
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('ordem', { ascending: true });
      if (apenasAtivos) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MotivoPerda[];
    },
  });
}

export function useSalvarMotivoPerda() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: { id?: string; codigo: string; label: string; ativo: boolean; ordem: number }) => {
      if (!empresaId) throw new Error('Selecione uma empresa ativa.');
      const payload = {
        empresa_id: empresaId,
        codigo: input.codigo,
        label: input.label,
        ativo: input.ativo,
        ordem: input.ordem,
      };
      const q = input.id
        ? supabase.from('comercial_motivos_perda' as never).update(payload as never).eq('id', input.id)
        : supabase.from('comercial_motivos_perda' as never).insert(payload as never);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comercial-motivos-perda'] });
      toast.success('Motivo salvo.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Restaurar padrões ────────────────────────────────────────────────────────

/** Chama `public.comercial_seed_padroes` — idempotente, não sobrescreve o que existe. */
export function useRestaurarPadroes() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error('Selecione uma empresa ativa.');
      const { error } = await supabase.rpc('comercial_seed_padroes' as never, {
        p_empresa_id: empresaId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comercial-valores-alvo'] });
      qc.invalidateQueries({ queryKey: ['comercial-motivos-perda'] });
      qc.invalidateQueries({ queryKey: ['comercial-metas-config'] });
      toast.success('Padrões restaurados.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Realizado mensal (derivado dos demais módulos) ───────────────────────────

export type RealizadoMensal = {
  empresa_id: string;
  user_id: string;
  ano: number;
  mes: number;
  participados: number;
  ganhos: number;
  perdidos: number;
  valor_ganho: number;
  valor_perdido: number;
  pedidos_faturados: number;
  valor_faturado: number;
  nfe_quitadas: number;
  valor_quitado: number;
};

/**
 * Lê `vw_comercial_realizado_mensal`. A view roda com `security_invoker=on`,
 * então a RLS das tabelas de origem continua valendo — um colaborador só
 * enxerga o que já enxergaria nelas.
 */
export function useRealizadoMensal(params: { ano?: number; userId?: string } = {}) {
  const empresaId = useEmpresaId();
  const { ano, userId } = params;
  return useQuery({
    queryKey: ['comercial-realizado', empresaId, ano, userId],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from('vw_comercial_realizado_mensal' as never)
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      if (ano) q = q.eq('ano', ano);
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RealizadoMensal[];
    },
  });
}
