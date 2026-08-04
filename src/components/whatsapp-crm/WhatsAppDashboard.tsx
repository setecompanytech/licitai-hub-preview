import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users, Send, TrendingUp, Loader2, BarChart3 } from 'lucide-react';
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

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!stats) return null;

  const kpis = [
    { label: 'Conversas', value: stats.totalConversas, sub: `${stats.conversasAbertas} abertas`, icon: MessageSquare, color: 'text-muted-foreground' },
    { label: 'Mensagens', value: stats.totalMensagens, sub: 'total trocadas', icon: Send, color: 'text-muted-foreground' },
    { label: 'Leads', value: stats.totalLeads, sub: `${stats.leadsGanhos} ganhos • ${stats.leadsPerdidos} perdidos`, icon: Users, color: 'text-muted-foreground' },
    { label: 'Pipeline', value: `R$ ${stats.valorPipeline.toLocaleString('pt-BR')}`, sub: 'em negociação', icon: TrendingUp, color: 'text-muted-foreground' },
    { label: 'Campanhas', value: stats.totalCampanhas, sub: `${stats.campanhasExecutadas} executadas`, icon: BarChart3, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Pipeline Chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Pipeline de Leads</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Setor Chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Conversas por Setor</h3>
          {setorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={setorData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {setorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">Sem dados</div>
          )}
        </Card>
      </div>

      {/* Conversion rate */}
      {stats.totalLeads > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Taxa de Conversão</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${(stats.leadsGanhos / stats.totalLeads) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-bold text-success">
              {((stats.leadsGanhos / stats.totalLeads) * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{stats.leadsGanhos} ganhos de {stats.totalLeads} leads totais</p>
        </Card>
      )}
    </div>
  );
}
