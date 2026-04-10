import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Loader2, Users, Search } from 'lucide-react';

const tipoBadge: Record<string, string> = {
  cliente: 'bg-emerald-100 text-emerald-800',
  fornecedor: 'bg-blue-100 text-blue-800',
  ambos: 'bg-purple-100 text-purple-800',
};

export default function FinPessoas() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ razao_social: '', tipo: 'fornecedor', cnpj_cpf: '', email: '', telefone: '', nome_fantasia: '' });

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('fin_pessoas').select('*').eq('empresa_id', empresaAtiva!.id).order('razao_social');
    setItems(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.razao_social) { toast.error('Informe a razão social'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_pessoas').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      razao_social: form.razao_social, tipo: form.tipo,
      cnpj_cpf: form.cnpj_cpf || null, email: form.email || null,
      telefone: form.telefone || null, nome_fantasia: form.nome_fantasia || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Pessoa cadastrada');
    setShowNew(false);
    setForm({ razao_social: '', tipo: 'fornecedor', cnpj_cpf: '', email: '', telefone: '', nome_fantasia: '' });
    load();
  }

  const filtered = items.filter((i) => !search || i.razao_social?.toLowerCase().includes(search.toLowerCase()) || i.cnpj_cpf?.includes(search));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Clientes / Fornecedores</h1>
        <div className="flex gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Razão Social</th>
              <th className="text-left p-3 font-medium">CNPJ/CPF</th>
              <th className="text-left p-3 font-medium">E-mail</th>
              <th className="text-center p-3 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{i.razao_social}</td>
                <td className="p-3">{i.cnpj_cpf || '—'}</td>
                <td className="p-3">{i.email || '—'}</td>
                <td className="p-3 text-center"><Badge className={tipoBadge[i.tipo] || ''}>{i.tipo}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma pessoa cadastrada</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Pessoa</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Razão Social *</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} /></div>
            </div>
            <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
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
