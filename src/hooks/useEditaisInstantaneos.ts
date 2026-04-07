import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODALIDADE_PNCP, ESFERA_PNCP, MUNICIPIO_IBGE } from "@/constants/pncpMappings";

export type FiltrosBusca = {
  q: string;
  uf: string;
  municipioIbge: string;
  municipioNome: string;
  esfera: string;
  modalidade: string;
  segmento: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
  ordenacao: "data_publicacao" | "data_abertura" | "valor";
  direcao: "asc" | "desc";
  pagina: number;
};

export type EditalInstantaneo = {
  id: string;
  pncp_id: string;
  numero_controle_pncp: string | null;
  cnpj_orgao: string | null;
  ano_compra: string | null;
  sequencial_compra: string | null;
  numero_compra: string | null;
  orgao: string | null;
  unidade_orgao: string | null;
  objeto: string | null;
  modalidade_id: number | null;
  modalidade_nome: string | null;
  situacao: string | null;
  valor_total_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  municipio_ibge: string | null;
  esfera_id: string | null;
  data_publicacao_pncp: string | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  link_sistema_origem: string | null;
  url_pncp: string | null;
  tipo_instrumento: string | null;
  srp: boolean | null;
  fonte: string | null;
  link_comprasnet: string | null;
  lei_base: string | null;
  total_count: number;
  rank_busca: number;
};

const TAMANHO_PAGINA = 20;

const FILTROS_PADRAO: FiltrosBusca = {
  q: "",
  uf: "",
  municipioIbge: "",
  municipioNome: "",
  esfera: "",
  modalidade: "Todos",
  segmento: "",
  dataInicio: "",
  dataFim: "",
  ordenacao: "data_publicacao",
  direcao: "desc",
  pagina: 1,
};

export const useEditaisInstantaneos = () => {
  const [filtros, setFiltros] = useState<FiltrosBusca>({ ...FILTROS_PADRAO });
  const [editais, setEditais] = useState<EditalInstantaneo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const filtrosAtivos = useMemo(() => {
    return [
      filtros.q.trim() !== "",
      filtros.uf !== "",
      filtros.municipioIbge !== "",
      filtros.esfera !== "",
      filtros.modalidade !== "Todos",
      filtros.segmento !== "",
      filtros.dataInicio !== "",
      filtros.dataFim !== "",
    ].filter(Boolean).length;
  }, [filtros]);

  // ── BUSCA INSTANTÂNEA NO BANCO LOCAL ─────────────────────────
  const buscar = useCallback(async (f: FiltrosBusca) => {
    setLoading(true);
    setErro(null);

    try {
      const modalidadeId =
        f.modalidade !== "Todos"
          ? (MODALIDADE_PNCP[f.modalidade] ?? null)
          : null;
      const esferaCodigo = f.esfera ? (ESFERA_PNCP[f.esfera] ?? null) : null;

      const { data, error } = await supabase.rpc(
        "busca_editais_instantanea" as any,
        {
          p_q: f.q.trim() || null,
          p_uf: f.uf || null,
          p_municipio_ibge: f.municipioIbge || null,
          p_esfera: esferaCodigo,
          p_modalidade_id: modalidadeId,
          p_segmento: f.segmento || null,
          p_data_inicio: f.dataInicio || null,
          p_data_fim: f.dataFim || null,
          p_ordenacao: f.ordenacao,
          p_direcao: f.direcao,
          p_pagina: f.pagina,
          p_tamanho: TAMANHO_PAGINA,
        }
      );

      if (error) throw error;

      const items = (data ?? []) as EditalInstantaneo[];
      setEditais(items);
      setTotal(items.length > 0 ? Number(items[0].total_count) : 0);
    } catch (e: any) {
      console.error("[BUSCA INSTANTÂNEA] Erro:", e);
      setErro("Falha na busca: " + (e.message || "erro desconhecido"));
      setEditais([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── DISPARO COM DEBOUNCE ────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const delay = filtros.q !== "" ? 300 : 0;
    debounceRef.current = setTimeout(() => buscar(filtros), delay);
    return () => clearTimeout(debounceRef.current);
  }, [filtros, buscar]);

  // ── ÚLTIMA SINCRONIZAÇÃO ────────────────────────────────
  useEffect(() => {
    supabase
      .from("pncp_editais_cache")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.updated_at) setUltimaSync(new Date(data.updated_at));
      });
  }, []);

  // ── REALTIME: recarregar quando novos editais chegam ────────
  useEffect(() => {
    const canal = supabase
      .channel("editais_instantaneos_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pncp_editais_cache" },
        () => {
          setUltimaSync(new Date());
          buscar(filtros);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [filtros, buscar]);

  const atualizarFiltros = useCallback((novos: Partial<FiltrosBusca>) => {
    setFiltros((prev) => ({ ...prev, ...novos, pagina: 1 }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltros({ ...FILTROS_PADRAO });
  }, []);

  const irParaPagina = useCallback((pagina: number) => {
    setFiltros((prev) => ({ ...prev, pagina }));
  }, []);

  return {
    filtros,
    editais,
    total,
    loading,
    erro,
    filtrosAtivos,
    ultimaSync,
    atualizarFiltros,
    limparFiltros,
    irParaPagina,
    buscar,
    TAMANHO_PAGINA,
  };
};