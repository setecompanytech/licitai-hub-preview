import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import EstadoVazio from '@/components/shared/EstadoVazio';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando os modelos</span>
      </div>
    );
  }

  const dialogNovoTemplate = (
    <Dialog open={showNew} onOpenChange={setShowNew}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" />Novo modelo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo modelo de mensagem</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="modelo-nome">Nome</Label>
            <Input id="modelo-nome" value={newTemplate.nome} onChange={e => setNewTemplate(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modelo-categoria">Categoria</Label>
            <Select value={newTemplate.categoria} onValueChange={v => setNewTemplate(p => ({ ...p, categoria: v }))}>
              <SelectTrigger id="modelo-categoria"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modelo-conteudo">Conteúdo</Label>
            <Textarea id="modelo-conteudo" value={newTemplate.conteudo} onChange={e => setNewTemplate(p => ({ ...p, conteudo: e.target.value }))} rows={5} placeholder="Olá {{nome}}, sua proposta para {{orgao}} foi atualizada..." />
            <p className="text-xs text-muted-foreground">Use {'{{variavel}}'} para campos dinâmicos</p>
          </div>
          {newTemplate.conteudo && extractVars(newTemplate.conteudo).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extractVars(newTemplate.conteudo).map(v => <Badge key={v} variant="muted">{`{{${v}}}`}</Badge>)}
            </div>
          )}
          <Button onClick={handleCreate} className="w-full">Criar modelo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">{templates.length} modelos</p>
        {dialogNovoTemplate}
      </div>

      {templates.length === 0 ? (
        <EstadoVazio
          icone={<FileText aria-hidden="true" />}
          titulo="Nenhum modelo criado ainda"
          descricao="Guarde as mensagens que você repete e reaproveite nos disparos."
          acao={<Button onClick={() => setShowNew(true)}><Plus aria-hidden="true" />Novo modelo</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map(t => (
            <Card key={t.id} className={`p-6 ${!t.ativo ? 'opacity-60' : ''}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate">{t.nome}</h3>
                  <Badge variant="muted" className="mt-1" truncate>{t.categoria}</Badge>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.ativo ? 'Ativo' : 'Inativo'}</span>
                  <Switch
                    checked={t.ativo}
                    onCheckedChange={v => handleToggle(t.id, v)}
                    aria-label={`${t.ativo ? 'Desativar' : 'Ativar'} o modelo ${t.nome}`}
                  />
                </div>
              </div>
              {editingId === t.id ? (
                <div className="space-y-2">
                  <Label htmlFor={`modelo-edicao-${t.id}`} className="sr-only">Conteúdo do modelo {t.nome}</Label>
                  <Textarea id={`modelo-edicao-${t.id}`} value={editConteudo} onChange={e => setEditConteudo(e.target.value)} rows={4} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(t.id)}><Check aria-hidden="true" />Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X aria-hidden="true" />Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="mb-3 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.conteudo}</p>
              )}
              {t.variaveis.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {t.variaveis.map(v => <Badge key={v} variant="muted">{`{{${v}}}`}</Badge>)}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground tabular-nums">Usado {t.uso_count}x</span>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleCopy(t.conteudo)} aria-label={`Copiar o modelo ${t.nome}`}>
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(t.id); setEditConteudo(t.conteudo); }} aria-label={`Editar o modelo ${t.nome}`}>
                    <Edit2 aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} aria-label={`Remover o modelo ${t.nome}`}>
                    <Trash2 className="text-destructive" aria-hidden="true" />
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
