import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Loader2, Landmark, CreditCard, Wallet } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const tipoIcons: Record<string, React.ElementType> = { corrente: Landmark, poupanca: Wallet, cartao_credito: CreditCard, caixa: Wallet };
const tipoLabels: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', investimento: 'Investimento',
  cartao_credito: 'Cartão de Crédito', cartao_debito: 'Cartão Débito',
  caixa: 'Caixa', pix: 'PIX', aplicacao: 'Aplicação',
};

export default function FinContasBancarias() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', tipo: 'corrente', banco_nome: '', agencia: '', numero_conta: '', saldo_inicial: '0' });

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('fin_contas').select('*').eq('empresa_id', empresaAtiva!.id).order('nome');
    setContas(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.nome) { toast.error('Informe o nome da conta'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_contas').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      nome: form.nome, tipo: form.tipo, banco_nome: form.banco_nome || null,
      agencia: form.agencia || null, numero_conta: form.numero_conta || null,
      saldo_inicial: parseFloat(form.saldo_inicial.replace(',', '.')) || 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Conta criada');
    setShowNew(false);
    setForm({ nome: '', tipo: 'corrente', banco_nome: '', agencia: '', numero_conta: '', saldo_inicial: '0' });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Landmark className="w-5 h-5 text-primary" /> Contas Bancárias</h1>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contas.map((c) => {
          const Icon = tipoIcons[c.tipo] || Landmark;
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Icon className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <CardTitle className="text-sm">{c.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tipoLabels[c.tipo] || c.tipo}{c.banco_nome ? ` · ${c.banco_nome}` : ''}</p>
                </div>
                <Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativa' : 'Inativa'}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{fmt(c.saldo_inicial || 0)}</p>
                {c.agencia && <p className="text-xs text-muted-foreground mt-1">Ag: {c.agencia} · CC: {c.numero_conta}</p>}
              </CardContent>
            </Card>
          );
        })}
        {contas.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma conta cadastrada</p>}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Conta Principal BB" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Banco</Label><Input value={form.banco_nome} onChange={(e) => setForm({ ...form, banco_nome: e.target.value })} placeholder="Banco do Brasil" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agência</Label><Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.numero_conta} onChange={(e) => setForm({ ...form, numero_conta: e.target.value })} /></div>
            </div>
            <div><Label>Saldo Inicial (R$)</Label><Input value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
