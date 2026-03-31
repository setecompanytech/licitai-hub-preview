import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Settings2, Zap, CheckCircle2 } from 'lucide-react';

type Regra = {
  id: string; nome: string; tipo_match: string; padrao_texto: string;
  categoria_destino: string | null; acao: string; ativo: boolean;
  prioridade: number; vezes_aplicada: number;
};

const categorias = [
  'Fornecedor', 'Tributos', 'Folha de Pagamento', 'Aluguel',
  'Frete/Logística', 'Serviços', 'Material', 'Transferência', 'Outros',
];

export default function ConciliacaoRegras() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '', tipo_match: 'contem', padrao_texto: '',
    categoria_destino: '', acao: 'categorizar', prioridade: '0',
  });

  useEffect(() => { if (user && empresaAtiva) load(); }, [user, empresaAtiva]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('conciliacao_regras')
      .select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
      .order('prioridade', { ascending: false });
    setRegras((data as any[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.nome || !form.padrao_texto) { toast.error('Preencha nome e padrão'); return; }
    setSaving(true);
    const { error } = await supabase.from('conciliacao_regras').insert({
      user_id: user!.id, empresa_id: empresaAtiva!.id,
      nome: form.nome, tipo_match: form.tipo_match,
      padrao_texto: form.padrao_texto, categoria_destino: form.categoria_destino || null,
      acao: form.acao, prioridade: parseInt(form.prioridade) || 0,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar regra'); return; }
    toast.success('Regra criada!');
    setDialogOpen(false);
    setForm({ nome: '', tipo_match: 'contem', padrao_texto: '', categoria_destino: '', acao: 'categorizar', prioridade: '0' });
    load();
  };

  const toggleRegra = async (id: string, ativo: boolean) => {
    await supabase.from('conciliacao_regras').update({ ativo } as any).eq('id', id);
    load();
  };

  const deleteRegra = async (id: string) => {
    await supabase.from('conciliacao_regras').delete().eq('id', id);
    toast.success('Regra excluída');
    load();
  };

  // Apply rules to uncategorized transactions
  const aplicarRegras = async () => {
    if (regras.filter(r => r.ativo).length === 0) { toast.info('Nenhuma regra ativa'); return; }
    
    const { data: transacoes } = await supabase.from('transacoes_bancarias')
      .select('id, descricao, categoria')
      .eq('user_id', user!.id)
      .is('categoria', null);

    if (!transacoes || transacoes.length === 0) { toast.info('Nenhuma transação sem categoria'); return; }

    let aplicadas = 0;
    const regrasAtivas = regras.filter(r => r.ativo).sort((a, b) => b.prioridade - a.prioridade);

    for (const t of transacoes as any[]) {
      for (const regra of regrasAtivas) {
        let match = false;
        const desc = t.descricao.toLowerCase();
        const padrao = regra.padrao_texto.toLowerCase();

        if (regra.tipo_match === 'contem') match = desc.includes(padrao);
        else if (regra.tipo_match === 'comeca_com') match = desc.startsWith(padrao);
        else if (regra.tipo_match === 'termina_com') match = desc.endsWith(padrao);
        else if (regra.tipo_match === 'exato') match = desc === padrao;
        else if (regra.tipo_match === 'regex') {
          try { match = new RegExp(padrao, 'i').test(t.descricao); } catch {}
        }

        if (match && regra.categoria_destino) {
          await supabase.from('transacoes_bancarias').update({ categoria: regra.categoria_destino } as any).eq('id', t.id);
          await supabase.from('conciliacao_regras').update({ vezes_aplicada: regra.vezes_aplicada + 1 } as any).eq('id', regra.id);
          aplicadas++;
          break;
        }
      }
    }

    toast.success(`${aplicadas} transações categorizadas automaticamente!`);
    load();
  };

  if (!empresaAtiva) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Settings2 className="w-4 h-4 text-accent" /> Regras de Auto-Categorização</h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={aplicarRegras}>
            <Zap className="w-3.5 h-3.5 mr-1" /> Aplicar Regras
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Regra</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Regra de Categorização</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label className="text-xs">Nome da regra *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: PIX de fornecedores" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Tipo de match</Label>
                    <Select value={form.tipo_match} onValueChange={v => setForm(f => ({ ...f, tipo_match: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contem">Contém</SelectItem>
                        <SelectItem value="comeca_com">Começa com</SelectItem>
                        <SelectItem value="termina_com">Termina com</SelectItem>
                        <SelectItem value="exato">Exato</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Prioridade</Label><Input type="number" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} /></div>
                </div>
                <div><Label className="text-xs">Padrão de texto *</Label><Input value={form.padrao_texto} onChange={e => setForm(f => ({ ...f, padrao_texto: e.target.value }))} placeholder="PIX, TED, BOLETO..." /></div>
                <div><Label className="text-xs">Categoria destino</Label>
                  <Select value={form.categoria_destino} onValueChange={v => setForm(f => ({ ...f, categoria_destino: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : regras.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground text-sm">
          Nenhuma regra configurada. Crie regras para categorizar transações automaticamente.
        </Card>
      ) : (
        <div className="space-y-2">
          {regras.map(r => (
            <Card key={r.id} className={`p-3 ${!r.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.nome}</span>
                    <Badge variant="outline" className="text-[9px]">{r.tipo_match}</Badge>
                    {r.categoria_destino && <Badge className="bg-accent/10 text-accent text-[9px]">{r.categoria_destino}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Padrão: "<span className="font-mono">{r.padrao_texto}</span>" · Aplicada {r.vezes_aplicada}x
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.ativo} onCheckedChange={v => toggleRegra(r.id, v)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteRegra(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
