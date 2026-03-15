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
  url_edital?: string | null;
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

  const [favoritosKeys, setFavoritosKeys] = useState<Set<string>>(new Set());

  // Load licitações vinculadas ao fluxo (monitoramento/favoritos/gestão)
  const fetchLicitacoes = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [licitacoesResp, favoritosResp] = await Promise.all([
      supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, modalidade, valor_estimado, url_edital')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('editais_favoritos')
        .select('numero, orgao')
        .eq('user_id', user.id),
    ]);

    if (licitacoesResp.error) {
      console.error('Erro ao buscar licitações:', licitacoesResp.error);
    } else {
      setLicitacoes((licitacoesResp.data as unknown as LicitacaoResumo[]) || []);
    }

    if (favoritosResp.error) {
      console.error('Erro ao buscar editais marcados:', favoritosResp.error);
      setFavoritosKeys(new Set());
    } else {
      const keys = new Set(
        (favoritosResp.data || []).map((f) => `${(f.numero || '').trim().toLowerCase()}|${(f.orgao || '').trim().toLowerCase()}`)
      );
      setFavoritosKeys(keys);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLicitacoes();
  }, [fetchLicitacoes]);

  const licitacoesMarcadas = favoritosKeys.size > 0
    ? licitacoes.filter((l) => favoritosKeys.has(`${(l.numero || '').trim().toLowerCase()}|${(l.orgao || '').trim().toLowerCase()}`))
    : licitacoes;

  // Only show results when both filters are active
  const numeroFiltro = filterNumero.trim();
  const orgaoFiltro = filterOrgao.trim();
  const hasActiveFilter = numeroFiltro.length > 0 && orgaoFiltro.length > 0;

  // Filter licitacoes
  const filtered = hasActiveFilter
    ? licitacoesMarcadas.filter(l => {
        const matchNumero = l.numero?.toLowerCase().includes(numeroFiltro.toLowerCase());
        const matchOrgao = l.orgao?.toLowerCase().includes(orgaoFiltro.toLowerCase());
        return matchNumero && matchOrgao;
      })
    : [];

  // Unique orgaos for filter
  const orgaosUnicos = [...new Set(licitacoesMarcadas.map(l => l.orgao).filter(Boolean))].sort();

  // Select licitacao and load items
  const handleSelect = async (licitacaoId: string) => {
    const lic = licitacoes.find(l => l.id === licitacaoId);
    if (!lic) return;

    setSelectedId(licitacaoId);
    setLicitacaoNumero(lic.numero || '');
    setLicitacaoOrgao(lic.orgao || '');

    // Fetch existing items from licitacao_itens
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

    const existingItens: LicitacaoItemAutoFill[] = ((itensData as any[]) || []).map(i => ({
      descricao: i.descricao || '',
      quantidade: i.quantidade || 1,
      unidade: i.unidade || 'UN',
      valorUnitario: i.valor_unitario || 0,
      valorTotal: i.valor_total || 0,
      lote: i.lote || 'Único',
    }));

    setLoadingItens(false);

    if (existingItens.length > 0) {
      setItensCount(existingItens.length);
      if (onItensLoaded) onItensLoaded(existingItens);
      toast.success(`${existingItens.length} item(ns) carregados automaticamente da licitação!`);
      return;
    }

    // No items found — try to auto-extract from edital document
    toast.info('Nenhum item encontrado. Buscando edital para extração automática via IA...');
    setExtracting(true);

    try {
      // Look for edital documents associated with this licitação
      const { data: docs } = await supabase
        .from('documentos')
        .select('arquivo_path, nome, tipo')
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      let editalText = '';

      if (docs && docs.length > 0) {
        // Try to download and read the first edital document
        for (const doc of docs) {
          if (doc.arquivo_path) {
            try {
              const { data: fileData } = await supabase.storage
                .from('documentos')
                .download(doc.arquivo_path);
              if (fileData) {
                editalText = await fileData.text();
                if (editalText.length > 100) break;
              }
            } catch {
              // continue to next document
            }
          }
        }
      }

      // If no document text, use the objeto field as base for extraction
      if (!editalText || editalText.length < 100) {
        editalText = `Licitação: ${lic.numero}\nÓrgão: ${lic.orgao}\nObjeto: ${lic.objeto}\nModalidade: ${lic.modalidade || 'N/I'}\nValor Estimado: R$ ${lic.valor_estimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/I'}`;
      }

      const extracted = await extrairItensIA(licitacaoId, editalText);

      if (extracted.length > 0) {
        const mappedItens: LicitacaoItemAutoFill[] = extracted.map(i => ({
          descricao: i.descricao || '',
          quantidade: i.quantidade || 1,
          unidade: i.unidade || 'UN',
          valorUnitario: i.valor_unitario || 0,
          valorTotal: i.valor_total || 0,
          lote: i.lote || 'Único',
        }));
        setItensCount(mappedItens.length);
        if (onItensLoaded) onItensLoaded(mappedItens);
      } else {
        setItensCount(0);
        toast.info('Não foi possível extrair itens automaticamente. Adicione manualmente na planilha abaixo.');
      }
    } catch (err) {
      console.error('Erro na extração automática:', err);
      toast.error('Erro ao tentar extrair itens automaticamente.');
      setItensCount(0);
    } finally {
      setExtracting(false);
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
            {extracting ? (
              <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 text-accent shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {licitacaoNumero} — {licitacaoOrgao}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {licitacoes.find(l => l.id === selectedId)?.objeto?.slice(0, 100)}
              </p>
            </div>
            {extracting ? (
              <Badge className="bg-accent/20 text-accent border-accent/30 shrink-0">
                <Brain className="w-3 h-3 mr-1" /> Extraindo...
              </Badge>
            ) : (
              <Badge className="bg-accent/20 text-accent border-accent/30 shrink-0">
                {itensCount} {itensCount === 1 ? 'item' : 'itens'}
              </Badge>
            )}
          </div>
          {extracting && (
            <p className="text-[10px] text-accent">
              🤖 A IA está extraindo os itens do edital automaticamente. Aguarde...
            </p>
          )}
          {!extracting && itensCount > 0 && (
            <p className="text-[10px] text-accent">
              ✓ Itens preenchidos automaticamente. Você pode editar, adicionar ou excluir itens livremente.
            </p>
          )}
          {!extracting && itensCount === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Nenhum item extraído. Adicione manualmente na planilha abaixo.
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
