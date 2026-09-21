import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users, Send, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Stats {
  totalConversas: number;
  conversasAbertas: number;
  totalMensagens: number;
  totalLeads: number;
  leadsGanhos: number;
  leadsPerdidos: number;
  totalCampanhas: number;
  campanhasExecutadas: number;
  valorPipeline: number;
}

// Série de gráfico: cor vinda da paleta de dados (`--chart-*`), não da paleta
// de interface. Recharts recebe cor por prop, então o token entra como
// `hsl(var(--token))` — é referência ao token, não cor escrita à mão.
const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 12,
};

export default function WhatsAppDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState<{ name: string; value: number }[]>([]);
  const [setorData, setSetorData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => { if (user) loadStats(); }, [user]);

  const loadStats = async () => {
    setLoading(true);
    const [conversas, mensagens, leads, campanhas] = await Promise.all([
      supabase.from('whatsapp_conversas').select('id, status, setor').eq('user_id', user!.id),
      supabase.from('whatsapp_mensagens').select('id').eq('user_id', user!.id),
      supabase.from('whatsapp_leads').select('id, etapa, valor_estimado, setor').eq('user_id', user!.id),
      supabase.from('whatsapp_campanhas').select('id, status').eq('user_id', user!.id),
    ]);

    const leadsData = (leads.data || []) as { id: string; etapa: string; valor_estimado: number; setor: string }[];
    const conversasData = (conversas.data || []) as { id: string; status: string; setor: string }[];

    setStats({
      totalConversas: conversasData.length,
      conversasAbertas: conversasData.filter(c => c.status === 'aberta').length,
      totalMensagens: (mensagens.data || []).length,
      totalLeads: leadsData.length,
      leadsGanhos: leadsData.filter(l => l.etapa === 'ganho').length,
      leadsPerdidos: leadsData.filter(l => l.etapa === 'perdido').length,
      totalCampanhas: (campanhas.data || []).length,
      campanhasExecutadas: ((campanhas.data || []) as { id: string; status: string }[]).filter(c => c.status === 'executada').length,
      valorPipeline: leadsData.filter(l => !['ganho', 'perdido'].includes(l.etapa)).reduce((s, l) => s + (l.valor_estimado || 0), 0),
    });

    // Pipeline chart
    const etapas = ['novo', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'];
    setPipelineData(etapas.map(e => ({
      name: e.charAt(0).toUpperCase() + e.slice(1),
      value: leadsData.filter(l => l.etapa === e).length,
    })));

    // Setor chart
    const setorMap: Record<string, number> = {};
    conversasData.forEach(c => { setorMap[c.setor] = (setorMap[c.setor] || 0) + 1; });
    setSetorData(Object.entries(setorMap).map(([name, value]) => ({ name, value })));

    setLoading(false);
  };

  if (loading) {
    return (
      /* Esqueleto na forma do painel: a faixa de indicadores e os dois gráficos. */
      <div role="status" aria-busy="true" className="space-y-6">
        <span className="sr-only">Carregando o painel</span>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const kpis = [
    { label: 'Conversas', value: String(stats.totalConversas), sub: `${stats.conversasAbertas} abertas`, icon: MessageSquare },
    { label: 'Mensagens', value: String(stats.totalMensagens), sub: 'total trocadas', icon: Send },
    { label: 'Leads', value: String(stats.totalLeads), sub: `${stats.leadsGanhos} ganhos • ${stats.leadsPerdidos} perdidos`, icon: Users },
    { label: 'Pipeline', value: `R$ ${stats.valorPipeline.toLocaleString('pt-BR')}`, sub: 'em negociação', icon: TrendingUp },
    { label: 'Campanhas', value: String(stats.totalCampanhas), sub: `${stats.campanhasExecutadas} executadas`, icon: BarChart3 },
  ];

  const taxaConversao = stats.totalLeads > 0 ? (stats.leadsGanhos / stats.totalLeads) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPIs na faixa de indicadores do padrão: rótulo, valor em dígitos
          tabulares, ícone discreto no canto e a linha de detalhe embaixo. */}
      <FaixaIndicadores
        itens={kpis.map(k => ({ rotulo: k.label, valor: k.value, detalhe: k.sub, icone: k.icon }))}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Pipeline Chart */}
        <Card className="p-5">
          <h3 className="mb-4 text-lg font-semibold leading-6 text-foreground">Funil de leads</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }} />
              <Bar dataKey="value" name="Leads" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Setor Chart */}
        <Card className="p-5">
          <h3 className="mb-4 text-lg font-semibold leading-6 text-foreground">Conversas por setor</h3>
          {setorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={setorData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {setorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EstadoVazio
              tamanho="compacto"
              icone={<PieChartIcon aria-hidden="true" />}
              titulo="Sem conversas para distribuir"
              descricao="O gráfico aparece assim que a primeira conversa for classificada num setor."
            />
          )}
        </Card>
      </div>

      {/* Conversion rate */}
      {stats.totalLeads > 0 && (
        <Card className="p-5">
          <h3 className="mb-2 text-lg font-semibold leading-6 text-foreground">Taxa de conversão</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-48 flex-1">
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Taxa de conversão de leads"
                aria-valuenow={Math.round(taxaConversao)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${taxaConversao}%` }}
                />
              </div>
            </div>
            {/* Tinta `-ink`: é a que lê sobre o branco do cartão. */}
            <span className="text-3xl font-semibold leading-8 tabular-nums text-success-ink">
              {taxaConversao.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {stats.leadsGanhos} ganhos de {stats.totalLeads} leads totais
          </p>
        </Card>
      )}
    </div>
  );
}
