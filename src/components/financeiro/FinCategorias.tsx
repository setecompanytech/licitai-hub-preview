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
import { Plus, Loader2, FolderTree, Pencil, Trash2 } from 'lucide-react';

const tipoBadge: Record<string, string> = {
  receita: 'bg-emerald-100 text-emerald-800',
  despesa: 'bg-red-100 text-red-800',
  transferencia: 'bg-blue-100 text-blue-800',
};

export default function FinCategorias() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', tipo: 'despesa', codigo: '', pai_id: '' });

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('fin_categorias').select('*').eq('empresa_id', empresaAtiva!.id).order('codigo');
    setCats(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.nome) { toast.error('Informe o nome'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_categorias').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      nome: form.nome, tipo: form.tipo, codigo: form.codigo || null,
      pai_id: form.pai_id || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria criada');
    setShowNew(false);
    setForm({ nome: '', tipo: 'despesa', codigo: '', pai_id: '' });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const pais = cats.filter((c) => !c.pai_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><FolderTree className="w-5 h-5" /> Categorias (Plano de Contas)</h1>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Categoria</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Código</th>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-center p-3 font-medium">Tipo</th>
              <th className="text-center p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{c.codigo || '—'}</td>
                <td className="p-3">{c.pai_id ? <span className="ml-4">↳ </span> : ''}{c.nome}</td>
                <td className="p-3 text-center"><Badge className={tipoBadge[c.tipo] || ''}>{c.tipo}</Badge></td>
                <td className="p-3 text-center"><Badge variant={c.ativa ? 'default' : 'secondary'}>{c.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma categoria</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="1.01" /></div>
            </div>
            <div>
              <Label>Categoria Pai</Label>
              <Select value={form.pai_id} onValueChange={(v) => setForm({ ...form, pai_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (raiz)</SelectItem>
                  {pais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
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
