import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart, AlertTriangle,
  Calendar, Percent, Loader2, Receipt
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type DashboardData = {
  contrato: any;
  itens: any[];
  pedidos: any[];
  custos: any[];
};

export default function ContratoDashboard({ contratoId }: { contratoId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [contratoRes, itensRes, pedidosRes, custosRes] = await Promise.all([
        supabase.from('contratos').select('*').eq('id', contratoId).single(),
        supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_custos').select('*').eq('contrato_id', contratoId),
      ]);
      setData({
        contrato: contratoRes.data,
        itens: (itensRes.data as any[]) || [],
        pedidos: (pedidosRes.data as any[]) || [],
        custos: (custosRes.data as any[]) || [],
      });
      setLoading(false);
    };
    load();
  }, [contratoId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.contrato) return <Card className="p-8 text-center text-muted-foreground">Contrato não encontrado</Card>;

  const c = data.contrato;
  const pedidosAtivos = data.pedidos.filter(p => p.status !== 'cancelado');
  const faturamento = pedidosAtivos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
  const totalCustos = data.custos.reduce((s: number, cc: any) => s + (cc.valor || 0), 0);
  const custosDiretos = data.custos.filter((cc: any) => cc.tipo === 'custo_direto').reduce((s: number, cc: any) => s + cc.valor, 0);
  const tributos = data.custos.filter((cc: any) => cc.tipo === 'tributo').reduce((s: number, cc: any) => s + cc.valor, 0);
  const frete = data.custos.filter((cc: any) => cc.tipo === 'frete_logistica').reduce((s: number, cc: any) => s + cc.valor, 0);
  const despAdmin = data.custos.filter((cc: any) => cc.tipo === 'despesa_administrativa').reduce((s: number, cc: any) => s + cc.valor, 0);
  const lucroBruto = faturamento - custosDiretos;
  const lucroLiquido = faturamento - totalCustos;
  const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
  const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;
  const pctConsumo = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
  const diasRestantes = c.data_fim ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  // Items with low stock
  const itensAlertaSaldo = data.itens.filter((i: any) => {
    const pct = i.quantidade_contratada > 0 ? (i.quantidade_consumida / i.quantidade_contratada) * 100 : 0;
    return pct >= 80;
  });

  // Monthly pedidos breakdown
  const pedidosPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    pedidosAtivos.forEach((p: any) => {
      if (p.data_pedido) {
        const key = p.data_pedido.substring(0, 7); // YYYY-MM
        map[key] = (map[key] || 0) + (p.valor_total || 0);
      }
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [data.pedidos]);

  return (
    <div className="space-y-5">
      {/* Alertas */}
      {(itensAlertaSaldo.length > 0 || (diasRestantes !== null && diasRestantes <= 60)) && (
        <div className="bg-warning/5 border border-warning/30 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-warning flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Alertas do Contrato
          </h4>
          {diasRestantes !== null && diasRestantes <= 60 && (
            <p className="text-xs text-warning/80">
              ⏰ Contrato vence em <strong>{diasRestantes} dias</strong> ({new Date(c.data_fim).toLocaleDateString('pt-BR')})
            </p>
          )}
          {itensAlertaSaldo.map((i: any) => {
            const pct = (i.quantidade_consumida / i.quantidade_contratada * 100).toFixed(0);
            return (
              <p key={i.id} className="text-xs text-warning/80">
                📦 <strong>{i.descricao}</strong>: saldo baixo ({pct}% consumido, restam {i.saldo_quantitativo} {i.unidade})
              </p>
            );
          })}
        </div>
      )}

      {/* KPI Row 1 - Contract overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Valor Global
          </div>
          <p className="text-lg font-bold">{fmt(c.valor_global)}</p>
          <Progress value={Math.min(pctConsumo, 100)} className="h-1.5 mt-2" />
          <p className="text-[9px] text-muted-foreground mt-1">{pctConsumo.toFixed(1)}% consumido</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Saldo
          </div>
          <p className={`text-lg font-bold ${(c.saldo_remanescente || 0) > 0 ? 'text-success' : 'text-destructive'}`}>
            {fmt(c.saldo_remanescente || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
            <Package className="w-3.5 h-3.5" /> Itens
          </div>
          <p className="text-lg font-bold">{data.itens.length}</p>
          {itensAlertaSaldo.length > 0 && (
            <Badge className="text-[9px] bg-warning/10 text-warning mt-1">{itensAlertaSaldo.length} em alerta</Badge>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
            <ShoppingCart className="w-3.5 h-3.5" /> Pedidos
          </div>
          <p className="text-lg font-bold">{pedidosAtivos.length}</p>
          <p className="text-[9px] text-muted-foreground">{data.pedidos.filter((p: any) => p.status === 'pendente').length} pendentes</p>
        </Card>
      </div>

      {/* KPI Row 2 - Financial */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-accent">
          <div className="text-[10px] text-muted-foreground mb-1">Faturamento</div>
          <p className="text-lg font-bold">{fmt(faturamento)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-destructive">
          <div className="text-[10px] text-muted-foreground mb-1">Custos Totais</div>
          <p className="text-lg font-bold text-destructive">{fmt(totalCustos)}</p>
        </Card>
        <Card className={`p-4 border-l-4 ${lucroBruto >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
          <div className="text-[10px] text-muted-foreground mb-1">Lucro Bruto</div>
          <p className={`text-lg font-bold ${lucroBruto >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroBruto)}</p>
          <p className="text-[9px] text-muted-foreground">Margem: {margemBruta.toFixed(1)}%</p>
        </Card>
        <Card className={`p-4 border-l-4 ${lucroLiquido >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
          <div className="text-[10px] text-muted-foreground mb-1">Lucro Líquido</div>
          <p className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroLiquido)}</p>
          <p className="text-[9px] text-muted-foreground">Margem: {margemLiquida.toFixed(1)}%</p>
        </Card>
      </div>

      {/* Cost breakdown */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-accent" /> Composição de Custos
        </h4>
        <div className="space-y-2">
          {[
            { label: 'Custos Diretos', valor: custosDiretos, color: 'bg-accent' },
            { label: 'Despesas Administrativas', valor: despAdmin, color: 'bg-primary' },
            { label: 'Frete / Logística', valor: frete, color: 'bg-warning' },
            { label: 'Tributos', valor: tributos, color: 'bg-destructive' },
            { label: 'Outros', valor: totalCustos - custosDiretos - despAdmin - frete - tributos, color: 'bg-muted-foreground' },
          ].filter(x => x.valor > 0).map(item => {
            const pct = totalCustos > 0 ? (item.valor / totalCustos) * 100 : 0;
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-40">{item.label}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium w-28 text-right">{fmt(item.valor)}</span>
                <span className="text-[10px] text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Monthly evolution */}
      {pedidosPorMes.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-accent" /> Evolução Mensal de Pedidos
          </h4>
          <div className="flex items-end gap-2 h-32">
            {pedidosPorMes.map(([mes, valor]) => {
              const max = Math.max(...pedidosPorMes.map(([, v]) => v as number));
              const h = max > 0 ? ((valor as number) / max) * 100 : 0;
              return (
                <div key={mes} className="flex-1 flex flex-col items-center">
                  <span className="text-[9px] font-medium mb-1">{fmt(valor as number)}</span>
                  <div className="w-full bg-accent/20 rounded-t" style={{ height: `${h}%`, minHeight: '4px' }}>
                    <div className="w-full h-full bg-accent rounded-t" />
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1">{mes.substring(5)}/{mes.substring(2, 4)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Vigência info */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-accent" /> Vigência
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Assinatura:</span>
            <p className="font-medium">{c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Início:</span>
            <p className="font-medium">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fim:</span>
            <p className={`font-medium ${diasRestantes !== null && diasRestantes <= 60 ? 'text-warning' : ''}`}>
              {c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Dias restantes:</span>
            <p className={`font-medium ${diasRestantes !== null && diasRestantes <= 60 ? 'text-warning font-bold' : ''}`}>
              {diasRestantes !== null ? `${diasRestantes} dias` : '—'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
