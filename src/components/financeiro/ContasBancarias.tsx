import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Landmark, DollarSign, Edit2, CheckCircle2 } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Conta = {
  id: string; banco_nome: string; banco_codigo: string | null; agencia: string | null;
  conta: string | null; tipo: string; descricao: string | null;
  saldo_inicial: number; saldo_atual: number; ativo: boolean;
};

const BANCOS = [
  { codigo: '001', nome: 'Banco do Brasil' }, { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica' }, { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' }, { codigo: '745', nome: 'Citibank' },
  { codigo: '756', nome: 'Sicoob' }, { codigo: '748', nome: 'Sicredi' },
  { codigo: '077', nome: 'Inter' }, { codigo: '260', nome: 'Nubank' },
  { codigo: '336', nome: 'C6 Bank' }, { codigo: '212', nome: 'Original' },
  { codigo: '422', nome: 'Safra' }, { codigo: '070', nome: 'BRB' },
  { codigo: '000', nome: 'Outro' },
];

export default function ContasBancarias() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    banco_codigo: '', banco_nome: '', agencia: '', conta: '',
    tipo: 'corrente', descricao: '', saldo_inicial: '0',
  });

  useEffect(() => { if (user && empresaAtiva) load(); }, [user, empresaAtiva]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('contas_bancarias')
      .select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
      .order('created_at', { ascending: false });
    setContas((data as any[]) || []);
    setLoading(false);
  };

  const handleBancoSelect = (codigo: string) => {
    const b = BANCOS.find(b => b.codigo === codigo);
    setForm(f => ({ ...f, banco_codigo: codigo, banco_nome: b?.nome || '' }));
  };

  const handleSave = async () => {
    if (!form.banco_nome) { toast.error('Selecione o banco'); return; }
    setSaving(true);
    const saldo = parseFloat(form.saldo_inicial) || 0;
    const { error } = await supabase.from('contas_bancarias').insert({
      user_id: user!.id, empresa_id: empresaAtiva!.id,
      banco_codigo: form.banco_codigo || null, banco_nome: form.banco_nome,
      agencia: form.agencia || null, conta: form.conta || null,
      tipo: form.tipo, descricao: form.descricao || null,
      saldo_inicial: saldo, saldo_atual: saldo,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar conta'); return; }
    toast.success('Conta bancária cadastrada!');
    setDialogOpen(false);
    setForm({ banco_codigo: '', banco_nome: '', agencia: '', conta: '', tipo: 'corrente', descricao: '', saldo_inicial: '0' });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contas_bancarias').delete().eq('id', id);
    toast.success('Conta excluída');
    load();
  };

  const totalSaldo = contas.filter(c => c.ativo).reduce((s, c) => s + c.saldo_atual, 0);

  if (!empresaAtiva) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa para gerenciar contas bancárias.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-accent" /> Contas Bancárias
          </h3>
          <p className="text-xs text-muted-foreground">{contas.length} contas | Saldo total: {fmt(totalSaldo)}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Conta Bancária</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">Banco</Label>
                <Select value={form.banco_codigo} onValueChange={handleBancoSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    {BANCOS.map(b => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Agência</Label><Input value={form.agencia} onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))} placeholder="0001" /></div>
                <div><Label className="text-xs">Conta</Label><Input value={form.conta} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} placeholder="12345-6" /></div>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Descrição / Apelido</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Conta principal" /></div>
              <div><Label className="text-xs">Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : contas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <Landmark className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhuma conta bancária cadastrada
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contas.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{c.banco_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.agencia && `Ag: ${c.agencia}`} {c.conta && `| Cc: ${c.conta}`}
                  </p>
                  {c.descricao && <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>}
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {c.tipo === 'corrente' ? 'Conta Corrente' : c.tipo === 'poupanca' ? 'Poupança' : 'Pagamento'}
                  </Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-[10px] text-muted-foreground">Saldo Atual</p>
                <p className={`text-lg font-bold ${c.saldo_atual >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {fmt(c.saldo_atual)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
