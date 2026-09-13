import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  CheckCircle2, AlertTriangle, Edit3, DollarSign, Package,
  Shield, BarChart3, Loader2,
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

type VarianteStatus = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// Status em família semântica do Badge, sempre com texto.
const STATUS_CONFIG: Record<string, { label: string; variant: VarianteStatus; icon: React.ElementType }> = {
  pendente_precificacao: { label: 'Pendente', variant: 'muted', icon: Package },
  aprovado_automaticamente: { label: 'Aprovado (auto)', variant: 'success', icon: CheckCircle2 },
  aguardando_aprovacao_preco: { label: 'Revisar', variant: 'warning', icon: AlertTriangle },
  aprovado_manualmente: { label: 'Aprovado (manual)', variant: 'success', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', variant: 'danger', icon: AlertTriangle },
  proposta_enviada: { label: 'Enviado', variant: 'info', icon: Shield },
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
      <div className="space-y-2" role="status" aria-label="Carregando itens">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" aria-hidden="true" />
            Precificação — {itens.length} itens
          </h3>
          <p className="text-sm text-muted-foreground">
            {itensAprovados}/{itens.length} aprovados • Total: <strong className="text-foreground tabular-nums">{formatCurrency(totalProposta)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {itens.length === 0 && (
            <Button onClick={dispararPrecificacao} disabled={precificando}>
              {precificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              Extrair e Precificar
            </Button>
          )}
          {itens.length > 0 && (
            <Button onClick={aprovarTodos} variant="default">
              <CheckCircle2 className="h-4 w-4" />
              Aprovar Todos
            </Button>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div aria-hidden="true" className="w-12 h-12 mx-auto rounded-full bg-primary-tint text-primary flex items-center justify-center mb-4">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-foreground">Nenhum item extraído ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Extrair e Precificar" para iniciar o motor autônomo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Ref.</TableHead>
                <TableHead className="text-right">Proposta</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-center">Fontes</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendente_precificacao;
                const StatusIcon = statusCfg.icon;

                return (
                  <TableRow key={item.id}>
                    {/* Número + Descrição */}
                    <TableCell className="min-w-[16rem]">
                      <div className="flex items-center gap-2">
                        <Badge variant="muted" className="shrink-0">#{item.numero}</Badge>
                        <span className="text-foreground font-medium">{item.descricao}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.quantidade?.toLocaleString('pt-BR')} {item.unidade}
                        {item.marca_selecionada && ` • ${item.marca_selecionada} ${item.modelo_selecionado || ''}`}
                      </p>
                      {/* Motivo */}
                      {item.motivo_status && item.status === 'aguardando_aprovacao_preco' && (
                        <p className="text-xs text-warning-ink mt-1 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                          {item.motivo_status}
                        </p>
                      )}
                    </TableCell>

                    {/* Ref. Mercado */}
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(item.preco_referencia)}</TableCell>

                    {/* Proposta (editável) */}
                    <TableCell className="text-right whitespace-nowrap">
                      {editando === item.id ? (
                        <>
                          <label htmlFor={`preco-${item.id}`} className="sr-only">Preço da proposta</label>
                          <Input
                            id={`preco-${item.id}`}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarPrecoEditado(item.id);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                            onBlur={() => salvarPrecoEditado(item.id)}
                            className="h-9 w-32 text-right tabular-nums ml-auto"
                            autoFocus
                          />
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditando(item.id);
                            setEditValue(item.preco_proposta?.toString() ?? '');
                          }}
                          className="font-medium tabular-nums gap-1 px-2"
                          aria-label={`Editar preço da proposta do item ${item.numero}`}
                        >
                          {formatCurrency(item.preco_proposta)}
                          <Edit3 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        </Button>
                      )}
                    </TableCell>

                    {/* Lance Mínimo */}
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(item.preco_lance_minimo)}</TableCell>

                    {/* Margem */}
                    <TableCell className={`text-right tabular-nums font-medium whitespace-nowrap ${
                      (item.margem_bruta_perc ?? 0) >= 15 ? 'text-success' :
                      (item.margem_bruta_perc ?? 0) >= 8 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {item.margem_bruta_perc?.toFixed(1) ?? '0'}%
                    </TableCell>

                    {/* Fontes + Confiança */}
                    <TableCell className="text-center whitespace-nowrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-foreground cursor-help tabular-nums">
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
                    </TableCell>

                    {/* Status + Ação */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={statusCfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" aria-hidden="true" />
                          {statusCfg.label}
                        </Badge>

                        {item.status === 'aguardando_aprovacao_preco' && (
                          <Button size="sm" variant="default" onClick={() => aprovarItem(item.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Aprovar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
