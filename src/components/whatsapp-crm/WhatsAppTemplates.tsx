import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, FileText, Loader2, Trash2, Copy, Edit2, Check, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Template {
  id: string;
  nome: string;
  categoria: string;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  uso_count: number;
  created_at: string;
}

const CATEGORIAS = ['geral', 'licitações', 'jurídico', 'financeiro', 'documentos', 'cobrança', 'follow-up'];

export default function WhatsAppTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConteudo, setEditConteudo] = useState('');
  const [newTemplate, setNewTemplate] = useState({ nome: '', categoria: 'geral', conteudo: '' });

  useEffect(() => { if (user) loadTemplates(); }, [user]);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as Template[]);
    setLoading(false);
  };

  const extractVars = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches.map(m => m.replace(/[{}]/g, '')))] : [];
  };

  const handleCreate = async () => {
    if (!newTemplate.nome || !newTemplate.conteudo) { toast.error('Nome e conteúdo são obrigatórios'); return; }
    const { error } = await supabase.from('whatsapp_templates').insert({
      user_id: user!.id,
      nome: newTemplate.nome,
      categoria: newTemplate.categoria,
      conteudo: newTemplate.conteudo,
      variaveis: extractVars(newTemplate.conteudo),
    });
    if (error) toast.error('Erro ao criar template');
    else {
      toast.success('Template criado!');
      setShowNew(false);
      setNewTemplate({ nome: '', categoria: 'geral', conteudo: '' });
      loadTemplates();
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await supabase.from('whatsapp_templates').update({ ativo }).eq('id', id);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('whatsapp_templates').delete().eq('id', id);
    toast.success('Template removido');
    loadTemplates();
  };

  const handleSaveEdit = async (id: string) => {
    await supabase.from('whatsapp_templates').update({
      conteudo: editConteudo,
      variaveis: extractVars(editConteudo),
    }).eq('id', id);
    toast.success('Template atualizado');
    setEditingId(null);
    loadTemplates();
  };

  const handleCopy = (conteudo: string) => {
    navigator.clipboard.writeText(conteudo);
    toast.success('Copiado!');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Novo Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Template de Mensagem</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label><Input value={newTemplate.nome} onChange={e => setNewTemplate(p => ({ ...p, nome: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={newTemplate.categoria} onValueChange={v => setNewTemplate(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea value={newTemplate.conteudo} onChange={e => setNewTemplate(p => ({ ...p, conteudo: e.target.value }))} rows={5} className="mt-1" placeholder="Olá {{nome}}, sua proposta para {{orgao}} foi atualizada..." />
                <p className="text-[10px] text-muted-foreground mt-1">Use {'{{variavel}}'} para campos dinâmicos</p>
              </div>
              {newTemplate.conteudo && extractVars(newTemplate.conteudo).length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {extractVars(newTemplate.conteudo).map(v => <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>)}
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Criar Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {templates.length === 0 ? (
          <Card className="p-10 text-center col-span-2">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum template criado ainda</p>
          </Card>
        ) : (
          templates.map(t => (
            <Card key={t.id} className={`p-4 ${!t.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{t.nome}</p>
                  <Badge variant="outline" className="text-xs mt-0.5">{t.categoria}</Badge>
                </div>
                <Switch checked={t.ativo} onCheckedChange={v => handleToggle(t.id, v)} />
              </div>
              {editingId === t.id ? (
                <div className="space-y-2">
                  <Textarea value={editConteudo} onChange={e => setEditConteudo(e.target.value)} rows={4} className="text-xs" />
                  <div className="flex gap-1">
                    <Button size="sm" className="text-xs h-7 gap-1" onClick={() => handleSaveEdit(t.id)}><Check className="w-3 h-3" />Salvar</Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => setEditingId(null)}><X className="w-3 h-3" />Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mb-2 line-clamp-4">{t.conteudo}</p>
              )}
              {t.variaveis.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {t.variaveis.map(v => <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>)}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Usado {t.uso_count}x</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopy(t.conteudo)}><Copy className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(t.id); setEditConteudo(t.conteudo); }}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
