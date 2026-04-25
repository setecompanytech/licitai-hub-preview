import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  ShoppingCart, Plus, Trash2, Edit2, Eye, Loader2, Package, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

type ShoppingList = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  created_at: string;
};

type ListItem = {
  id: string;
  descricao: string;
  marca: string | null;
  unidade: string;
  quantidade: number;
  preco_referencia: number | null;
  fonte_referencia: string | null;
  url_referencia: string | null;
  observacoes: string | null;
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ListasCompras() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ descricao: '', marca: '', unidade: 'UN', quantidade: '1', preco_referencia: '', fonte_referencia: '' });

  useEffect(() => { loadLists(); }, []);

  const loadLists = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLists((data || []) as ShoppingList[]);
    setLoading(false);
  };

  const createList = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('shopping_lists').insert({
      nome: newName, descricao: newDesc || null, user_id: user.id,
    });
    if (error) toast.error('Erro ao criar lista.');
    else { toast.success('Lista criada!'); setNewName(''); setNewDesc(''); setShowCreate(false); loadLists(); }
    setCreating(false);
  };

  const deleteList = async (id: string) => {
    const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir.');
    else { toast.success('Lista excluída.'); setLists(prev => prev.filter(l => l.id !== id)); if (selectedList?.id === id) setSelectedList(null); }
  };

  const openList = async (list: ShoppingList) => {
    setSelectedList(list);
    setLoadingItems(true);
    const { data } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', list.id)
      .order('created_at', { ascending: true });
    setItems((data || []) as ListItem[]);
    setLoadingItems(false);
  };

  const addItem = async () => {
    if (!selectedList || !newItem.descricao.trim()) return;
    const { error } = await supabase.from('shopping_list_items').insert({
      list_id: selectedList.id,
      descricao: newItem.descricao,
      marca: newItem.marca || null,
      unidade: newItem.unidade,
      quantidade: parseFloat(newItem.quantidade) || 1,
      preco_referencia: newItem.preco_referencia ? parseFloat(newItem.preco_referencia) : null,
      fonte_referencia: newItem.fonte_referencia || null,
    });
    if (error) toast.error('Erro ao adicionar item.');
    else {
      toast.success('Item adicionado!');
      setNewItem({ descricao: '', marca: '', unidade: 'UN', quantidade: '1', preco_referencia: '', fonte_referencia: '' });
      setShowAddItem(false);
      openList(selectedList);
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
    if (error) toast.error('Erro.');
    else setItems(prev => prev.filter(i => i.id !== id));
  };

  const totalList = items.reduce((sum, i) => sum + (i.preco_referencia || 0) * i.quantidade, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Listas de Compras</h3>
          <Badge variant="outline">{lists.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Lista
        </Button>
      </div>

      {showCreate && (
        <div className="bg-muted/30 border border-border/40 rounded-lg p-4 space-y-3">
          <Input placeholder="Nome da lista" value={newName} onChange={e => setNewName(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="min-h-[60px]" />
          <div className="flex gap-2">
            <Button size="sm" onClick={createList} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lists panel */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma lista criada ainda.</p>
          ) : (
            lists.map(list => (
              <button
                key={list.id}
                onClick={() => openList(list)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedList?.id === list.id ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{list.nome}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); deleteList(list.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {list.descricao && <p className="text-[11px] text-muted-foreground mt-1 truncate">{list.descricao}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(list.created_at).toLocaleDateString('pt-BR')}</p>
              </button>
            ))
          )}
        </div>

        {/* Items panel */}
        <div className="lg:col-span-2">
          {selectedList ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{selectedList.nome}</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
                  </Button>
                </div>
              </div>

              {showAddItem && (
                <div className="bg-muted/30 border border-border/40 rounded-lg p-3 grid grid-cols-2 gap-2">
                  <Input placeholder="Descrição do produto *" value={newItem.descricao} onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))} className="col-span-2" />
                  <Input placeholder="Marca" value={newItem.marca} onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))} />
                  <Input placeholder="Unidade" value={newItem.unidade} onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))} />
                  <Input type="number" placeholder="Quantidade" value={newItem.quantidade} onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))} />
                  <MoneyInput placeholder="Preço referência (R$)" value={Number(newItem.preco_referencia) || 0} onValueChange={v => setNewItem(p => ({ ...p, preco_referencia: String(v) }))} />
                  <Input placeholder="Fonte referência" value={newItem.fonte_referencia} onChange={e => setNewItem(p => ({ ...p, fonte_referencia: e.target.value }))} className="col-span-2" />
                  <div className="col-span-2 flex gap-2">
                    <Button size="sm" onClick={addItem} disabled={!newItem.descricao.trim()}>Adicionar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Lista vazia. Adicione itens para começar.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Produto</TableHead>
                        <TableHead className="text-xs">Marca</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-center">Unid</TableHead>
                        <TableHead className="text-xs text-right">Preço Ref.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-center w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.descricao}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.marca || '—'}</TableCell>
                          <TableCell className="text-center text-sm">{item.quantidade}</TableCell>
                          <TableCell className="text-center text-xs">{item.unidade}</TableCell>
                          <TableCell className="text-right text-sm">{item.preco_referencia ? formatCurrency(item.preco_referencia) : '—'}</TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {item.preco_referencia ? formatCurrency(item.preco_referencia * item.quantidade) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteItem(item.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end pt-2 border-t border-border/30">
                    <p className="text-sm font-semibold">Total estimado: {formatCurrency(totalList)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Selecione uma lista para visualizar os itens</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
