import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Landmark, Loader2, AlertTriangle, Receipt, ChevronRight,
  DollarSign, FileWarning, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMoney, fmtDate, moneyClass } from '@/styles/financeiro';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';

export default function FinHubDashboard() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>({});

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const today = new Date().toISOString().split('T')[0];
    const mesAtual = today.substring(0, 7);
    const inicioMes = `${mesAtual}-01`;

    // Mês anterior
    const dtMesAnt = new Date();
    dtMesAnt.setMonth(dtMesAnt.getMonth() - 1);
    const mesAnt = dtMesAnt.toISOString().substring(0, 7);

    const [cpRes, crRes, contasRes, cpVencRes, crProxRes, nfeRes, movMesRes, movMesAntRes, cpUrgRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('valor_documento, valor_pago, status, data_vencimento, data_pagamento').eq('empresa_id', eid),
      supabase.from('fin_contas_receber').select('valor_documento, valor_recebido, status, data_vencimento, data_recebimento').eq('empresa_id', eid),
      supabase.from('fin_contas').select('id, nome, tipo, banco_nome, banco_codigo, agencia, numero_conta, saldo_inicial, limite_credito, ativo').eq('empresa_id', eid).eq('ativo', true),
      supabase.from('fin_contas_pagar').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['aberto', 'em_aberto', 'parcial']).lt('data_vencimento', today),
      supabase.from('fin_contas_receber').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).in('status', ['em_aberto', 'recebido_parcial']).gte('data_vencimento', today).lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
      supabase.from('fin_notas_fiscais').select('id, manifesto, xml_baixado, status_sefaz').eq('empresa_id', eid).eq('status_sefaz', 'autorizada').is('manifesto', null),
      supabase.from('fin_movimentacoes').select('tipo_lancamento, valor').eq('empresa_id', eid).gte('data_lancamento', inicioMes),
      supabase.from('fin_movimentacoes').select('tipo_lancamento, valor').eq('empresa_id', eid).gte('data_lancamento', `${mesAnt}-01`).lt('data_lancamento', inicioMes),
      supabase.from('fin_contas_pagar').select('id, favorecido_nome, valor_documento, data_vencimento, status').eq('empresa_id', eid).in('status', ['aberto', 'em_aberto', 'parcial', 'vencido']).lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).order('data_vencimento').limit(8),
    ]);

    const cpAll = cpRes.data || [];
    const crAll = crRes.data || [];

    // Receita bruta mês atual (CR recebidos no mês)
    const receitaMes = crAll.filter(c => c.status === 'recebido' && c.data_recebimento?.startsWith(mesAtual)).reduce((s, c) => s + (c.valor_recebido || 0), 0);
    const receitaMesAnt = crAll.filter(c => c.status === 'recebido' && c.data_recebimento?.startsWith(mesAnt)).reduce((s, c) => s + (c.valor_recebido || 0), 0);

    // Despesas pagas mês atual
    const despesaMes = cpAll.filter(c => c.status === 'pago' && c.data_pagamento?.startsWith(mesAtual)).reduce((s, c) => s + (c.valor_pago || 0), 0);
    const despesaMesAnt = cpAll.filter(c => c.status === 'pago' && c.data_pagamento?.startsWith(mesAnt)).reduce((s, c) => s + (c.valor_pago || 0), 0);

    const resultado = receitaMes - despesaMes;
    const margem = receitaMes > 0 ? (resultado / receitaMes) * 100 : 0;

    // CP em aberto
    const cpAberto = cpAll.filter(c => ['aberto', 'em_aberto', 'parcial', 'vencido'].includes(c.status || '')).reduce((s, c) => s + (c.valor_documento || 0), 0);
    const cpAbertoQtd = cpAll.filter(c => ['aberto', 'em_aberto', 'parcial', 'vencido'].includes(c.status || '')).length;

    // CR em aberto
    const crAberto = crAll.filter(c => ['em_aberto', 'recebido_parcial'].includes(c.status || '')).reduce((s, c) => s + (c.valor_documento || 0), 0);
    const crAbertoQtd = crAll.filter(c => ['em_aberto', 'recebido_parcial'].includes(c.status || '')).length;

    // Gráfico 6 meses
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - i);
      const m = dt.toISOString().substring(0, 7);
      const label = dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const rec = crAll.filter(c => c.status === 'recebido' && c.data_recebimento?.startsWith(m)).reduce((s, c) => s + (c.valor_recebido || 0), 0);
      const desp = cpAll.filter(c => c.status === 'pago' && c.data_pagamento?.startsWith(m)).reduce((s, c) => s + (c.valor_pago || 0), 0);
      chartData.push({ mes: label, receitas: rec, despesas: desp, saldo: rec - desp });
    }

    // Saldos das contas (simplificado com saldo_inicial)
    const contasAll = contasRes.data || [];

    // Variações %
    const varReceita = receitaMesAnt > 0 ? ((receitaMes - receitaMesAnt) / receitaMesAnt * 100) : 0;
    const varDespesa = despesaMesAnt > 0 ? ((despesaMes - despesaMesAnt) / despesaMesAnt * 100) : 0;

    setD({
      receitaMes, despesaMes, resultado, margem,
      varReceita, varDespesa,
      cpAberto, cpAbertoQtd, cpAtrasadas: cpVencRes.count || 0,
      crAberto, crAbertoQtd, crProx7d: crProxRes.count || 0,
      nfeSemManifesto: (nfeRes.data || []).length,
      nfeSemXml: (nfeRes.data || []).filter(n => !n.xml_baixado).length,
      contas: contasAll,
      chartData,
      cpUrgentes: cpUrgRes.data || [],
    });
    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const kpis = [
    {
      label: 'Receita Bruta', valor: d.receitaMes, icon: TrendingUp,
      sub: `vs. mês ant. ${d.varReceita >= 0 ? '+' : ''}${d.varReceita.toFixed(1)}%`,
      color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      label: 'Despesas Pagas', valor: d.despesaMes, icon: TrendingDown,
      sub: `vs. mês ant. ${d.varDespesa >= 0 ? '+' : ''}${d.varDespesa.toFixed(1)}%`,
      color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20',
    },
    {
      label: 'Resultado Líquido', valor: d.resultado, icon: DollarSign,
      sub: `margem: ${d.margem.toFixed(1)}%`,
      color: d.resultado >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg: d.resultado >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20',
    },
    {
      label: 'CP em Aberto', valor: d.cpAberto, icon: ArrowDownCircle,
      sub: `${d.cpAbertoQtd} docs · ${d.cpAtrasadas} atrasadas`,
      color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/20',
    },
    {
      label: 'CR em Aberto', valor: d.crAberto, icon: ArrowUpCircle,
      sub: `${d.crAbertoQtd} docs · ${d.crProx7d} a vencer 7d`,
      color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: 'NF-e Pendentes', valor: d.nfeSemManifesto, icon: Receipt,
      sub: `${d.nfeSemXml} sem XML ↓`, isCount: true,
      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Hub Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão consolidada — mês atual</p>
      </div>

      {/* 2.1 — 6 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('p-1.5 rounded-lg', k.bg)}>
                  <k.icon className={cn('w-4 h-4', k.color)} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground truncate">{k.label}</span>
              </div>
              <p className={cn('text-lg font-bold font-mono', k.color)}>
                {k.isCount ? k.valor : fmtMoney(k.valor)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2.2 — Gráfico Fluxo de Caixa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fluxo de Caixa — Últimos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtMoney(v), name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Saldo']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="receitas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Despesas" />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Saldo" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* 2.3 — Contas Correntes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="w-4 h-4" /> Contas Correntes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.contas.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta cadastrada</p>
            )}
            {d.contas.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.banco_nome || c.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.agencia && `Ag: ${c.agencia}`} {c.numero_conta && `/ Conta: ${c.numero_conta}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                    {fmtMoney(c.saldo_inicial || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Saldo inicial</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 2.4 — CP Urgentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> CP Urgentes (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.cpUrgentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta urgente 🎉</p>
            ) : (
              <div className="space-y-1.5">
                {d.cpUrgentes.map((cp: any) => {
                  const atrasado = cp.data_vencimento < new Date().toISOString().split('T')[0];
                  return (
                    <div key={cp.id} className="flex items-center justify-between p-2 rounded border text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{cp.favorecido_nome || '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDate(cp.data_vencimento)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{fmtMoney(cp.valor_documento)}</span>
                        {atrasado && <Badge variant="destructive" className="text-[10px] px-1.5">Atrasada</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2.6 — Mini DRE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mini DRE — Mês Corrente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm font-mono">
            {[
              { label: 'RECEITA BRUTA', value: d.receitaMes, bold: true },
              { label: '(-) Deduções (ISS/PIS/COFINS)', value: 0 },
              { label: '= RECEITA LÍQUIDA', value: d.receitaMes, bold: true },
              { label: '(-) Custos dos Serviços', value: 0 },
              { label: '= LUCRO BRUTO', value: d.receitaMes, bold: true, sub: `margem: ${d.receitaMes > 0 ? '100' : '0'}%` },
              { label: '(-) Despesas Operacionais', value: d.despesaMes },
              { label: '(-) Despesas Financeiras', value: 0 },
              { label: '= RESULTADO ANTES IR/CSLL', value: d.resultado, bold: true },
              { label: '(-) Provisão IR/CSLL', value: 0 },
              { label: '= RESULTADO LÍQUIDO', value: d.resultado, bold: true, sub: `margem: ${d.margem.toFixed(1)}%` },
            ].map((row, i) => (
              <div key={i} className={cn(
                'flex items-center justify-between py-1 px-2 rounded',
                row.bold && 'bg-muted/50 font-bold'
              )}>
                <span className="text-muted-foreground">{row.label}</span>
                <div className="text-right">
                  <span className={moneyClass(row.value)}>{fmtMoney(row.value)}</span>
                  {row.sub && <span className="text-[10px] text-muted-foreground ml-2">({row.sub})</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
