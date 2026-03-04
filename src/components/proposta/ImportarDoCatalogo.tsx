import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, ShoppingCart, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CatalogoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  preco_unitario: number;
  preco_total: number;
  tipo_calculo: string;
  licitacao_numero: string | null;
  licitacao_orgao: string | null;
}

interface Props {
  onImport: (items: CatalogoItem[]) => void;
  licitacaoNumero?: string;
}

export default function ImportarDoCatalogo({ onImport, licitacaoNumero }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLicitacao, setFilterLicitacao] = useState(licitacaoNumero || 'todos');
  const [licitacoes, setLicitacoes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('catalogo_itens_precificados')
      .select('id, descricao, quantidade, unidade, marca, fabricante, modelo, preco_unitario, preco_total, tipo_calculo, licitacao_numero, licitacao_orgao')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setItems(data as CatalogoItem[]);
      const lics = [...new Set(data.filter((d: any) => d.licitacao_numero).map((d: any) => d.licitacao_numero as string))];
      setLicitacoes(lics);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) loadItems();
  }, [expanded, user]);

  const filteredItems = items.filter(i => {
    if (filterLicitacao !== 'todos' && i.licitacao_numero !== filterLicitacao) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const selectedItems = filteredItems.filter(i => selected.has(i.id));
    if (selectedItems.length === 0) { toast.error('Selecione ao menos um item'); return; }
    onImport(selectedItems);
    setSelected(new Set());
    setExpanded(false);
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Package className="w-4 h-4 text-accent" />
          Importar do Catálogo de Precificação
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Select value={filterLicitacao} onValueChange={setFilterLicitacao}>
              <SelectTrigger className="h-8 text-xs w-[250px]">
                <FileText className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Filtrar por licitação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as licitações</SelectItem>
                {licitacoes.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <Button size="sm" onClick={handleImport} className="bg-accent hover:bg-accent/90 text-accent-foreground h-8">
                <ShoppingCart className="w-3 h-3 mr-1" /> Importar {selected.size} item(ns)
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum item no catálogo. Precifique itens na aba Precificação primeiro.
            </p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto space-y-1">
              {filteredItems.map(item => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                    selected.has(item.id) ? 'bg-accent/10 border border-accent/20' : 'hover:bg-muted/30 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-border"
                  />
                  <span className="flex-1 truncate">{item.descricao}</span>
                  <span className="text-muted-foreground">{item.quantidade} {item.unidade}</span>
                  <span className="font-medium">{formatCurrency(item.preco_unitario)}</span>
                  <span className="font-semibold text-accent">{formatCurrency(item.preco_total)}</span>
                  {item.licitacao_numero && (
                    <Badge variant="outline" className="text-[8px] shrink-0">{item.licitacao_numero}</Badge>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
