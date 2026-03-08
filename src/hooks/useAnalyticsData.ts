import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

export type ModalidadeBreakdown = {
  modalidade: string;
  total: number;
  ganhas: number;
  perdidas: number;
  emAndamento: number;
  valorGanho: number;
};

export type StatusBreakdown = {
  status: string;
  count: number;
  color: string;
};

export type UfBreakdown = {
  uf: string;
  total: number;
  ganhas: number;
  perdidas: number;
};

export type TimelineItem = {
  mes: string;
  pregao_ganhas: number;
  pregao_perdidas: number;
  dispensa_ganhas: number;
  dispensa_perdidas: number;
  emAndamento: number;
};

export type AnalyticsKpis = {
  totalProcessos: number;
  ganhas: number;
  perdidas: number;
  emAndamento: number;
  taxaVitoria: number;
  valorTotalGanho: number;
  valorEmDisputa: number;
  pregoes: number;
  dispensas: number;
  pregoesGanhos: number;
  dispensasGanhas: number;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const STATUS_GANHO = ['Vencida', 'vencida', 'Homologada'];
const STATUS_PERDIDO = ['Perdida', 'perdida'];
const STATUS_ANDAMENTO = ['Monitorando', 'Analisando', 'Proposta Enviada', 'enviada', 'proposta', 'Em Disputa', 'Publicado'];

const STATUS_COLORS: Record<string, string> = {
  'Monitorando': 'hsl(210, 100%, 40%)',
  'Analisando': 'hsl(38, 92%, 50%)',
  'Proposta Enviada': 'hsl(174, 72%, 40%)',
  'enviada': 'hsl(174, 72%, 40%)',
  'proposta': 'hsl(174, 72%, 40%)',
  'Em Disputa': 'hsl(280, 60%, 50%)',
  'Publicado': 'hsl(220, 14%, 60%)',
  'Vencida': 'hsl(142, 71%, 45%)',
  'vencida': 'hsl(142, 71%, 45%)',
  'Homologada': 'hsl(142, 71%, 35%)',
  'Perdida': 'hsl(0, 72%, 51%)',
  'perdida': 'hsl(0, 72%, 51%)',
  'Arquivada': 'hsl(220, 14%, 40%)',
};

function isDispensa(modalidade: string) {
  return modalidade?.toLowerCase().includes('dispensa');
}

function isPregao(modalidade: string) {
  return modalidade?.toLowerCase().includes('pregão') || modalidade?.toLowerCase().includes('pregao');
}

export function useAnalyticsData() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const [licitacoes, setLicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, valor_adjudicado, uf, municipio, data_abertura, data_encerramento, created_at, updated_at')
      .eq('user_id', user.id);

    if (!todasSelecionadas && empresaAtiva) {
      q = q.eq('empresa_id', empresaAtiva.id);
    }

    const { data } = await q;
    setLicitacoes(data || []);
    setLoading(false);
  }, [user, empresaAtiva, todasSelecionadas]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('analytics-licitacoes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licitacoes', filter: `user_id=eq.${user.id}` },
        () => { loadData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  // Compute KPIs
  const kpis: AnalyticsKpis = (() => {
    const ganhas = licitacoes.filter(l => STATUS_GANHO.includes(l.status));
    const perdidas = licitacoes.filter(l => STATUS_PERDIDO.includes(l.status));
    const emAndamento = licitacoes.filter(l => STATUS_ANDAMENTO.includes(l.status));
    const totalDecididas = ganhas.length + perdidas.length;
    const taxa = totalDecididas > 0 ? (ganhas.length / totalDecididas) * 100 : 0;
    const valorGanho = ganhas.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
    const valorDisputa = emAndamento.reduce((s, l) => s + (l.valor_estimado || 0), 0);

    const pregoes = licitacoes.filter(l => isPregao(l.modalidade));
    const dispensas = licitacoes.filter(l => isDispensa(l.modalidade));

    return {
      totalProcessos: licitacoes.length,
      ganhas: ganhas.length,
      perdidas: perdidas.length,
      emAndamento: emAndamento.length,
      taxaVitoria: Math.round(taxa * 10) / 10,
      valorTotalGanho: valorGanho,
      valorEmDisputa: valorDisputa,
      pregoes: pregoes.length,
      dispensas: dispensas.length,
      pregoesGanhos: pregoes.filter(l => STATUS_GANHO.includes(l.status)).length,
      dispensasGanhas: dispensas.filter(l => STATUS_GANHO.includes(l.status)).length,
    };
  })();

  // Breakdown by modalidade
  const modalidadeBreakdown: ModalidadeBreakdown[] = (() => {
    const map: Record<string, ModalidadeBreakdown> = {};
    licitacoes.forEach(l => {
      const mod = l.modalidade || 'Outros';
      if (!map[mod]) map[mod] = { modalidade: mod, total: 0, ganhas: 0, perdidas: 0, emAndamento: 0, valorGanho: 0 };
      map[mod].total++;
      if (STATUS_GANHO.includes(l.status)) {
        map[mod].ganhas++;
        map[mod].valorGanho += l.valor_adjudicado || l.valor_estimado || 0;
      }
      if (STATUS_PERDIDO.includes(l.status)) map[mod].perdidas++;
      if (STATUS_ANDAMENTO.includes(l.status)) map[mod].emAndamento++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Breakdown by status
  const statusBreakdown: StatusBreakdown[] = (() => {
    const map: Record<string, number> = {};
    licitacoes.forEach(l => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count, color: STATUS_COLORS[status] || 'hsl(220, 14%, 60%)' }))
      .sort((a, b) => b.count - a.count);
  })();

  // Breakdown by UF
  const ufBreakdown: UfBreakdown[] = (() => {
    const map: Record<string, UfBreakdown> = {};
    licitacoes.forEach(l => {
      const uf = l.uf || 'N/I';
      if (!map[uf]) map[uf] = { uf, total: 0, ganhas: 0, perdidas: 0 };
      map[uf].total++;
      if (STATUS_GANHO.includes(l.status)) map[uf].ganhas++;
      if (STATUS_PERDIDO.includes(l.status)) map[uf].perdidas++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Timeline (last 6 months)
  const timeline: TimelineItem[] = (() => {
    const now = new Date();
    const items: TimelineItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const label = MESES[d.getMonth()];
      const inRange = licitacoes.filter(l => {
        const t = new Date(l.updated_at).getTime();
        return t >= start && t <= end;
      });
      items.push({
        mes: label,
        pregao_ganhas: inRange.filter(l => isPregao(l.modalidade) && STATUS_GANHO.includes(l.status)).length,
        pregao_perdidas: inRange.filter(l => isPregao(l.modalidade) && STATUS_PERDIDO.includes(l.status)).length,
        dispensa_ganhas: inRange.filter(l => isDispensa(l.modalidade) && STATUS_GANHO.includes(l.status)).length,
        dispensa_perdidas: inRange.filter(l => isDispensa(l.modalidade) && STATUS_PERDIDO.includes(l.status)).length,
        emAndamento: inRange.filter(l => STATUS_ANDAMENTO.includes(l.status)).length,
      });
    }
    return items;
  })();

  return { kpis, modalidadeBreakdown, statusBreakdown, ufBreakdown, timeline, licitacoes, loading };
}
