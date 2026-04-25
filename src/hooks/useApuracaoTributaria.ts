import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import {
  calcularSimples, calcularPresumido, calcularReal,
  type AnexoSimples, type ResultadoSimples, type ResultadoPresumido, type ResultadoReal,
} from "@/lib/financeiro/simples-nacional-2026";

export type Regime = "simples" | "presumido" | "real";

export interface ConfigTributaria {
  empresa_id: string;
  regime: Regime;
  anexo_simples: AnexoSimples | null;
  presuncao_irpj_comercio: number;
  presuncao_irpj_servico: number;
  presuncao_csll_comercio: number;
  presuncao_csll_servico: number;
  aliquota_pis: number;
  aliquota_cofins: number;
  aliquota_pis_nc: number;
  aliquota_cofins_nc: number;
  aliquota_irpj: number;
  adicional_irpj: number;
  limite_adicional_irpj: number;
  aliquota_csll: number;
  aliquota_iss: number;
  aliquota_icms: number;
}

export interface Apuracao {
  id: string;
  empresa_id: string;
  competencia: string;
  regime: Regime;
  receita_bruta_comercio: number;
  receita_bruta_servico: number;
  receita_bruta_total: number;
  rbt12: number;
  valor_simples: number;
  aliquota_efetiva_simples: number;
  valor_irpj: number;
  valor_adicional_irpj: number;
  valor_csll: number;
  valor_pis: number;
  valor_cofins: number;
  valor_iss: number;
  valor_icms: number;
  valor_total: number;
  status: "rascunho" | "apurado" | "pago";
  pago_em: string | null;
  observacoes: string | null;
  detalhes: any;
  created_at: string;
  apuracao_desatualizada?: boolean;
  desatualizada_motivo?: string | null;
  desatualizada_em?: string | null;
}

const DEFAULT_CONFIG: Omit<ConfigTributaria, "empresa_id"> = {
  regime: "simples",
  anexo_simples: 1,
  presuncao_irpj_comercio: 8,
  presuncao_irpj_servico: 32,
  presuncao_csll_comercio: 12,
  presuncao_csll_servico: 32,
  aliquota_pis: 0.65,
  aliquota_cofins: 3,
  aliquota_pis_nc: 1.65,
  aliquota_cofins_nc: 7.6,
  aliquota_irpj: 15,
  adicional_irpj: 10,
  limite_adicional_irpj: 20000,
  aliquota_csll: 9,
  aliquota_iss: 5,
  aliquota_icms: 18,
};

export function useApuracaoTributaria() {
  const { empresaAtiva } = useEmpresa();
  const [config, setConfig] = useState<ConfigTributaria | null>(null);
  const [apuracoes, setApuracoes] = useState<Apuracao[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    try {
      const { data: cfg } = await (supabase as any)
        .from("financeiro_config_tributaria")
        .select("*")
        .eq("empresa_id", empresaAtiva.id)
        .maybeSingle();

      setConfig(cfg ?? { empresa_id: empresaAtiva.id, ...DEFAULT_CONFIG });

      const { data: aps } = await (supabase as any)
        .from("financeiro_apuracoes")
        .select("*")
        .eq("empresa_id", empresaAtiva.id)
        .order("competencia", { ascending: false })
        .limit(24);
      setApuracoes(aps ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar apurações: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [empresaAtiva?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarConfig = useCallback(async (novo: Partial<ConfigTributaria>) => {
    if (!empresaAtiva?.id || !config) return;
    const merged = { ...config, ...novo, empresa_id: empresaAtiva.id };
    const { error } = await (supabase as any)
      .from("financeiro_config_tributaria")
      .upsert(merged, { onConflict: "empresa_id" });
    if (error) { toast.error("Erro: " + error.message); return; }
    setConfig(merged);
    toast.success("Configuração tributária salva.");
  }, [empresaAtiva?.id, config]);

  const buscarReceita = useCallback(async (competencia: string) => {
    if (!empresaAtiva?.id) return null;
    const { data, error } = await (supabase as any).rpc("financeiro_receita_competencia", {
      p_empresa_id: empresaAtiva.id,
      p_competencia: competencia,
    });
    if (error) { toast.error("Erro: " + error.message); return null; }
    return data as { comercio: number; servico: number; total: number; rbt12: number };
  }, [empresaAtiva?.id]);

  const calcular = useCallback((
    receitaComercio: number,
    receitaServico: number,
    rbt12: number,
    despesasOperacionais = 0,
    creditosPisCofins = 0,
  ): { simples?: ResultadoSimples; presumido?: ResultadoPresumido; real?: ResultadoReal } => {
    if (!config) return {};
    const receitaMes = receitaComercio + receitaServico;

    if (config.regime === "simples") {
      const anexo = (config.anexo_simples ?? 1) as AnexoSimples;
      return { simples: calcularSimples(rbt12, receitaMes, anexo) };
    }
    if (config.regime === "presumido") {
      return {
        presumido: calcularPresumido({
          receitaComercio, receitaServico,
          presuncaoIrpjComercio: config.presuncao_irpj_comercio,
          presuncaoIrpjServico: config.presuncao_irpj_servico,
          presuncaoCsllComercio: config.presuncao_csll_comercio,
          presuncaoCsllServico: config.presuncao_csll_servico,
          aliquotaIrpj: config.aliquota_irpj,
          adicionalIrpj: config.adicional_irpj,
          limiteAdicionalIrpj: config.limite_adicional_irpj,
          aliquotaCsll: config.aliquota_csll,
          aliquotaPis: config.aliquota_pis,
          aliquotaCofins: config.aliquota_cofins,
          aliquotaIss: config.aliquota_iss,
          aliquotaIcms: config.aliquota_icms,
        }),
      };
    }
    return {
      real: calcularReal({
        receitaComercio, receitaServico, despesasOperacionais,
        aliquotaIrpj: config.aliquota_irpj,
        adicionalIrpj: config.adicional_irpj,
        limiteAdicionalIrpj: config.limite_adicional_irpj,
        aliquotaCsll: config.aliquota_csll,
        aliquotaPisNc: config.aliquota_pis_nc,
        aliquotaCofinsNc: config.aliquota_cofins_nc,
        creditosPisCofins,
        aliquotaIss: config.aliquota_iss,
        aliquotaIcms: config.aliquota_icms,
      }),
    };
  }, [config]);

  const salvarApuracao = useCallback(async (
    competencia: string,
    receitaComercio: number,
    receitaServico: number,
    rbt12: number,
    resultado: ReturnType<typeof calcular>,
  ) => {
    if (!empresaAtiva?.id || !config) return;
    const r = resultado.simples ?? resultado.presumido ?? resultado.real;
    if (!r) return;

    const total = "valorDevido" in r ? r.valorDevido : r.total;
    const payload: any = {
      empresa_id: empresaAtiva.id,
      competencia,
      regime: config.regime,
      receita_bruta_comercio: receitaComercio,
      receita_bruta_servico: receitaServico,
      receita_bruta_total: receitaComercio + receitaServico,
      rbt12,
      valor_total: total,
      detalhes: r,
      status: "apurado",
    };

    if (resultado.simples) {
      payload.valor_simples = resultado.simples.valorDevido;
      payload.aliquota_efetiva_simples = resultado.simples.aliquotaEfetiva;
    } else if (resultado.presumido) {
      Object.assign(payload, {
        base_irpj: resultado.presumido.baseIrpj,
        base_csll: resultado.presumido.baseCsll,
        base_pis_cofins: resultado.presumido.receitaTotal,
        valor_irpj: resultado.presumido.irpj,
        valor_adicional_irpj: resultado.presumido.adicionalIrpj,
        valor_csll: resultado.presumido.csll,
        valor_pis: resultado.presumido.pis,
        valor_cofins: resultado.presumido.cofins,
        valor_iss: resultado.presumido.iss,
        valor_icms: resultado.presumido.icms,
      });
    } else if (resultado.real) {
      Object.assign(payload, {
        base_irpj: resultado.real.lucroAntesIRCSLL,
        base_csll: resultado.real.lucroAntesIRCSLL,
        base_pis_cofins: resultado.real.receitaTotal,
        valor_irpj: resultado.real.irpj,
        valor_adicional_irpj: resultado.real.adicionalIrpj,
        valor_csll: resultado.real.csll,
        valor_pis: resultado.real.pis,
        valor_cofins: resultado.real.cofins,
        valor_iss: resultado.real.iss,
        valor_icms: resultado.real.icms,
      });
    }

    const { error } = await (supabase as any)
      .from("financeiro_apuracoes")
      .upsert(payload, { onConflict: "empresa_id,competencia,regime" });
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Apuração salva com sucesso.");
    await carregar();
  }, [empresaAtiva?.id, config, carregar]);

  const marcarComoPago = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("financeiro_apuracoes")
      .update({ status: "pago", pago_em: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Apuração marcada como paga.");
    await carregar();
  }, [carregar]);

  return {
    config, apuracoes, loading,
    salvarConfig, buscarReceita, calcular, salvarApuracao, marcarComoPago, carregar,
  };
}
