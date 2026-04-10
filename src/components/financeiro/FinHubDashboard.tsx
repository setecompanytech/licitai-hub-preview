import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Landmark, Loader2, AlertTriangle, Calendar, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

export default function FinHubDashboard() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const today = new Date().toISOString().split('T')[0];
    const mes = today.substring(0, 7);

    const [cpRes, crRes, contasRes, cpVencRes, cpHojeRes, cpProxRes, movRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('valor_documento, status').eq('empresa_id', eid),
      supabase.from('fin_contas_receber').select('valor_documento, status').eq('empresa_id', eid),
      supabase.from('fin_contas').select('saldo_inicial, nome').eq('empresa_id', eid).eq('ativo', true),
      supabase.from('fin_contas_pagar').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['aberto', 'parcial']).lt('data_vencimento', today),
      supabase.from('fin_contas_pagar').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['aberto', 'parcial']).eq('data_vencimento', today),
      supabase.from('fin_contas_pagar').select('favorecido_nome, valor_documento, data_vencimento').eq('empresa_id', eid).in('status', ['aberto', 'parcial']).gte('data_vencimento', today).order('data_vencimento').limit(5),
      supabase.from('fin_movimentacoes').select('tipo_lancamento, valor, data_lancamento').eq('empresa_id', eid).gte('data_lancamento', `${mes}-01`),
    ]);

    const cpAll = cpRes.data || [];
    const crAll = crRes.data || [];
    const contasAll = contasRes.data || [];
    const movsAll = movRes.data || [];

    const totalCPAberto = cpAll.filter(i => i.status === 'aberto' || i.status === 'parcial').reduce((s, i) => s + (i.valor_documento || 0), 0);
    const totalCRAberto = crAll.filter(i => i.status === 'aberto' || i.status === 'parcial').reduce((s, i) => s + (i.valor_documento || 0), 0);
    const totalSaldo = contasAll.reduce((s, i) => s + (i.saldo_inicial || 0), 0);

    const entradaMes = movsAll.filter(m => m.tipo_lancamento === 'credito').reduce((s, m) => s + (m.valor || 0), 0);
    const saidaMes = movsAll.filter(m => m.tipo_lancamento === 'debito').reduce((s, m) => s + (m.valor || 0), 0);

    setData({
      totalSaldo, totalCPAberto, totalCRAberto,
      contasQtd: contasAll.length, cpQtd: cpAll.filter(i => i.status !== 'pago' && i.status !== 'cancelado').length,
      crQtd: crAll.filter(i => i.status !== 'recebido' && i.status !== 'cancelado').length,
      vencidas: cpVencRes.count || 0, hoje: cpHojeRes.count || 0,
      proximas: cpProxRes.data || [],
      entradaMes, saidaMes,
    });
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const resultado = data.totalCRAberto - data.totalCPAberto;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hub Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão consolidada do financeiro da empresa</p>
      </div>

      {/* Alertas */}
      {(data.vencidas > 0 || data.hoje > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              {data.vencidas > 0 && <span className="font-medium text-amber-800 dark:text-amber-300">{data.vencidas} conta(s) vencida(s)</span>}
              {data.vencidas > 0 && data.hoje > 0 && <span className="mx-1">·</span>}
              {data.hoje > 0 && <span className="font-medium text-amber-800 dark:text-amber-300">{data.hoje} vencendo hoje</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo em Contas</CardTitle>
            <Landmark className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(data.totalSaldo)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.contasQtd} contas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
            <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{fmt(data.totalCRAberto)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.crQtd} títulos em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
            <ArrowDownCircle className="w-5 h-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmt(data.totalCPAberto)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.cpQtd} títulos em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resultado Previsto</CardTitle>
            {resultado >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold', resultado >= 0 ? 'text-emerald-600' : 'text-destructive')}>{fmt(resultado)}</p>
            <p className="text-xs text-muted-foreground mt-1">Receber − Pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Movimentação do mês */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-medium">Movimentação do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Entradas</span>
                <span className="text-sm font-bold text-emerald-600">{fmt(data.entradaMes)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (data.entradaMes / Math.max(data.entradaMes + data.saidaMes, 1)) * 100)}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Saídas</span>
                <span className="text-sm font-bold text-destructive">{fmt(data.saidaMes)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-destructive h-2 rounded-full" style={{ width: `${Math.min(100, (data.saidaMes / Math.max(data.entradaMes + data.saidaMes, 1)) * 100)}%` }} />
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Resultado do Mês</span>
                <span className={cn('text-sm font-bold', data.entradaMes - data.saidaMes >= 0 ? 'text-emerald-600' : 'text-destructive')}>{fmt(data.entradaMes - data.saidaMes)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximos vencimentos */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-medium">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {data.proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento próximo</p>
            ) : (
              <div className="space-y-2">
                {data.proximas.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex-1 truncate">
                      <span className="font-medium">{p.favorecido_nome || '—'}</span>
                    </div>
                    <span className="font-bold ml-3">{fmt(p.valor_documento)}</span>
                    <span className="text-xs text-muted-foreground ml-3 w-20 text-right">{fmtDate(p.data_vencimento)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
