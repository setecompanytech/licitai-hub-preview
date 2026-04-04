import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FiltrosEditais {
  termo?: string;
  uf?: string;
  modalidadeId?: number;
  valorMin?: number;
  valorMax?: number;
  srp?: boolean;
  apenasAbertos?: boolean;
  municipio?: string;
}

export interface EditalCache {
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
  valor_total_homologado: number | null;
  uf: string | null;
  municipio: string | null;
  data_publicacao_pncp: string | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  link_sistema_origem: string | null;
  url_pncp: string | null;
  srp: boolean | null;
  tipo_instrumento: string | null;
  retificacao: boolean;
  versao: number;
}

export interface SyncStatus {
  ultimaSincronizacao: string | null;
  novos: number;
  totalRegistros: number;
}

const PAGE_SIZE = 20;

export function useEditaisPNCP(filtros: FiltrosEditais = {}) {
  const [editais, setEditais] = useState<EditalCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    ultimaSincronizacao: null,
    novos: 0,
    totalRegistros: 0,
  });
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;

  const buscar = useCallback(async (paginaNum: number, acumular: boolean) => {
    setLoading(true);

    let query = supabase
      .from('pncp_editais_cache')
      .select('*', { count: 'exact' })
      .order('data_publicacao_pncp', { ascending: false })
      .range(paginaNum * PAGE_SIZE, (paginaNum + 1) * PAGE_SIZE - 1);

    const f = filtrosRef.current;

    // FTS: full-text search em português (usa o índice GIN criado)
    if (f.termo && f.termo.trim().length >= 3) {
      const termoFts = f.termo.trim().split(/\s+/).join(' & ');
      query = query.textSearch('objeto', termoFts, { type: 'websearch', config: 'portuguese' });
    }

    if (f.apenasAbertos !== false) {
      query = query.gte('data_encerramento_proposta', new Date().toISOString());
    }

    if (f.uf) query = query.eq('uf', f.uf);
    if (f.modalidadeId) query = query.eq('modalidade_id', f.modalidadeId);
    if (f.valorMin) query = query.gte('valor_total_estimado', f.valorMin);
    if (f.valorMax) query = query.lte('valor_total_estimado', f.valorMax);
    if (f.srp !== undefined) query = query.eq('srp', f.srp);
    if (f.municipio) query = query.ilike('municipio', `%${f.municipio}%`);

    const { data, error, count } = await query;

    if (!error && data) {
      setEditais(prev => acumular ? [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
      if (count !== null) setTotal(count);
    }

    setLoading(false);
  }, []);

  // Carregar sync status via RPC/raw query (table not in generated types yet)
  const carregarSyncStatus = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from('pncp_sync_log')
        .select('concluido_em, novos, total_registros')
        .eq('status', 'sucesso')
        .order('concluido_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSyncStatus({
          ultimaSincronizacao: data.concluido_em,
          novos: data.novos || 0,
          totalRegistros: data.total_registros || 0,
        });
      }
    } catch {
      // Table may not exist yet
    }
  }, []);

  // Reload quando filtros mudam
  useEffect(() => {
    setPagina(0);
    buscar(0, false);
    carregarSyncStatus();
  }, [
    filtros.termo,
    filtros.uf,
    filtros.modalidadeId,
    filtros.valorMin,
    filtros.valorMax,
    filtros.srp,
    filtros.apenasAbertos,
    filtros.municipio,
    buscar,
    carregarSyncStatus,
  ]);

  // Realtime: atualizar automaticamente quando pncp_editais_cache mudar
  useEffect(() => {
    const channel = supabase
      .channel('editais-cache-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pncp_editais_cache' },
        () => {
          // Recarregar primeira página quando novos editais chegam
          buscar(0, false);
          carregarSyncStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buscar, carregarSyncStatus]);

  const carregarMais = useCallback(() => {
    if (loading || !hasMore) return;
    const novaPagina = pagina + 1;
    setPagina(novaPagina);
    buscar(novaPagina, true);
  }, [loading, hasMore, pagina, buscar]);

  const recarregar = useCallback(() => {
    setPagina(0);
    buscar(0, false);
    carregarSyncStatus();
  }, [buscar, carregarSyncStatus]);

  return {
    editais,
    loading,
    hasMore,
    total,
    syncStatus,
    carregarMais,
    recarregar,
  };
}
