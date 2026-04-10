import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Landmark, Loader2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FinHubDashboard() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{ label: string; value: string; icon: React.ElementType; color: string; sub?: string }[]>([]);
  const [vencidas, setVencidas] = useState(0);
  const [hojeCP, setHojeCP] = useState(0);

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    load();
  }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const today = new Date().toISOString().split('T')[0];

    const [cpRes, crRes, contasRes, cpVencRes, cpHojeRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('valor_documento').eq('empresa_id', eid).in('status', ['aberto', 'parcial']),
      supabase.from('fin_contas_receber').select('valor_documento').eq('empresa_id', eid).in('status', ['aberto', 'parcial']),
      supabase.from('fin_contas').select('saldo_inicial').eq('empresa_id', eid).eq('ativo', true),
      supabase.from('fin_contas_pagar').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['aberto', 'parcial']).lt('data_vencimento', today),
      supabase.from('fin_contas_pagar').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['aberto', 'parcial']).eq('data_vencimento', today),
    ]);

    const totalCP = (cpRes.data || []).reduce((s, r) => s + (r.valor_documento || 0), 0);
    const totalCR = (crRes.data || []).reduce((s, r) => s + (r.valor_documento || 0), 0);
    const totalSaldo = (contasRes.data || []).reduce((s, r) => s + (r.saldo_inicial || 0), 0);

    setVencidas(cpVencRes.count || 0);
    setHojeCP(cpHojeRes.count || 0);

    setKpis([
      { label: 'Saldo em Contas', value: fmt(totalSaldo), icon: Landmark, color: 'text-blue-600', sub: `${contasRes.data?.length || 0} contas ativas` },
      { label: 'A Receber', value: fmt(totalCR), icon: ArrowUpCircle, color: 'text-emerald-600', sub: `${crRes.data?.length || 0} títulos em aberto` },
      { label: 'A Pagar', value: fmt(totalCP), icon: ArrowDownCircle, color: 'text-red-500', sub: `${cpRes.data?.length || 0} títulos em aberto` },
      { label: 'Resultado Previsto', value: fmt(totalCR - totalCP), icon: totalCR >= totalCP ? TrendingUp : TrendingDown, color: totalCR >= totalCP ? 'text-emerald-600' : 'text-red-500', sub: 'Receber − Pagar' },
    ]);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hub Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão consolidada do financeiro da empresa</p>
      </div>

      {(vencidas > 0 || hojeCP > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              {vencidas > 0 && <span className="font-medium text-amber-800 dark:text-amber-300">{vencidas} conta(s) vencida(s)</span>}
              {vencidas > 0 && hojeCP > 0 && <span className="mx-1">·</span>}
              {hojeCP > 0 && <span className="font-medium text-amber-800 dark:text-amber-300">{hojeCP} vencendo hoje</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={cn('w-5 h-5', kpi.color)} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
