import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, DollarSign, AlertTriangle,
  CheckCircle2, Clock, Search, CreditCard, Repeat, SplitSquareVertical
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type ContaPagar = {
  id: string; descricao: string; fornecedor: string | null; valor: number;
  valor_pago: number; data_vencimento: string; data_pagamento: string | null;
  status: string; categoria: string | null; nota_fiscal: string | null;
  observacoes: string | null; contrato_id: string | null;
  parcela_numero: number | null; parcela_total: number | null; parcela_grupo_id: string | null;
  juros_percentual: number; multa_percentual: number; valor_juros: number;
  valor_multa: number; valor_desconto: number;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  pago: { label: 'Pago', color: 'bg-success/10 text-success' },
  parcial: { label: 'Parcial', color: 'bg-accent/10 text-accent' },
  atrasado: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
};

const categorias = [
  'Fornecedor', 'Tributos', 'Folha de Pagamento', 'Aluguel',
  'Frete/Logística', 'Serviços', 'Material', 'Equipamentos', 'Outros',
];

export default function ContasPagar() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [baixaDialogOpen, setBaixaDialogOpen] = useState(false);
  const [baixaConta, setBaixaConta] = useState<ContaPagar | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');

  const [form, setForm] = useState({
    descricao: '', fornecedor: '', valor: '', data_vencimento: '',
    categoria: '', nota_fiscal: '', observacoes: '',
    parcelar: false, num_parcelas: '2', intervalo_dias: '30',
    juros_percentual: '0', multa_percentual: '0',
  });

  const [baixaForm, setBaixaForm] = useState({
    valor_pago: '', data_pagamento: '', desconto: '0',
  });

  useEffect(() => { if (user && empresaAtiva) load(); }, [user, empresaAtiva]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('contas_pagar')
      .select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
      .order('data_vencimento', { ascending: true });
    const today = new Date().toISOString().split('T')[0];
    const list = ((data as any[]) || []).map(c => ({
      ...c,
      status: c.status === 'pendente' && c.data_vencimento < today ? 'atrasado' : c.status,
    }));
    setContas(list);
    setLoading(false);
  };

  const calcEncargos = (conta: ContaPagar) => {
    if (conta.status === 'pago' || conta.status === 'cancelado') return { juros: 0, multa: 0, total: conta.valor };
    const hoje = new Date();
    const venc = new Date(conta.data_vencimento + 'T00:00:00');
    if (hoje <= venc) return { juros: 0, multa: 0, total: conta.valor };
    const diasAtraso = Math.ceil((hoje.getTime() - venc.getTime()) / 86400000);
    const juros = conta.valor * (conta.juros_percentual / 100) * (diasAtraso / 30);
    const multa = diasAtraso > 0 ? conta.valor * (conta.multa_percentual / 100) : 0;
    return { juros: Math.round(juros * 100) / 100, multa: Math.round(multa * 100) / 100, total: conta.valor + juros + multa };
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor || !form.data_vencimento) {
      toast.error('Preencha descrição, valor e vencimento'); return;
    }
    setSaving(true);
    const valorTotal = parseFloat(form.valor) || 0;

    if (form.parcelar && parseInt(form.num_parcelas) > 1) {
      const numParcelas = parseInt(form.num_parcelas);
      const intervaloDias = parseInt(form.intervalo_dias) || 30;
      const valorParcela = Math.round((valorTotal / numParcelas) * 100) / 100;
      const grupoId = crypto.randomUUID();
      const parcelas = [];

      for (let i = 0; i < numParcelas; i++) {
        const dataVenc = new Date(form.data_vencimento + 'T00:00:00');
        dataVenc.setDate(dataVenc.getDate() + (i * intervaloDias));
        const valorP = i === numParcelas - 1 ? valorTotal - valorParcela * (numParcelas - 1) : valorParcela;
        parcelas.push({
          user_id: user!.id, empresa_id: empresaAtiva!.id,
          descricao: `${form.descricao} (${i + 1}/${numParcelas})`,
          fornecedor: form.fornecedor || null,
          valor: valorP, data_vencimento: dataVenc.toISOString().split('T')[0],
          categoria: form.categoria || null, nota_fiscal: form.nota_fiscal || null,
          observacoes: form.observacoes || null, status: 'pendente',
          parcela_numero: i + 1, parcela_total: numParcelas, parcela_grupo_id: grupoId,
          juros_percentual: parseFloat(form.juros_percentual) || 0,
          multa_percentual: parseFloat(form.multa_percentual) || 0,
        });
      }
      const { error } = await supabase.from('contas_pagar').insert(parcelas as any);
      if (error) { toast.error('Erro ao salvar parcelas'); setSaving(false); return; }
      toast.success(`${numParcelas} parcelas criadas!`);
    } else {
      const { error } = await supabase.from('contas_pagar').insert({
        user_id: user!.id, empresa_id: empresaAtiva!.id,
        descricao: form.descricao, fornecedor: form.fornecedor || null,
        valor: valorTotal, data_vencimento: form.data_vencimento,
        categoria: form.categoria || null, nota_fiscal: form.nota_fiscal || null,
        observacoes: form.observacoes || null, status: 'pendente',
        juros_percentual: parseFloat(form.juros_percentual) || 0,
        multa_percentual: parseFloat(form.multa_percentual) || 0,
      } as any);
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
      toast.success('Conta a pagar registrada!');
    }

    setSaving(false);
    setDialogOpen(false);
    setForm({ descricao: '', fornecedor: '', valor: '', data_vencimento: '', categoria: '', nota_fiscal: '', observacoes: '', parcelar: false, num_parcelas: '2', intervalo_dias: '30', juros_percentual: '0', multa_percentual: '0' });
    load();
  };

  const openBaixa = (conta: ContaPagar) => {
    const enc = calcEncargos(conta);
    const saldo = enc.total - (conta.valor_pago || 0);
    setBaixaConta(conta);
    setBaixaForm({
      valor_pago: saldo.toFixed(2),
      data_pagamento: new Date().toISOString().split('T')[0],
      desconto: '0',
    });
    setBaixaDialogOpen(true);
  };

  const handleBaixa = async () => {
    if (!baixaConta) return;
    const valorPago = parseFloat(baixaForm.valor_pago) || 0;
    const desconto = parseFloat(baixaForm.desconto) || 0;
    const totalJaPago = (baixaConta.valor_pago || 0) + valorPago;
    const enc = calcEncargos(baixaConta);
    const saldoRestante = enc.total - totalJaPago - desconto;
    const novoStatus = saldoRestante <= 0.01 ? 'pago' : 'parcial';

    const { error } = await supabase.from('contas_pagar').update({
      status: novoStatus,
      data_pagamento: baixaForm.data_pagamento,
      valor_pago: totalJaPago,
      valor_desconto: (baixaConta.valor_desconto || 0) + desconto,
      valor_juros: enc.juros,
      valor_multa: enc.multa,
    } as any).eq('id', baixaConta.id);

    if (error) { toast.error('Erro ao registrar baixa'); return; }
    toast.success(novoStatus === 'pago' ? 'Conta quitada!' : 'Baixa parcial registrada!');
    setBaixaDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contas_pagar').delete().eq('id', id);
    toast.success('Excluído');
    load();
  };

  const filtered = contas.filter(c => {
    const matchSearch = !search || c.descricao.toLowerCase().includes(search.toLowerCase()) || c.fornecedor?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || c.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const totalPendente = contas.filter(c => ['pendente', 'parcial'].includes(c.status)).reduce((s, c) => s + c.valor - (c.valor_pago || 0), 0);
  const totalAtrasado = contas.filter(c => c.status === 'atrasado').reduce((s, c) => s + c.valor, 0);
  const totalPago = contas.filter(c => c.status === 'pago').reduce((s, c) => s + (c.valor_pago || 0), 0);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pendente</div><p className="text-lg font-bold text-warning">{fmt(totalPendente)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Atrasado</div><p className="text-lg font-bold text-destructive">{fmt(totalAtrasado)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pago</div><p className="text-lg font-bold text-success">{fmt(totalPago)}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Conta a Pagar</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label className="text-xs">Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fornecedor</Label><Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
                <div><Label className="text-xs">Valor Total (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} /></div>
                <div><Label className="text-xs">Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Juros e multa */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Juros ao mês (%)</Label><Input type="number" step="0.01" value={form.juros_percentual} onChange={e => setForm(f => ({ ...f, juros_percentual: e.target.value }))} /></div>
                <div><Label className="text-xs">Multa por atraso (%)</Label><Input type="number" step="0.01" value={form.multa_percentual} onChange={e => setForm(f => ({ ...f, multa_percentual: e.target.value }))} /></div>
              </div>

              {/* Parcelamento */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                <Switch checked={form.parcelar} onCheckedChange={v => setForm(f => ({ ...f, parcelar: v }))} />
                <div className="flex-1">
                  <Label className="text-xs font-medium flex items-center gap-1"><SplitSquareVertical className="w-3.5 h-3.5" /> Parcelar</Label>
                  {form.parcelar && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div><Label className="text-[10px]">Nº Parcelas</Label><Input type="number" min="2" max="48" value={form.num_parcelas} onChange={e => setForm(f => ({ ...f, num_parcelas: e.target.value }))} className="h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">Intervalo (dias)</Label><Input type="number" min="7" max="90" value={form.intervalo_dias} onChange={e => setForm(f => ({ ...f, intervalo_dias: e.target.value }))} className="h-8 text-xs" /></div>
                    </div>
                  )}
                </div>
              </div>

              <div><Label className="text-xs">Nota Fiscal</Label><Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} /></div>
              <div><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhuma conta a pagar</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-right">Pago</TableHead>
                <TableHead className="text-xs text-center">Vencimento</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const cfg = statusCfg[c.status] || statusCfg.pendente;
                const enc = calcEncargos(c);
                const temEncargos = enc.juros > 0 || enc.multa > 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                      {c.parcela_numero && <span className="text-[9px] text-muted-foreground ml-1">{c.parcela_numero}/{c.parcela_total}</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-xs">{c.fornecedor || '—'}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span className="font-medium">{fmt(c.valor)}</span>
                      {temEncargos && <span className="block text-[9px] text-destructive">+{fmt(enc.juros + enc.multa)} encargos</span>}
                    </TableCell>
                    <TableCell className="text-xs text-right">{c.valor_pago ? fmt(c.valor_pago) : '—'}</TableCell>
                    <TableCell className="text-xs text-center">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-xs">{c.categoria || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!['pago', 'cancelado'].includes(c.status) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openBaixa(c)} title="Baixa (total ou parcial)">
                            <CreditCard className="w-3.5 h-3.5 text-success" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Baixa Dialog */}
      <Dialog open={baixaDialogOpen} onOpenChange={setBaixaDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Registrar Baixa</DialogTitle></DialogHeader>
          {baixaConta && (
            <div className="space-y-3 mt-2">
              <Card className="p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">Conta: <span className="font-medium text-foreground">{baixaConta.descricao}</span></p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div><span className="text-muted-foreground">Original:</span><br/><span className="font-bold">{fmt(baixaConta.valor)}</span></div>
                  <div><span className="text-muted-foreground">Já pago:</span><br/><span className="font-bold text-success">{fmt(baixaConta.valor_pago || 0)}</span></div>
                  {(() => { const e = calcEncargos(baixaConta); return e.juros + e.multa > 0 ? (
                    <div><span className="text-muted-foreground">Encargos:</span><br/><span className="font-bold text-destructive">{fmt(e.juros + e.multa)}</span></div>
                  ) : null; })()}
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Valor Pago (R$)</Label><Input type="number" step="0.01" value={baixaForm.valor_pago} onChange={e => setBaixaForm(f => ({ ...f, valor_pago: e.target.value }))} /></div>
                <div><Label className="text-xs">Data Pagamento</Label><Input type="date" value={baixaForm.data_pagamento} onChange={e => setBaixaForm(f => ({ ...f, data_pagamento: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Desconto (R$)</Label><Input type="number" step="0.01" value={baixaForm.desconto} onChange={e => setBaixaForm(f => ({ ...f, desconto: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setBaixaDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleBaixa}>Confirmar Baixa</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
