import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, TrendingUp, TrendingDown, Calendar, Download, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type FluxoSemana = {
  label: string;
  inicio: string;
  fim: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcum: number;
};

export default function FinFluxoCaixa() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [semanas, setSemanas] = useState<FluxoSemana[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [periodo, setPeriodo] = useState('30');

  useEffect(() => {
    if (empresaAtiva?.id) load();
  }, [empresaAtiva?.id, periodo]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + parseInt(periodo));

    const hojeStr = hoje.toISOString().split('T')[0];
    const fimStr = fim.toISOString().split('T')[0];

    const [contasRes, cpRes, crRes] = await Promise.all([
      supabase.from('fin_contas').select('saldo_inicial').eq('empresa_id', eid).eq('ativo', true),
      supabase.from('fin_contas_pagar')
        .select('valor_documento, data_vencimento, status')
        .eq('empresa_id', eid)
        .in('status', ['aberto', 'parcial'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', fimStr),
      supabase.from('fin_contas_receber')
        .select('valor_documento, data_vencimento, status')
        .eq('empresa_id', eid)
        .in('status', ['aberto', 'parcial'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', fimStr),
    ]);

    const saldoBase = (contasRes.data || []).reduce((s, c) => s + (c.saldo_inicial || 0), 0);
    setSaldoInicial(saldoBase);

    // Agrupar por semana
    const cpList = cpRes.data || [];
    const crList = crRes.data || [];
    const weeks: FluxoSemana[] = [];
    let cursor = new Date(hoje);
    let acum = saldoBase;

    while (cursor < fim) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > fim) weekEnd.setTime(fim.getTime());

      const ws = weekStart.toISOString().split('T')[0];
      const we = weekEnd.toISOString().split('T')[0];

      const entradas = crList
        .filter(r => r.data_vencimento >= ws && r.data_vencimento <= we)
        .reduce((s, r) => s + (r.valor_documento || 0), 0);

      const saidas = cpList
        .filter(r => r.data_vencimento >= ws && r.data_vencimento <= we)
        .reduce((s, r) => s + (r.valor_documento || 0), 0);

      const saldo = entradas - saidas;
      acum += saldo;

      weeks.push({
        label: `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
        inicio: ws,
        fim: we,
        entradas,
        saidas,
        saldo,
        saldoAcum: acum,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    setSemanas(weeks);
    setLoading(false);
  }

  function exportCsv() {
    const lines = ['Período;Entradas;Saídas;Saldo Período;Saldo Acumulado'];
    semanas.forEach(s => {
      lines.push(`${s.label};${s.entradas.toFixed(2)};${s.saidas.toFixed(2)};${s.saldo.toFixed(2)};${s.saldoAcum.toFixed(2)}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-caixa-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exportado');
  }

  const totalEntradas = semanas.reduce((s, w) => s + w.entradas, 0);
  const totalSaidas = semanas.reduce((s, w) => s + w.saidas, 0);
  const saldoFinal = semanas.length > 0 ? semanas[semanas.length - 1].saldoAcum : saldoInicial;
  const maxBar = Math.max(...semanas.map(w => Math.max(w.entradas, w.saidas)), 1);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Saldo Atual</div>
          <p className={cn('text-xl font-bold font-mono', saldoInicial >= 0 ? 'text-success' : 'text-destructive')}>{fmt(saldoInicial)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-success mb-1"><TrendingUp className="w-3 h-3" /> Entradas Previstas</div>
          <p className="text-xl font-bold font-mono text-success">{fmt(totalEntradas)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-destructive mb-1"><TrendingDown className="w-3 h-3" /> Saídas Previstas</div>
          <p className="text-xl font-bold font-mono text-destructive">{fmt(totalSaidas)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Saldo Projetado</div>
          <p className={cn('text-xl font-bold font-mono', saldoFinal >= 0 ? 'text-success' : 'text-destructive')}>{fmt(saldoFinal)}</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Próximos 7 dias</SelectItem>
              <SelectItem value="15">Próximos 15 dias</SelectItem>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="60">Próximos 60 dias</SelectItem>
              <SelectItem value="90">Próximos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Gráfico simplificado de barras */}
      {semanas.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Projeção Semanal</span>
          </div>
          <div className="space-y-3">
            {semanas.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">{s.label}</span>
                  <span className={cn('font-bold font-mono', s.saldoAcum >= 0 ? 'text-success' : 'text-destructive')}>
                    {fmt(s.saldoAcum)}
                  </span>
                </div>
                <div className="flex gap-1 h-5">
                  <div
                    className="bg-success/20 border border-success/30 rounded-sm flex items-center justify-end pr-1"
                    style={{ width: `${Math.max((s.entradas / maxBar) * 50, 2)}%` }}
                  >
                    {s.entradas > 0 && <span className="text-[9px] text-success font-mono">{fmt(s.entradas)}</span>}
                  </div>
                  <div
                    className="bg-destructive/20 border border-destructive/30 rounded-sm flex items-center justify-end pr-1"
                    style={{ width: `${Math.max((s.saidas / maxBar) * 50, 2)}%` }}
                  >
                    {s.saidas > 0 && <span className="text-[9px] text-destructive font-mono">{fmt(s.saidas)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-success/20 border border-success/30" /> Entradas</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" /> Saídas</div>
          </div>
        </Card>
      )}

      {semanas.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma projeção no período selecionado. Cadastre contas a pagar/receber para visualizar o fluxo.
        </Card>
      )}
    </div>
  );
}
