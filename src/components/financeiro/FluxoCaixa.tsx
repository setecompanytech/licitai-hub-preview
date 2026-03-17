import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, ArrowUpCircle,
  ArrowDownCircle, Landmark, BarChart3, Calendar, AlertTriangle
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FluxoCaixa() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30');
  const [saldoBancario, setSaldoBancario] = useState(0);
  const [pagar, setPagar] = useState<any[]>([]);
  const [receber, setReceber] = useState<any[]>([]);
  const [nfsAutorizadas, setNfsAutorizadas] = useState(0);
  const [contratosAtivos, setContratosAtivos] = useState(0);
  const [saldoContratos, setSaldoContratos] = useState(0);

  useEffect(() => { if (user && empresaAtiva) loadAll(); }, [user, empresaAtiva, periodo]);

  const loadAll = async () => {
    setLoading(true);
    const dias = parseInt(periodo);
    const hoje = new Date();
    const futuro = new Date(hoje);
    futuro.setDate(futuro.getDate() + dias);
    const hojeStr = hoje.toISOString().split('T')[0];
    const futuroStr = futuro.toISOString().split('T')[0];

    const [contasRes, pagarRes, receberRes, nfsRes, contratosRes] = await Promise.all([
      supabase.from('contas_bancarias').select('saldo_atual')
        .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('ativo', true),
      supabase.from('contas_pagar').select('valor, data_vencimento, status, categoria, fornecedor')
        .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
        .in('status', ['pendente', 'atrasado'])
        .lte('data_vencimento', futuroStr),
      supabase.from('contas_receber').select('valor, data_vencimento, status, cliente, numero_nf')
        .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
        .in('status', ['pendente', 'atrasado'])
        .lte('data_vencimento', futuroStr),
      supabase.from('notas_fiscais').select('valor_total')
        .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id).eq('status', 'autorizada'),
      supabase.from('contratos').select('valor_global, saldo_remanescente, status')
        .eq('user_id', user!.id).eq('status', 'vigente'),
    ]);

    setSaldoBancario(((contasRes.data as any[]) || []).reduce((s, c) => s + (c.saldo_atual || 0), 0));
    setPagar((pagarRes.data as any[]) || []);
    setReceber((receberRes.data as any[]) || []);
    setNfsAutorizadas(((nfsRes.data as any[]) || []).reduce((s, n) => s + (n.valor_total || 0), 0));
    
    const cts = (contratosRes.data as any[]) || [];
    setContratosAtivos(cts.length);
    setSaldoContratos(cts.reduce((s, c) => s + (c.saldo_remanescente || 0), 0));
    
    setLoading(false);
  };

  const totalPagar = pagar.reduce((s, p) => s + p.valor, 0);
  const totalReceber = receber.reduce((s, r) => s + r.valor, 0);
  const atrasadosPagar = pagar.filter(p => p.status === 'atrasado');
  const atrasadosReceber = receber.filter(r => r.status === 'atrasado');
  const saldoProjetado = saldoBancario + totalReceber - totalPagar;

  // Group by week for projection
  const projecaoSemanal = useMemo(() => {
    const semanas: { label: string; receitas: number; despesas: number; saldo: number }[] = [];
    const hoje = new Date();
    let saldo = saldoBancario;

    for (let s = 0; s < Math.ceil(parseInt(periodo) / 7); s++) {
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() + s * 7);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 6);
      const inicioStr = inicio.toISOString().split('T')[0];
      const fimStr = fim.toISOString().split('T')[0];

      const rec = receber.filter(r => r.data_vencimento >= inicioStr && r.data_vencimento <= fimStr).reduce((s, r) => s + r.valor, 0);
      const pag = pagar.filter(p => p.data_vencimento >= inicioStr && p.data_vencimento <= fimStr).reduce((s, p) => s + p.valor, 0);
      saldo = saldo + rec - pag;

      semanas.push({
        label: `${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
        receitas: rec, despesas: pag, saldo,
      });
    }
    return semanas;
  }, [pagar, receber, saldoBancario, periodo]);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-accent" /> Visão Geral Financeira</h3>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Próximos 7 dias</SelectItem>
            <SelectItem value="15">Próximos 15 dias</SelectItem>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
          </SelectContent>
        </Select>
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
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><TrendingUp className="w-3 h-3" /> Saldo Projetado</div>
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
              {atrasadosPagar.length > 0 && (
                <span className="text-destructive font-medium">{atrasadosPagar.length} conta(s) a pagar atrasada(s) ({fmt(atrasadosPagar.reduce((s, p) => s + p.valor, 0))})</span>
              )}
              {atrasadosPagar.length > 0 && atrasadosReceber.length > 0 && <span className="mx-2">|</span>}
              {atrasadosReceber.length > 0 && (
                <span className="text-warning font-medium">{atrasadosReceber.length} recebível(is) atrasado(s) ({fmt(atrasadosReceber.reduce((s, r) => s + r.valor, 0))})</span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Weekly projection */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Projeção de Fluxo de Caixa — Próximos {periodo} dias
        </h4>
        <div className="space-y-2">
          {projecaoSemanal.map((sem, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
              <span className="w-28 text-muted-foreground font-mono text-[10px]">{sem.label}</span>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-success">+{fmt(sem.receitas)}</span>
                <span className="text-destructive">-{fmt(sem.despesas)}</span>
              </div>
              <span className={`font-bold ${sem.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(sem.saldo)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Upcoming payments */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-destructive">
            <ArrowDownCircle className="w-4 h-4" /> Próximos Pagamentos
          </h4>
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
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-success">
            <ArrowUpCircle className="w-4 h-4" /> Próximos Recebimentos
          </h4>
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
