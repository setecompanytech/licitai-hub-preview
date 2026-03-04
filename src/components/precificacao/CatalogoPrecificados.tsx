import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, Search, Trash2, FileText, Filter, Loader2, ShoppingCart, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { valorPorExtenso } from '@/lib/numero-extenso';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS: Record<string, string> = {
  produto: 'Produto',
  servico_simples: 'Serviço Simples',
  servico_composicao: 'Serviço por Composição',
};

interface CatalogoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  custo_unitario: number;
  preco_unitario: number;
  preco_total: number;
  margem_lucro: number | null;
  tributos_total: number | null;
  bdi_percentual: number | null;
  tipo_calculo: string;
  regime_tributario: string | null;
  licitacao_id: string | null;
  licitacao_numero: string | null;
  licitacao_orgao: string | null;
  created_at: string;
}

export default function CatalogoPrecificados() {
  const { user } = useAuth();
  const { addItem } = usePropostaCart();
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterLicitacao, setFilterLicitacao] = useState('todos');
  const [licitacoes, setLicitacoes] = useState<{ id: string; numero: string; orgao: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('catalogo_itens_precificados')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar catálogo');
    } else {
      setItems((data || []) as CatalogoItem[]);
      // Extract unique licitações
      const lics = new Map<string, { id: string; numero: string; orgao: string }>();
      (data || []).forEach((item: any) => {
        if (item.licitacao_numero) {
          const key = item.licitacao_numero;
          if (!lics.has(key)) {
            lics.set(key, {
              id: item.licitacao_id || '',
              numero: item.licitacao_numero,
              orgao: item.licitacao_orgao || '',
            });
          }
        }
      });
      setLicitacoes(Array.from(lics.values()));
    }
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, [user]);

  const filteredItems = items.filter(item => {
    if (searchTerm && !item.descricao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTipo !== 'todos' && item.tipo_calculo !== filterTipo) return false;
    if (filterLicitacao !== 'todos' && item.licitacao_numero !== filterLicitacao) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('catalogo_itens_precificados').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item removido do catálogo');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const enviarSelecionados = () => {
    const selected = filteredItems.filter(i => selectedItems.has(i.id));
    if (selected.length === 0) { toast.error('Selecione ao menos um item'); return; }
    selected.forEach((item, idx) => {
      addItem({
        item: String(idx + 1),
        descricao: item.descricao,
        quantidade: String(item.quantidade),
        unidade: item.unidade,
        marca: item.marca || '',
        fabricante: item.fabricante || '',
        modelo: item.modelo || '',
        valorUnitario: item.preco_unitario.toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(item.preco_unitario),
        valorTotal: item.preco_total.toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(item.preco_total),
      });
    });
    toast.success(`${selected.length} item(ns) enviado(s) para a Proposta Comercial!`);
    setSelectedItems(new Set());
  };

  const totalSelecionado = filteredItems
    .filter(i => selectedItems.has(i.id))
    .reduce((s, i) => s + i.preco_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-sm">Catálogo de Itens Precificados</h3>
          <Badge variant="outline" className="text-[10px]">{items.length} itens</Badge>
        </div>
        <Button size="sm" onClick={loadItems} variant="outline" disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span className="ml-1">Atualizar</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar no catálogo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="produto">Produtos</SelectItem>
            <SelectItem value="servico_simples">Serviços Simples</SelectItem>
            <SelectItem value="servico_composicao">Serviços por Composição</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLicitacao} onValueChange={setFilterLicitacao}>
          <SelectTrigger className="w-[220px] h-9">
            <FileText className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="Licitação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as licitações</SelectItem>
            {licitacoes.map(l => (
              <SelectItem key={l.numero} value={l.numero}>
                {l.numero} — {l.orgao?.slice(0, 30) || 'S/N'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selection actions */}
      {selectedItems.size > 0 && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-lg px-4 py-2.5">
          <span className="text-xs font-medium">
            {selectedItems.size} item(ns) selecionado(s) · Total: {formatCurrency(totalSelecionado)}
          </span>
          <Button size="sm" onClick={enviarSelecionados} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta Comercial
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item no catálogo.</p>
          <p className="text-xs mt-1">Use as calculadoras para precificar itens e salvar no catálogo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onChange={selectAll}
                    className="rounded border-border"
                  />
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Descrição</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-center">Qtd</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-center">Und</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Marca</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Custo Unit.</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Preço Unit.</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Total</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Tipo</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Licitação</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={item.id} className={selectedItems.has(item.id) ? 'bg-accent/5' : ''}>
                  <TableCell className="py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-border"
                    />
                  </TableCell>
                  <TableCell className="text-xs py-1.5 max-w-[200px] truncate">{item.descricao}</TableCell>
                  <TableCell className="text-xs py-1.5 text-center">{item.quantidade}</TableCell>
                  <TableCell className="text-xs py-1.5 text-center">{item.unidade}</TableCell>
                  <TableCell className="text-xs py-1.5">{item.marca || '—'}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">{formatCurrency(item.custo_unitario)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-medium">{formatCurrency(item.preco_unitario)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-semibold text-accent">{formatCurrency(item.preco_total)}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[9px]">
                      {TIPO_LABELS[item.tipo_calculo] || item.tipo_calculo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] py-1.5 max-w-[120px] truncate text-muted-foreground">
                    {item.licitacao_numero || '—'}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredItems.length} itens exibidos</span>
          <span className="font-medium text-foreground">
            Total: {formatCurrency(filteredItems.reduce((s, i) => s + i.preco_total, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
