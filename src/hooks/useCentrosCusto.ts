import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export interface CentroCusto {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface RateioItem {
  id?: string;
  centro_custo_id: string;
  percentual: number;
  valor?: number;
}

export function useCentrosCusto(apenasAtivos = true) {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ["fin-centros-custo", empresaAtiva?.id, apenasAtivos],
    enabled: !!empresaAtiva?.id,
    queryFn: async () => {
      let q = (supabase as any)
        .from("fin_centros_custo")
        .select("*")
        .eq("empresa_id", empresaAtiva!.id)
        .order("codigo");
      if (apenasAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CentroCusto[];
    },
  });
}

export function useRateios(lancamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ["fin-rateios", lancamentoId],
    enabled: !!lancamentoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fin_lancamento_rateios")
        .select("*")
        .eq("lancamento_id", lancamentoId);
      if (error) throw error;
      return (data ?? []) as Array<RateioItem & { id: string; lancamento_id: string }>;
    },
  });
}

export function useSalvarRateios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lancamentoId,
      valorBase,
      itens,
    }: {
      lancamentoId: string;
      valorBase: number;
      itens: RateioItem[];
    }) => {
      // Substitui completamente: remove tudo e reinsere
      const { error: delErr } = await (supabase as any)
        .from("fin_lancamento_rateios")
        .delete()
        .eq("lancamento_id", lancamentoId);
      if (delErr) throw delErr;

      if (itens.length === 0) return;

      const total = itens.reduce((s, r) => s + (Number(r.percentual) || 0), 0);
      if (total > 100.001) {
        throw new Error(`Soma dos percentuais (${total.toFixed(2)}%) excede 100%.`);
      }

      const payload = itens.map((r) => ({
        lancamento_id: lancamentoId,
        centro_custo_id: r.centro_custo_id,
        percentual: r.percentual,
        valor: Math.round(((r.percentual / 100) * valorBase) * 100) / 100,
      }));

      const { error: insErr } = await (supabase as any)
        .from("fin_lancamento_rateios")
        .insert(payload);
      if (insErr) throw insErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fin-rateios", vars.lancamentoId] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      toast.success("Rateio salvo.");
    },
    onError: (e: any) => toast.error("Erro ao salvar rateio: " + e.message),
  });
}
