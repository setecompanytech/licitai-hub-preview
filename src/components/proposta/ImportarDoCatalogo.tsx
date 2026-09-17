import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, ShoppingCart, Loader2, FileText, ChevronDown, ChevronUp, CheckSquare, Trash2 } from 'lucide-react';
import { useProcessoAtivo, type ProcessoResumo } from '@/hooks/useProcessoAtivo';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
  _fonte?: 'catalogo' | 'edital';
}

interface Props {
  onImport: (items: CatalogoItem[]) => void;
  licitacaoNumero?: string;
  licitacaoId?: string | null;
}

export default function ImportarDoCatalogo({ onImport, licitacaoNumero, licitacaoId }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { fetchProcessos } = useProcessoAtivo();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLicitacao, setFilterLicitacao] = useState(licitacaoId || licitacaoNumero || 'todos');
  // resolvedLicId: o UUID real do processo (pode ser null se ainda não resolvido)
  const [resolvedLicId, setResolvedLicId] = useState<string | null>(licitacaoId || null);
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

    let catalogoData: CatalogoItem[] = [];
    if (!error && data) {
      catalogoData = (data as any[]).map(d => ({ ...d, _fonte: 'catalogo' as const }));
    }

    // Resolver o licitacao_id efetivo: vem via prop ou buscado pelo numero
    let effectiveLicId: string | null = licitacaoId || null;
    if (!effectiveLicId && licitacaoNumero) {
      // Busca todas as licitações do usuário e filtra client-side
      // porque o numero guardado pode ser "07/2026/PMPA-DL" enquanto
      // licitacaoNumero é "PREGÃO ELETRÔNICO Nº 07/2026/PMPA-DL" (ou vice-versa)
      let qLics = supabase
        .from('licitacoes')
        .select('id, numero');
      // Processos da empresa: a proposta pode vincular ao processo de um colega
      if (empresaAtiva) qLics = qLics.eq('empresa_id', empresaAtiva.id);
      const { data: allLics } = await qLics;

      if (allLics && allLics.length > 0) {
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const target = norm(licitacaoNumero);
        const match = allLics.find(l => {
          if (!l.numero) return false;
          const dbNum = norm(l.numero);
          return dbNum === target || target.includes(dbNum) || dbNum.includes(target);
        });
        effectiveLicId = match?.id ?? null;
      }
    }

    // Sempre carrega itens extraídos do edital (licitacao_itens) e mescla com catálogo
    if (effectiveLicId) {
      const { data: editalItens } = await supabase
        .from('licitacao_itens')
        .select('id, numero, descricao, quantidade, unidade, valor_unitario, valor_total, marca, fabricante, modelo, lote')
        // Itens são do processo (empresa); o RLS decide quem lê.
        .eq('licitacao_id', effectiveLicId)
        .order('numero', { ascending: true });

      if (editalItens && editalItens.length > 0) {
        const catalogIds = new Set(catalogoData.map(i => i.id));
        const editalMapped: CatalogoItem[] = editalItens
          .filter((it: any) => !catalogIds.has(it.id))
          .map((it: any) => ({
            id: it.id,
            descricao: it.descricao,
            quantidade: Number(it.quantidade ?? 1),
            unidade: it.unidade || 'UN',
            marca: it.marca || null,
            fabricante: it.fabricante || null,
            modelo: it.modelo || null,
            preco_unitario: Number(it.valor_unitario ?? 0),
            preco_total: Number(it.valor_total ?? 0),
            tipo_calculo: 'edital',
            licitacao_id: effectiveLicId,
            licitacao_numero: licitacaoNumero || null,
            licitacao_orgao: null,
            _fonte: 'edital' as const,
          }));
        catalogoData = [...catalogoData, ...editalMapped];
      }
    }

    // ELIMINA A DUPLICIDADE: catálogo e itens do edital são tabelas diferentes
    // com IDs diferentes e a MESMA descrição — dedup por descrição normalizada,
    // preferindo a linha do catálogo (tem o preço do usuário) sobre a
    // referência do edital; entre linhas do catálogo, vence a mais recente.
    const porDescricao = new Map<string, CatalogoItem>();
    for (const item of catalogoData) {
      const chave = `${item.licitacao_id || ''}|${item.descricao.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      const atual = porDescricao.get(chave);
      if (!atual) { porDescricao.set(chave, item); continue; }
      if (atual._fonte === 'edital' && item._fonte === 'catalogo') porDescricao.set(chave, item);
    }
    catalogoData = [...porDescricao.values()];

    if (effectiveLicId) setResolvedLicId(effectiveLicId);
    setItems(catalogoData);
    const lics = [...new Set(catalogoData.filter(d => d.licitacao_numero).map(d => d.licitacao_numero as string))];
    setLicitacoes(lics);

    // Filtro de processos: só faz sentido SEM vínculo — vinculado, a lista
    // trava no processo aberto (selecionar outro processo aqui era convite a
    // importar itens da pasta errada).
    if (!licitacaoId) {
      const procs = await fetchProcessos();
      setProcessos(procs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) loadItems();
  }, [expanded, user, empresaAtiva, licitacaoId, licitacaoNumero]);

  useEffect(() => {
    setFilterLicitacao(licitacaoId || licitacaoNumero || 'todos');
    setSelected(new Set());
  }, [licitacaoNumero, licitacaoId]);

  const filteredItems = items.filter(i => {
    if (filterLicitacao === 'todos') return true;
    if (i.licitacao_id === filterLicitacao) return true;
    if (i.licitacao_numero === filterLicitacao) return true;
    // Quando filterLicitacao é o numero mas o item tem apenas o UUID resolvido
    if (resolvedLicId && i.licitacao_id === resolvedLicId) return true;
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

  const [excluindo, setExcluindo] = useState(false);
  const handleExcluir = async () => {
    const sel = filteredItems.filter(i => selected.has(i.id));
    if (sel.length === 0) { toast.error('Selecione ao menos um item'); return; }
    if (!confirm(`Excluir ${sel.length} item(ns) selecionado(s)? Itens do catálogo e da extração do edital serão removidos.`)) return;
    setExcluindo(true);
    try {
      const catIds = sel.filter(i => i._fonte === 'catalogo').map(i => i.id);
      const edIds = sel.filter(i => i._fonte === 'edital').map(i => i.id);
      if (catIds.length) await supabase.from('catalogo_itens_precificados').delete().in('id', catIds);
      if (edIds.length) await supabase.from('licitacao_itens').delete().in('id', edIds);
      toast.success(`${sel.length} item(ns) excluído(s).`);
      setSelected(new Set());
      await loadItems();
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 bg-muted px-4 py-3 transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Package className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Importar do catálogo de precificação
        </span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {licitacaoId ? (
              <Badge variant="info" className="gap-1.5 px-3 py-1.5">
                <FileText className="w-3 h-3" aria-hidden="true" />
                Itens deste processo{licitacaoNumero ? `: ${licitacaoNumero}` : ''}
              </Badge>
            ) : (
              <Select value={filterLicitacao} onValueChange={(v) => { setFilterLicitacao(v); setSelected(new Set()); }}>
                <SelectTrigger className="w-full text-sm sm:w-[280px]" aria-label="Filtrar por licitação">
                  <FileText className="w-4 h-4 mr-2 text-muted-foreground" aria-hidden="true" />
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
            )}
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              <CheckSquare className="w-4 h-4" /> {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </Button>
            {selected.size > 0 && (
              <>
                <Button size="sm" onClick={handleImport}>
                  <ShoppingCart className="w-4 h-4" /> Importar {selected.size} item(ns)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExcluir}
                  disabled={excluindo}
                  className="border-destructive-line text-destructive hover:bg-destructive-tint hover:text-destructive"
                >
                  {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir selecionados
                </Button>
              </>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Package />}
              titulo="Nenhum item encontrado"
              descricao="Extraia os itens do edital ou precifique na aba Precificação."
            />
          ) : (
            <div className="max-h-[250px] space-y-1 overflow-y-auto">
              {filteredItems.some(i => i._fonte === 'edital') && (
                <p className="px-1 pb-1 text-xs text-muted-foreground">
                  Itens extraídos do edital (valores de referência). Preencha seu preço após importar.
                </p>
              )}
              {filteredItems.map(item => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                    selected.has(item.id) ? 'border-primary bg-primary-tint' : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-border"
                  />
                  <span className="flex-1 truncate">{item.descricao}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{item.quantidade} {item.unidade}</span>
                  {item.preco_unitario > 0
                    ? <span className="shrink-0 font-medium tabular-nums">{formatCurrency(item.preco_unitario)}</span>
                    : <span className="shrink-0 text-muted-foreground">sem preço</span>
                  }
                  {item._fonte === 'edital'
                    ? <Badge variant="warning" className="shrink-0">Edital</Badge>
                    : <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatCurrency(item.preco_total)}</span>
                  }
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
