import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoneyInput } from '@/components/ui/money-input';
import {
  DollarSign, Plus, Settings, Receipt, CheckCircle2, Clock, XCircle, Loader2, Eye, EyeOff
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-500/15 text-blue-600' },
  pago: { label: 'Pago', color: 'bg-success/10 text-success' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
  rejeitado: { label: 'Rejeitado', color: 'bg-destructive/10 text-destructive' },
};

const TIPO_COMISSAO: Record<string, string> = {
  percentual_contrato: '% sobre Contrato',
  percentual_lucro: '% sobre Lucro',
  valor_fixo: 'Valor Fixo',
  nota_fiscal: 'Por Nota Fiscal',
};

type Lancamento = {
  id: string; user_id: string; tipo: string; valor_base: number;
  desconto_percentual: number; percentual_comissao: number; valor_comissao: number;
  nota_fiscal: string | null; status: string; observacoes: string | null;
  created_at: string; contrato_pedido_id: string | null; contrato_id: string | null;
  solicitado_por: string | null;
};

type Membro = { user_id: string; nome: string | null; email: string | null };
type Config = {
  id: string; user_id: string; tipo_comissao: string; percentual: number;
  valor_fixo: number; visibilidade_publica: boolean; ativo: boolean;
};

type Pedido = {
  id: string; numero_pedido: string; valor_total: number; descricao: string | null;
};

export default function ContratoComissoes({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin, isFinanceiro } = useMembroPermissoes();
  const podeGerenciar = isAdmin || isFinanceiro;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // Config dialog
  const [cfgDialogOpen, setCfgDialogOpen] = useState(false);
  const [cfgUserId, setCfgUserId] = useState('');
  const [cfgTipo, setCfgTipo] = useState('percentual_contrato');
  const [cfgPercentual, setCfgPercentual] = useState('');
  const [cfgValorFixo, setCfgValorFixo] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  // Solicitar comissão dialog
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [solPedidoId, setSolPedidoId] = useState('');
  const [solValorBase, setSolValorBase] = useState('');
  const [solNF, setSolNF] = useState('');
  const [solObs, setSolObs] = useState('');
  const [savingSol, setSavingSol] = useState(false);

  const empresaId = empresaAtiva?.id;

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);

    const lancFilter = podeGerenciar
      ? supabase.from('comissoes_lancamentos' as any).select('*').eq('contrato_id', contratoId).order('created_at', { ascending: false })
      : supabase.from('comissoes_lancamentos' as any).select('*').eq('contrato_id', contratoId).eq('user_id', user!.id).order('created_at', { ascending: false });

    const [lancRes, membrosRes, cfgRes, pedidosRes] = await Promise.all([
      lancFilter,
      supabase.from('empresa_membros').select('user_id, nome, email').eq('empresa_id', empresaId),
      supabase.from('comissoes_config' as any).select('*').eq('empresa_id', empresaId),
      supabase.from('contrato_pedidos').select('id, numero_pedido, valor_total, descricao').eq('contrato_id', contratoId).eq('status', 'entregue').order('numero_pedido', { ascending: false }),
    ]);

    setLancamentos((lancRes.data as any[]) || []);
    setMembros((membrosRes.data as any[]) || []);
    setConfigs((cfgRes.data as any[]) || []);
    setPedidos((pedidosRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId, empresaId]);

  const getMembroNome = (userId: string) => {
    const m = membros.find(m => m.user_id === userId);
    return m?.nome || m?.email || 'Usuário';
  };

  // Admin configura comissão do vendedor
  const handleSaveCfg = async () => {
    if (!cfgUserId || !empresaId) return;
    setSavingCfg(true);
    const payload: any = {
      empresa_id: empresaId,
      user_id: cfgUserId,
      tipo_comissao: cfgTipo,
      percentual: parseFloat(cfgPercentual) || 0,
      valor_fixo: parseFloat(cfgValorFixo) || 0,
    };
    const existing = configs.find(c => c.user_id === cfgUserId);
    const { error } = existing
      ? await supabase.from('comissoes_config' as any).update(payload).eq('id', existing.id)
      : await supabase.from('comissoes_config' as any).insert(payload);

    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Comissão configurada!'); setCfgDialogOpen(false); load(); }
    setSavingCfg(false);
  };

  // Vendedor solicita comissão
  const handleSolicitar = async () => {
    if (!user || !empresaId) return;
    const valorBase = parseFloat(solValorBase) || 0;
    if (valorBase <= 0) { toast.error('Informe o valor base'); return; }

    const minhaCfg = configs.find(c => c.user_id === user.id);
    const percentual = minhaCfg?.percentual || 0;
    const valorComissao = minhaCfg?.tipo_comissao === 'valor_fixo'
      ? (minhaCfg?.valor_fixo || 0)
      : valorBase * (percentual / 100);

    setSavingSol(true);
    const { error } = await supabase.from('comissoes_lancamentos' as any).insert({
      empresa_id: empresaId,
      user_id: user.id,
      solicitado_por: user.id,
      contrato_id: contratoId,
      contrato_pedido_id: solPedidoId || null,
      tipo: minhaCfg?.tipo_comissao || 'nota_fiscal',
      valor_base: valorBase,
      desconto_percentual: 0,
      percentual_comissao: percentual,
      valor_comissao: valorComissao,
      nota_fiscal: solNF || null,
      status: 'pendente',
      observacoes: solObs || null,
    } as any);

    if (error) toast.error('Erro ao solicitar: ' + error.message);
    else {
      toast.success('Pedido de comissão enviado para aprovação!');
      setSolicitarOpen(false);
      setSolPedidoId(''); setSolValorBase(''); setSolNF(''); setSolObs('');
      load();
    }
    setSavingSol(false);
  };

  // Admin aprova/rejeita
  const handleUpdateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'pago') updates.pago_em = new Date().toISOString();
    const { error } = await supabase.from('comissoes_lancamentos' as any).update(updates).eq('id', id);
    if (error) toast.error('Erro ao atualizar');
    else { toast.success('Status atualizado'); load(); }
  };

  const totalPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + (l.valor_comissao || 0), 0);
  const totalAprovado = lancamentos.filter(l => l.status === 'aprovado').reduce((s, l) => s + (l.valor_comissao || 0), 0);
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valor_comissao || 0), 0);

  const minhaCfg = configs.find(c => c.user_id === user?.id);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-accent" /> Comissões do Contrato
          </h3>
          <p className="text-xs text-muted-foreground">
            {podeGerenciar ? 'Gerencie comissões de todos os vendedores' : 'Visualize e solicite suas comissões'}
          </p>
        </div>
        <div className="flex gap-2">
          {podeGerenciar && (
            <Button size="sm" variant="outline" onClick={() => {
              setCfgUserId(''); setCfgTipo('percentual_contrato'); setCfgPercentual(''); setCfgValorFixo('');
              setCfgDialogOpen(true);
            }}>
              <Settings className="w-4 h-4 mr-1" /> Configurar %
            </Button>
          )}
          <Button size="sm" onClick={() => {
            setSolPedidoId(''); setSolValorBase(''); setSolNF(''); setSolObs('');
            setSolicitarOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-1" /> Solicitar Comissão
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-base font-bold text-warning">{fmt(totalPendente)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Aprovado</p>
          <p className="text-base font-bold text-blue-600">{fmt(totalAprovado)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-base font-bold text-success">{fmt(totalPago)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Minha Comissão</p>
          <p className="text-base font-bold">{minhaCfg ? (minhaCfg.tipo_comissao === 'valor_fixo' ? fmt(minhaCfg.valor_fixo) : `${minhaCfg.percentual}%`) : '—'}</p>
        </Card>
      </div>

      {/* Table */}
      {lancamentos.length === 0 ? (
        <Card className="p-8 text-center">
          <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada neste contrato.</p>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {podeGerenciar && <TableHead className="whitespace-nowrap">Vendedor</TableHead>}
                <TableHead className="whitespace-nowrap">NF</TableHead>
                <TableHead className="whitespace-nowrap">Valor Base</TableHead>
                <TableHead className="whitespace-nowrap">%</TableHead>
                <TableHead className="whitespace-nowrap">Comissão</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Data</TableHead>
                {podeGerenciar && <TableHead className="whitespace-nowrap">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map(l => {
                const st = STATUS_CFG[l.status] || STATUS_CFG.pendente;
                return (
                  <TableRow key={l.id}>
                    {podeGerenciar && <TableCell className="whitespace-nowrap text-sm">{getMembroNome(l.user_id)}</TableCell>}
                    <TableCell className="whitespace-nowrap text-sm">{l.nota_fiscal || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmt(l.valor_base)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{l.percentual_comissao}%</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-semibold">{fmt(l.valor_comissao)}</TableCell>
                    <TableCell><Badge className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    {podeGerenciar && (
                      <TableCell>
                        {l.status === 'pendente' && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateStatus(l.id, 'aprovado')} title="Aprovar">
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateStatus(l.id, 'rejeitado')} title="Rejeitar">
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                        {l.status === 'aprovado' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateStatus(l.id, 'pago')}>
                            Marcar Pago
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Config Dialog (Admin) */}
      <Dialog open={cfgDialogOpen} onOpenChange={setCfgDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configurar Comissão do Vendedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vendedor *</Label>
              <Select value={cfgUserId} onValueChange={v => {
                setCfgUserId(v);
                const existing = configs.find(c => c.user_id === v);
                if (existing) {
                  setCfgTipo(existing.tipo_comissao);
                  setCfgPercentual(String(existing.percentual));
                  setCfgValorFixo(String(existing.valor_fixo));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {membros.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Comissão</Label>
              <Select value={cfgTipo} onValueChange={setCfgTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_COMISSAO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {cfgTipo === 'valor_fixo' ? (
              <div><Label>Valor Fixo (R$)</Label><MoneyInput value={Number(cfgValorFixo) || 0} onValueChange={v => setCfgValorFixo(String(v))} /></div>
            ) : (
              <div><Label>Percentual (%)</Label><Input type="number" step="0.1" value={cfgPercentual} onChange={e => setCfgPercentual(e.target.value)} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCfgDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCfg} disabled={savingCfg || !cfgUserId}>
              {savingCfg && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Solicitar Comissão Dialog */}
      <Dialog open={solicitarOpen} onOpenChange={setSolicitarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Solicitar Pedido de Comissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {minhaCfg && (
              <div className="bg-accent/10 rounded-lg p-3 text-xs">
                <p className="font-medium">Sua comissão: <span className="text-accent">{minhaCfg.tipo_comissao === 'valor_fixo' ? fmt(minhaCfg.valor_fixo) : `${minhaCfg.percentual}%`}</span></p>
                <p className="text-muted-foreground">Tipo: {TIPO_COMISSAO[minhaCfg.tipo_comissao]}</p>
              </div>
            )}
            <div>
              <Label>Pedido de Referência (opcional)</Label>
              <Select value={solPedidoId} onValueChange={v => {
                setSolPedidoId(v);
                const p = pedidos.find(p => p.id === v);
                if (p) setSolValorBase(String(p.valor_total));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um pedido entregue" /></SelectTrigger>
                <SelectContent>
                  {pedidos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_pedido} — {fmt(p.valor_total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Base (R$) *</Label>
              <MoneyInput value={Number(solValorBase) || 0} onValueChange={v => setSolValorBase(String(v))} placeholder="R$ 0,00" />
            </div>
            <div>
              <Label>Nº Nota Fiscal</Label>
              <Input value={solNF} onChange={e => setSolNF(e.target.value)} placeholder="NF-e" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={solObs} onChange={e => setSolObs(e.target.value)} rows={2} placeholder="Justificativa da solicitação..." />
            </div>
            {minhaCfg && solValorBase && (
              <div className="bg-success/10 rounded-lg p-3 text-sm">
                <p className="font-medium">Valor estimado da comissão: <span className="text-success font-bold">
                  {fmt(minhaCfg.tipo_comissao === 'valor_fixo'
                    ? minhaCfg.valor_fixo
                    : (parseFloat(solValorBase) || 0) * (minhaCfg.percentual / 100)
                  )}
                </span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolicitarOpen(false)}>Cancelar</Button>
            <Button onClick={handleSolicitar} disabled={savingSol}>
              {savingSol && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
