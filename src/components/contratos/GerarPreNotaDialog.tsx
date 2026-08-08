import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Loader2, FileText, CheckCircle2, Package, MapPin, Truck, Send
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const NATUREZAS = [
  'Venda de mercadoria',
  'Venda de produção',
  'Prestação de serviço',
  'Remessa para conserto',
  'Transferência de mercadoria',
  'Outra saída',
];

type Pedido = {
  id: string; numero_pedido: string; descricao: string | null;
  contrato_item_id: string | null; quantidade: number; valor_unitario: number;
  valor_total: number; status: string;
};

type ContratoItem = { id: string; descricao: string; unidade: string; valor_unitario: number };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contratoId: string;
  pedidos: Pedido[];
  itens: ContratoItem[];
  onCreated: () => void;
}

export default function GerarPreNotaDialog({ open, onOpenChange, contratoId, pedidos, itens, onCreated }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [saving, setSaving] = useState(false);

  // Selected pedidos for partial invoicing
  const [selectedPedidos, setSelectedPedidos] = useState<Record<string, { selected: boolean; quantidade: string }>>({});

  // Form
  const [natureza, setNatureza] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [freteModalidade, setFreteModalidade] = useState('9');
  const [freteValor, setFreteValor] = useState('0');
  const [transportadora, setTransportadora] = useState('');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');

  // Only show pedidos that are pendente or entregue (not cancelado)
  const eligiblePedidos = pedidos.filter(p => p.status !== 'cancelado');

  useEffect(() => {
    if (open) {
      const initial: Record<string, { selected: boolean; quantidade: string }> = {};
      eligiblePedidos.forEach(p => {
        initial[p.id] = { selected: false, quantidade: String(p.quantidade) };
      });
      setSelectedPedidos(initial);
      setNatureza('');
      setObservacoes('');
      setJustificativa('');
      setFreteModalidade('9');
      setFreteValor('0');
      setTransportadora('');
      setEnderecoEntrega('');
    }
  }, [open]);

  const togglePedido = (id: string) => {
    setSelectedPedidos(prev => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id]?.selected }
    }));
  };

  const updateQtd = (id: string, qtd: string) => {
    setSelectedPedidos(prev => ({
      ...prev,
      [id]: { ...prev[id], quantidade: qtd }
    }));
  };

  const selected = Object.entries(selectedPedidos).filter(([, v]) => v.selected);
  const totalValue = selected.reduce((sum, [id, v]) => {
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) return sum;
    const qty = parseFloat(v.quantidade) || 0;
    return sum + qty * pedido.valor_unitario;
  }, 0);

  const handleSubmit = async () => {
    if (!natureza) { toast.error('Selecione a Natureza da Operação'); return; }
    if (selected.length === 0) { toast.error('Selecione pelo menos um pedido'); return; }
    if (!user || !empresaAtiva) return;

    setSaving(true);

    // Create pre-nota
    const { data: preNota, error } = await supabase.from('pre_notas_fiscais' as any).insert({
      user_id: user.id,
      empresa_id: empresaAtiva.id,
      contrato_id: contratoId,
      status: 'pendente',
      natureza_operacao: natureza,
      observacoes: observacoes || null,
      justificativa: justificativa || null,
      frete_modalidade: freteModalidade,
      frete_valor: parseFloat(freteValor) || 0,
      transportadora: transportadora || null,
      endereco_entrega: enderecoEntrega || null,
      valor_total: totalValue + (parseFloat(freteValor) || 0),
    } as any).select('id').single();

    if (error || !preNota) {
      toast.error('Erro ao criar Pré-NF');
      setSaving(false);
      return;
    }

    // Insert items
    const itensInsert = selected.map(([pedidoId, v]) => {
      const pedido = pedidos.find(p => p.id === pedidoId)!;
      const item = itens.find(i => i.id === pedido.contrato_item_id);
      const qty = parseFloat(v.quantidade) || 0;
      return {
        pre_nota_id: (preNota as any).id,
        contrato_pedido_id: pedidoId,
        contrato_item_id: pedido.contrato_item_id || null,
        descricao: pedido.descricao || item?.descricao || `Pedido ${pedido.numero_pedido}`,
        unidade: item?.unidade || 'UN',
        quantidade: qty,
        valor_unitario: pedido.valor_unitario,
        valor_total: qty * pedido.valor_unitario,
      };
    });

    await supabase.from('pre_nota_itens' as any).insert(itensInsert as any);

    setSaving(false);
    toast.success('Pré-Nota Fiscal enviada ao Financeiro para aprovação!');
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            Gerar Pré-Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Fluxo de aprovação</p>
          <p>A Pré-NF será enviada ao setor <strong>Financeiro</strong> para revisão. O financeiro pode aprovar, rejeitar ou devolver para correção antes de emitir a NF-e/NFS-e oficial.</p>
        </div>

        {/* 1. Selecionar Pedidos (faturamento parcial) */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            Selecionar Pedidos para Faturar
            <Badge variant="outline" className="text-xs">{selected.length} selecionados</Badge>
          </h4>

          {eligiblePedidos.length === 0 ? (
            <Card className="p-4 text-center text-xs text-muted-foreground">Nenhum pedido elegível para faturamento</Card>
          ) : (
            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {eligiblePedidos.map(p => {
                const sel = selectedPedidos[p.id];
                const item = itens.find(i => i.id === p.contrato_item_id);
                return (
                  <Card key={p.id} className={`p-3 transition-colors ${sel?.selected ? 'border-primary/40 bg-primary/5' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={sel?.selected || false}
                        onCheckedChange={() => togglePedido(p.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-medium">{p.numero_pedido}</span>
                          <span className="text-xs font-medium">{fmt(p.valor_total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.descricao || item?.descricao || '—'}</p>
                        {sel?.selected && (
                          <div className="mt-2 flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Qtd a faturar:</Label>
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              max={p.quantidade}
                              value={sel.quantidade}
                              onChange={e => updateQtd(p.id, e.target.value)}
                              className="h-7 w-24 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">de {p.quantidade} {item?.unidade || 'UN'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {selected.length > 0 && (
            <Card className="p-2 bg-muted/50 border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">{selected.length} pedidos selecionados</span>
                <span className="font-bold text-foreground">{fmt(totalValue)}</span>
              </div>
            </Card>
          )}
        </div>

        <Separator />

        {/* 2. Natureza da Operação */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            Dados da Operação
          </h4>
          <div>
            <Label className="text-xs">Natureza da Operação <span className="text-destructive">*</span></Label>
            <Select value={natureza} onValueChange={setNatureza}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {NATUREZAS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Observações / Instruções ao Financeiro</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Informações relevantes para emissão da NF (prazo, condição especial...)" />
          </div>
          <div>
            <Label className="text-xs">Justificativa</Label>
            <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2} placeholder="Motivo/justificativa da solicitação" />
          </div>
        </div>

        <Separator />

        {/* 3. Transporte/Entrega */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-muted-foreground" />
            Dados de Entrega / Transporte
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Modalidade de Frete</Label>
              <Select value={freteModalidade} onValueChange={setFreteModalidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Emitente</SelectItem>
                  <SelectItem value="1">Destinatário</SelectItem>
                  <SelectItem value="2">Terceiros</SelectItem>
                  <SelectItem value="9">Sem frete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor do Frete (R$)</Label>
              <MoneyInput value={parseFloat(freteValor) || 0} onValueChange={v => setFreteValor(String(v))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Transportadora</Label>
              <Input value={transportadora} onChange={e => setTransportadora(e.target.value)} placeholder="Nome da transportadora" />
            </div>
            <div>
              <Label className="text-xs">Endereço de Entrega</Label>
              <Input value={enderecoEntrega} onChange={e => setEnderecoEntrega(e.target.value)} placeholder="Endereço completo" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Resumo */}
        <Card className="p-3 bg-muted/30">
          <div className="flex justify-between items-center text-xs mb-1">
            <span>Subtotal dos itens:</span>
            <span className="font-medium">{fmt(totalValue)}</span>
          </div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span>Frete:</span>
            <span>{fmt(parseFloat(freteValor) || 0)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Total Pré-NF:</span>
            <span className="text-lg font-bold text-foreground">{fmt(totalValue + (parseFloat(freteValor) || 0))}</span>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || selected.length === 0 || !natureza}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar ao Financeiro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
