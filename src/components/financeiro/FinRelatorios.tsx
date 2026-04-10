import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, Download, BarChart3, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { fmtMoney, moneyClass } from '@/styles/financeiro';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function FinRelatorios() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [dreData, setDreData] = useState<any[]>([]);
  const [fluxoData, setFluxoData] = useState<any[]>([]);
  const [anoFiltro, setAnoFiltro] = useState(String(new Date().getFullYear()));
  const [tab, setTab] = useState('dre');

  useEffect(() => { if (empresaAtiva?.id) { loadDre(); loadFluxo(); } }, [empresaAtiva?.id, anoFiltro]);

  async function loadDre() {
    if (!empresaAtiva?.id) return;
    setLoading(true);
    const eid = empresaAtiva.id;
    const [cpRes, crRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('data_pagamento, valor_pago, valor_documento, status, categoria_id')
        .eq('empresa_id', eid).eq('status', 'pago').gte('data_pagamento', `${anoFiltro}-01-01`).lte('data_pagamento', `${anoFiltro}-12-31`),
      supabase.from('fin_contas_receber').select('data_recebimento, valor_recebido, valor_documento, status, categoria_id')
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

    const data = Object.entries(monthly).map(([key, val]) => ({
      mes: meses[parseInt(key.split('-')[1]) - 1],
      mesKey: key,
      receitas: val.receitas,
      despesas: val.despesas,
      resultado: val.receitas - val.despesas,
    }));

    setDreData(data);
    setLoading(false);
  }

  async function loadFluxo() {
    if (!empresaAtiva?.id) return;
    const eid = empresaAtiva.id;
    const today = new Date();
    const months: any[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const firstDay = `${mesKey}-01`;

      const [cpRes, crRes] = await Promise.all([
        supabase.from('fin_contas_pagar').select('valor_documento').eq('empresa_id', eid).in('status', ['aberto', 'parcial']).gte('data_vencimento', firstDay).lte('data_vencimento', lastDay),
        supabase.from('fin_contas_receber').select('valor_documento').eq('empresa_id', eid).in('status', ['aberto', 'parcial']).gte('data_vencimento', firstDay).lte('data_vencimento', lastDay),
      ]);

      const saidas = (cpRes.data || []).reduce((s: number, r: any) => s + (r.valor_documento || 0), 0);
      const entradas = (crRes.data || []).reduce((s: number, r: any) => s + (r.valor_documento || 0), 0);

      months.push({
        mes: meses[d.getMonth()],
        entradas,
        saidas,
        saldo: entradas - saidas,
      });
    }
    setFluxoData(months);
  }

  const totalReceitas = dreData.reduce((s, d) => s + d.receitas, 0);
  const totalDespesas = dreData.reduce((s, d) => s + d.despesas, 0);
  const totalResultado = totalReceitas - totalDespesas;

  function exportCSV() {
    const header = 'Mês;Receitas;Despesas;Resultado\n';
    const rows = dreData.map(d => `${d.mes};${d.receitas.toFixed(2)};${d.despesas.toFixed(2)};${d.resultado.toFixed(2)}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dre_${anoFiltro}.csv`; a.click();
    toast.success('CSV exportado');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground">DRE, Fluxo de Caixa Projetado e análises</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={anoFiltro} onValueChange={setAnoFiltro}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-t-2 border-t-emerald-500"><CardContent className="p-4 text-center">
          <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totalReceitas)}</p>
          <p className="text-xs text-muted-foreground">Receitas {anoFiltro}</p>
        </CardContent></Card>
        <Card className="border-t-2 border-t-red-500"><CardContent className="p-4 text-center">
          <TrendingDown className="w-5 h-5 text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-600">{fmtMoney(totalDespesas)}</p>
          <p className="text-xs text-muted-foreground">Despesas {anoFiltro}</p>
        </CardContent></Card>
        <Card className={`border-t-2 ${totalResultado >= 0 ? 'border-t-blue-500' : 'border-t-amber-500'}`}><CardContent className="p-4 text-center">
          <BarChart3 className={`w-5 h-5 mx-auto mb-1 ${moneyClass(totalResultado)}`} />
          <p className={`text-2xl font-bold ${moneyClass(totalResultado)}`}>{fmtMoney(totalResultado)}</p>
          <p className="text-xs text-muted-foreground">Resultado {anoFiltro}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dre">📊 DRE Mensal</TabsTrigger>
          <TabsTrigger value="fluxo">📈 Fluxo Projetado</TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="space-y-4">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <>
              {/* Chart */}
              <Card><CardContent className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dreData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent></Card>

              {/* Table */}
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Margem %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreData.map(d => (
                      <TableRow key={d.mesKey}>
                        <TableCell className="font-medium">{d.mes}</TableCell>
                        <TableCell className="text-right text-emerald-600">{fmtMoney(d.receitas)}</TableCell>
                        <TableCell className="text-right text-red-600">{fmtMoney(d.despesas)}</TableCell>
                        <TableCell className={`text-right font-bold ${moneyClass(d.resultado)}`}>{fmtMoney(d.resultado)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {d.receitas > 0 ? `${((d.resultado / d.receitas) * 100).toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmtMoney(totalReceitas)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmtMoney(totalDespesas)}</TableCell>
                      <TableCell className={`text-right ${moneyClass(totalResultado)}`}>{fmtMoney(totalResultado)}</TableCell>
                      <TableCell className="text-right">{totalReceitas > 0 ? `${((totalResultado / totalReceitas) * 100).toFixed(1)}%` : '—'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent></Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="fluxo" className="space-y-4">
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Fluxo de Caixa Projetado — Próximos 6 Meses</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={fluxoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Area type="monotone" dataKey="entradas" name="Entradas" fill="#10b98133" stroke="#10b981" />
                <Area type="monotone" dataKey="saidas" name="Saídas" fill="#ef444433" stroke="#ef4444" />
                <Line type="monotone" dataKey="saldo" name="Saldo Líquido" stroke="#2563eb" strokeWidth={2} dot />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Entradas Previstas</TableHead>
                  <TableHead className="text-right">Saídas Previstas</TableHead>
                  <TableHead className="text-right">Saldo Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxoData.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmtMoney(d.entradas)}</TableCell>
                    <TableCell className="text-right text-red-600">{fmtMoney(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-bold ${moneyClass(d.saldo)}`}>{fmtMoney(d.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
