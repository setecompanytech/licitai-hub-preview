import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users, Send, TrendingUp, Loader2, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando o painel</span>
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
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="p-6">
            <div className="mb-2 flex items-center gap-2">
              <k.icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground break-words">{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline Chart */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Funil de leads</h3>
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
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Conversas por setor</h3>
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
        <Card className="p-6">
          <h3 className="mb-2 text-lg font-semibold text-foreground">Taxa de conversão</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-48 flex-1">
              <div
                className="h-3 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Taxa de conversão de leads"
                aria-valuenow={Math.round(taxaConversao)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${taxaConversao}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-semibold tabular-nums text-success">
              {taxaConversao.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {stats.leadsGanhos} ganhos de {stats.totalLeads} leads totais
          </p>
        </Card>
      )}
    </div>
  );
}
