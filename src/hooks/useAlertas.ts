import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TipoAlerta =
  | "novo_edital" | "alteracao" | "suspensao"
  | "cancelamento" | "homologacao" | "resultado";

export type FonteAlerta = "PNCP" | "DOU" | "DOE" | "ComprasNet" | "sistema";

export interface Alerta {
  id: string;
  user_id: string;
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  orgao?: string;
  uf?: string;
  segmento?: string;
  numero_processo?: string;
  numero_pregao?: string;
  cnpj_orgao?: string;
  valor_estimado?: number;
  data_abertura?: string;
  url_edital?: string;
  url_publicacao?: string;
  fonte: FonteAlerta;
  lido: boolean;
  arquivado: boolean;
  urgente: boolean;
  created_at: string;
}

export interface FiltrosAlertas {
  tipos?: TipoAlerta[];
  ufs?: string[];
  lido?: boolean;
  arquivado?: boolean;
  urgente?: boolean;
  dataInicio?: string;
  dataFim?: string;
}

export interface PreferenciasAlertas {
  id?: string;
  cnpj?: string;
  razao_social?: string;
  segmentos: string[];
  ufs: string[];
  receber_editais: boolean;
  receber_alteracoes: boolean;
  receber_suspensoes: boolean;
  receber_cancelamentos: boolean;
  receber_homologacoes: boolean;
  canal_email: boolean;
  canal_whatsapp: boolean;
  canal_push: boolean;
  email_notificacao?: string;
  whatsapp_notificacao?: string;
  frequencia: "imediato" | "diario" | "semanal";
  ativo: boolean;
}

export interface Segmento {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  ativo: boolean;
}

export const useAlertas = () => {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [total, setTotal] = useState(0);
  const [naoLidos, setNaoLidos] = useState(0);
  const [urgentes, setUrgentes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 20;

  const buscarAlertas = useCallback(async (filtros: FiltrosAlertas = {}) => {
    if (!user?.id) return;
    setLoading(true);
    setErro(null);
    try {
      let query = supabase
        .from("alertas_gerados" as any)
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .eq("arquivado", filtros.arquivado ?? false);

      if (filtros.tipos?.length) query = query.in("tipo", filtros.tipos);
      if (filtros.ufs?.length) query = query.in("uf", filtros.ufs);
      if (filtros.lido !== undefined) query = query.eq("lido", filtros.lido);
      if (filtros.urgente !== undefined) query = query.eq("urgente", filtros.urgente);
      if (filtros.dataInicio) query = query.gte("created_at", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("created_at", filtros.dataFim);

      query = query
        .order("urgente", { ascending: false })
        .order("created_at", { ascending: false })
        .range((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      setAlertas((data as any[]) ?? []);
      setTotal(count ?? 0);
    } catch (e: any) {
      console.error("Falha ao buscar alertas", e);
      setErro("Não foi possível carregar os alertas.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, pagina]);

  const atualizarContadores = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ count: nl }, { count: urg }] = await Promise.all([
        supabase.from("alertas_gerados" as any).select("*", { count: "exact", head: true })
          .eq("user_id", user.id).eq("lido", false).eq("arquivado", false),
        supabase.from("alertas_gerados" as any).select("*", { count: "exact", head: true })
          .eq("user_id", user.id).eq("urgente", true).eq("lido", false).eq("arquivado", false),
      ]);
      setNaoLidos(nl ?? 0);
      setUrgentes(urg ?? 0);
    } catch (e) {
      console.warn("Falha ao buscar contadores", e);
    }
  }, [user?.id]);

  const marcarComoLido = useCallback(async (alertaId: string) => {
    try {
      await supabase.from("alertas_gerados" as any)
        .update({ lido: true }).eq("id", alertaId).eq("user_id", user?.id);
      setAlertas(prev => prev.map(a => a.id === alertaId ? { ...a, lido: true } : a));
      setNaoLidos(prev => Math.max(0, prev - 1));
    } catch (e) { console.warn("Falha ao marcar alerta como lido", e); }
  }, [user?.id]);

  const arquivar = useCallback(async (alertaId: string) => {
    try {
      await supabase.from("alertas_gerados" as any)
        .update({ arquivado: true, lido: true }).eq("id", alertaId).eq("user_id", user?.id);
      setAlertas(prev => prev.filter(a => a.id !== alertaId));
    } catch (e) { console.warn("Falha ao arquivar alerta", e); }
  }, [user?.id]);

  const marcarTodosLidos = useCallback(async () => {
    try {
      await supabase.from("alertas_gerados" as any)
        .update({ lido: true }).eq("user_id", user?.id).eq("lido", false);
      setAlertas(prev => prev.map(a => ({ ...a, lido: true })));
      setNaoLidos(0);
    } catch (e) { console.warn("Falha ao marcar todos como lidos", e); }
  }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const canal = supabase.channel(`alertas_${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alertas_gerados",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const novoAlerta = payload.new as Alerta;
        setAlertas(prev => [novoAlerta, ...prev]);
        setNaoLidos(prev => prev + 1);
        if (novoAlerta.urgente) setUrgentes(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [user?.id]);

  useEffect(() => { atualizarContadores(); }, [atualizarContadores]);

  return {
    alertas, total, naoLidos, urgentes, loading, erro, pagina,
    totalPaginas: Math.ceil(total / ITENS_POR_PAGINA),
    buscarAlertas, marcarComoLido, arquivar,
    marcarTodosLidos, setPagina, atualizarContadores,
  };
};

export const usePreferenciasAlertas = () => {
  const { user } = useAuth();
  const [preferencias, setPreferencias] = useState<PreferenciasAlertas | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscarPreferencias = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("preferencias_alertas" as any)
        .select("*").eq("user_id", user.id).maybeSingle();
      setPreferencias(data as any);
    } finally { setLoading(false); }
  }, [user?.id]);

  const salvarPreferencias = useCallback(async (prefs: Partial<PreferenciasAlertas>) => {
    if (!user?.id) return false;
    setSalvando(true);
    try {
      const payload = { ...prefs, user_id: user.id, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase.from("preferencias_alertas" as any)
        .select("id").eq("user_id", user.id).maybeSingle();

      if (existing) {
        const { error } = await supabase.from("preferencias_alertas" as any)
          .update(payload).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("preferencias_alertas" as any)
          .insert(payload);
        if (error) throw error;
      }
      setPreferencias(prev => ({ ...prev, ...prefs } as PreferenciasAlertas));
      return true;
    } catch (e) {
      console.error("Falha ao salvar preferências", e);
      return false;
    } finally { setSalvando(false); }
  }, [user?.id]);

  useEffect(() => { buscarPreferencias(); }, [buscarPreferencias]);

  return { preferencias, loading, salvando, salvarPreferencias, buscarPreferencias };
};

export const useSegmentos = () => {
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("segmentos_licitacao" as any)
        .select("*")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      setSegmentos((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const categorias = [...new Set(segmentos.map(s => s.categoria))];

  return { segmentos, categorias, loading };
};
