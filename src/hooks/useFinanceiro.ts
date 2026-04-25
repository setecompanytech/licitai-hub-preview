import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type Lancamento = Database["public"]["Tables"]["financeiro_lancamentos"]["Row"];
export type LancamentoInsert = Database["public"]["Tables"]["financeiro_lancamentos"]["Insert"];
export type Conta = Database["public"]["Tables"]["financeiro_contas"]["Row"];
export type ContaInsert = Database["public"]["Tables"]["financeiro_contas"]["Insert"];
export type Categoria = Database["public"]["Tables"]["financeiro_categorias"]["Row"];
export type CategoriaInsert = Database["public"]["Tables"]["financeiro_categorias"]["Insert"];
export type Pessoa = Database["public"]["Tables"]["financeiro_pessoas"]["Row"];
export type PessoaInsert = Database["public"]["Tables"]["financeiro_pessoas"]["Insert"];

export type LancamentoFiltro = {
  tipo?: Database["public"]["Enums"]["financeiro_tipo_lancamento"] | "todos";
  status?: Database["public"]["Enums"]["financeiro_status_lancamento"] | "todos";
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
};

export function useEmpresaId() {
  const { empresaAtiva } = useEmpresa();
  return empresaAtiva?.id ?? null;
}

// ----------------------------------------------------------------------------
// Contas
// ----------------------------------------------------------------------------
export function useContas() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-contas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_contas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("ordem", { ascending: true })
        .order("nome");
      if (error) throw error;
      return data as Conta[];
    },
  });
}

export function useUpsertConta() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (payload: Partial<ContaInsert> & { id?: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const body: ContaInsert = {
        ...(payload as ContaInsert),
        empresa_id: empresaId,
        nome: payload.nome ?? "Nova conta",
      };
      const q = payload.id
        ? supabase.from("financeiro_contas").update(body).eq("id", payload.id).select().single()
        : supabase.from("financeiro_contas").insert(body).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      toast.success("Conta salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_contas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      toast.success("Conta removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Categorias
// ----------------------------------------------------------------------------
export function useCategorias() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-categorias", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_categorias")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("codigo");
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

export function useUpsertCategoria() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (payload: Partial<CategoriaInsert> & { id?: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const body: CategoriaInsert = {
        ...(payload as CategoriaInsert),
        empresa_id: empresaId,
        codigo: payload.codigo ?? "0.0",
        nome: payload.nome ?? "Nova categoria",
        natureza: payload.natureza ?? "despesa",
      };
      const q = payload.id
        ? supabase.from("financeiro_categorias").update(body).eq("id", payload.id).select().single()
        : supabase.from("financeiro_categorias").insert(body).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      toast.success("Categoria salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      toast.success("Categoria removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSeedPlanoContas() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const { error } = await supabase.rpc("seed_plano_contas_padrao" as never, {
        p_empresa_id: empresaId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      toast.success("Plano de contas padrão criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Pessoas
// ----------------------------------------------------------------------------
export function usePessoas() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-pessoas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pessoas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("nome");
      if (error) throw error;
      return data as Pessoa[];
    },
  });
}

export function useUpsertPessoa() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (payload: Partial<PessoaInsert> & { id?: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const body: PessoaInsert = {
        ...(payload as PessoaInsert),
        empresa_id: empresaId,
        nome: payload.nome ?? "Nova pessoa",
        documento: payload.documento ?? "",
        pessoa_tipo: payload.pessoa_tipo ?? "fornecedor",
      };
      const q = payload.id
        ? supabase.from("financeiro_pessoas").update(body).eq("id", payload.id).select().single()
        : supabase.from("financeiro_pessoas").insert(body).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-pessoas"] });
      toast.success("Pessoa salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_pessoas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-pessoas"] });
      toast.success("Pessoa removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Lançamentos
// ----------------------------------------------------------------------------
export function useLancamentos(filtro: LancamentoFiltro = {}) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-lancamentos", empresaId, filtro],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("financeiro_lancamentos")
        .select("*, conta:financeiro_contas(id,nome), categoria:financeiro_categorias(id,nome,natureza), pessoa:financeiro_pessoas(id,nome)")
        .eq("empresa_id", empresaId!)
        .order("data_competencia", { ascending: false })
        .limit(500);
      if (filtro.tipo && filtro.tipo !== "todos") q = q.eq("tipo", filtro.tipo);
      if (filtro.status && filtro.status !== "todos") q = q.eq("status", filtro.status);
      if (filtro.dataInicio) q = q.gte("data_competencia", filtro.dataInicio);
      if (filtro.dataFim) q = q.lte("data_competencia", filtro.dataFim);
      if (filtro.busca) q = q.ilike("descricao", `%${filtro.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as (Lancamento & {
        conta: { id: string; nome: string } | null;
        categoria: { id: string; nome: string; natureza: string } | null;
        pessoa: { id: string; nome: string } | null;
      })[];
    },
  });
}

export function useUpsertLancamento() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (payload: Partial<LancamentoInsert> & { id?: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const body: LancamentoInsert = {
        ...(payload as LancamentoInsert),
        empresa_id: empresaId,
        descricao: payload.descricao ?? "",
        valor: payload.valor ?? 0,
        data_competencia: payload.data_competencia ?? new Date().toISOString().slice(0, 10),
        natureza: payload.natureza ?? "despesa",
        tipo: payload.tipo ?? "a_pagar",
      };
      const q = payload.id
        ? supabase.from("financeiro_lancamentos").update(body).eq("id", payload.id).select().single()
        : supabase.from("financeiro_lancamentos").insert(body).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      toast.success("Lançamento salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      toast.success("Lançamento removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Resumo (Dashboard)
// ----------------------------------------------------------------------------
export type ResumoFinanceiro = {
  saldoTotal: number;
  aPagar: number;
  aReceber: number;
  realizadoMes: number;
  topDespesas: { nome: string; total: number }[];
  fluxo: { mes: string; entrada: number; saida: number; saldo: number }[];
};

export function useResumoFinanceiro() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-resumo", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<ResumoFinanceiro> => {
      const hoje = new Date();
      const mesAtual = hoje.toISOString().slice(0, 7);
      const inicio6m = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString().slice(0, 10);

      const [contasRes, lancRes] = await Promise.all([
        supabase.from("financeiro_contas").select("saldo_atual").eq("empresa_id", empresaId!).eq("ativa", true),
        supabase
          .from("financeiro_lancamentos")
          .select("valor, tipo, status, natureza, data_competencia, data_realizado, categoria:financeiro_categorias(nome)")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", inicio6m)
          .limit(2000),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (lancRes.error) throw lancRes.error;

      const saldoTotal = (contasRes.data ?? []).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const lancs = lancRes.data ?? [];

      const aPagar = lancs
        .filter((l) => l.tipo === "a_pagar" && (l.status === "previsto" || l.status === "em_atraso"))
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const aReceber = lancs
        .filter((l) => l.tipo === "a_receber" && (l.status === "previsto" || l.status === "em_atraso"))
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const realizadoMes = lancs
        .filter((l) => (l.data_realizado ?? "").startsWith(mesAtual))
        .reduce((s, l) => s + (l.natureza === "receita" ? 1 : -1) * Number(l.valor ?? 0), 0);

      // Top 5 despesas (realizadas) por categoria
      const despesasMap = new Map<string, number>();
      lancs
        .filter((l) => l.natureza === "despesa" && l.status !== "cancelado")
        .forEach((l) => {
          const nome = (l.categoria as { nome?: string } | null)?.nome ?? "Sem categoria";
          despesasMap.set(nome, (despesasMap.get(nome) ?? 0) + Number(l.valor ?? 0));
        });
      const topDespesas = Array.from(despesasMap.entries())
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Fluxo de caixa por mês (últimos 6)
      const fluxoMap = new Map<string, { entrada: number; saida: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        fluxoMap.set(d.toISOString().slice(0, 7), { entrada: 0, saida: 0 });
      }
      lancs.forEach((l) => {
        const mes = (l.data_competencia ?? "").slice(0, 7);
        const bucket = fluxoMap.get(mes);
        if (!bucket) return;
        const v = Number(l.valor ?? 0);
        if (l.natureza === "receita") bucket.entrada += v;
        else if (l.natureza === "despesa") bucket.saida += v;
      });
      const fluxo = Array.from(fluxoMap.entries()).map(([mes, v]) => ({
        mes,
        entrada: v.entrada,
        saida: v.saida,
        saldo: v.entrada - v.saida,
      }));

      return { saldoTotal, aPagar, aReceber, realizadoMes, topDespesas, fluxo };
    },
  });
}
