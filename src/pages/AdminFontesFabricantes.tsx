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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Pencil, Trash2, Save, X, Factory,
  Search, ExternalLink, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIAS = [
  'informatica',
  'escritorio',
  'moveis',
  'eletrodomesticos',
  'eletroeletronicos',
  'alimentos',
  'limpeza',
  'saude',
  'construcao',
  'veiculos',
  'vestuario',
  'seguranca',
  'ferramentas',
  'geral',
] as const;

const CATEGORIA_LABELS: Record<string, string> = {
  informatica: 'Informática e TI',
  escritorio: 'Material de Escritório',
  moveis: 'Móveis e Mobiliário',
  eletrodomesticos: 'Eletrodomésticos',
  eletroeletronicos: 'Eletroeletrônicos',
  alimentos: 'Alimentação',
  limpeza: 'Limpeza e Higiene',
  saude: 'Saúde e Hospitalar',
  construcao: 'Construção Civil',
  veiculos: 'Veículos e Peças',
  vestuario: 'Vestuário e EPI',
  seguranca: 'Segurança',
  ferramentas: 'Ferramentas',
  geral: 'Geral',
};

interface Fonte {
  id: string;
  nome: string;
  url_base: string;
  categoria: string;
  descricao: string | null;
  palavras_chave: string[];
  prioridade: number;
  ativo: boolean;
  created_at: string;
}

const EMPTY_FORM: Omit<Fonte, 'id' | 'created_at'> = {
  nome: '',
  url_base: '',
  categoria: 'geral',
  descricao: '',
  palavras_chave: [],
  prioridade: 0,
  ativo: true,
};

export default function AdminFontesFabricantes() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('todos');
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [kwInput, setKwInput] = useState('');

  const loadFontes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fontes_fabricantes')
      .select('*')
      .order('prioridade', { ascending: false });
    if (error) toast.error('Erro ao carregar fontes');
    else setFontes((data || []) as unknown as Fonte[]);
    setLoading(false);
  };

  useEffect(() => { loadFontes(); }, []);

  if (roleLoading) {
    return (
      <AppLayout>
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Carregando...</span>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filtered = fontes.filter(f => {
    if (searchTerm && !f.nome.toLowerCase().includes(searchTerm.toLowerCase()) && !f.url_base.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCat !== 'todos' && f.categoria !== filterCat) return false;
    return true;
  });

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
    setKwInput('');
  };

  const startEdit = (fonte: Fonte) => {
    setEditing(fonte.id);
    setCreating(false);
    setForm({
      nome: fonte.nome,
      url_base: fonte.url_base,
      categoria: fonte.categoria,
      descricao: fonte.descricao,
      palavras_chave: fonte.palavras_chave || [],
      prioridade: fonte.prioridade,
      ativo: fonte.ativo,
    });
    setKwInput((fonte.palavras_chave || []).join(', '));
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
    setKwInput('');
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.url_base.trim()) {
      toast.error('Nome e URL são obrigatórios.');
      return;
    }
    const keywords = kwInput.split(',').map(k => k.trim()).filter(Boolean);
    const payload = {
      ...form,
      palavras_chave: keywords,
      created_by: user?.id,
    };

    if (creating) {
      const { error } = await supabase.from('fontes_fabricantes').insert(payload as any);
      if (error) { toast.error('Erro ao criar fonte'); console.error(error); }
      else { toast.success('Fonte adicionada!'); cancel(); loadFontes(); }
    } else if (editing) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await supabase.from('fontes_fabricantes').update(updatePayload as any).eq('id', editing);
      if (error) { toast.error('Erro ao atualizar'); console.error(error); }
      else { toast.success('Fonte atualizada!'); cancel(); loadFontes(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta fonte?')) return;
    const { error } = await supabase.from('fontes_fabricantes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Fonte removida'); loadFontes(); }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('fontes_fabricantes').update({ ativo } as any).eq('id', id);
    if (error) toast.error('Erro');
    else loadFontes();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <CabecalhoPagina
          rota="/admin/fontes-fabricantes"
          descricao="Alimente a IA de catalogação com portais e sites de fabricantes para aperfeiçoar as buscas de especificações e imagens."
          acoes={
            <Button onClick={startCreate}>
              <Plus aria-hidden="true" /> Nova Fonte
            </Button>
          }
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input placeholder="Buscar fonte..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[220px]" aria-label="Categoria">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIAS.map(c => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Create/Edit Form */}
        {(creating || editing) && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              {creating ? <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              {creating ? 'Adicionar Nova Fonte' : 'Editar Fonte'}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do Fabricante/Portal *</Label>
                <Input placeholder="Ex: HP Brasil, Tramontina, 3M" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>URL Base *</Label>
                <Input placeholder="https://www.hp.com.br" value={form.url_base} onChange={e => setForm(p => ({ ...p, url_base: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Fabricante líder em impressoras, notebooks e periféricos de informática..." value={form.descricao || ''} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} className="min-h-[60px]" />
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input placeholder="impressora, notebook, monitor, toner, cartucho" value={kwInput} onChange={e => setKwInput(e.target.value)} />
              <p className="text-xs text-muted-foreground">A IA usará estas palavras para priorizar este fabricante em buscas de produtos relacionados.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={cancel}><X aria-hidden="true" /> Cancelar</Button>
              <Button onClick={handleSave}>
                <Save aria-hidden="true" /> Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">🧠 Como a IA utiliza estas fontes:</p>
          <p>1. Ao gerar Fichas Técnicas, Folders ou Catálogos, a IA consulta esta base de fabricantes</p>
          <p>2. Quando a marca/fabricante do produto coincide com uma fonte cadastrada, a IA prioriza buscas diretas no site oficial</p>
          <p>3. As palavras-chave ajudam a IA a identificar qual fabricante é relevante para cada tipo de produto</p>
          <p>4. Fontes com maior prioridade são consultadas primeiro, garantindo imagens e dados mais autênticos</p>
        </div>

        {/* Table */}
        {loading ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Carregando fontes...</span>
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <EstadoVazio
              tamanho="compacto"
              icone={<Factory />}
              titulo="Nenhuma fonte cadastrada."
              descricao="Adicione sites de fabricantes para aperfeiçoar a IA de catalogação."
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Fabricante/Portal</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Palavras-chave</TableHead>
                  <TableHead className="text-center">
                    <span className="flex items-center justify-center gap-1"><ArrowUpDown className="h-3 w-3" aria-hidden="true" /> Prior.</span>
                  </TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(fonte => (
                  <TableRow key={fonte.id}>
                    <TableCell>
                      <Switch
                        checked={fonte.ativo}
                        onCheckedChange={v => handleToggle(fonte.id, v)}
                        aria-label={fonte.ativo ? 'Desativar fonte' : 'Ativar fonte'}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{fonte.nome}</TableCell>
                    <TableCell>
                      <a href={fonte.url_base} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        {fonte.url_base.replace(/^https?:\/\//, '').substring(0, 35)}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORIA_LABELS[fonte.categoria] || fonte.categoria}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="flex flex-wrap gap-1">
                        {(fonte.palavras_chave || []).slice(0, 4).map((kw, i) => (
                          <Badge key={i} variant="muted">{kw}</Badge>
                        ))}
                        {(fonte.palavras_chave || []).length > 4 && (
                          <Badge variant="muted">+{fonte.palavras_chave.length - 4}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold tabular-nums">{fonte.prioridade}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar fonte" onClick={() => startEdit(fonte)}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir fonte" className="text-destructive-ink hover:bg-destructive-tint" onClick={() => handleDelete(fonte.id)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-right text-xs text-muted-foreground">
          {filtered.length} fonte(s) · {fontes.filter(f => f.ativo).length} ativa(s)
        </div>
      </div>
    </AppLayout>
  );
}
