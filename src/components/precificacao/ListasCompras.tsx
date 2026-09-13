import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MoneyInput } from '@/components/ui/money-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShoppingCart, Plus, Trash2, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Listas de Compras</h3>
          <Badge variant="info">{lists.length} {lists.length === 1 ? 'lista' : 'listas'}</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Nova Lista
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
          <div>
            <Label htmlFor="lista-nome" className="text-sm">Nome da lista</Label>
            <Input id="lista-nome" placeholder="Ex.: Material de expediente — PE 12/2026" value={newName} onChange={e => setNewName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="lista-descricao" className="text-sm">Descrição (opcional)</Label>
            <Textarea id="lista-descricao" placeholder="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="mt-1 min-h-[60px]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createList} disabled={creating || !newName.trim()}>
              <Plus className="w-4 h-4" aria-hidden="true" /> {creating ? 'Criando...' : 'Criar'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lists panel */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Carregando listas">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma lista criada ainda.</p>
          ) : (
            lists.map(list => {
              const ativa = selectedList?.id === list.id;
              return (
                <div
                  key={list.id}
                  className={cn(
                    'relative rounded-lg border transition-colors',
                    ativa ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openList(list)}
                    aria-pressed={ativa}
                    className="w-full rounded-lg p-3 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <p className="text-sm font-medium truncate">{list.nome}</p>
                    {list.descricao && <p className="text-xs text-muted-foreground mt-1 truncate">{list.descricao}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(list.created_at).toLocaleDateString('pt-BR')}</p>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive-tint"
                    aria-label={`Excluir lista ${list.nome}`}
                    onClick={() => deleteList(list.id)}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Items panel */}
        <div className="lg:col-span-2">
          {selectedList ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-semibold">{selectedList.nome}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowAddItem(true)}>
                    <Plus className="w-4 h-4" aria-hidden="true" /> Adicionar Item
                  </Button>
                </div>
              </div>

              {showAddItem && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="item-descricao" className="text-sm">Descrição do produto *</Label>
                    <Input id="item-descricao" placeholder="Descrição" value={newItem.descricao} onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="item-marca" className="text-sm">Marca</Label>
                    <Input id="item-marca" placeholder="Opcional" value={newItem.marca} onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="item-unidade" className="text-sm">Unidade</Label>
                    <Input id="item-unidade" placeholder="UN" value={newItem.unidade} onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="item-quantidade" className="text-sm">Quantidade</Label>
                    <Input id="item-quantidade" type="number" placeholder="1" value={newItem.quantidade} onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="item-preco" className="text-sm">Preço de referência (R$)</Label>
                    <MoneyInput id="item-preco" placeholder="0,00" value={Number(newItem.preco_referencia) || 0} onValueChange={v => setNewItem(p => ({ ...p, preco_referencia: String(v) }))} className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="item-fonte" className="text-sm">Fonte de referência</Label>
                    <Input id="item-fonte" placeholder="Ex.: Painel de Preços, Mercado Livre" value={newItem.fonte_referencia} onChange={e => setNewItem(p => ({ ...p, fonte_referencia: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <Button onClick={addItem} disabled={!newItem.descricao.trim()}>Adicionar</Button>
                    <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="space-y-2" role="status" aria-label="Carregando itens da lista">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Lista vazia. Adicione itens para começar.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm font-semibold">Produto</TableHead>
                          <TableHead className="text-sm font-semibold">Marca</TableHead>
                          <TableHead className="text-sm font-semibold text-center">Qtd</TableHead>
                          <TableHead className="text-sm font-semibold text-center">Unid</TableHead>
                          <TableHead className="text-sm font-semibold text-right">Preço Ref.</TableHead>
                          <TableHead className="text-sm font-semibold text-right">Total</TableHead>
                          <TableHead className="w-10 text-sm font-semibold"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">{item.descricao}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.marca || '—'}</TableCell>
                            <TableCell className="text-center text-sm tabular-nums">{item.quantidade}</TableCell>
                            <TableCell className="text-center text-sm">{item.unidade}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{item.preco_referencia ? formatCurrency(item.preco_referencia) : '—'}</TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {item.preco_referencia ? formatCurrency(item.preco_referencia * item.quantidade) : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive-tint" aria-label={`Remover ${item.descricao}`} onClick={() => deleteItem(item.id)}>
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-border">
                    <p className="text-sm font-semibold tabular-nums">Total estimado: {formatCurrency(totalList)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                <Package className="w-6 h-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-semibold">Nenhuma lista selecionada</p>
              <p className="mt-1 text-sm text-muted-foreground">Selecione uma lista para visualizar os itens.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
