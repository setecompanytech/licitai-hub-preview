import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Loader2, Receipt, Users, Wallet
} from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FinDashboard() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    entradas: 0, saidas: 0, resultado: 0, nfPendentes: 0,
    comissoesPendentes: 0, contasCount: 0,
  });

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    loadKpis();
  }, [empresaAtiva?.id]);

  async function loadKpis() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0];
    const mesFim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const [entRes, saiRes, nfRes, comRes, ctRes] = await Promise.all([
      supabase.from('fin_lancamentos').select('valor')
        .eq('empresa_id', eid).eq('tipo', 'entrada').eq('status', 'pago')
        .gte('data_competencia', mesInicio).lte('data_competencia', mesFim),
      supabase.from('fin_lancamentos').select('valor')
        .eq('empresa_id', eid).eq('tipo', 'saida').eq('status', 'pago')
        .gte('data_competencia', mesInicio).lte('data_competencia', mesFim),
      supabase.from('fin_notas_fiscais').select('id')
        .eq('empresa_id', eid).is('manifesto', null).eq('status_sefaz', 'autorizada'),
      supabase.from('fin_comissoes').select('id')
        .eq('empresa_id', eid).eq('status', 'a_pagar'),
      supabase.from('fin_contas').select('id')
        .eq('empresa_id', eid).eq('ativo', true),
    ]);

    const totalEnt = (entRes.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
    const totalSai = (saiRes.data ?? []).reduce((s, r) => s + Number(r.valor), 0);

    setKpis({
      entradas: totalEnt,
      saidas: totalSai,
      resultado: totalEnt - totalSai,
      nfPendentes: nfRes.data?.length ?? 0,
      comissoesPendentes: comRes.data?.length ?? 0,
      contasCount: ctRes.data?.length ?? 0,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { label: 'Receitas do Mês', value: fmt(kpis.entradas), icon: TrendingUp, color: 'text-success' },
    { label: 'Despesas do Mês', value: fmt(kpis.saidas), icon: TrendingDown, color: 'text-destructive' },
    { label: 'Resultado Mensal', value: fmt(kpis.resultado), icon: DollarSign, color: kpis.resultado >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'NF-e Pendentes', value: String(kpis.nfPendentes), icon: Receipt, color: kpis.nfPendentes > 0 ? 'text-warning' : 'text-muted-foreground' },
    { label: 'Comissões a Pagar', value: String(kpis.comissoesPendentes), icon: Users, color: kpis.comissoesPendentes > 0 ? 'text-warning' : 'text-muted-foreground' },
    { label: 'Contas Ativas', value: String(kpis.contasCount), icon: Wallet, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wide mb-2">
              <c.icon className="w-4 h-4" /> {c.label}
            </div>
            <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Resumo do Período</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Receitas</span>
              <span className="font-mono font-semibold text-success">{fmt(kpis.entradas)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Despesas</span>
              <span className="font-mono font-semibold text-destructive">{fmt(kpis.saidas)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold">Resultado</span>
              <span className={`font-mono font-bold text-lg ${kpis.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                {fmt(kpis.resultado)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Alertas</h3>
          <div className="space-y-3">
            {kpis.nfPendentes > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                <AlertTriangle className="w-4 h-4" />
                {kpis.nfPendentes} NF-e sem manifestação
              </div>
            )}
            {kpis.comissoesPendentes > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 text-accent text-sm">
                <Users className="w-4 h-4" />
                {kpis.comissoesPendentes} comissões pendentes
              </div>
            )}
            {kpis.nfPendentes === 0 && kpis.comissoesPendentes === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
