import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------
export type TipoVinculo = "clt" | "pro_labore" | "autonomo" | "estagiario" | "terceirizado";
export type StatusCompetencia = "aberta" | "calculada" | "fechada" | "paga" | "cancelada";

export interface Funcionario {
  id: string;
  user_id: string;
  empresa_id: string | null;
  nome: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  tipo_vinculo: TipoVinculo;
  cargo: string | null;
  departamento: string | null;
  salario_base: number;
  carga_horaria_mensal: number | null;
  num_dependentes: number | null;
  vale_transporte: boolean | null;
  vale_refeicao: number | null;
  plano_saude: number | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rubrica {
  id: string;
  user_id: string;
  codigo: string;
  descricao: string;
  tipo: "provento" | "desconto" | "informativo";
  natureza: string | null;
  incide_inss: boolean | null;
  incide_irrf: boolean | null;
  incide_fgts: boolean | null;
  formula: string | null;
  valor_fixo: number | null;
  percentual: number | null;
  ativo: boolean | null;
  ordem: number | null;
}

export interface Competencia {
  id: string;
  user_id: string;
  competencia: string;
  status: StatusCompetencia;
  total_proventos: number | null;
  total_descontos: number | null;
  total_liquido: number | null;
  total_encargos: number | null;
  data_pagamento: string | null;
  observacoes: string | null;
}

export interface Holerite {
  id: string;
  competencia_id: string;
  funcionario_id: string;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  base_inss: number;
  base_irrf: number;
  base_fgts: number;
  valor_inss: number;
  valor_irrf: number;
  valor_fgts: number;
  status: "calculado" | "aprovado" | "pago" | "cancelado";
  data_pagamento: string | null;
  observacoes: string | null;
}

// ----------------------------------------------------------------------------
// Tabelas INSS/IRRF 2026 (Portaria MPS/MF nº 13/2026 + Lei 15.270/2025)
// Implementação detalhada em: src/lib/financeiro/inss-irrf-2026.ts
// ----------------------------------------------------------------------------
import {
  calcularINSS as calcularINSS2026,
  calcularIRRF as calcularIRRF2026,
  DESCONTO_MAXIMO_INSS_2026,
} from "@/lib/financeiro/inss-irrf-2026";

const VALOR_TETO_INSS = DESCONTO_MAXIMO_INSS_2026; // R$ 988,09

/**
 * Calcula INSS pelo método progressivo oficial (2026).
 * API mantida compatível: retorna apenas o valor total do desconto.
 */
export function calcularINSS(salario: number): number {
  return calcularINSS2026(salario).total;
}

/**
 * Calcula IRRF aplicando tabela progressiva + redutor da Reforma 2026.
 * Recebe a base de cálculo (rendimento bruto - INSS) por compatibilidade.
 */
export function calcularIRRF(baseCalculo: number, dependentes: number = 0): number {
  // Reconstrói rendimento bruto aproximado para aplicar o redutor da reforma.
  // Como o chamador já passou (salario - INSS), usamos baseCalculo como rendimento
  // bruto efetivo + INSS já deduzido = 0 (aproximação para retrocompatibilidade).
  const r = calcularIRRF2026({
    rendimentoBruto: baseCalculo,
    inssDescontado: 0,
    dependentes,
  });
  return r.imposto_final;
}

export function calcularFGTS(salario: number): number {
  return salario * 0.08;
}

// ----------------------------------------------------------------------------
// Funcionários
// ----------------------------------------------------------------------------
export function useFuncionarios() {
  return useQuery({
    queryKey: ["fin-folha-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fin_folha_funcionarios" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Funcionario[];
    },
  });
}

export function useUpsertFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Funcionario> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("Não autenticado");
      const body = { ...payload, user_id: u.user.id };
      const q = payload.id
        ? supabase.from("fin_folha_funcionarios" as any).update(body).eq("id", payload.id).select().single()
        : supabase.from("fin_folha_funcionarios" as any).insert(body as any).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-folha-funcionarios"] });
      toast.success("Funcionário salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fin_folha_funcionarios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-folha-funcionarios"] });
      toast.success("Funcionário removido");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ----------------------------------------------------------------------------
// Competências e Holerites
// ----------------------------------------------------------------------------
export function useCompetencias() {
  return useQuery({
    queryKey: ["fin-folha-competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fin_folha_competencias" as any)
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Competencia[];
    },
  });
}

export function useHoleritesCompetencia(competenciaId: string | null) {
  return useQuery({
    queryKey: ["fin-folha-holerites", competenciaId],
    enabled: !!competenciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fin_folha_holerites" as any)
        .select("*, funcionario:fin_folha_funcionarios(nome,cpf,cargo,tipo_vinculo)")
        .eq("competencia_id", competenciaId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useProcessarFolha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competencia }: { competencia: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("Não autenticado");

      // 1) Cria/encontra competência
      const { data: existing } = await supabase
        .from("fin_folha_competencias" as any)
        .select("*")
        .eq("competencia", competencia)
        .maybeSingle();

      let competenciaId: string;
      if (existing) {
        competenciaId = (existing as any).id;
      } else {
        const { data: novaComp, error: e1 } = await supabase
          .from("fin_folha_competencias" as any)
          .insert({ user_id: u.user.id, competencia, status: "aberta" } as any)
          .select()
          .single();
        if (e1) throw e1;
        competenciaId = (novaComp as any).id;
      }

      // 2) Lista funcionários ativos
      const { data: funcs, error: e2 } = await supabase
        .from("fin_folha_funcionarios" as any)
        .select("*")
        .eq("ativo", true);
      if (e2) throw e2;

      // 3) Calcula holerite para cada funcionário
      let totalProventos = 0, totalDescontos = 0, totalLiquido = 0;

      for (const fnc of (funcs ?? []) as any[]) {
        const salario = Number(fnc.salario_base) || 0;
        const proventos: any[] = [{ codigo: "001", descricao: "Salário base", tipo: "provento", valor: salario, ordem: 10 }];
        const descontos: any[] = [];
        let baseInss = salario, baseIrrf = 0, baseFgts = salario;
        let valInss = 0, valIrrf = 0, valFgts = 0;

        if (fnc.tipo_vinculo === "clt") {
          valInss = calcularINSS(baseInss);
          baseIrrf = salario - valInss;
          valIrrf = calcularIRRF(baseIrrf, fnc.num_dependentes ?? 0);
          valFgts = calcularFGTS(baseFgts);
          if (valInss > 0) descontos.push({ codigo: "100", descricao: "INSS", tipo: "desconto", valor: valInss, ordem: 100 });
          if (valIrrf > 0) descontos.push({ codigo: "101", descricao: "IRRF", tipo: "desconto", valor: valIrrf, ordem: 110 });
        } else if (fnc.tipo_vinculo === "pro_labore") {
          valInss = Math.min(calcularINSS(baseInss), VALOR_TETO_INSS);
          baseIrrf = salario - valInss;
          valIrrf = calcularIRRF(baseIrrf, fnc.num_dependentes ?? 0);
          if (valInss > 0) descontos.push({ codigo: "100", descricao: "INSS Pró-labore", tipo: "desconto", valor: valInss, ordem: 100 });
          if (valIrrf > 0) descontos.push({ codigo: "101", descricao: "IRRF", tipo: "desconto", valor: valIrrf, ordem: 110 });
        } else if (fnc.tipo_vinculo === "autonomo") {
          valInss = Math.min(salario * 0.11, VALOR_TETO_INSS);
          baseIrrf = salario - valInss;
          valIrrf = calcularIRRF(baseIrrf, fnc.num_dependentes ?? 0);
          if (valInss > 0) descontos.push({ codigo: "100", descricao: "INSS Autônomo (11%)", tipo: "desconto", valor: valInss, ordem: 100 });
          if (valIrrf > 0) descontos.push({ codigo: "101", descricao: "IRRF", tipo: "desconto", valor: valIrrf, ordem: 110 });
        }

        if (Number(fnc.plano_saude) > 0) descontos.push({ codigo: "200", descricao: "Plano de Saúde", tipo: "desconto", valor: Number(fnc.plano_saude), ordem: 200 });
        if (fnc.vale_transporte) {
          const vt = Math.min(salario * 0.06, salario * 0.06);
          descontos.push({ codigo: "201", descricao: "Vale-transporte (6%)", tipo: "desconto", valor: vt, ordem: 201 });
        }

        const totProv = proventos.reduce((a, b) => a + Number(b.valor), 0);
        const totDesc = descontos.reduce((a, b) => a + Number(b.valor), 0);
        const liquido = totProv - totDesc;

        // Upsert holerite
        const { data: hol, error: e3 } = await supabase
          .from("fin_folha_holerites" as any)
          .upsert({
            user_id: u.user.id,
            competencia_id: competenciaId,
            funcionario_id: fnc.id,
            total_proventos: totProv,
            total_descontos: totDesc,
            total_liquido: liquido,
            base_inss: baseInss,
            base_irrf: baseIrrf,
            base_fgts: baseFgts,
            valor_inss: valInss,
            valor_irrf: valIrrf,
            valor_fgts: valFgts,
            status: "calculado",
          } as any, { onConflict: "competencia_id,funcionario_id" })
          .select()
          .single();
        if (e3) throw e3;

        // Limpa itens antigos e insere novos
        await supabase.from("fin_folha_holerite_itens" as any).delete().eq("holerite_id", (hol as any).id);
        const itens = [...proventos, ...descontos].map(i => ({
          ...i, user_id: u.user.id, holerite_id: (hol as any).id,
        }));
        if (itens.length > 0) {
          const { error: e4 } = await supabase.from("fin_folha_holerite_itens" as any).insert(itens as any);
          if (e4) throw e4;
        }

        totalProventos += totProv;
        totalDescontos += totDesc;
        totalLiquido += liquido;
      }

      // 4) Atualiza totais da competência
      const totalEncargos = totalProventos * 0.268; // INSS Patronal 20% + RAT 1-3% + Terceiros 5.8% ≈ 26.8%
      await supabase
        .from("fin_folha_competencias" as any)
        .update({
          total_proventos: totalProventos,
          total_descontos: totalDescontos,
          total_liquido: totalLiquido,
          total_encargos: totalEncargos,
          status: "calculada",
        } as any)
        .eq("id", competenciaId);

      // 5) Encargos
      await supabase.from("fin_folha_encargos" as any).upsert({
        user_id: u.user.id,
        competencia_id: competenciaId,
        base_calculo: totalProventos,
        inss_patronal: totalProventos * 0.20,
        rat: totalProventos * 0.02,
        terceiros: totalProventos * 0.058,
        fgts_patronal: totalProventos * 0.08,
        total_encargos: totalEncargos,
      } as any);

      return { competenciaId, totalProventos, totalDescontos, totalLiquido, totalEncargos };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fin-folha-competencias"] });
      qc.invalidateQueries({ queryKey: ["fin-folha-holerites"] });
      toast.success(`Folha processada — Líquido R$ ${r.totalLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}
