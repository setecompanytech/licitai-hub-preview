import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Loader2, Landmark, CreditCard, Wallet, Pencil, Eye } from 'lucide-react';
import { fmtMoney, moneyClass } from '@/styles/financeiro';

const tipoIcons: Record<string, React.ElementType> = {
  corrente: Landmark, poupanca: Wallet, cartao_credito: CreditCard, caixa: Wallet, pix: Wallet, investimento: Landmark,
};
const tipoLabels: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', investimento: 'Investimento',
  cartao_credito: 'Cartão de Crédito', cartao_debito: 'Cartão Débito',
  caixa: 'Caixa', pix: 'PIX', aplicacao: 'Aplicação',
};
const BANCOS = [
  'Banco do Brasil', 'Bradesco', 'Itaú', 'Santander', 'Caixa Econômica',
  'Nubank', 'Inter', 'Sicoob', 'Sicredi', 'Safra', 'BTG Pactual', 'C6 Bank', 'Outro',
];

export default function FinContasBancarias() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '', tipo: 'corrente', banco_nome: '', agencia: '',
    numero_conta: '', saldo_inicial: '0', cor: '#2563EB',
  });

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('fin_contas').select('*').eq('empresa_id', empresaAtiva!.id).order('nome');
    setContas(data || []);
    setLoading(false);
  }

  function openEdit(c: any) {
    setEditItem(c);
    setForm({
      nome: c.nome, tipo: c.tipo, banco_nome: c.banco_nome || '',
      agencia: c.agencia || '', numero_conta: c.numero_conta || '',
      saldo_inicial: String(c.saldo_inicial || 0), cor: c.cor || '#2563EB',
    });
    setShowNew(true);
  }

  async function handleSave() {
    if (!form.nome) { toast.error('Informe o nome da conta'); return; }
    setSaving(true);
    const payload = {
      nome: form.nome, tipo: form.tipo, banco_nome: form.banco_nome || null,
      agencia: form.agencia || null, numero_conta: form.numero_conta || null,
      saldo_inicial: parseFloat(form.saldo_inicial.replace(',', '.')) || 0,
      cor: form.cor || null,
    };

    if (editItem) {
      const { error } = await supabase.from('fin_contas').update(payload).eq('id', editItem.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Conta atualizada');
    } else {
      const { error } = await supabase.from('fin_contas').insert({
        ...payload, empresa_id: empresaAtiva!.id, user_id: user!.id, ativo: true,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Conta criada');
    }
    setShowNew(false); setEditItem(null);
    resetForm(); load();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('fin_contas').update({ ativo: !ativo }).eq('id', id);
    load();
  }

  function resetForm() {
    setForm({ nome: '', tipo: 'corrente', banco_nome: '', agencia: '', numero_conta: '', saldo_inicial: '0', cor: '#2563EB' });
  }

  const saldoTotal = contas.filter(c => c.ativo).reduce((s: number, c: any) => s + (c.saldo_atual || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Contas Bancárias</h1>
          <p className="text-sm text-muted-foreground">
            Saldo Global: <span className={`font-bold ${moneyClass(saldoTotal)}`}>{fmtMoney(saldoTotal)}</span>
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditItem(null); setShowNew(true); }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contas.map((c: any) => {
          const Icon = tipoIcons[c.tipo] || Landmark;
          return (
            <Card key={c.id} className={`relative overflow-hidden ${!c.ativo ? 'opacity-50' : ''}`}>
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: c.cor || '#2563EB' }} />
              <CardContent className="p-4 pl-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-sm">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.banco_nome || tipoLabels[c.tipo] || c.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c.id, c.ativo)} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className={`text-xl font-bold ${moneyClass(c.saldo_atual || 0)}`}>{fmtMoney(c.saldo_atual || 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Saldo atual</p>
                </div>
                {(c.agencia || c.numero_conta) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {c.agencia && `Ag: ${c.agencia}`} {c.numero_conta && `CC: ${c.numero_conta}`}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {contas.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
          </CardContent></Card>
        )}
      </div>

      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) { setEditItem(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome da Conta *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Conta Principal BB" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Banco</Label>
                <Select value={form.banco_nome} onValueChange={(v) => setForm({ ...form, banco_nome: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Agência</Label><Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div><Label>Nº Conta</Label><Input value={form.numero_conta} onChange={(e) => setForm({ ...form, numero_conta: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Saldo Inicial (R$)</Label><Input value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} /></div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setEditItem(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {editItem ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
