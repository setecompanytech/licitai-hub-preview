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
  origemTipo?: Database["public"]["Enums"]["financeiro_origem_tipo"] | "todos";
  origemLoteId?: string;
  /**
   * Campo de data usado para o intervalo dataInicio/dataFim.
   * - "competencia" (padrão): filtra por data_competencia (retrocompatível).
   * - "vencimento": filtra por data_vencimento (usado pelo Calendário Financeiro).
   * - "ambos": retorna lançamentos cujo vencimento OU competência caia no intervalo
   *   (ideal para visões de calendário que exibem por vencimento mas devem incluir
   *   NFs com competência em mês anterior e pagamento no mês exibido).
   */
  campoData?: "competencia" | "vencimento" | "ambos";
};

export function useEmpresaId() {
  const { empresaAtiva } = useEmpresa();
  return empresaAtiva?.id ?? null;
}

// ----------------------------------------------------------------------------
// Projetos (fin_projetos)
// ----------------------------------------------------------------------------
export function useFinProjetos() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-projetos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fin_projetos")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });
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

      // Sincroniza saldo_atual com saldo_inicial:
      //  - na criação: saldo_atual = saldo_inicial (zero se não informado)
      //  - na edição: só re-sincroniza se o usuário editou o saldo_inicial e
      //    a conta ainda não tem movimentações (saldo_atual == saldo_inicial antigo)
      if (!payload.id) {
        body.saldo_atual = Number(payload.saldo_inicial ?? 0);
      } else if (payload.saldo_inicial !== undefined) {
        const { data: atual } = await supabase
          .from("financeiro_contas")
          .select("saldo_inicial, saldo_atual")
          .eq("id", payload.id)
          .maybeSingle();
        const semMovimento =
          atual && Number(atual.saldo_inicial ?? 0) === Number(atual.saldo_atual ?? 0);
        if (semMovimento) {
          body.saldo_atual = Number(payload.saldo_inicial ?? 0);
        }
      }

      // Pré-checagem amigável de duplicidade — alinhada à realidade contábil:
      // Múltiplas APLICAÇÕES (CDB, LCI, LCA, Fundos, Poupança) podem coexistir
      // no mesmo banco/agência/conta-corrente, desde que tenham TIPO ou NOME distintos.
      // Só consideramos duplicado quando empresa + banco + agência + conta + tipo + nome coincidem.
      if (body.banco_codigo && body.agencia && body.conta && body.tipo && body.nome) {
        const dupQuery = supabase
          .from("financeiro_contas")
          .select("id, nome, tipo")
          .eq("empresa_id", empresaId)
          .eq("banco_codigo", body.banco_codigo)
          .eq("agencia", body.agencia)
          .eq("conta", body.conta)
          .eq("tipo", body.tipo)
          .ilike("nome", body.nome);
        if (payload.id) dupQuery.neq("id", payload.id);
        const { data: dup } = await dupQuery.maybeSingle();
        if (dup) {
          throw new Error(
            `Já existe uma conta com mesmo banco, agência, número, tipo e nome ("${dup.nome}"). ` +
              `Para cadastrar outra aplicação no mesmo banco, altere o nome (ex.: "CDB Itaú 30 dias", "LCI Itaú 90 dias") ou o tipo da conta.`,
          );
        }
      }

      const q = payload.id
        ? supabase.from("financeiro_contas").update(body).eq("id", payload.id).select().single()
        : supabase.from("financeiro_contas").insert(body).select().single();
      const { data, error } = await q;
      if (error) {
        // Tradução amigável de erros de constraint do Postgres
        const msg = (error as { code?: string; message?: string }).message ?? "";
        const code = (error as { code?: string }).code;
        if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
          throw new Error(
            "Já existe uma conta com exatamente os mesmos dados (banco, agência, número, tipo e nome). " +
              "Para cadastrar outra aplicação financeira no mesmo banco, diferencie pelo nome (ex.: \"CDB 30d\", \"LCI 90d\", \"Fundo DI\") ou pelo tipo.",
          );
        }
        throw error;
      }
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

/**
 * Sincroniza o Plano de Contas hierárquico (fin_plano_contas) com a tabela
 * financeiro_categorias usada nos lançamentos. Idempotente (UPSERT por código).
 */
export function useSyncPlanoContasCategorias() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const { data, error } = await supabase.rpc(
        "fin_sync_plano_contas_to_categorias" as never,
        { p_empresa_id: empresaId } as never,
      );
      if (error) throw error;
      return data as { inseridas: number; atualizadas: number; total_depois: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fin-categorias"] });
      toast.success(
        `Categorias sincronizadas: ${r?.inseridas ?? 0} novas · ${r?.atualizadas ?? 0} atualizadas · total ${r?.total_depois ?? 0}.`,
      );
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
    mutationFn: async (params: { id: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc("try_delete_financeiro_pessoa" as any, {
        p_pessoa_id: params.id,
        p_motivo: params.motivo ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; bloqueado?: boolean; dependencias?: Record<string, number> };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["fin-pessoas"] });
      if (data?.bloqueado) {
        const deps = data.dependencias || {};
        const partes = Object.entries(deps)
          .filter(([k, v]) => k !== "total" && Number(v) > 0)
          .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
          .join(", ");
        toast.error(`Exclusão bloqueada por integridade. Vínculos: ${partes || "histórico financeiro"}. Desative o cadastro em vez de excluir.`);
      } else {
        toast.success("Pessoa removida.");
      }
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
        .select("*, conta:financeiro_contas!financeiro_lancamentos_conta_id_fkey(id,nome), categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(id,nome,natureza), pessoa:financeiro_pessoas(id,nome)")
        .eq("empresa_id", empresaId!)
        .order("data_competencia", { ascending: false })
        .limit(500);
      if (filtro.tipo && filtro.tipo !== "todos") q = q.eq("tipo", filtro.tipo);
      if (filtro.status && filtro.status !== "todos") q = q.eq("status", filtro.status);
      if (filtro.origemTipo && filtro.origemTipo !== "todos") q = q.eq("origem_tipo", filtro.origemTipo);
      if (filtro.origemLoteId) q = q.eq("origem_lote_id", filtro.origemLoteId);
      const campo = filtro.campoData ?? "competencia";
      if (campo === "ambos") {
        // Retorna registros cujo vencimento OU competência caia no intervalo.
        if (filtro.dataInicio && filtro.dataFim) {
          q = q.or(
            `and(data_vencimento.gte.${filtro.dataInicio},data_vencimento.lte.${filtro.dataFim}),` +
              `and(data_competencia.gte.${filtro.dataInicio},data_competencia.lte.${filtro.dataFim})`
          );
        } else if (filtro.dataInicio) {
          q = q.or(`data_vencimento.gte.${filtro.dataInicio},data_competencia.gte.${filtro.dataInicio}`);
        } else if (filtro.dataFim) {
          q = q.or(`data_vencimento.lte.${filtro.dataFim},data_competencia.lte.${filtro.dataFim}`);
        }
      } else {
        const coluna = campo === "vencimento" ? "data_vencimento" : "data_competencia";
        if (filtro.dataInicio) q = q.gte(coluna, filtro.dataInicio);
        if (filtro.dataFim) q = q.lte(coluna, filtro.dataFim);
      }
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
      const { data: userData } = await supabase.auth.getUser();
      const usuarioId = userData.user?.id ?? null;
      const body: LancamentoInsert = {
        ...(payload as LancamentoInsert),
        empresa_id: empresaId,
        descricao: payload.descricao ?? "",
        valor: payload.valor ?? 0,
        data_competencia: payload.data_competencia ?? new Date().toISOString().slice(0, 10),
        natureza: payload.natureza ?? "despesa",
        tipo: payload.tipo ?? "a_pagar",
      };
      if (!payload.id) {
        // Apenas em criação — preserva origem em updates posteriores
        body.origem_tipo = (payload as any).origem_tipo ?? "manual";
        body.origem_job = (payload as any).origem_job ?? "useUpsertLancamento";
        body.origem_usuario_id = (payload as any).origem_usuario_id ?? usuarioId;
        body.origem_timestamp = (payload as any).origem_timestamp ?? new Date().toISOString();
      }
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
      qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] });
      qc.invalidateQueries({ queryKey: ["fin-fluxo-caixa"] });
      qc.invalidateQueries({ queryKey: ["fin-dre"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] }); // saldo_atual atualizado pelo trigger
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
// Parcelamento — gera N lançamentos com vencimentos mensais a partir do "pai".
// O 1º lançamento é o "pai" (parcela_pai_id = null) e referenciado pelas demais.
// ----------------------------------------------------------------------------
export type Periodicidade = "mensal" | "semanal" | "quinzenal" | "bimestral" | "trimestral" | "semestral" | "anual" | "dias";
export type RegraFimSemana = "manter" | "antecipar" | "postergar";
export type ModoParcelamento = "dividir" | "repetir";

export type GerarParcelasInput = Partial<LancamentoInsert> & {
  parcelas: number;            // total (>=2)
  data_vencimento: string;     // vencimento da 1ª parcela (YYYY-MM-DD)
  valor_total: number;         // valor total (modo "dividir") ou valor unitário (modo "repetir")
  intervalo_dias?: number;     // usado quando periodicidade = "dias"
  periodicidade?: Periodicidade; // padrão: mensal
  modo?: ModoParcelamento;     // padrão: dividir
  regra_fim_semana?: RegraFimSemana; // padrão: manter
  dia_fixo?: number | null;    // forçar dia do mês (ex.: 10)
  /** Datas pré-calculadas pela simulação (sobrepõem os cálculos internos) */
  datas_customizadas?: { competencia: string; vencimento: string; valor: number }[];
};

/**
 * Gera a lista de datas e valores para a série de parcelas/repetições.
 * Exposta para que a UI possa pré-visualizar antes de salvar.
 */
export function calcularSerieParcelas(input: {
  parcelas: number;
  data_vencimento: string;
  data_competencia?: string;
  valor_total: number;
  periodicidade?: Periodicidade;
  intervalo_dias?: number;
  modo?: ModoParcelamento;
  regra_fim_semana?: RegraFimSemana;
  dia_fixo?: number | null;
}) {
  const total = Math.max(2, Math.floor(input.parcelas));
  const periodicidade = input.periodicidade ?? "mensal";
  const modo = input.modo ?? "dividir";
  const regra = input.regra_fim_semana ?? "manter";

  // Valores
  let valores: number[];
  if (modo === "repetir") {
    const v = +Number(input.valor_total).toFixed(2);
    valores = Array(total).fill(v);
  } else {
    const valorParcela = Math.round((input.valor_total / total) * 100) / 100;
    const valorUltima = +(input.valor_total - valorParcela * (total - 1)).toFixed(2);
    valores = Array.from({ length: total }, (_, i) => (i === total - 1 ? valorUltima : valorParcela));
  }

  const baseVenc = new Date(input.data_vencimento + "T12:00:00");
  const baseComp = input.data_competencia
    ? new Date(input.data_competencia + "T12:00:00")
    : baseVenc;

  const advance = (d: Date, i: number) => {
    switch (periodicidade) {
      case "semanal":
        d.setDate(d.getDate() + 7 * i); break;
      case "quinzenal":
        d.setDate(d.getDate() + 15 * i); break;
      case "bimestral":
        d.setMonth(d.getMonth() + 2 * i); break;
      case "trimestral":
        d.setMonth(d.getMonth() + 3 * i); break;
      case "semestral":
        d.setMonth(d.getMonth() + 6 * i); break;
      case "anual":
        d.setFullYear(d.getFullYear() + i); break;
      case "dias":
        d.setDate(d.getDate() + (input.intervalo_dias ?? 30) * i); break;
      case "mensal":
      default:
        d.setMonth(d.getMonth() + i);
    }
  };

  const aplicarDiaFixo = (d: Date) => {
    if (!input.dia_fixo) return;
    const ano = d.getFullYear();
    const mes = d.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    d.setDate(Math.min(input.dia_fixo, ultimoDia));
  };

  const aplicarRegraFds = (d: Date) => {
    if (regra === "manter") return;
    const dow = d.getDay(); // 0=dom, 6=sab
    if (dow === 6) d.setDate(d.getDate() + (regra === "postergar" ? 2 : -1));
    else if (dow === 0) d.setDate(d.getDate() + (regra === "postergar" ? 1 : -2));
  };

  const datas: { competencia: string; vencimento: string; valor: number }[] = [];
  for (let i = 0; i < total; i++) {
    const v = new Date(baseVenc);
    const c = new Date(baseComp);
    advance(v, i);
    advance(c, i);
    if (periodicidade !== "semanal" && periodicidade !== "quinzenal" && periodicidade !== "dias") {
      aplicarDiaFixo(v);
      aplicarDiaFixo(c);
    }
    aplicarRegraFds(v);
    datas.push({
      competencia: c.toISOString().slice(0, 10),
      vencimento: v.toISOString().slice(0, 10),
      valor: valores[i],
    });
  }
  return datas;
}

export function useGerarParcelas() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: GerarParcelasInput) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const total = Math.max(2, Math.floor(input.parcelas));

      const datas = input.datas_customizadas && input.datas_customizadas.length === total
        ? input.datas_customizadas
        : calcularSerieParcelas({
            parcelas: total,
            data_vencimento: input.data_vencimento,
            data_competencia: input.data_competencia ?? undefined,
            valor_total: input.valor_total,
            periodicidade: input.periodicidade,
            intervalo_dias: input.intervalo_dias,
            modo: input.modo,
            regra_fim_semana: input.regra_fim_semana,
            dia_fixo: input.dia_fixo ?? null,
          });

      const baseBody: LancamentoInsert = {
        ...(input as LancamentoInsert),
        empresa_id: empresaId,
        descricao: input.descricao ?? "",
        valor: datas[0].valor,
        natureza: input.natureza ?? "despesa",
        tipo: input.tipo ?? "a_pagar",
        status: input.status ?? "previsto",
        data_competencia: datas[0].competencia,
        data_vencimento: datas[0].vencimento,
        parcela_numero: 1,
        parcela_total: total,
        parcela_pai_id: null,
      };
      // remove campos auxiliares
      delete (baseBody as any).parcelas;
      delete (baseBody as any).valor_total;
      delete (baseBody as any).intervalo_dias;
      delete (baseBody as any).periodicidade;
      delete (baseBody as any).modo;
      delete (baseBody as any).regra_fim_semana;
      delete (baseBody as any).dia_fixo;
      delete (baseBody as any).datas_customizadas;

      const { data: paiInserido, error: errPai } = await supabase
        .from("financeiro_lancamentos")
        .insert(baseBody)
        .select()
        .single();
      if (errPai) throw errPai;

      const filhos: LancamentoInsert[] = [];
      for (let i = 1; i < total; i++) {
        filhos.push({
          ...baseBody,
          descricao: `${baseBody.descricao} (${i + 1}/${total})`,
          valor: datas[i].valor,
          data_competencia: datas[i].competencia,
          data_vencimento: datas[i].vencimento,
          parcela_numero: i + 1,
          parcela_pai_id: paiInserido.id,
        });
      }

      // Renomeia a 1ª também para padronizar "(1/N)"
      await supabase
        .from("financeiro_lancamentos")
        .update({ descricao: `${baseBody.descricao} (1/${total})` })
        .eq("id", paiInserido.id);

      if (filhos.length > 0) {
        const { error: errFilhos } = await supabase
          .from("financeiro_lancamentos")
          .insert(filhos);
        if (errFilhos) throw errFilhos;
      }

      return { pai_id: paiInserido.id, total };
    },
    onSuccess: ({ total }) => {
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      toast.success(`${total} parcelas geradas.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Membros da empresa (para selecionar vendedor/responsável)
// ----------------------------------------------------------------------------
export type MembroEmpresa = {
  user_id: string;
  papel: string | null;
  nome_completo: string | null;
  email: string | null;
};

export function useMembrosEmpresa() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-membros-empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<MembroEmpresa[]> => {
      const { data, error } = await supabase
        .from("empresa_membros")
        .select("user_id, papel, nome, email")
        .eq("empresa_id", empresaId!)
        .order("nome", { nullsFirst: false });
      if (error) throw error;
      // Enriquecimento com profiles (nome_completo) — best-effort
      const ids = (data ?? []).map((m: any) => m.user_id);
      let perfis: any[] = [];
      if (ids.length > 0) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("user_id, nome_completo")
          .in("user_id", ids);
        perfis = pData ?? [];
      }
      const mapPerfis = new Map(perfis.map((p) => [p.user_id, p.nome_completo]));
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        papel: m.papel ?? null,
        nome_completo: m.nome ?? mapPerfis.get(m.user_id) ?? null,
        email: m.email ?? null,
      }));
    },
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

// ----------------------------------------------------------------------------
// Conciliação Bancária
// ----------------------------------------------------------------------------
export type ExtratoImportado = Database["public"]["Tables"]["financeiro_extratos_importados"]["Row"];
export type ExtratoMovimento = Database["public"]["Tables"]["financeiro_extrato_movimentos"]["Row"];

export function useExtratosImportados() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-extratos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_extratos_importados")
        .select("*, conta:financeiro_contas(id,nome)")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as (ExtratoImportado & { conta: { id: string; nome: string } | null })[];
    },
  });
}

export function useMovimentosExtrato(filtros: { conta_id?: string; conciliado?: boolean } = {}) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-movimentos", empresaId, filtros],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("financeiro_extrato_movimentos")
        .select("*, conta:financeiro_contas(id,nome), lancamento:financeiro_lancamentos(id,descricao,valor)")
        .eq("empresa_id", empresaId!)
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (filtros.conta_id) q = q.eq("conta_id", filtros.conta_id);
      if (typeof filtros.conciliado === "boolean") q = q.eq("conciliado", filtros.conciliado);
      const { data, error } = await q;
      if (error) throw error;
      return data as (ExtratoMovimento & {
        conta: { id: string; nome: string } | null;
        lancamento: { id: string; descricao: string; valor: number } | null;
      })[];
    },
  });
}

export function useImportarOFX() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: { conta_id: string; arquivo_nome: string; conteudo_ofx: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const { data, error } = await supabase.functions.invoke("import-ofx", {
        body: { empresa_id: empresaId, ...input },
      });
      if (error) {
        // Tenta extrair a mensagem real do corpo da resposta (FunctionsHttpError)
        let realMsg = error.message;
        try {
          const ctx = (error as { context?: { response?: Response } }).context;
          if (ctx?.response) {
            const body = await ctx.response.clone().json().catch(() => null);
            if (body?.error) realMsg = String(body.error);
          }
        } catch { /* ignore */ }
        throw new Error(realMsg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["fin-extratos"] });
      qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
      if (data?.duplicado) toast.info("Arquivo já havia sido importado anteriormente.");
      else toast.success(`${data?.total_movimentos ?? 0} movimentos importados.`);
    },
    onError: (e: Error) => toast.error(`Erro ao importar OFX: ${e.message}`),
  });
}

export function useConciliarAutomatico() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: { extrato_id?: string; conta_id?: string; auto_aplicar?: boolean; score_minimo?: number; usar_ia?: boolean }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const { data, error } = await supabase.functions.invoke("reconciliation-engine", {
        body: { empresa_id: empresaId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: boolean;
        movimentos_analisados: number;
        sugestoes: number;
        aplicados: number;
        ia_consultados?: number;
        ia_sugeridos?: number;
        matches: Array<{ movimento_id: string; lancamento_id: string; score: number; metodo?: string; motivos: Record<string, unknown>; justificativa_ia?: string }>;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fin-resumo"] });
      if (data.aplicados > 0) toast.success(`${data.aplicados} conciliações aplicadas automaticamente.`);
      else if (data.sugestoes > 0) toast.success(`${data.sugestoes} sugestões encontradas.`);
      else toast.info("Nenhuma sugestão de conciliação encontrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConciliarManual() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  return useMutation({
    mutationFn: async (input: { movimento_id: string; lancamento_id: string }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa.");
      const { error: errCon } = await supabase.from("financeiro_conciliacoes").insert({
        empresa_id: empresaId,
        extrato_movimento_id: input.movimento_id,
        lancamento_id: input.lancamento_id,
        score: 100,
        metodo: "manual",
        motivos: { manual: true },
      });
      if (errCon) throw errCon;
      await supabase
        .from("financeiro_extrato_movimentos")
        .update({ conciliado: true, lancamento_id: input.lancamento_id })
        .eq("id", input.movimento_id);
      await supabase
        .from("financeiro_lancamentos")
        .update({ status: "conciliado", data_conciliado: new Date().toISOString() })
        .eq("id", input.lancamento_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      toast.success("Movimento conciliado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDesfazerConciliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { movimento_id: string; lancamento_id: string }) => {
      await supabase.from("financeiro_conciliacoes").delete().eq("extrato_movimento_id", input.movimento_id);
      await supabase
        .from("financeiro_extrato_movimentos")
        .update({ conciliado: false, lancamento_id: null })
        .eq("id", input.movimento_id);
      await supabase
        .from("financeiro_lancamentos")
        .update({ status: "previsto", data_conciliado: null })
        .eq("id", input.lancamento_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-movimentos"] });
      qc.invalidateQueries({ queryKey: ["fin-lancamentos"] });
      toast.success("Conciliação desfeita.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// DRE — Demonstração do Resultado do Exercício (mensal)
// ----------------------------------------------------------------------------
export type DRELinhaRaw = {
  empresa_id: string;
  competencia: string;
  grupo_dre: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  natureza: "receita" | "despesa";
  total: number;
};

export type DREGrupo = {
  grupo: string;
  natureza: "receita" | "despesa";
  total: number;
  itens: { categoria: string; total: number }[];
};

export type DREResumo = {
  competencia: string;
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
  outrosResultados: number;
  resultadoLiquido: number;
  margemLiquida: number;
  grupos: DREGrupo[];
};

export function useDRE(competencia: string) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-dre", empresaId, competencia],
    enabled: !!empresaId && !!competencia,
    queryFn: async (): Promise<DREResumo> => {
      const inicio = `${competencia}-01`;
      const { data, error } = await supabase
        .from("mv_financeiro_dre_mensal" as never)
        .select("*")
        .eq("empresa_id", empresaId!)
        .eq("competencia", inicio);
      if (error) throw error;
      const linhas = (data ?? []) as unknown as DRELinhaRaw[];

      const gruposMap = new Map<string, DREGrupo>();
      linhas.forEach((l) => {
        const key = l.grupo_dre ?? "outros";
        if (!gruposMap.has(key)) {
          gruposMap.set(key, { grupo: key, natureza: l.natureza, total: 0, itens: [] });
        }
        const g = gruposMap.get(key)!;
        g.total += Number(l.total ?? 0);
        g.itens.push({ categoria: l.categoria_nome ?? "Sem categoria", total: Number(l.total ?? 0) });
      });
      const grupos = Array.from(gruposMap.values()).sort((a, b) => b.total - a.total);

      const sumGrupo = (nome: string) => grupos.find((g) => g.grupo === nome)?.total ?? 0;
      const receitaBruta = sumGrupo("receita_bruta") || grupos.filter((g) => g.natureza === "receita").reduce((s, g) => s + g.total, 0);
      const deducoes = sumGrupo("deducoes");
      const receitaLiquida = receitaBruta - deducoes;
      const custos = sumGrupo("custos");
      const lucroBruto = receitaLiquida - custos;
      const despesasOperacionais = sumGrupo("despesas_operacionais") || grupos.filter((g) => g.natureza === "despesa" && g.grupo !== "deducoes" && g.grupo !== "custos" && g.grupo !== "outros_resultados").reduce((s, g) => s + g.total, 0);
      const resultadoOperacional = lucroBruto - despesasOperacionais;
      const outrosResultados = sumGrupo("outros_resultados");
      const resultadoLiquido = resultadoOperacional + outrosResultados;
      const margemLiquida = receitaLiquida > 0 ? resultadoLiquido / receitaLiquida : 0;

      return {
        competencia,
        receitaBruta,
        deducoes,
        receitaLiquida,
        custos,
        lucroBruto,
        despesasOperacionais,
        resultadoOperacional,
        outrosResultados,
        resultadoLiquido,
        margemLiquida,
        grupos,
      };
    },
  });
}

// ----------------------------------------------------------------------------
// Fluxo de Caixa — projeção diária (90 dias)
// ----------------------------------------------------------------------------
export type FluxoDia = {
  data: string;
  entradas_previstas: number;
  saidas_previstas: number;
  entradas_realizadas: number;
  saidas_realizadas: number;
  saldo_dia: number;
  saldo_acumulado: number;
};

export function useFluxoCaixa(diasFrente = 90) {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-fluxo-caixa", empresaId, diasFrente],
    enabled: !!empresaId,
    queryFn: async (): Promise<{ saldoInicial: number; dias: FluxoDia[] }> => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10);
      const fim = new Date(hoje.getTime() + diasFrente * 86400000).toISOString().slice(0, 10);

      const [contasRes, fluxoRes] = await Promise.all([
        supabase.from("financeiro_contas").select("saldo_atual").eq("empresa_id", empresaId!).eq("ativa", true),
        supabase
          .from("mv_financeiro_fluxo_caixa" as never)
          .select("*")
          .eq("empresa_id", empresaId!)
          .gte("data", inicio)
          .lte("data", fim)
          .order("data"),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (fluxoRes.error) throw fluxoRes.error;

      const saldoInicial = (contasRes.data ?? []).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);
      const linhas = (fluxoRes.data ?? []) as unknown as Omit<FluxoDia, "saldo_dia" | "saldo_acumulado">[];

      let acumulado = saldoInicial;
      const dias: FluxoDia[] = linhas.map((l) => {
        const entrada = Number(l.entradas_previstas ?? 0) + Number(l.entradas_realizadas ?? 0);
        const saida = Number(l.saidas_previstas ?? 0) + Number(l.saidas_realizadas ?? 0);
        const saldo_dia = entrada - saida;
        acumulado += saldo_dia;
        return {
          data: l.data,
          entradas_previstas: Number(l.entradas_previstas ?? 0),
          saidas_previstas: Number(l.saidas_previstas ?? 0),
          entradas_realizadas: Number(l.entradas_realizadas ?? 0),
          saidas_realizadas: Number(l.saidas_realizadas ?? 0),
          saldo_dia,
          saldo_acumulado: acumulado,
        };
      });

      return { saldoInicial, dias };
    },
  });
}

// ----------------------------------------------------------------------------
// Resumo Visor (próximos 10 dias + cards de hoje + maiores atrasos)
// ----------------------------------------------------------------------------
export type ResumoVisor = {
  saldoTotal: number;
  contasSaldo: Array<{ id: string; nome: string; tipo: string | null; banco: string | null; agencia: string | null; conta: string | null; cor: string | null; saldoAtual: number; ativa: boolean }>;
  proximos10Dias: Array<{ data: string; previstoPagar: number; previstoReceber: number; saldoProjetado: number }>;
  hojePagar: { qtd: number; total: number; atraso: number };
  hojeReceber: { qtd: number; total: number; atraso: number };
  topAtrasosPagar: Array<{ id: string; descricao: string; pessoa: string; diasAtraso: number; valor: number; vencimento: string }>;
  topAtrasosReceber: Array<{ id: string; descricao: string; pessoa: string; diasAtraso: number; valor: number; vencimento: string }>;
  inadimplenciaMesPct: number;
  runwayDias: number | null;
};

export function useResumoVisorFinanceiro() {
  const empresaId = useEmpresaId();
  return useQuery({
    queryKey: ["fin-resumo-visor", empresaId],
    enabled: !!empresaId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<ResumoVisor> => {
      const hoje = new Date();
      const hojeStr = hoje.toISOString().slice(0, 10);
      const fim10 = new Date(hoje);
      fim10.setDate(fim10.getDate() + 10);
      const fim10Str = fim10.toISOString().slice(0, 10);
      const inicio30 = new Date(hoje);
      inicio30.setDate(inicio30.getDate() - 30);
      const inicio30Str = inicio30.toISOString().slice(0, 10);
      const mesAtual = hoje.toISOString().slice(0, 7);

      const [contasRes, futurosRes, atrasosRes, mesRes] = await Promise.all([
        supabase.from("financeiro_contas").select("id, nome, tipo, banco_nome, agencia, conta, cor, saldo_atual, ativa, ordem").eq("empresa_id", empresaId!).order("ordem", { ascending: true }),
        supabase
          .from("financeiro_lancamentos")
          .select("id, valor, tipo, status, data_vencimento")
          .eq("empresa_id", empresaId!)
          .in("status", ["previsto", "em_atraso"])
          .gte("data_vencimento", hojeStr)
          .lte("data_vencimento", fim10Str)
          .limit(2000),
        supabase
          .from("financeiro_lancamentos")
          .select("id, descricao, valor, tipo, status, data_vencimento, pessoa:financeiro_pessoas(nome)")
          .eq("empresa_id", empresaId!)
          .in("status", ["previsto", "em_atraso"])
          .lt("data_vencimento", hojeStr)
          .order("data_vencimento", { ascending: true })
          .limit(500),
        supabase
          .from("financeiro_lancamentos")
          .select("valor, tipo, status, natureza, data_realizado, data_competencia")
          .eq("empresa_id", empresaId!)
          .gte("data_competencia", inicio30Str)
          .limit(2000),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (futurosRes.error) throw futurosRes.error;
      if (atrasosRes.error) throw atrasosRes.error;
      if (mesRes.error) throw mesRes.error;

      const contasRows = (contasRes.data ?? []) as Array<{ id: string; nome: string; tipo: string | null; banco_nome: string | null; agencia: string | null; conta: string | null; cor: string | null; saldo_atual: number | null; ativa: boolean }>;
      const contasSaldo = contasRows.map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        banco: c.banco_nome,
        agencia: c.agencia,
        conta: c.conta,
        cor: c.cor,
        saldoAtual: Number(c.saldo_atual ?? 0),
        ativa: c.ativa,
      }));
      const saldoTotal = contasSaldo.filter((c) => c.ativa).reduce((s, c) => s + c.saldoAtual, 0);

      // Próximos 10 dias
      const buckets = new Map<string, { previstoPagar: number; previstoReceber: number }>();
      for (let i = 0; i < 10; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), { previstoPagar: 0, previstoReceber: 0 });
      }
      (futurosRes.data ?? []).forEach((l) => {
        const k = (l.data_vencimento ?? "").slice(0, 10);
        const b = buckets.get(k);
        if (!b) return;
        const v = Number(l.valor ?? 0);
        if (l.tipo === "a_pagar") b.previstoPagar += v;
        else if (l.tipo === "a_receber") b.previstoReceber += v;
      });
      let saldoAcumulado = saldoTotal;
      const proximos10Dias = Array.from(buckets.entries()).map(([data, v]) => {
        saldoAcumulado += v.previstoReceber - v.previstoPagar;
        return { data, previstoPagar: v.previstoPagar, previstoReceber: v.previstoReceber, saldoProjetado: saldoAcumulado };
      });

      // Hoje (a pagar / a receber)
      const futuros = futurosRes.data ?? [];
      const atrasos = atrasosRes.data ?? [];
      const hojePagarLancs = futuros.filter((l) => l.data_vencimento === hojeStr && l.tipo === "a_pagar");
      const hojeReceberLancs = futuros.filter((l) => l.data_vencimento === hojeStr && l.tipo === "a_receber");
      const atrasoPagarTot = atrasos.filter((l) => l.tipo === "a_pagar").reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const atrasoReceberTot = atrasos.filter((l) => l.tipo === "a_receber").reduce((s, l) => s + Number(l.valor ?? 0), 0);

      const hojePagar = {
        qtd: hojePagarLancs.length,
        total: hojePagarLancs.reduce((s, l) => s + Number(l.valor ?? 0), 0),
        atraso: atrasoPagarTot,
      };
      const hojeReceber = {
        qtd: hojeReceberLancs.length,
        total: hojeReceberLancs.reduce((s, l) => s + Number(l.valor ?? 0), 0),
        atraso: atrasoReceberTot,
      };

      // Top atrasos
      const mapAtraso = (l: typeof atrasos[number]) => {
        const venc = new Date(l.data_vencimento ?? hojeStr);
        const dias = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000));
        return {
          id: l.id,
          descricao: l.descricao ?? "Sem descrição",
          pessoa: (l.pessoa as { nome?: string } | null)?.nome ?? "—",
          diasAtraso: dias,
          valor: Number(l.valor ?? 0),
          vencimento: l.data_vencimento ?? "",
        };
      };
      const topAtrasosPagar = atrasos.filter((l) => l.tipo === "a_pagar").map(mapAtraso).sort((a, b) => b.diasAtraso - a.diasAtraso).slice(0, 5);
      const topAtrasosReceber = atrasos.filter((l) => l.tipo === "a_receber").map(mapAtraso).sort((a, b) => b.diasAtraso - a.diasAtraso).slice(0, 5);

      // Inadimplência mês = atraso a receber / (recebido + atraso) do mês
      const lancsMes = (mesRes.data ?? []).filter((l) => (l.data_competencia ?? "").startsWith(mesAtual));
      const recebidoMes = lancsMes.filter((l) => l.tipo === "a_receber" && (l.status === "realizado" || l.status === "conciliado")).reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const atrasoReceberMes = lancsMes.filter((l) => l.tipo === "a_receber" && l.status === "em_atraso").reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const baseInad = recebidoMes + atrasoReceberMes;
      const inadimplenciaMesPct = baseInad > 0 ? (atrasoReceberMes / baseInad) * 100 : 0;

      // Runway = saldo / (despesa média diária dos últimos 30 dias)
      const despesa30 = (mesRes.data ?? [])
        .filter((l) => l.natureza === "despesa" && (l.status === "realizado" || l.status === "conciliado"))
        .reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const despDiaria = despesa30 / 30;
      const runwayDias = despDiaria > 0 ? Math.floor(saldoTotal / despDiaria) : null;

      return {
        saldoTotal,
        contasSaldo,
        proximos10Dias,
        hojePagar,
        hojeReceber,
        topAtrasosPagar,
        topAtrasosReceber,
        inadimplenciaMesPct,
        runwayDias,
      };
    },
  });
}

export function useRefreshFinanceiroViews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_financeiro_views" as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-dre"] });
      qc.invalidateQueries({ queryKey: ["fin-fluxo-caixa"] });
      toast.success("Relatórios atualizados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
