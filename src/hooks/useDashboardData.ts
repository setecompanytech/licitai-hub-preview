import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

type KpiData = {
  licitacoesMonitoradas: number;
  propostasEnviadas: number;
  taxaVitoria: number;
  roiMedio: number;
  valorTotalGanho: number;
  licitacoesHoje: number;
  editaisAbertos: number;
  ultimaSincronizacao: string | null;
};

type ChartMensal = {
  mes: string;
  vitorias: number;
  derrotas: number;
  propostas: number;
};

type ChartValor = {
  mes: string;
  valor: number;
};

type LicitacaoRecente = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
};

type ModalidadeItem = {
  name: string;
  value: number;
  fill: string;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MODALIDADE_COLORS: Record<string, string> = {
  'Pregão Eletrônico': 'hsl(210, 100%, 40%)',
  'Concorrência': 'hsl(174, 72%, 40%)',
  'Tomada de Preços': 'hsl(38, 92%, 50%)',
  'Dispensa': 'hsl(220, 14%, 60%)',
  'Inexigibilidade': 'hsl(142, 71%, 45%)',
};

/** Applies empresa filter to a supabase query builder */
function applyEmpresaFilter(query: any, empresaAtiva: any, todasSelecionadas: boolean) {
  if (!todasSelecionadas && empresaAtiva) {
    return query.eq('empresa_id', empresaAtiva.id);
  }
  return query;
}

export function useDashboardData() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const [kpis, setKpis] = useState<KpiData>({
    licitacoesMonitoradas: 0,
    propostasEnviadas: 0,
    taxaVitoria: 0,
    roiMedio: 0,
    valorTotalGanho: 0,
    licitacoesHoje: 0,
    editaisAbertos: 0,
    ultimaSincronizacao: null,
  });
  const [chartMensal, setChartMensal] = useState<ChartMensal[]>([]);
  const [chartValor, setChartValor] = useState<ChartValor[]>([]);
  const [recentes, setRecentes] = useState<LicitacaoRecente[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAll();

    // Realtime: auto-refresh dashboard when source tables change
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitacoes', filter: `user_id=eq.${user.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos', filter: `user_id=eq.${user.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_tasks', filter: `user_id=eq.${user.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoramento_editais', filter: `user_id=eq.${user.id}` }, () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, empresaAtiva, todasSelecionadas]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadKpis(), loadChartMensal(), loadRecentes(), loadModalidades()]);
    setLoading(false);
  }

  /** Helper to build a filtered query on licitacoes */
  // Escopo por empresa, como a lista de Processos Licitatórios logo abaixo dos
  // KPIs. O `.eq('user_id')` que havia aqui fazia o cabeçalho anunciar
  // "Resultados de: <empresa>" mostrando só os números do usuário logado — o
  // painel dizia 21 Monitoradas enquanto a empresa tinha 37 processos. O RLS
  // (Onda 4) garante que só chegam empresas das quais se é membro.
  function licitacoesQuery() {
    const q = supabase.from('licitacoes').select('*', { count: 'exact', head: true });
    return applyEmpresaFilter(q, empresaAtiva, todasSelecionadas);
  }

  function licitacoesDataQuery(selectCols: string) {
    const q = supabase.from('licitacoes').select(selectCols);
    return applyEmpresaFilter(q, empresaAtiva, todasSelecionadas);
  }

  async function loadKpis() {
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      { count: monitoradas },
      { count: propostas },
      { count: vencidas },
      { count: perdidas },
      { data: ganhos },
      { count: hoje },
      { data: roiData },
    ] = await Promise.all([
      licitacoesQuery(),
      licitacoesQuery().in('status', ['Proposta Enviada', 'enviada', 'proposta']),
      licitacoesQuery().in('status', ['Vencida', 'vencida', 'Homologada']),
      licitacoesQuery().in('status', ['Perdida', 'perdida']),
      licitacoesDataQuery('valor_estimado, valor_adjudicado').in('status', ['Vencida', 'vencida', 'Homologada']).gte('created_at', sixMonthsAgo.toISOString()),
      supabase.from('monitoramento_editais').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', `${today}T00:00:00`),
      // ROI: get all won bids that have both valor_estimado AND valor_adjudicado
      licitacoesDataQuery('valor_estimado, valor_adjudicado')
        .in('status', ['Vencida', 'vencida', 'Homologada'])
        .not('valor_estimado', 'is', null)
        .not('valor_adjudicado', 'is', null),
    ]);

    // Editais abertos no cache PNCP + última sincronização
    let editaisAbertos = 0;
    let ultimaSincronizacao: string | null = null;
    try {
      const [cacheCount, syncLog] = await Promise.all([
        supabase
          .from('pncp_editais_cache')
          .select('*', { count: 'exact', head: true })
          .gte('data_encerramento_proposta', new Date().toISOString()),
        (supabase as any)
          .from('pncp_sync_log')
          .select('concluido_em')
          .eq('status', 'sucesso')
          .order('concluido_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      editaisAbertos = cacheCount.count || 0;
      ultimaSincronizacao = syncLog.data?.concluido_em || null;
    } catch {
      // Tables may not exist yet
    }

    const totalGanho = ganhos?.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0) || 0;
    const totalDecididas = (vencidas || 0) + (perdidas || 0);
    const taxa = totalDecididas > 0 ? ((vencidas || 0) / totalDecididas) * 100 : 0;

    // ROI = ((sum adjudicado - sum estimado) / sum estimado) * 100
    // Positive ROI = saved money (bought below estimate)
    let roi = 0;
    if (roiData && roiData.length > 0) {
      const sumEstimado = roiData.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      const sumAdjudicado = roiData.reduce((s, l) => s + (l.valor_adjudicado || 0), 0);
      if (sumEstimado > 0) {
        // Economy percentage: how much was saved vs estimated
        roi = Math.round(((sumEstimado - sumAdjudicado) / sumEstimado) * 1000) / 10;
      }
    }

    setKpis({
      licitacoesMonitoradas: monitoradas || 0,
      propostasEnviadas: propostas || 0,
      taxaVitoria: Math.round(taxa * 10) / 10,
      roiMedio: roi,
      valorTotalGanho: totalGanho,
      licitacoesHoje: hoje || 0,
      editaisAbertos,
      ultimaSincronizacao,
    });
  }

  async function loadChartMensal() {
    const now = new Date();
    const months: ChartMensal[] = [];
    const monthsValor: ChartValor[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const label = MESES[d.getMonth()];

      const [{ count: v }, { count: p }, { count: pr }, { data: vals }] = await Promise.all([
        licitacoesQuery().in('status', ['Vencida', 'vencida', 'Homologada']).gte('updated_at', start).lte('updated_at', end),
        licitacoesQuery().in('status', ['Perdida', 'perdida']).gte('updated_at', start).lte('updated_at', end),
        licitacoesQuery().in('status', ['Proposta Enviada', 'enviada', 'proposta']).gte('created_at', start).lte('created_at', end),
        licitacoesDataQuery('valor_estimado, valor_adjudicado').in('status', ['Vencida', 'vencida', 'Homologada']).gte('updated_at', start).lte('updated_at', end),
      ]);

      months.push({ mes: label, vitorias: v || 0, derrotas: p || 0, propostas: pr || 0 });
      monthsValor.push({ mes: label, valor: vals?.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0) || 0 });
    }

    setChartMensal(months);
    setChartValor(monthsValor);
  }

  async function loadModalidades() {
    const { data } = await licitacoesDataQuery('modalidade');

    if (!data || data.length === 0) {
      setModalidades([]);
      return;
    }

    const counts: Record<string, number> = {};
    data.forEach((l: any) => {
      counts[l.modalidade] = (counts[l.modalidade] || 0) + 1;
    });

    const total = data.length;
    const items: ModalidadeItem[] = Object.entries(counts).map(([name, count]) => ({
      name,
      value: Math.round((count / total) * 100),
      fill: MODALIDADE_COLORS[name] || 'hsl(220, 14%, 60%)',
    }));

    setModalidades(items);
  }

  async function loadRecentes() {
    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
      .order('created_at', { ascending: false })
      .limit(5);
    q = applyEmpresaFilter(q, empresaAtiva, todasSelecionadas);
    const { data } = await q;
    setRecentes(data || []);
  }

  return { kpis, chartMensal, chartValor, recentes, modalidades, loading };
}
