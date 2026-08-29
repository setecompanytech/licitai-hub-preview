import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { supabase } from '@/integrations/supabase/client';
import { situacaoDaVigencia } from '@/lib/contratos/vigencia';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart, AlertTriangle,
  Calendar, Percent, Loader2, Receipt, Lock, Pencil, Check, X
} from 'lucide-react';
import CabecalhoDoDocumento from '@/components/documento/CabecalhoDoDocumento';
import SecaoDoDocumento from '@/components/documento/SecaoDoDocumento';
import DeOndeVem from '@/components/documento/DeOndeVem';
import FolhaDeAssinaturas from '@/components/documento/FolhaDeAssinaturas';
import BotaoImprimir from '@/components/documento/BotaoImprimir';
import RelatorioConsumoAtaDialog from './RelatorioConsumoAtaDialog';
import ManutencaoAtaSrpDialog from './ManutencaoAtaSrpDialog';
import EvolucaoMensalDashboard from './EvolucaoMensalDashboard';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function ContratoDashboard({ contratoId }: { contratoId: string }) {
  const [data, setData] = useState<{ contrato: any; itens: any[]; pedidos: any[]; custos: any[]; aditivos: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [editandoVigencia, setEditandoVigencia] = useState(false);
  const [vigForm, setVigForm] = useState({ assinatura: '', inicio: '', fim: '' });
  const [salvandoVigencia, setSalvandoVigencia] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  const { temPermissao, isFinanceiro, isAdmin } = useMembroPermissoes();

  const podeVerCustos = isFinanceiro || isAdmin;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [contratoRes, itensRes, pedidosRes, custosRes, aditivosRes] = await Promise.all([
        supabase.from('contratos').select('*').eq('id', contratoId).single(),
        supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_custos').select('*').eq('contrato_id', contratoId),
        supabase.from('contrato_aditivos').select('*').eq('contrato_id', contratoId),
      ]);
      if (cancelled) return;
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

    // Realtime: sincroniza Valor Global / % consumido quando pedidos forem
    // criados ou removidos (inclusive via cascata do Financeiro).
    const channel = supabase
      .channel(`contrato-dashboard-${contratoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_pedidos', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_itens', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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
    
    // Contagem por DATA e sem sinal invertido: ver lib/contratos/vigencia.
    const vigencia = situacaoDaVigencia(c.data_fim);
    const diasRestantes = vigencia.dias;
    
    // For items, add addendum quantities proportionally
    const itensComAditivo = data.itens.map((i: any) => {
      const qtdContratadaTotal = (i.quantidade_contratada || 0) + totalAditivoQtdAcrescimo - totalAditivoQtdSupressao;
      const saldoQtd = qtdContratadaTotal - (i.quantidade_consumida || 0);
      return { ...i, quantidade_contratada_total: qtdContratadaTotal, saldo_quantitativo_efetivo: saldoQtd };
    });
    
    const itensAlertaSaldo = itensComAditivo.filter((i: any) => i.quantidade_contratada_total > 0 && (i.quantidade_consumida / i.quantidade_contratada_total) * 100 >= 80);
    // As duas cascatas da ATA precisam concordar: o consumo FINANCEIRO (soma
    // dos contratos derivados) e o FÍSICO (quilos baixados dos itens). Dinheiro
    // andando com quilos parados = contratos derivados com quantidade zerada —
    // o scan não rendeu o número e ninguém completou. Sem este aviso, a
    // divergência só aparecia quando o estoque "sobrava" no fim da vigência.
    const fisicoParado = c?.tipo_documento === 'ata_srp'
      && (c?.valor_consumido || 0) > 0
      && data.itens.length > 0
      && data.itens.every((i: any) => (i.quantidade_ata_consumida || 0) === 0);
    const meses: Record<string, number> = {};
    pedidosAtivos.forEach((p: any) => { if (p.data_pedido) { const k = p.data_pedido.substring(0, 7); meses[k] = (meses[k] || 0) + (p.valor_total || 0); } });
    const pedidosPorMes = Object.entries(meses).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    return { c, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, diasRestantes, vigencia, fisicoParado, itensAlertaSaldo, pedidosPorMes, valorGlobalEfetivo, totalAditivoValorAcrescimo, totalAditivoValorSupressao, totalAditivoQtdAcrescimo, totalAditivoQtdSupressao };
  }, [data]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!calc) return <Card className="p-8 text-center text-muted-foreground">Contrato não encontrado</Card>;

  const { c, pedidosAtivos, faturamento, totalCustos, totalCustosTabela, custosDiretos, custoPedidos, tributos, frete, despAdmin, lucroBruto, lucroLiquido, pctConsumo, diasRestantes, vigencia, fisicoParado, itensAlertaSaldo, pedidosPorMes, valorGlobalEfetivo, totalAditivoValorAcrescimo, totalAditivoValorSupressao } = calc;
  const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
  const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;

  const isAtaSrp = c.tipo_documento === 'ata_srp';

  return (
    <div className="space-y-5 documento">
      {/* Só aparece no papel: a folha sai da impressora sem saber de que
          empresa e de que contrato ela fala, e vai parar dentro de um
          processo administrativo. */}
      <CabecalhoDoDocumento
        titulo={isAtaSrp ? 'Relatório de Consumo de Ata' : 'Relatório de Execução Contratual'}
        referencia={c.objeto ?? undefined}
        identificador={[
          isAtaSrp ? c.numero_ata : c.numero_contrato,
          c.orgao_contratante,
        ].filter(Boolean).join(' — ') || undefined}
      />

      <div className="flex justify-end gap-2">
        <BotaoImprimir />
        {isAtaSrp && (
          <>
            <ManutencaoAtaSrpDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
            <RelatorioConsumoAtaDialog ataId={contratoId} ataNumero={c.numero_ata || c.numero_contrato} />
          </>
        )}
      </div>
      {(itensAlertaSaldo.length > 0 || vigencia.vencido || vigencia.vencendo || fisicoParado) && (
        <SecaoDoDocumento numero="1" titulo="Alertas">
        <div className={`rounded-xl p-4 space-y-2 border ${vigencia.vencido ? 'bg-destructive/5 border-destructive/30' : 'bg-warning/5 border-warning/30'}`}>
          <h4 className={`text-xs font-semibold flex items-center gap-1.5 ${vigencia.vencido ? 'text-destructive' : 'text-warning'}`}>
            <AlertTriangle className="w-4 h-4" /> Alertas
          </h4>
          {vigencia.vencido && (
            <p className="text-xs text-destructive/90">
              <strong>{vigencia.frase}</strong> (em {c.data_fim ? new Date(`${c.data_fim}T12:00:00`).toLocaleDateString('pt-BR') : '—'}).
              {' '}Se houve prorrogação, registre o aditivo de prazo para a vigência voltar a valer.
            </p>
          )}
          {!vigencia.vencido && vigencia.vencendo && <p className="text-xs text-warning/80">{vigencia.frase}</p>}
          {fisicoParado && (
            <p className="text-xs text-warning/80">
              <strong>Consumo financeiro sem lastro físico:</strong> há contratos derivados somando
              valor, mas nenhum quilo foi baixado dos itens da ata. Abra o contrato derivado →
              Itens/Lotes e preencha as quantidades (o lápis edita).
            </p>
          )}
          {itensAlertaSaldo.map((i: any) => (
            <p key={i.id} className="text-xs text-warning/80"><strong>{i.descricao}</strong>: saldo baixo (restam {i.saldo_quantitativo_efetivo ?? i.saldo_quantitativo} {i.unidade})</p>
          ))}
        </div>
        </SecaoDoDocumento>
      )}

      <SecaoDoDocumento numero="2" titulo="Execução do contrato">
      {/* Cards visíveis para todos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><DollarSign className="w-3.5 h-3.5" /> Valor Global</div>
            {podeVerCustos && !editingGlobal && (
              <Button variant="ghost" size="icon" className="h-5 w-5 nao-imprime" onClick={() => { setEditingGlobal(true); setGlobalInput(String(c.valor_global || 0)); }}>
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editingGlobal ? (
            <div className="flex items-center gap-1">
              <MoneyInput
                value={parseFloat(globalInput) || 0}
                onValueChange={v => setGlobalInput(String(v))}
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
                <p className="text-xs text-muted-foreground">Original: {fmt(c.valor_global_original || 0)} + Aditivos: {fmt(totalAditivoValorAcrescimo)}</p>
              )}
              <Progress value={Math.min(pctConsumo, 100)} className="h-1.5 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{pctConsumo.toFixed(1)}% consumido</p>
            </>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" /> Saldo</div>
          <p className={`text-lg font-bold ${(c.saldo_remanescente || 0) > 0 ? 'text-success' : 'text-destructive'}`}>{fmt(c.saldo_remanescente || 0)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Package className="w-3.5 h-3.5" /> Itens</div>
          <p className="text-lg font-bold">{data!.itens.length}</p>
          {itensAlertaSaldo.length > 0 && <Badge className="text-xs bg-warning/10 text-warning mt-1">{itensAlertaSaldo.length} em alerta</Badge>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><ShoppingCart className="w-3.5 h-3.5" /> Pedidos</div>
          <p className="text-lg font-bold">{pedidosAtivos.length}</p>
        </Card>
      </div>

      {/* Cards financeiros - apenas admin/financeiro */}
      {podeVerCustos && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-l-4 border-l-accent">
            <div className="text-xs text-muted-foreground mb-1">Faturamento</div>
            <p className="text-lg font-bold">{fmt(faturamento)}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-destructive">
            <div className="text-xs text-muted-foreground mb-1">Custos Totais</div>
            <p className="text-lg font-bold text-destructive">{fmt(totalCustos)}</p>
            {custoPedidos > 0 && (
              <p className="text-xs text-muted-foreground">Custos pedidos: {fmt(custoPedidos)}</p>
            )}
          </Card>
          <Card className={`p-4 border-l-4 ${lucroBruto >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
            <div className="text-xs text-muted-foreground mb-1">Lucro Bruto</div>
            <p className={`text-lg font-bold ${lucroBruto >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroBruto)}</p>
            <p className="text-xs text-muted-foreground">Margem: {margemBruta.toFixed(1)}%</p>
          </Card>
          <Card className={`p-4 border-l-4 ${lucroLiquido >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
            <div className="text-xs text-muted-foreground mb-1">Lucro Líquido</div>
            <p className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(lucroLiquido)}</p>
            <p className="text-xs text-muted-foreground">Margem: {margemLiquida.toFixed(1)}%</p>
          </Card>
        </div>
      )}

      <DeOndeVem
        itens={[
          { numero: 'Valor global', origem: 'valor original do contrato mais os aditivos de acréscimo', ondeEditar: 'Arquivos e Aditivos' },
          { numero: 'Saldo', origem: 'valor global menos o que os pedidos já consumiram' },
          { numero: 'Faturado', origem: 'soma dos pedidos lançados', ondeEditar: 'Pedidos' },
          { numero: 'Itens', origem: 'linhas cadastradas', ondeEditar: 'Itens/Lotes' },
        ]}
      />
      </SecaoDoDocumento>

      {/* Composição de custos - apenas admin/financeiro */}
      {podeVerCustos && totalCustos > 0 && (
        <SecaoDoDocumento numero="3" titulo="Composição de custos">
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-muted-foreground" /> Composição de Custos</h4>
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
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </Card>
        </SecaoDoDocumento>
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

      <SecaoDoDocumento numero="4" titulo="Evolução mensal">
      <EvolucaoMensalDashboard
        pedidos={data!.pedidos as any[]}
        podeVerCustos={podeVerCustos}
        valorGlobal={valorGlobalEfetivo}
        dataInicio={c.data_inicio}
        dataFim={c.data_fim}
      />
      </SecaoDoDocumento>

      <SecaoDoDocumento numero="5" titulo="Vigência">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><Calendar className="w-4 h-4 text-muted-foreground" /> Vigência</h4>
          {!editandoVigencia && (
            <Button variant="ghost" size="icon" className="h-5 w-5"
              onClick={() => {
                setVigForm({
                  assinatura: c.data_assinatura?.slice(0, 10) || '',
                  inicio: c.data_inicio?.slice(0, 10) || '',
                  fim: c.data_fim?.slice(0, 10) || '',
                });
                setEditandoVigencia(true);
              }}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>
        {/* O contrato do scan chega sem datas — o documento não as rendeu — e a
            vigência ficava em traços SEM caminho para preencher. Sem data de
            fim, o contrato não entra em aviso de vencimento nenhum. */}
        {!editandoVigencia && !c.data_fim && (
          <p className="text-xs text-warning mb-2">
            O documento não trouxe as datas. Informe-as no lápis — sem data de fim,
            este contrato fica fora dos avisos de vencimento.
          </p>
        )}
        {editandoVigencia && (
          <div className="flex flex-wrap items-end gap-2 mb-3">
            {([['Assinatura', 'assinatura'], ['Início', 'inicio'], ['Fim', 'fim']] as const).map(([rot, chave]) => (
              <div key={chave}>
                <span className="text-xs text-muted-foreground block mb-0.5">{rot}</span>
                <input type="date" className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={vigForm[chave]}
                  onChange={e => setVigForm(f => ({ ...f, [chave]: e.target.value }))} />
              </div>
            ))}
            <Button size="sm" className="h-8 text-xs" disabled={salvandoVigencia} onClick={async () => {
              setSalvandoVigencia(true);
              const { error } = await supabase.from('contratos').update({
                data_assinatura: vigForm.assinatura || null,
                data_inicio: vigForm.inicio || null,
                data_fim: vigForm.fim || null,
              } as any).eq('id', contratoId);
              setSalvandoVigencia(false);
              if (error) { toast.error('Erro ao salvar vigência', { description: error.message }); return; }
              toast.success('Vigência atualizada.');
              setEditandoVigencia(false);
              // Mesmo padrão do lápis do valor: relê o contrato e atualiza o estado.
              const res = await supabase.from('contratos').select('*').eq('id', contratoId).single();
              if (res.data) setData(prev => prev ? { ...prev, contrato: res.data } : prev);
            }}>
              {salvandoVigencia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditandoVigencia(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground">Assinatura:</span><p className="font-medium">{c.data_assinatura ? new Date(c.data_assinatura).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div><span className="text-muted-foreground">Início:</span><p className="font-medium">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div><span className="text-muted-foreground">Fim:</span><p className={`font-medium ${vigencia.vencido ? 'text-destructive' : vigencia.vencendo ? 'text-warning' : ''}`}>{c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}</p></div>
          <div>
            <span className="text-muted-foreground">{vigencia.vencido ? 'Situação:' : 'Dias restantes:'}</span>
            <p className={`font-medium ${vigencia.vencido ? 'text-destructive font-bold' : vigencia.vencendo ? 'text-warning font-bold' : ''}`}>
              {vigencia.frase ?? '—'}
            </p>
          </div>
        </div>
      </Card>
      </SecaoDoDocumento>

      {/* Só no papel. Assinar na tela seria promessa falsa — não há assinatura
          eletrônica aqui. O fiscal do órgão já está cadastrado no contrato,
          então o nome dele vem escrito; a caneta é que não. */}
      <FolhaDeAssinaturas
        local={c.municipio ?? undefined}
        signatarios={[
          { papel: 'Responsável pela emissão' },
          { papel: 'Gestor do contrato' },
          ...(c.fiscal_nome
            ? [{ papel: 'Fiscal do contrato (órgão)', nome: c.fiscal_nome }]
            : []),
        ]}
      />
    </div>
  );
}
