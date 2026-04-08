import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, ShoppingCart, Loader2, FileText, ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';
import { useProcessoAtivo, type ProcessoResumo } from '@/hooks/useProcessoAtivo';
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
  licitacao_id: string | null;
  licitacao_numero: string | null;
  licitacao_orgao: string | null;
}

interface Props {
  onImport: (items: CatalogoItem[]) => void;
  licitacaoNumero?: string;
  licitacaoId?: string | null;
}

export default function ImportarDoCatalogo({ onImport, licitacaoNumero, licitacaoId }: Props) {
  const { user } = useAuth();
  const { fetchProcessos } = useProcessoAtivo();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLicitacao, setFilterLicitacao] = useState(licitacaoId || licitacaoNumero || 'todos');
  const [licitacoes, setLicitacoes] = useState<string[]>([]);
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectFields = 'id, descricao, quantidade, unidade, marca, fabricante, modelo, preco_unitario, preco_total, tipo_calculo, licitacao_numero, licitacao_orgao, licitacao_id';

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    let data: any[] | null = null;
    let error: any = null;

    if (licitacaoId) {
      const result = await supabase
        .from('catalogo_itens_precificados')
        .select(selectFields)
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .order('created_at', { ascending: false });
      data = result.data as any[] | null;
      error = result.error;
    }

    if ((!data || data.length === 0) && licitacaoNumero) {
      const result = await supabase
        .from('catalogo_itens_precificados')
        .select(selectFields)
        .eq('user_id', user.id)
        .eq('licitacao_numero', licitacaoNumero)
        .order('created_at', { ascending: false });
      if (!result.error && result.data) {
        data = result.data as any[];
      }
      error = result.error;
    }

    if (!data || data.length === 0) {
      const result = await supabase
        .from('catalogo_itens_precificados')
        .select(selectFields)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      data = result.data as any[] | null;
      error = result.error;
    }

    if (!error && data) {
      setItems(data as any[]);
      const lics = [...new Set(data.filter((d: any) => d.licitacao_numero).map((d: any) => d.licitacao_numero as string))];
      setLicitacoes(lics);
    }
    // Load user processes for the filter dropdown
    const procs = await fetchProcessos();
    setProcessos(procs);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) loadItems();
  }, [expanded, user, licitacaoId, licitacaoNumero]);

  useEffect(() => {
    setFilterLicitacao(licitacaoId || licitacaoNumero || 'todos');
    setSelected(new Set());
  }, [licitacaoNumero, licitacaoId]);

  const filteredItems = items.filter(i => {
    if (filterLicitacao === 'todos') return true;
    // Filter by licitacao_id (process ID)
    if (i.licitacao_id === filterLicitacao) return true;
    // Fallback: filter by licitacao_numero
    if (i.licitacao_numero === filterLicitacao) return true;
    return false;
  });

  const allSelected = filteredItems.length > 0 && filteredItems.every(i => selected.has(i.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredItems.map(i => i.id)));
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterLicitacao} onValueChange={(v) => { setFilterLicitacao(v); setSelected(new Set()); }}>
              <SelectTrigger className="h-8 text-xs w-[280px]">
                <FileText className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Filtrar por licitação" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="todos">Todas as licitações</SelectItem>
                {processos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.numero || 'S/N'}</span>
                    {p.orgao ? <span className="text-muted-foreground ml-1">— {p.orgao}</span> : null}
                  </SelectItem>
                ))}
                {licitacoes.filter(l => !processos.some(p => p.numero === l)).map(l => (
                  <SelectItem key={`num-${l}`} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={toggleSelectAll} className="h-8 text-xs gap-1">
              <CheckSquare className="w-3 h-3" /> {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </Button>
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
