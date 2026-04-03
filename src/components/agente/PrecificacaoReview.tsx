import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  CheckCircle2, AlertTriangle, Edit3, DollarSign, Package,
  TrendingUp, Shield, BarChart3, Loader2,
} from 'lucide-react';

interface ItemEdital {
  id: string;
  numero: number;
  lote: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_estimado_unitario: number | null;
  preco_referencia: number | null;
  preco_proposta: number | null;
  preco_lance_inicial: number | null;
  preco_lance_minimo: number | null;
  margem_bruta_perc: number | null;
  marca_selecionada: string | null;
  modelo_selecionado: string | null;
  justificativa_marca: string | null;
  fontes_consultadas: any[] | null;
  confianca_calculo: number | null;
  status: string;
  motivo_status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente_precificacao: { label: 'Pendente', color: 'text-muted-foreground', icon: Package },
  aprovado_automaticamente: { label: 'Auto ✓', color: 'text-emerald-400', icon: CheckCircle2 },
  aguardando_aprovacao_preco: { label: 'Revisar', color: 'text-yellow-400', icon: AlertTriangle },
  aprovado_manualmente: { label: 'Manual ✓', color: 'text-emerald-400', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', color: 'text-destructive', icon: AlertTriangle },
  proposta_enviada: { label: 'Enviado', color: 'text-blue-400', icon: Shield },
};

export default function PrecificacaoReview({ licitacaoId }: { licitacaoId: string }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ItemEdital[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [precificando, setPrecificando] = useState(false);

  const carregarItens = useCallback(async () => {
    const { data } = await supabase
      .from('agent_itens_edital')
      .select('*')
      .eq('licitacao_id', licitacaoId)
      .order('numero');

    setItens((data as unknown as ItemEdital[]) ?? []);
    setLoading(false);
  }, [licitacaoId]);

  useEffect(() => {
    carregarItens();

    const channel = supabase
      .channel(`precificacao-${licitacaoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_itens_edital',
        filter: `licitacao_id=eq.${licitacaoId}`,
      }, () => carregarItens())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [carregarItens, licitacaoId]);

  const aprovarItem = async (itemId: string) => {
    await supabase
      .from('agent_itens_edital')
      .update({
        status: 'aprovado_manualmente',
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
      })
      .eq('id', itemId);

    toast.success('Item aprovado');
    carregarItens();
  };

  const aprovarTodos = async () => {
    const pendentes = itens.filter(i => i.status === 'aguardando_aprovacao_preco' || i.status === 'aprovado_automaticamente');
    for (const item of pendentes) {
      await supabase
        .from('agent_itens_edital')
        .update({
          status: 'aprovado_manualmente',
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', item.id);
    }
    toast.success(`${pendentes.length} itens aprovados`);
    carregarItens();
  };

  const salvarPrecoEditado = async (itemId: string) => {
    const novoPreco = parseFloat(editValue.replace(',', '.'));
    if (isNaN(novoPreco) || novoPreco <= 0) {
      toast.error('Preço inválido');
      return;
    }

    await supabase
      .from('agent_itens_edital')
      .update({
        preco_proposta: novoPreco,
        status: 'aprovado_manualmente',
        motivo_status: 'Preço ajustado manualmente',
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
      })
      .eq('id', itemId);

    setEditando(null);
    toast.success('Preço atualizado');
    carregarItens();
  };

  const dispararPrecificacao = async () => {
    setPrecificando(true);
    try {
      const { data: licit } = await supabase
        .from('agent_licitacoes')
        .select('empresa_id')
        .eq('id', licitacaoId)
        .single();

      if (!licit?.empresa_id) throw new Error('Empresa não encontrada');

      await supabase.functions.invoke('agent-extrator-itens', {
        body: { licitacao_id: licitacaoId, empresa_id: licit.empresa_id },
      });

      toast.success('Extração e precificação iniciadas');
    } catch (e) {
      toast.error('Erro ao iniciar precificação');
      console.error(e);
    } finally {
      setPrecificando(false);
    }
  };

  const totalProposta = itens.reduce((sum, i) =>
    sum + (i.preco_proposta ?? 0) * (i.quantidade ?? 1), 0
  );

  const itensAprovados = itens.filter(i =>
    i.status === 'aprovado_automaticamente' || i.status === 'aprovado_manualmente'
  ).length;

  const formatCurrency = (val: number | null) =>
    val != null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Precificação — {itens.length} itens
          </h3>
          <p className="text-sm text-muted-foreground">
            {itensAprovados}/{itens.length} aprovados • Total: <strong className="text-foreground">{formatCurrency(totalProposta)}</strong>
          </p>
        </div>

        <div className="flex gap-2">
          {itens.length === 0 && (
            <Button onClick={dispararPrecificacao} disabled={precificando} size="sm">
              {precificando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
              Extrair e Precificar
            </Button>
          )}
          {itens.length > 0 && (
            <Button onClick={aprovarTodos} size="sm" variant="default">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprovar Todos
            </Button>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum item extraído ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Extrair e Precificar" para iniciar o motor autônomo.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {itens.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendente_precificacao;
              const StatusIcon = statusCfg.icon;

              return (
                <Card key={item.id} className="bg-card border-border hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-12 gap-3 items-center text-sm">
                      {/* Número + Descrição */}
                      <div className="col-span-4 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            #{item.numero}
                          </Badge>
                          <span className="truncate text-foreground font-medium">{item.descricao}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.quantidade?.toLocaleString('pt-BR')} {item.unidade}
                          {item.marca_selecionada && ` • ${item.marca_selecionada} ${item.modelo_selecionado || ''}`}
                        </p>
                      </div>

                      {/* Ref. Mercado */}
                      <div className="col-span-1 text-center">
                        <p className="text-xs text-muted-foreground">Ref.</p>
                        <p className="text-foreground">{formatCurrency(item.preco_referencia)}</p>
                      </div>

                      {/* Proposta (editável) */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">Proposta</p>
                        {editando === item.id ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarPrecoEditado(item.id);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                            onBlur={() => salvarPrecoEditado(item.id)}
                            className="h-7 text-xs text-center"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditando(item.id);
                              setEditValue(item.preco_proposta?.toString() ?? '');
                            }}
                            className="text-foreground hover:text-primary transition-colors font-medium inline-flex items-center gap-1"
                          >
                            {formatCurrency(item.preco_proposta)}
                            <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
                      </div>

                      {/* Lance Mínimo */}
                      <div className="col-span-1 text-center">
                        <p className="text-xs text-muted-foreground">Mín.</p>
                        <p className="text-foreground">{formatCurrency(item.preco_lance_minimo)}</p>
                      </div>

                      {/* Margem */}
                      <div className="col-span-1 text-center">
                        <p className="text-xs text-muted-foreground">Margem</p>
                        <p className={`font-medium ${
                          (item.margem_bruta_perc ?? 0) >= 15 ? 'text-emerald-400' :
                          (item.margem_bruta_perc ?? 0) >= 8 ? 'text-yellow-400' : 'text-destructive'
                        }`}>
                          {item.margem_bruta_perc?.toFixed(1) ?? '0'}%
                        </p>
                      </div>

                      {/* Fontes + Confiança */}
                      <div className="col-span-1 text-center">
                        <p className="text-xs text-muted-foreground">Fontes</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground cursor-help">
                                {(item.fontes_consultadas as any[])?.length ?? 0}
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({((item.confianca_calculo ?? 0) * 100).toFixed(0)}%)
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                {(item.fontes_consultadas as any[])?.map((f: any, i: number) => (
                                  <div key={i}>{f.nome}: R$ {f.media?.toFixed(2)} ({f.registros} reg.)</div>
                                )) ?? <p>Sem dados</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {/* Status + Ação */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <Badge variant="outline" className={`${statusCfg.color} text-xs`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>

                        {item.status === 'aguardando_aprovacao_preco' && (
                          <Button size="sm" variant="default" className="text-xs h-7" onClick={() => aprovarItem(item.id)}>
                            ✓ Aprovar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Motivo */}
                    {item.motivo_status && item.status === 'aguardando_aprovacao_preco' && (
                      <p className="text-xs text-yellow-400/80 mt-2 pl-8">
                        ⚠ {item.motivo_status}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
