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
import { Plus, Pencil, Trash2, Save, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Skeleton } from '@/components/ui/skeleton';

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

  if (roleLoading) {
    return (
      <AppLayout>
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando...</span>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppLayout>
    );
  }
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
      <CabecalhoPagina
        rota="/admin/templates"
        acoes={
          !creating && !editing ? (
            <Button onClick={() => { resetForm(); setCreating(true); }}>
              <Plus aria-hidden="true" /> Novo Template
            </Button>
          ) : undefined
        }
      />

      {/* Form */}
      {(creating || editing) && (
        <div className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">{editing ? 'Editar Template' : 'Novo Template'}</h3>
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
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={resetForm}><X aria-hidden="true" /> Cancelar</Button>
            <Button onClick={handleSave}><Save aria-hidden="true" /> Salvar</Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Carregando templates...</span>
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <EstadoVazio
              tamanho="compacto"
              icone={<FileText />}
              titulo="Nenhum template cadastrado"
              descricao="Crie o primeiro modelo de documento para os usuários"
            />
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{t.nome}</span>
                  <Badge variant="outline">{categoriaLabels[t.categoria] || t.categoria}</Badge>
                  {!t.ativo && <Badge variant="muted">Inativo</Badge>}
                </div>
                {t.descricao && <p className="text-sm text-muted-foreground">{t.descricao}</p>}
                {t.legislacao_base && <p className="mt-1 text-xs text-muted-foreground">📜 {t.legislacao_base}</p>}
                <p className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">Prompt: {t.prompt_sistema.slice(0, 120)}...</p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Editar template" onClick={() => startEdit(t)}><Pencil aria-hidden="true" /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Excluir template" className="text-destructive-ink hover:bg-destructive-tint" onClick={() => handleDelete(t.id)}><Trash2 aria-hidden="true" /></Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
