import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Save, X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

type Template = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  prompt_sistema: string;
  modelo_conteudo: string | null;
  legislacao_base: string | null;
  ativo: boolean;
  created_at: string;
};

const categorias = [
  'reequilibrio_economico',
  'impugnacao',
  'recurso_hierarquico',
  'parecer_juridico',
  'proposta_tecnica',
  'geral',
];

const categoriaLabels: Record<string, string> = {
  reequilibrio_economico: 'Reequilíbrio Econômico',
  impugnacao: 'Impugnação',
  recurso_hierarquico: 'Recurso Hierárquico',
  parecer_juridico: 'Parecer Jurídico',
  proposta_tecnica: 'Proposta Técnica',
  geral: 'Geral',
};

export default function AdminTemplates() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nome: '', categoria: 'geral', descricao: '', prompt_sistema: '',
    modelo_conteudo: '', legislacao_base: '', ativo: true,
  });

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .order('categoria')
      .order('nome');
    setTemplates((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadTemplates(); }, [isAdmin]);

  if (roleLoading) return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div></AppLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const resetForm = () => {
    setForm({ nome: '', categoria: 'geral', descricao: '', prompt_sistema: '', modelo_conteudo: '', legislacao_base: '', ativo: true });
    setEditing(null);
    setCreating(false);
  };

  const startEdit = (t: Template) => {
    setForm({
      nome: t.nome, categoria: t.categoria, descricao: t.descricao || '',
      prompt_sistema: t.prompt_sistema, modelo_conteudo: t.modelo_conteudo || '',
      legislacao_base: t.legislacao_base || '', ativo: t.ativo,
    });
    setEditing(t.id);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!form.nome || !form.prompt_sistema) {
      toast.error('Nome e prompt do sistema são obrigatórios');
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from('document_templates')
        .update({ ...form, descricao: form.descricao || null, modelo_conteudo: form.modelo_conteudo || null, legislacao_base: form.legislacao_base || null })
        .eq('id', editing);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Template atualizado');
    } else {
      const { error } = await supabase
        .from('document_templates')
        .insert({ ...form, descricao: form.descricao || null, modelo_conteudo: form.modelo_conteudo || null, legislacao_base: form.legislacao_base || null, created_by: user!.id });
      if (error) { toast.error('Erro ao criar'); return; }
      toast.success('Template criado');
    }

    resetForm();
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('document_templates').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Template excluído');
    loadTemplates();
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates de Documentos</h1>
            <p className="text-sm text-muted-foreground">Gerencie modelos e prompts da IA — Painel Administrador</p>
          </div>
        </div>
        {!creating && !editing && (
          <Button onClick={() => { resetForm(); setCreating(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        )}
      </div>

      {/* Form */}
      {(creating || editing) && (
        <div className="bg-card rounded-xl border border-border/50 p-6 mb-6 space-y-4">
          <h3 className="text-sm font-semibold">{editing ? 'Editar Template' : 'Novo Template'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Pedido de Reequilíbrio" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{categoriaLabels[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição breve do template" />
          </div>
          <div className="space-y-2">
            <Label>Prompt do Sistema (IA) *</Label>
            <Textarea rows={5} value={form.prompt_sistema} onChange={e => setForm(f => ({ ...f, prompt_sistema: e.target.value }))} placeholder="Instrução para a IA gerar o documento..." />
          </div>
          <div className="space-y-2">
            <Label>Modelo de Conteúdo</Label>
            <Textarea rows={4} value={form.modelo_conteudo} onChange={e => setForm(f => ({ ...f, modelo_conteudo: e.target.value }))} placeholder="Estrutura base do documento..." />
          </div>
          <div className="space-y-2">
            <Label>Legislação Base</Label>
            <Input value={form.legislacao_base} onChange={e => setForm(f => ({ ...f, legislacao_base: e.target.value }))} placeholder="Ex: Lei 14.133/2021, Art. 124" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            <Label>Ativo</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button>
            <Button variant="outline" onClick={resetForm} className="gap-2"><X className="w-4 h-4" /> Cancelar</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando templates...</p>
        ) : templates.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Nenhum template cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie o primeiro modelo de documento para os usuários</p>
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{t.nome}</span>
                  <Badge variant="outline" className="text-xs">{categoriaLabels[t.categoria] || t.categoria}</Badge>
                  {!t.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                </div>
                {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                {t.legislacao_base && <p className="text-xs text-muted-foreground mt-1">📜 {t.legislacao_base}</p>}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">Prompt: {t.prompt_sistema.slice(0, 120)}...</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
