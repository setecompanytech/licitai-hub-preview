import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Loader2, Download, Trash2, CheckCircle, Brain } from 'lucide-react';
import { toast } from 'sonner';

type LicitacaoResumo = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
};

export type LicitacaoItemAutoFill = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  lote: string;
};

interface LicitacaoSelectorProps {
  licitacaoNumero: string;
  setLicitacaoNumero: (v: string) => void;
  licitacaoOrgao: string;
  setLicitacaoOrgao: (v: string) => void;
  onItensLoaded?: (itens: LicitacaoItemAutoFill[]) => void;
}

export default function LicitacaoSelector({
  licitacaoNumero,
  setLicitacaoNumero,
  licitacaoOrgao,
  setLicitacaoOrgao,
  onItensLoaded,
}: LicitacaoSelectorProps) {
  const { user } = useAuth();
  const { extrairItensIA } = useEditalExtraction();
  const [licitacoes, setLicitacoes] = useState<LicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itensCount, setItensCount] = useState<number>(0);
  const [filterNumero, setFilterNumero] = useState('');
  const [filterOrgao, setFilterOrgao] = useState('');

  // Load user licitacoes
  const fetchLicitacoes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, valor_estimado')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar licitações:', error);
    } else {
      setLicitacoes((data as unknown as LicitacaoResumo[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLicitacoes();
  }, [fetchLicitacoes]);

  // Only show results when both filters are active
  const numeroFiltro = filterNumero.trim();
  const orgaoFiltro = filterOrgao.trim();
  const hasActiveFilter = numeroFiltro.length > 0 && orgaoFiltro.length > 0;

  // Filter licitacoes
  const filtered = hasActiveFilter
    ? licitacoes.filter(l => {
        const matchNumero = l.numero?.toLowerCase().includes(numeroFiltro.toLowerCase());
        const matchOrgao = l.orgao?.toLowerCase().includes(orgaoFiltro.toLowerCase());
        return matchNumero && matchOrgao;
      })
    : [];

  // Unique orgaos for filter
  const orgaosUnicos = [...new Set(licitacoes.map(l => l.orgao).filter(Boolean))].sort();

  // Select licitacao and load items
  const handleSelect = async (licitacaoId: string) => {
    const lic = licitacoes.find(l => l.id === licitacaoId);
    if (!lic) return;

    setSelectedId(licitacaoId);
    setLicitacaoNumero(lic.numero || '');
    setLicitacaoOrgao(lic.orgao || '');

    // Fetch items from licitacao_itens
    setLoadingItens(true);
    const { data: itensData, error } = await supabase
      .from('licitacao_itens')
      .select('descricao, quantidade, unidade, valor_unitario, valor_total, lote')
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user!.id)
      .order('numero', { ascending: true });

    if (error) {
      console.error('Erro ao buscar itens:', error);
      toast.error('Erro ao buscar itens da licitação.');
      setLoadingItens(false);
      return;
    }

    const itens: LicitacaoItemAutoFill[] = ((itensData as any[]) || []).map(i => ({
      descricao: i.descricao || '',
      quantidade: i.quantidade || 1,
      unidade: i.unidade || 'UN',
      valorUnitario: i.valor_unitario || 0,
      valorTotal: i.valor_total || 0,
      lote: i.lote || 'Único',
    }));

    setItensCount(itens.length);
    setLoadingItens(false);

    if (itens.length > 0 && onItensLoaded) {
      onItensLoaded(itens);
      toast.success(`${itens.length} item(ns) carregados automaticamente da licitação!`);
    } else if (itens.length === 0) {
      toast.info('Nenhum item extraído encontrado para esta licitação. Adicione manualmente.');
    }
  };

  const handleClear = () => {
    setSelectedId(null);
    setLicitacaoNumero('');
    setLicitacaoOrgao('');
    setItensCount(0);
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          Vincular à Licitação (preenchimento automático)
        </h4>
        {selectedId && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground h-7 text-xs">
            <Trash2 className="w-3 h-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {selectedId ? (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {licitacaoNumero} — {licitacaoOrgao}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {licitacoes.find(l => l.id === selectedId)?.objeto?.slice(0, 100)}
              </p>
            </div>
            <Badge className="bg-accent/20 text-accent border-accent/30 shrink-0">
              {itensCount} {itensCount === 1 ? 'item' : 'itens'}
            </Badge>
          </div>
          {itensCount > 0 && (
            <p className="text-[10px] text-accent">
              ✓ Itens preenchidos automaticamente. Você pode editar, adicionar ou excluir itens livremente.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground">
            Selecione uma licitação do sistema para preencher automaticamente os itens (descrição, quantidade, unidade e valores de referência).
          </p>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Filtrar por Nº da Licitação</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filterNumero}
                  onChange={e => setFilterNumero(e.target.value)}
                  placeholder="Ex: PE 001/2026"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Filtrar por Órgão</Label>
              {orgaosUnicos.length > 0 ? (
                <Select value={filterOrgao} onValueChange={setFilterOrgao}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgaosUnicos.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={filterOrgao}
                  onChange={e => setFilterOrgao(e.target.value)}
                  placeholder="Ex: Prefeitura de Belém"
                  className="mt-1"
                />
              )}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasActiveFilter ? (
            <div className="text-center py-4 border border-dashed border-border/50 rounded-lg">
              <Search className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Preencha os dois filtros para localizar a licitação desejada.</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Informe o Nº da Licitação e selecione/digite o Órgão.</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/30 rounded-lg p-2">
              {filtered.map(l => (
                <button
                  key={l.id}
                  onClick={() => handleSelect(l.id)}
                  disabled={loadingItens}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-accent/10 transition-colors border border-transparent hover:border-accent/20 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                        {l.numero || 'Sem número'}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{l.orgao}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {l.modalidade && (
                        <Badge variant="outline" className="text-[9px] h-5">{l.modalidade}</Badge>
                      )}
                      {l.valor_estimado && l.valor_estimado > 0 && (
                        <span className="text-[10px] font-medium text-accent">
                          R$ {l.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{l.objeto}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">Nenhuma licitação encontrada com os filtros aplicados.</p>
            </div>
          )}

          {/* Manual fallback */}
          <div className="border-t border-border/30 pt-3">
            <p className="text-[10px] text-muted-foreground mb-2">Ou preencha manualmente:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº da Licitação</Label>
                <Input value={licitacaoNumero} onChange={e => setLicitacaoNumero(e.target.value)} placeholder="Ex: PE 001/2026" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Órgão</Label>
                <Input value={licitacaoOrgao} onChange={e => setLicitacaoOrgao(e.target.value)} placeholder="Ex: Prefeitura de Belém" className="mt-1" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
