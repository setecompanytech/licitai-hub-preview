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
  });
  const [chartMensal, setChartMensal] = useState<ChartMensal[]>([]);
  const [chartValor, setChartValor] = useState<ChartValor[]>([]);
  const [recentes, setRecentes] = useState<LicitacaoRecente[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, empresaAtiva, todasSelecionadas]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadKpis(), loadChartMensal(), loadRecentes(), loadModalidades()]);
    setLoading(false);
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
    ] = await Promise.all([
      supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
      supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Proposta Enviada', 'enviada', 'proposta']),
      supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Vencida', 'vencida', 'Homologada']),
      supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Perdida', 'perdida']),
      supabase.from('licitacoes').select('valor_estimado, valor_adjudicado').eq('user_id', user!.id).in('status', ['Vencida', 'vencida', 'Homologada']).gte('created_at', sixMonthsAgo.toISOString()),
      supabase.from('monitoramento_editais').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', `${today}T00:00:00`),
    ]);

    const totalGanho = ganhos?.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0) || 0;
    const totalDecididas = (vencidas || 0) + (perdidas || 0);
    const taxa = totalDecididas > 0 ? ((vencidas || 0) / totalDecididas) * 100 : 0;

    setKpis({
      licitacoesMonitoradas: monitoradas || 0,
      propostasEnviadas: propostas || 0,
      taxaVitoria: Math.round(taxa * 10) / 10,
      roiMedio: 0,
      valorTotalGanho: totalGanho,
      licitacoesHoje: hoje || 0,
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
        supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Vencida', 'vencida', 'Homologada']).gte('updated_at', start).lte('updated_at', end),
        supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Perdida', 'perdida']).gte('updated_at', start).lte('updated_at', end),
        supabase.from('licitacoes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).in('status', ['Proposta Enviada', 'enviada', 'proposta']).gte('created_at', start).lte('created_at', end),
        supabase.from('licitacoes').select('valor_estimado, valor_adjudicado').eq('user_id', user!.id).in('status', ['Vencida', 'vencida', 'Homologada']).gte('updated_at', start).lte('updated_at', end),
      ]);

      months.push({ mes: label, vitorias: v || 0, derrotas: p || 0, propostas: pr || 0 });
      monthsValor.push({ mes: label, valor: vals?.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0) || 0 });
    }

    setChartMensal(months);
    setChartValor(monthsValor);
  }

  async function loadModalidades() {
    const { data } = await supabase
      .from('licitacoes')
      .select('modalidade')
      .eq('user_id', user!.id);

    if (!data || data.length === 0) {
      setModalidades([]);
      return;
    }

    const counts: Record<string, number> = {};
    data.forEach((l) => {
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
    const { data } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, valor_estimado, uf, municipio, data_encerramento')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentes(data || []);
  }

  return { kpis, chartMensal, chartValor, recentes, modalidades, loading };
}
