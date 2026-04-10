import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, Download, BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function FinRelatorios() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [dreData, setDreData] = useState<any[]>([]);
  const [fluxoData, setFluxoData] = useState<any[]>([]);
  const [anoFiltro, setAnoFiltro] = useState(String(new Date().getFullYear()));

  async function loadDre() {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    const eid = empresaAtiva.id;

    // Get all paid CP and received CR for the year
    const [cpRes, crRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('data_pagamento, valor_pago, valor_documento, status')
        .eq('empresa_id', eid).eq('status', 'pago').gte('data_pagamento', `${anoFiltro}-01-01`).lte('data_pagamento', `${anoFiltro}-12-31`),
      supabase.from('fin_contas_receber').select('data_recebimento, valor_recebido, valor_documento, status')
        .eq('empresa_id', eid).eq('status', 'recebido').gte('data_recebimento', `${anoFiltro}-01-01`).lte('data_recebimento', `${anoFiltro}-12-31`),
    ]);

    const monthly: Record<string, { receitas: number; despesas: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${anoFiltro}-${String(m).padStart(2, '0')}`;
      monthly[key] = { receitas: 0, despesas: 0 };
    }

    (cpRes.data || []).forEach(cp => {
      if (!cp.data_pagamento) return;
      const key = cp.data_pagamento.substring(0, 7);
      if (monthly[key]) monthly[key].despesas += (cp.valor_pago || cp.valor_documento || 0);
    });

    (crRes.data || []).forEach(cr => {
      if (!cr.data_recebimento) return;
      const key = cr.data_recebimento.substring(0, 7);
      if (monthly[key]) monthly[key].receitas += (cr.valor_recebido || cr.valor_documento || 0);
    });

    setDreData(Object.entries(monthly).map(([mes, v]) => ({ mes, ...v, resultado: v.receitas - v.despesas })));
    setLoading(false);
  }

  async function loadFluxo() {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    const eid = empresaAtiva.id;
    const today = new Date().toISOString().split('T')[0];

    const [cpRes, crRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('favorecido_nome, valor_documento, data_vencimento')
        .eq('empresa_id', eid).in('status', ['aberto', 'parcial']).gte('data_vencimento', today).order('data_vencimento').limit(50),
      supabase.from('fin_contas_receber').select('cliente_nome, valor_documento, data_vencimento')
        .eq('empresa_id', eid).in('status', ['aberto', 'parcial']).gte('data_vencimento', today).order('data_vencimento').limit(50),
    ]);

    const combined = [
      ...(cpRes.data || []).map(i => ({ tipo: 'saida' as const, nome: i.favorecido_nome || '—', valor: i.valor_documento, data: i.data_vencimento })),
      ...(crRes.data || []).map(i => ({ tipo: 'entrada' as const, nome: i.cliente_nome || '—', valor: i.valor_documento, data: i.data_vencimento })),
    ].sort((a, b) => a.data.localeCompare(b.data));

    setFluxoData(combined);
    setLoading(false);
  }

  function exportCsv(headers: string[], rows: any[][], filename: string) {
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    toast.success('CSV exportado');
  }

  const totalDre = dreData.reduce((s, d) => ({ r: s.r + d.receitas, d: s.d + d.despesas }), { r: 0, d: 0 });
  const maxBar = Math.max(...dreData.map(d => Math.max(d.receitas, d.despesas)), 1);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Relatórios Financeiros</h1>

      <Tabs defaultValue="dre" className="space-y-4" onValueChange={v => {
        if (v === 'dre' && dreData.length === 0) loadDre();
        if (v === 'fluxo' && fluxoData.length === 0) loadFluxo();
      }}>
        <TabsList>
          <TabsTrigger value="dre"><BarChart3 className="w-3.5 h-3.5 mr-1" /> DRE Mensal</TabsTrigger>
          <TabsTrigger value="fluxo"><TrendingUp className="w-3.5 h-3.5 mr-1" /> Fluxo Projetado</TabsTrigger>
        </TabsList>

        {/* DRE */}
        <TabsContent value="dre">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">DRE Mensal — Demonstrativo de Resultado</h3>
              <div className="flex gap-2">
                <Select value={anoFiltro} onValueChange={v => { setAnoFiltro(v); setTimeout(loadDre, 100); }}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={loadDre} disabled={loading}>
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                  <span className="ml-1">Atualizar</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportCsv(
                  ['Mês', 'Receitas', 'Despesas', 'Resultado'],
                  dreData.map(d => [d.mes, d.receitas.toFixed(2), d.despesas.toFixed(2), d.resultado.toFixed(2)]),
                  `dre_${anoFiltro}.csv`
                )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
              </div>
            </div>

            {/* Mini chart */}
            {dreData.length > 0 && (
              <div className="flex items-end gap-1 h-32 border-b pb-2">
                {dreData.map((d, i) => (
                  <div key={d.mes} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="flex gap-px w-full justify-center" style={{ height: '100px' }}>
                      <div className="w-2 bg-emerald-400 rounded-t" style={{ height: `${(d.receitas / maxBar) * 100}px`, marginTop: 'auto' }} title={`Receita: ${fmt(d.receitas)}`} />
                      <div className="w-2 bg-red-400 rounded-t" style={{ height: `${(d.despesas / maxBar) * 100}px`, marginTop: 'auto' }} title={`Despesa: ${fmt(d.despesas)}`} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{meses[i]}</span>
                  </div>
                ))}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mês</TableHead>
                  <TableHead className="text-xs text-right">Receitas</TableHead>
                  <TableHead className="text-xs text-right">Despesas</TableHead>
                  <TableHead className="text-xs text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dreData.map(d => (
                  <TableRow key={d.mes}>
                    <TableCell className="text-xs font-mono">{d.mes}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-emerald-600">{fmt(d.receitas)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-destructive">{fmt(d.despesas)}</TableCell>
                    <TableCell className={cn('text-xs text-right font-mono font-bold', d.resultado >= 0 ? 'text-emerald-600' : 'text-destructive')}>{fmt(d.resultado)}</TableCell>
                  </TableRow>
                ))}
                {dreData.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell className="text-xs">TOTAL {anoFiltro}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-emerald-600">{fmt(totalDre.r)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-destructive">{fmt(totalDre.d)}</TableCell>
                    <TableCell className={cn('text-xs text-right font-mono', totalDre.r - totalDre.d >= 0 ? 'text-emerald-600' : 'text-destructive')}>{fmt(totalDre.r - totalDre.d)}</TableCell>
                  </TableRow>
                )}
                {dreData.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Clique em Atualizar para carregar</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Fluxo Projetado */}
        <TabsContent value="fluxo">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Fluxo de Caixa Projetado (Títulos em Aberto)</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadFluxo} disabled={loading}>
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                  <span className="ml-1">Atualizar</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportCsv(
                  ['Data', 'Tipo', 'Nome', 'Valor'],
                  fluxoData.map(f => [f.data, f.tipo, f.nome, String(f.valor)]),
                  'fluxo_projetado.csv'
                )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxoData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Clique em Atualizar para carregar</TableCell></TableRow>
                ) : fluxoData.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{f.data ? new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-[10px]', f.tipo === 'entrada' ? 'text-emerald-600 border-emerald-300' : 'text-destructive border-destructive/30')}>{f.tipo === 'entrada' ? 'Receber' : 'Pagar'}</Badge></TableCell>
                    <TableCell className="text-xs">{f.nome}</TableCell>
                    <TableCell className={cn('text-xs text-right font-mono font-bold', f.tipo === 'entrada' ? 'text-emerald-600' : 'text-destructive')}>{f.tipo === 'entrada' ? '+' : '-'}{fmt(f.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
