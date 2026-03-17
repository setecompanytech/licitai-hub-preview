import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, ArrowUpCircle,
  ArrowDownCircle, Landmark, BarChart3, Calendar, AlertTriangle,
  Target, Layers
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Cenario = 'realista' | 'otimista' | 'pessimista';

export default function FluxoCaixa() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30');
  const [agrupamento, setAgrupamento] = useState<'semanal' | 'mensal' | 'trimestral'>('semanal');
  const [cenario, setCenario] = useState<Cenario>('realista');
  const [saldoBancario, setSaldoBancario] = useState(0);
  const [pagar, setPagar] = useState<any[]>([]);
  const [receber, setReceber] = useState<any[]>([]);
  const [nfsAutorizadas, setNfsAutorizadas] = useState(0);
  const [contratosAtivos, setContratosAtivos] = useState(0);
  const [saldoContratos, setSaldoContratos] = useState(0);
  // Realizado (histórico)
  const [pagarRealizado, setPagarRealizado] = useState<any[]>([]);
  const [receberRealizado, setReceberRealizado] = useState<any[]>([]);

  useEffect(() => { if (user && empresaAtiva) loadAll(); }, [user, empresaAtiva, periodo]);

  const loadAll = async () => {
    setLoading(true);
    const dias = parseInt(periodo);
    const hoje = new Date();
    const futuro = new Date(hoje);
    futuro.setDate(futuro.getDate() + dias);
    const passado = new Date(hoje);
    passado.setDate(passado.getDate() - dias);
    const hojeStr = hoje.toISOString().split('T')[0];
    const futuroStr = futuro.toISOString().split('T')[0];
    const passadoStr = passado.toISOString().split('T')[0];

    const [contasRes, pagarRes, receberRes, nfsRes, contratosRes, pagarRealizadoRes, receberRealizadoRes] = await Promise.all([
      supabase.from('contas_bancarias').select('saldo_atual').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('ativo', true),
      supabase.from('contas_pagar').select('valor, data_vencimento, status, categoria, fornecedor').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).in('status', ['pendente', 'atrasado', 'parcial']).lte('data_vencimento', futuroStr),
      supabase.from('contas_receber').select('valor, data_vencimento, status, cliente, numero_nf').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).in('status', ['pendente', 'atrasado', 'parcial']).lte('data_vencimento', futuroStr),
      supabase.from('notas_fiscais').select('valor_total').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('status', 'autorizada'),
      supabase.from('contratos').select('valor_global, saldo_remanescente, status').eq('user_id', user!.id).eq('status', 'vigente'),
      supabase.from('contas_pagar').select('valor, valor_pago, data_pagamento, categoria').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('status', 'pago').gte('data_pagamento', passadoStr),
      supabase.from('contas_receber').select('valor, valor_recebido, data_recebimento, cliente').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('status', 'recebido').gte('data_recebimento', passadoStr),
    ]);

    setSaldoBancario(((contasRes.data as any[]) || []).reduce((s, c) => s + (c.saldo_atual || 0), 0));
    setPagar((pagarRes.data as any[]) || []);
    setReceber((receberRes.data as any[]) || []);
    setNfsAutorizadas(((nfsRes.data as any[]) || []).reduce((s, n) => s + (n.valor_total || 0), 0));
    const cts = (contratosRes.data as any[]) || [];
    setContratosAtivos(cts.length);
    setSaldoContratos(cts.reduce((s, c) => s + (c.saldo_remanescente || 0), 0));
    setPagarRealizado((pagarRealizadoRes.data as any[]) || []);
    setReceberRealizado((receberRealizadoRes.data as any[]) || []);
    setLoading(false);
  };

  const totalPagar = pagar.reduce((s, p) => s + p.valor, 0);
  const totalReceber = receber.reduce((s, r) => s + r.valor, 0);
  const atrasadosPagar = pagar.filter(p => p.status === 'atrasado');
  const atrasadosReceber = receber.filter(r => r.status === 'atrasado');

  // Cenário multipliers
  const cenarioMult = useMemo(() => {
    switch (cenario) {
      case 'otimista': return { receita: 1.15, despesa: 0.9 };
      case 'pessimista': return { receita: 0.75, despesa: 1.1 };
      default: return { receita: 1, despesa: 1 };
    }
  }, [cenario]);

  const saldoProjetado = saldoBancario + (totalReceber * cenarioMult.receita) - (totalPagar * cenarioMult.despesa);

  // Group by period
  const projecao = useMemo(() => {
    const periodos: { label: string; receitas: number; despesas: number; saldo: number; receitasReal: number; despesasReal: number }[] = [];
    const hoje = new Date();
    let saldo = saldoBancario;
    const diasPeriodo = agrupamento === 'semanal' ? 7 : agrupamento === 'mensal' ? 30 : 90;
    const numPeriodos = Math.max(1, Math.ceil(parseInt(periodo) / diasPeriodo));

    for (let s = 0; s < numPeriodos; s++) {
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() + s * diasPeriodo);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + diasPeriodo - 1);
      const inicioStr = inicio.toISOString().split('T')[0];
      const fimStr = fim.toISOString().split('T')[0];

      const rec = receber.filter(r => r.data_vencimento >= inicioStr && r.data_vencimento <= fimStr).reduce((s, r) => s + r.valor, 0) * cenarioMult.receita;
      const pag = pagar.filter(p => p.data_vencimento >= inicioStr && p.data_vencimento <= fimStr).reduce((s, p) => s + p.valor, 0) * cenarioMult.despesa;
      saldo = saldo + rec - pag;

      // Realizado (passado espelhado)
      const passadoInicio = new Date(hoje);
      passadoInicio.setDate(passadoInicio.getDate() - (numPeriodos - s) * diasPeriodo);
      const passadoFim = new Date(passadoInicio);
      passadoFim.setDate(passadoFim.getDate() + diasPeriodo - 1);
      const pInicioStr = passadoInicio.toISOString().split('T')[0];
      const pFimStr = passadoFim.toISOString().split('T')[0];

      const recReal = receberRealizado.filter(r => r.data_recebimento >= pInicioStr && r.data_recebimento <= pFimStr).reduce((s, r) => s + (r.valor_recebido || 0), 0);
      const pagReal = pagarRealizado.filter(p => p.data_pagamento >= pInicioStr && p.data_pagamento <= pFimStr).reduce((s, p) => s + (p.valor_pago || 0), 0);

      const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      periodos.push({
        label: agrupamento === 'trimestral'
          ? `${fmtDate(inicio)} - ${fmtDate(fim)}`
          : `${fmtDate(inicio)} - ${fmtDate(fim)}`,
        receitas: rec, despesas: pag, saldo,
        receitasReal: recReal, despesasReal: pagReal,
      });
    }
    return periodos;
  }, [pagar, receber, pagarRealizado, receberRealizado, saldoBancario, periodo, agrupamento, cenarioMult]);

  // DRE simplificado
  const dreResumo = useMemo(() => {
    const receitasBruta = receberRealizado.reduce((s, r) => s + (r.valor_recebido || 0), 0) + totalReceber;
    const custos = pagarRealizado.filter(p => ['Fornecedor', 'Material', 'Frete/Logística'].includes(p.categoria)).reduce((s, p) => s + (p.valor_pago || 0), 0);
    const despesasOp = pagarRealizado.filter(p => !['Fornecedor', 'Material', 'Frete/Logística'].includes(p.categoria)).reduce((s, p) => s + (p.valor_pago || 0), 0);
    const lucroBruto = receitasBruta - custos;
    const lucroOperacional = lucroBruto - despesasOp;
    const margem = receitasBruta > 0 ? (lucroOperacional / receitasBruta) * 100 : 0;
    return { receitasBruta, custos, lucroBruto, despesasOp, lucroOperacional, margem };
  }, [receberRealizado, pagarRealizado, totalReceber]);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-accent" /> Visão Geral Financeira</h3>
        <div className="flex gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="180">180 dias</SelectItem>
              <SelectItem value="365">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agrupamento} onValueChange={v => setAgrupamento(v as any)}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cenario} onValueChange={v => setCenario(v as Cenario)}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="realista">Realista</SelectItem>
              <SelectItem value="otimista">Otimista (+15%)</SelectItem>
              <SelectItem value="pessimista">Pessimista (-25%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Landmark className="w-3 h-3" /> Saldo Bancário</div>
          <p className={`text-lg font-bold ${saldoBancario >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoBancario)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><ArrowUpCircle className="w-3 h-3" /> A Receber</div>
          <p className="text-lg font-bold text-success">{fmt(totalReceber)}</p>
          <p className="text-[9px] text-muted-foreground">{receber.length} títulos</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><ArrowDownCircle className="w-3 h-3" /> A Pagar</div>
          <p className="text-lg font-bold text-destructive">{fmt(totalPagar)}</p>
          <p className="text-[9px] text-muted-foreground">{pagar.length} títulos</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Target className="w-3 h-3" /> Projetado ({cenario})</div>
          <p className={`text-lg font-bold ${saldoProjetado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldoProjetado)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><DollarSign className="w-3 h-3" /> NFs Emitidas</div>
          <p className="text-lg font-bold">{fmt(nfsAutorizadas)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Calendar className="w-3 h-3" /> Saldo Contratos</div>
          <p className="text-lg font-bold text-accent">{fmt(saldoContratos)}</p>
          <p className="text-[9px] text-muted-foreground">{contratosAtivos} vigentes</p>
        </Card>
      </div>

      {/* Alerts */}
      {(atrasadosPagar.length > 0 || atrasadosReceber.length > 0) && (
        <Card className="p-3 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div className="text-xs">
              {atrasadosPagar.length > 0 && <span className="text-destructive font-medium">{atrasadosPagar.length} pagamento(s) atrasado(s) ({fmt(atrasadosPagar.reduce((s, p) => s + p.valor, 0))})</span>}
              {atrasadosPagar.length > 0 && atrasadosReceber.length > 0 && <span className="mx-2">|</span>}
              {atrasadosReceber.length > 0 && <span className="text-warning font-medium">{atrasadosReceber.length} recebível(is) atrasado(s) ({fmt(atrasadosReceber.reduce((s, r) => s + r.valor, 0))})</span>}
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="projecao" className="space-y-3">
        <TabsList>
          <TabsTrigger value="projecao" className="text-xs"><TrendingUp className="w-3.5 h-3.5 mr-1" /> Projeção</TabsTrigger>
          <TabsTrigger value="dre" className="text-xs"><Layers className="w-3.5 h-3.5 mr-1" /> DRE Simplificado</TabsTrigger>
          <TabsTrigger value="comparativo" className="text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Realizado vs Previsto</TabsTrigger>
        </TabsList>

        <TabsContent value="projecao">
          <Card className="p-4">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Fluxo de Caixa — {agrupamento} — Cenário {cenario}
            </h4>
            <div className="space-y-2">
              {projecao.map((sem, idx) => {
                const maxVal = Math.max(...projecao.map(s => Math.max(s.receitas, s.despesas)), 1);
                return (
                  <div key={idx} className="p-2 rounded-lg bg-muted/30 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="w-32 text-muted-foreground font-mono text-[10px]">{sem.label}</span>
                      <span className={`font-bold ${sem.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(sem.saldo)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] text-success">Receitas</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success/60 rounded-full" style={{ width: `${(sem.receitas / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-24 text-right text-success">{fmt(sem.receitas)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] text-destructive">Despesas</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-destructive/60 rounded-full" style={{ width: `${(sem.despesas / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-24 text-right text-destructive">{fmt(sem.despesas)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="dre">
          <Card className="p-4">
            <h4 className="text-xs font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> Demonstrativo de Resultado — Últimos {periodo} dias
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Receita Bruta', valor: dreResumo.receitasBruta, color: 'text-success', bold: true },
                { label: '(-) Custo dos Serviços/Produtos', valor: -dreResumo.custos, color: 'text-destructive', bold: false },
                { label: '= Lucro Bruto', valor: dreResumo.lucroBruto, color: dreResumo.lucroBruto >= 0 ? 'text-success' : 'text-destructive', bold: true, divider: true },
                { label: '(-) Despesas Operacionais', valor: -dreResumo.despesasOp, color: 'text-destructive', bold: false },
                { label: '= Resultado Operacional', valor: dreResumo.lucroOperacional, color: dreResumo.lucroOperacional >= 0 ? 'text-success' : 'text-destructive', bold: true, divider: true },
              ].map((item, i) => (
                <div key={i}>
                  {item.divider && <div className="border-t border-border my-1" />}
                  <div className={`flex justify-between items-center py-1 ${item.bold ? 'font-bold' : ''}`}>
                    <span className="text-xs">{item.label}</span>
                    <span className={`text-sm ${item.color}`}>{fmt(Math.abs(item.valor))}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold">Margem Operacional</span>
                  <Badge className={`${dreResumo.margem >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {dreResumo.margem.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo">
          <Card className="p-4">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" /> Realizado vs Previsto por Período
            </h4>
            <div className="space-y-3">
              {projecao.map((sem, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-mono text-muted-foreground mb-2">{sem.label}</p>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Receitas</p>
                      <div className="flex justify-between"><span>Previsto:</span><span className="text-success">{fmt(sem.receitas)}</span></div>
                      <div className="flex justify-between"><span>Realizado:</span><span className="font-bold text-success">{fmt(sem.receitasReal)}</span></div>
                      {sem.receitas > 0 && (
                        <Progress value={Math.min((sem.receitasReal / sem.receitas) * 100, 100)} className="h-1.5 mt-1" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Despesas</p>
                      <div className="flex justify-between"><span>Previsto:</span><span className="text-destructive">{fmt(sem.despesas)}</span></div>
                      <div className="flex justify-between"><span>Realizado:</span><span className="font-bold text-destructive">{fmt(sem.despesasReal)}</span></div>
                      {sem.despesas > 0 && (
                        <Progress value={Math.min((sem.despesasReal / sem.despesas) * 100, 100)} className="h-1.5 mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upcoming payments */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-destructive"><ArrowDownCircle className="w-4 h-4" /> Próximos Pagamentos</h4>
          {pagar.slice(0, 5).map((p, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs">
              <div>
                <p className="font-medium truncate max-w-[150px]">{p.fornecedor || p.categoria || 'Sem fornecedor'}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <span className="font-bold text-destructive">{fmt(p.valor)}</span>
            </div>
          ))}
          {pagar.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sem pagamentos pendentes</p>}
        </Card>
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-success"><ArrowUpCircle className="w-4 h-4" /> Próximos Recebimentos</h4>
          {receber.slice(0, 5).map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs">
              <div>
                <p className="font-medium truncate max-w-[150px]">{r.cliente || 'Sem cliente'}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(r.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <span className="font-bold text-success">{fmt(r.valor)}</span>
            </div>
          ))}
          {receber.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sem recebimentos pendentes</p>}
        </Card>
      </div>
    </div>
  );
}
