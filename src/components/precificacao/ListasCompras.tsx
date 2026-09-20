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
import EstadoVazio from '@/components/shared/EstadoVazio';
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
        <div className="flex flex-wrap items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold leading-6 text-foreground">Listas de Compras</h3>
          <Badge variant="info" className="tabular-nums">{lists.length} {lists.length === 1 ? 'lista' : 'listas'}</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus aria-hidden="true" /> Nova Lista
        </Button>
      </div>

      {/* Formulário: rótulo acima, campos de 40px, rodapé Cancelar → Criar. */}
      {showCreate && (
        <div className="space-y-4 rounded-lg border border-border bg-secondary p-4">
          <div className="space-y-1.5">
            <Label htmlFor="lista-nome">Nome da lista</Label>
            <Input id="lista-nome" placeholder="Ex.: Material de expediente — PE 12/2026" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lista-descricao">Descrição (opcional)</Label>
            <Textarea id="lista-descricao" placeholder="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="min-h-[60px]" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={createList} disabled={creating || !newName.trim()}>
              <Plus aria-hidden="true" /> {creating ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lists panel */}
        <div className="space-y-2 lg:col-span-1">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Carregando listas">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : lists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border">
              <EstadoVazio tamanho="compacto" icone={<ShoppingCart />} titulo="Nenhuma lista criada ainda." />
            </div>
          ) : (
            lists.map(list => {
              const ativa = selectedList?.id === list.id;
              return (
                <div
                  key={list.id}
                  className={cn(
                    'relative rounded-lg border shadow-sm transition-colors duration-150',
                    ativa ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:bg-muted/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openList(list)}
                    aria-pressed={ativa}
                    className="w-full rounded-lg p-3 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{list.nome}</p>
                    {list.descricao && <p className="mt-1 truncate text-xs text-muted-foreground">{list.descricao}</p>}
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">{new Date(list.created_at).toLocaleDateString('pt-BR')}</p>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost-destructive"
                    className="absolute right-2 top-2"
                    aria-label={`Excluir lista ${list.nome}`}
                    onClick={() => deleteList(list.id)}
                  >
                    <Trash2 aria-hidden="true" />
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
                <h4 className="text-base font-semibold leading-6 text-foreground">{selectedList.nome}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowAddItem(true)}>
                    <Plus aria-hidden="true" /> Adicionar Item
                  </Button>
                </div>
              </div>

              {showAddItem && (
                <div className="grid gap-4 rounded-lg border border-border bg-secondary p-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="item-descricao">Descrição do produto *</Label>
                    <Input id="item-descricao" placeholder="Descrição" value={newItem.descricao} onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="item-marca">Marca</Label>
                    <Input id="item-marca" placeholder="Opcional" value={newItem.marca} onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="item-unidade">Unidade</Label>
                    <Input id="item-unidade" placeholder="UN" value={newItem.unidade} onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="item-quantidade">Quantidade</Label>
                    <Input id="item-quantidade" type="number" placeholder="1" value={newItem.quantidade} onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))} className="tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="item-preco">Preço de referência (R$)</Label>
                    <MoneyInput id="item-preco" placeholder="0,00" value={Number(newItem.preco_referencia) || 0} onValueChange={v => setNewItem(p => ({ ...p, preco_referencia: String(v) }))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="item-fonte">Fonte de referência</Label>
                    <Input id="item-fonte" placeholder="Ex.: Painel de Preços, Mercado Livre" value={newItem.fonte_referencia} onChange={e => setNewItem(p => ({ ...p, fonte_referencia: e.target.value }))} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                    <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                    <Button onClick={addItem} disabled={!newItem.descricao.trim()}>Adicionar</Button>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="space-y-2" role="status" aria-label="Carregando itens da lista">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border">
                  <EstadoVazio tamanho="compacto" icone={<Package />} titulo="Lista vazia. Adicione itens para começar." />
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-md border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead>Unid</TableHead>
                          <TableHead className="text-right">Preço Ref.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.descricao}</TableCell>
                            <TableCell className="text-muted-foreground">{item.marca || '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                            <TableCell>{item.unidade}</TableCell>
                            <TableCell className="text-right tabular-nums" nowrap>{item.preco_referencia ? formatCurrency(item.preco_referencia) : '—'}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums" nowrap>
                              {item.preco_referencia ? formatCurrency(item.preco_referencia * item.quantidade) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon-sm" variant="ghost-destructive" aria-label={`Remover ${item.descricao}`} onClick={() => deleteItem(item.id)}>
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end border-t border-border pt-2">
                    <p className="text-sm font-semibold tabular-nums text-foreground">Total estimado: {formatCurrency(totalList)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border">
              <EstadoVazio
                icone={<Package />}
                titulo="Nenhuma lista selecionada"
                descricao="Selecione uma lista para visualizar os itens."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
