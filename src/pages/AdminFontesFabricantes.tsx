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
  Plus, Pencil, Trash2, Save, X, ShieldCheck, Globe, Factory,
  Search, ExternalLink, Loader2, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

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

  if (roleLoading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Factory className="w-5 h-5 text-accent" />
              Fontes de Fabricantes & Portais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Alimente a IA de catalogação com portais e sites de fabricantes para aperfeiçoar as buscas de especificações e imagens.
            </p>
          </div>
          <Badge variant="outline" className="border-accent/30 text-accent">
            <ShieldCheck className="w-3 h-3 mr-1" /> Admin
          </Badge>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar fonte..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIAS.map(c => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startCreate} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Nova Fonte
          </Button>
        </div>

        {/* Create/Edit Form */}
        {(creating || editing) && (
          <div className="border border-accent/30 rounded-xl p-5 bg-accent/5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {creating ? <Plus className="w-4 h-4 text-accent" /> : <Pencil className="w-4 h-4 text-accent" />}
              {creating ? 'Adicionar Nova Fonte' : 'Editar Fonte'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Fabricante/Portal *</Label>
                <Input placeholder="Ex: HP Brasil, Tramontina, 3M" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">URL Base *</Label>
                <Input placeholder="https://www.hp.com.br" value={form.url_base} onChange={e => setForm(p => ({ ...p, url_base: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prioridade (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição</Label>
              <Textarea placeholder="Fabricante líder em impressoras, notebooks e periféricos de informática..." value={form.descricao || ''} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} className="min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Palavras-chave (separadas por vírgula)</Label>
              <Input placeholder="impressora, notebook, monitor, toner, cartucho" value={kwInput} onChange={e => setKwInput(e.target.value)} />
              <p className="text-xs text-muted-foreground">A IA usará estas palavras para priorizar este fabricante em buscas de produtos relacionados.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))} />
              <Label className="text-xs">Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancel}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
              <Button onClick={handleSave} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-muted/30 border border-border/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">🧠 Como a IA utiliza estas fontes:</p>
          <p>1. Ao gerar Fichas Técnicas, Folders ou Catálogos, a IA consulta esta base de fabricantes</p>
          <p>2. Quando a marca/fabricante do produto coincide com uma fonte cadastrada, a IA prioriza buscas diretas no site oficial</p>
          <p>3. As palavras-chave ajudam a IA a identificar qual fabricante é relevante para cada tipo de produto</p>
          <p>4. Fontes com maior prioridade são consultadas primeiro, garantindo imagens e dados mais autênticos</p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Factory className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma fonte cadastrada.</p>
            <p className="text-xs mt-1">Adicione sites de fabricantes para aperfeiçoar a IA de catalogação.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold h-8">Status</TableHead>
                  <TableHead className="text-xs font-semibold h-8">Fabricante/Portal</TableHead>
                  <TableHead className="text-xs font-semibold h-8">URL</TableHead>
                  <TableHead className="text-xs font-semibold h-8">Categoria</TableHead>
                  <TableHead className="text-xs font-semibold h-8">Palavras-chave</TableHead>
                  <TableHead className="text-xs font-semibold h-8 text-center">
                    <span className="flex items-center gap-1 justify-center"><ArrowUpDown className="w-3 h-3" /> Prior.</span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold h-8 w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(fonte => (
                  <TableRow key={fonte.id}>
                    <TableCell className="py-1.5">
                      <Switch
                        checked={fonte.ativo}
                        onCheckedChange={v => handleToggle(fonte.id, v)}
                        className="scale-75"
                      />
                    </TableCell>
                    <TableCell className="text-xs py-1.5 font-medium">{fonte.nome}</TableCell>
                    <TableCell className="text-xs py-1.5">
                      <a href={fonte.url_base} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                        {fonte.url_base.replace(/^https?:\/\//, '').substring(0, 35)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[fonte.categoria] || fonte.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-xs py-1.5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {(fonte.palavras_chave || []).slice(0, 4).map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                        {(fonte.palavras_chave || []).length > 4 && (
                          <Badge variant="secondary" className="text-xs">+{fonte.palavras_chave.length - 4}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-1.5 text-center font-semibold">{fonte.prioridade}</TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(fonte)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(fonte.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-right">
          {filtered.length} fonte(s) · {fontes.filter(f => f.ativo).length} ativa(s)
        </div>
      </div>
    </AppLayout>
  );
}
