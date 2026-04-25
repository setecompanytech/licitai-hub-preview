import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart, AlertTriangle,
  Calendar, Percent, Loader2, Receipt, Lock, Pencil, Check, X
} from 'lucide-react';
import RelatorioConsumoAtaDialog from './RelatorioConsumoAtaDialog';
import ManutencaoAtaSrpDialog from './ManutencaoAtaSrpDialog';
import EvolucaoMensalDashboard from './EvolucaoMensalDashboard';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function ContratoDashboard({ contratoId }: { contratoId: string }) {
  const [data, setData] = useState<{ contrato: any; itens: any[]; pedidos: any[]; custos: any[]; aditivos: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  const { temPermissao, isFinanceiro, isAdmin } = useMembroPermissoes();

  const podeVerCustos = isFinanceiro || isAdmin;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [contratoRes, itensRes, pedidosRes, custosRes, aditivosRes] = await Promise.all([
        supabase.from('contratos').select('*').eq('id', contratoId).single(),
        supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_custos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId),
      ]);
      setData({
        contrato: contratoRes.data,
        itens: (itensRes.data as any[]) || [],
        pedidos: (pedidosRes.data as any[]) || [],
        custos: (custosRes.data as any[]) || [],
        aditivos: (aditivosRes.data as any[]) || [],
      });
      setLoading(false);
    };
    load();
  }, [contratoId]);

  const calc = useMemo(() => {
    if (!data?.contrato) return null;
    const c = data.contrato;
    const pedidosAtivos = data.pedidos.filter((p: any) => p.status !== 'cancelado');
    const faturamento = pedidosAtivos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
    
    // Sum addendum acrescimos/supressoes
    const totalAditivoValorAcrescimo = data.aditivos.reduce((s: number, a: any) => s + (a.valor_acrescimo || 0), 0);
    const totalAditivoValorSupressao = data.aditivos.reduce((s: number, a: any) => s + (a.valor_supressao || 0), 0);
    const totalAditivoQtdAcrescimo = data.aditivos.reduce((s: number, a: any) => s + (a.quantidade_acrescimo || 0), 0);
    const totalAditivoQtdSupressao = data.aditivos.reduce((s: number, a: any) => s + (a.quantidade_supressao || 0), 0);
    
    // Custos from contrato_custos table
    const totalCustosTabela = data.custos.reduce((s: number, cc: any) => s + (cc.valor || 0), 0);
    const custosDiretos = data.custos.filter((cc: any) => cc.tipo === 'custo_direto').reduce((s: number, cc: any) => s + cc.valor, 0);
    const tributos = data.custos.filter((cc: any) => cc.tipo === 'tributo').reduce((s: number, cc: any) => s + cc.valor, 0);
    const frete = data.custos.filter((cc: any) => cc.tipo === 'frete_logistica').reduce((s: number, cc: any) => s + cc.valor, 0);
    const despAdmin = data.custos.filter((cc: any) => cc.tipo === 'despesa_administrativa').reduce((s: number, cc: any) => s + cc.valor, 0);
    
    // Custos from pedidos (custo_total field)
    const custoPedidos = pedidosAtivos.reduce((s: number, p: any) => s + (p.custo_total || 0), 0);
    
    // Total costs = table costs + pedido costs
    const totalCustos = totalCustosTabela + custoPedidos;
    
    const lucroBruto = faturamento - custosDiretos - custoPedidos;
    const lucroLiquido = faturamento - totalCustos;
    
    // valor_global already includes aditivos via trigger, use it directly
    const valorGlobalEfetivo = c.valor_global || 0;
    const pctConsumo = valorGlobalEfetivo > 0 ? (c.valor_consumido / valorGlobalEfetivo) * 100 : 0;
    
    const diasRestantes = c.data_fim ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    
    // For items, add addendum quantities proportionally
    const itensComAditivo = data.itens.map((i: any) => {
      const qtdContratadaTotal = (i.quantidade_contratada || 0) + totalAditivoQtdAcrescimo - totalAditivoQtdSupressao;
      const saldoQtd = qtdContratadaTotal - (i.quantidade_consumida || 0);
      return { ...i, quantidade_contratada_total: qtdContratadaTotal, saldo_quantitativo_efetivo: saldoQtd };
    });
    
    const itensAlertaSaldo = itensComAditivo.filter((i: any) => i.quantidade_contratada_total > 0 && (i.quantidade_consumida / i.quantidade_contratada_total) * 100 >= 80);
    const meses: Record<string, number> = {};
    pedidosAtivos.forEach((p: any) => { if (p.data_pedido) { const k = p.data_pedido.substring(0, 7); meses[k] = (meses[k] || 0) + (p.valor_total || 0); } });
    const pedidosPorMes = Object.entries(meses).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return { c, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, diasRestantes, itensAlertaSaldo, pedidosPorMes, valorGlobalEfetivo, totalAditivoValorAcrescimo, totalAditivoValorSupressao, totalAditivoQtdAcrescimo, totalAditivoQtdSupressao };
  }, [data]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!calc) return <Card className="p-8 text-center text-muted-foreground">Contrato não encontrado</Card>;

  const { c, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, diasRestantes, itensAlertaSaldo, pedidosPorMes, valorGlobalEfetivo, totalAditivoValorAcrescimo, totalAditivoValorSupressao } = calc;
  const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
  const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;

  const isAtaSrp = c.tipo_documento === 'ata_srp';

  return (
    <div className="space-y-5">
      {isAtaSrp && (
        <div className="flex justify-end gap-2">
          <ManutencaoAtaSrpDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
          <RelatorioConsumoAtaDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
        </div>
      )}
      {(itensAlertaSaldo.length > 0 || (diasRestantes !== null && diasRestantes <= 60)) && (
        <div className="bg-warning/5 border border-warning/30 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-warning flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Alertas</h4>
          {diasRestantes !== null && diasRestantes <= 60 && <p className="text-xs text-warning/80">Contrato vence em <strong>{diasRestantes} dias</strong></p>}
          {itensAlertaSaldo.map((i: any) => (
            <p key={i.id} className="text-xs text-warning/80"><strong>{i.descricao}</strong>: saldo baixo (restam {i.saldo_quantitativo_efetivo ?? i.saldo_quantitativo} {i.unidade})</p>
          ))}
        </div>
      )}

      {/* Cards visíveis para todos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px]"><DollarSign className="w-3.5 h-3.5" /> Valor Global</div>
            {podeVerCustos && !editingGlobal && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingGlobal(true); setGlobalInput(String(c.valor_global || 0)); }}>
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editingGlobal ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                value={globalInput}
                onChange={e => setGlobalInput(e.target.value)}
                className="h-7 text-sm"
                autoFocus
              />
              <Button size="icon" className="h-7 w-7 shrink-0" onClick={async () => {
                const newVal = parseFloat(globalInput) || 0;
                const { error } = await supabase.from('contratos').update({ valor_global: newVal, valor_global_original: newVal } as any).eq('id', contratoId);
                if (error) { toast.error('Erro ao atualizar'); return; }
                toast.success('Valor Global atualizado!');
                setEditingGlobal(false);
                // Reload data
                const res = await supabase.from('contratos').select('*').eq('id', contratoId).single();
                if (res.data) setData(prev => prev ? { ...prev, contrato: res.data } : prev);
              }}><Check className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingGlobal(false)}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <>
              <p className="text-lg font-bold">{fmt(valorGlobalEfetivo)}</p>
              {totalAditivoValorAcrescimo > 0 && (
                <p className="text-[9px] text-muted-foreground">Original: {fmt(c.valor_global_original || 0)} + Aditivos: {fmt(totalAditivoValorAcrescimo)}</p>
              )}
              <Progress value={Math.min(pctConsumo, 100)} className="h-1.5 mt-2" />
              <p className="text-[9px] text-muted-foreground mt-1">{pctConsumo.toFixed(1)}% consumido</p>
            </>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1"><TrendingUp className="w-3.5 h-3.5" /> Saldo</div>
          <p className={`text-lg font-bold ${(c.saldo_remanescente || 0) > 0 ? 'text-success' : 'text-destructive'}`}>{fmt(c.saldo_remanescente || 0)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1"><Package className="w-3.5 h-3.5" /> Itens</div>
          <p className="text-lg font-bold">{data!.itens.length}</p>
          {itensAlertaSaldo.length > 0 && <Badge className="text-[9px] bg-warning/10 text-warning mt-1">{itensAlertaSaldo.length} em alerta</Badge>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1"><ShoppingCart className="w-3.5 h-3.5" /> Pedidos</div>
          <p className="text-lg font-bold">{pedidosAtivos.length}</p>
        </Card>
      </div>

      {/* Cards financeiros - apenas admin/financeiro */}
      {podeVerCustos && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-l-4 border-l-accent">
            <div className="text-[10px] text-muted-foreground mb-1">Faturamento</div>
            <p className="text-lg font-bold">{fmt(faturamento)}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-destructive">
            <div className="text-[10px] text-muted-foreground mb-1">Custos Totais</div>
            <p className="text-lg font-bold text-destructive">{fmt(totalCustos)}</p>
            {custoPedidos > 0 && (
              <p className="text-[9px] text-muted-foreground">Custos pedidos: {fmt(custoPedidos)}</p>
            )}
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
      )}

      {/* Composição de custos - apenas admin/financeiro */}
      {podeVerCustos && totalCustos > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-accent" /> Composição de Custos</h4>
          <div className="space-y-2">
            {[
              { label: 'Custos Diretos (Pedidos)', valor: custoPedidos, color: 'bg-primary' },
              { label: 'Custos Diretos (Outros)', valor: custosDiretos, color: 'bg-accent' },
              { label: 'Desp. Administrativas', valor: despAdmin, color: 'bg-secondary' },
              { label: 'Frete / Logística', valor: frete, color: 'bg-warning' },
              { label: 'Tributos', valor: tributos, color: 'bg-destructive' },
              { label: 'Outros', valor: totalCustosTabela - custosDiretos - despAdmin - frete - tributos, color: 'bg-muted-foreground' },
            ].filter(x => x.valor > 0).map(item => {
              const pct = totalCustos > 0 ? (item.valor / totalCustos) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-40">{item.label}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium w-28 text-right">{fmt(item.valor)}</span>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Aviso para não-financeiros */}
      {!podeVerCustos && (
        <Card className="p-4 border border-dashed border-muted-foreground/30">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Lock className="w-4 h-4" />
            <span>Custos, margens e lucratividade são visíveis apenas para o setor Financeiro e Administradores.</span>
          </div>
        </Card>
      )}

      <EvolucaoMensalDashboard
        pedidos={data!.pedidos as any[]}
        podeVerCustos={podeVerCustos}
        valorGlobal={valorGlobalEfetivo}
        dataInicio={c.data_inicio}
        dataFim={c.data_fim}
      />

      <Card className="p-4">
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-accent" /> Vigência</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground">Assinatura:</span><p className="font-medium">{c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div><span className="text-muted-foreground">Início:</span><p className="font-medium">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div><span className="text-muted-foreground">Fim:</span><p className={`font-medium ${diasRestantes !== null && diasRestantes <= 60 ? 'text-warning' : ''}`}>{c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div><span className="text-muted-foreground">Dias restantes:</span><p className={`font-medium ${diasRestantes !== null && diasRestantes <= 60 ? 'text-warning font-bold' : ''}`}>{diasRestantes !== null ? `${diasRestantes} dias` : '—'}</p></div>
        </div>
      </Card>
    </div>
  );
}
