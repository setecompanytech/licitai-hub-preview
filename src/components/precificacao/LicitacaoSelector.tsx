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
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

type LicitacaoResumo = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  url_edital?: string | null;
};

type DownloadEditalResponse = {
  success?: boolean;
  error?: string;
  tipo?: 'arquivo_direto' | 'download_urls';
  arquivo?: {
    nome?: string;
    conteudo_base64?: string;
    content_type?: string;
  };
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

function base64ToBlob(base64: string, contentType = 'application/pdf'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
}

export default function LicitacaoSelector({
  licitacaoNumero,
  setLicitacaoNumero,
  licitacaoOrgao,
  setLicitacaoOrgao,
  onItensLoaded,
}: LicitacaoSelectorProps) {
  const { user } = useAuth();
  const { extrairItensIA, deleteAllItens } = useEditalExtraction();
  const [licitacoes, setLicitacoes] = useState<LicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItens, setLoadingItens] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itensCount, setItensCount] = useState<number>(0);
  const [filterNumero, setFilterNumero] = useState('');
  const [filterOrgao, setFilterOrgao] = useState('');
  const [favoritosKeys, setFavoritosKeys] = useState<Set<string>>(new Set());

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

  const getLicitacaoKey = (numero?: string, orgao?: string) => `${(numero || '').trim().toLowerCase()}|${(orgao || '').trim().toLowerCase()}`;

  const licitacoesMarcadas = [...licitacoes].sort((a, b) => {
    const aFav = favoritosKeys.has(getLicitacaoKey(a.numero, a.orgao));
    const bFav = favoritosKeys.has(getLicitacaoKey(b.numero, b.orgao));
    if (aFav === bFav) return 0;
    return aFav ? -1 : 1;
  });

  const numeroFiltro = filterNumero.trim();
  const orgaoFiltro = filterOrgao.trim();
  const hasActiveFilter = orgaoFiltro.length > 0;

  const filtered = hasActiveFilter
    ? licitacoesMarcadas.filter((l) => {
        const matchOrgao = l.orgao?.toLowerCase().includes(orgaoFiltro.toLowerCase());
        if (!matchOrgao) return false;
        if (numeroFiltro.length > 0) {
          return l.numero?.toLowerCase().includes(numeroFiltro.toLowerCase());
        }
        return true;
      })
    : [];

  const orgaosUnicos = [...new Set(licitacoesMarcadas.map((l) => l.orgao).filter(Boolean))].sort();

  const mapItensToAutofill = (itensData: any[]): LicitacaoItemAutoFill[] => {
    return (itensData || []).map((i) => ({
      descricao: i.descricao || '',
      quantidade: i.quantidade || 1,
      unidade: i.unidade || 'UN',
      valorUnitario: i.valor_unitario || 0,
      valorTotal: i.valor_total || 0,
      lote: i.lote || 'Único',
    }));
  };

  const tryDownloadOfficialEdital = useCallback(async (lic: LicitacaoResumo): Promise<string> => {
    if (!lic.url_edital) return '';

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return '';

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numero: lic.numero,
          url: lic.url_edital,
          orgao: lic.orgao,
          objeto: lic.objeto,
        }),
      });

      const data = (await response.json()) as DownloadEditalResponse;
      if (!response.ok || !data?.success || data.tipo !== 'arquivo_direto' || !data.arquivo?.conteudo_base64) {
        return '';
      }

      const fileBlob = base64ToBlob(data.arquivo.conteudo_base64, data.arquivo.content_type || 'application/pdf');
      return extractTextFromBlob(fileBlob, data.arquivo.nome || 'edital.pdf');
    } catch (error) {
      console.error('Erro ao baixar edital oficial para extração:', error);
      return '';
    }
  }, []);

  const handleSelect = async (licitacaoId: string) => {
    if (!user) return;

    const lic = licitacoesMarcadas.find((item) => item.id === licitacaoId);
    if (!lic) return;

    setSelectedId(licitacaoId);
    setLicitacaoNumero(lic.numero || '');
    setLicitacaoOrgao(lic.orgao || '');
    setLoadingItens(true);

    const [docsResp, itensResp] = await Promise.all([
      supabase
        .from('documentos')
        .select('id, arquivo_path, nome, tipo, created_at')
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('licitacao_itens')
        .select('descricao, quantidade, unidade, valor_unitario, valor_total, lote, origem')
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id)
        .order('numero', { ascending: true }),
    ]);

    setLoadingItens(false);

    if (docsResp.error) {
      console.error('Erro ao buscar documentos da licitação:', docsResp.error);
    }

    if (itensResp.error) {
      console.error('Erro ao buscar itens:', itensResp.error);
      toast.error('Erro ao buscar itens da licitação.');
      return;
    }

    const docs = docsResp.data || [];
    const hasLinkedDocument = docs.some((doc) => doc.arquivo_path);
    const rawExistingItens = (itensResp.data as any[]) || [];
    const existingItens = mapItensToAutofill(rawExistingItens);
    const existingAreOnlyAi = rawExistingItens.length > 0 && rawExistingItens.every((item) => item.origem === 'ia');
    const shouldPurgeStaleAiItems = existingItens.length > 0 && existingAreOnlyAi && !hasLinkedDocument;

    if (shouldPurgeStaleAiItems) {
      await deleteAllItens(licitacaoId);
      setItensCount(0);
      onItensLoaded?.([]);
      toast.warning('Itens automáticos antigos foram removidos porque não havia um edital confiável vinculado.');
    } else if (existingItens.length > 0) {
      setItensCount(existingItens.length);
      onItensLoaded?.(existingItens);
      toast.success(`${existingItens.length} item(ns) carregados automaticamente da licitação!`);
      return;
    }

    toast.info('Nenhum item estruturado confiável foi encontrado. Iniciando extração automática do edital...');
    setExtracting(true);

    try {
      let editalText = '';

      for (const doc of docs) {
        if (!doc.arquivo_path) continue;

        try {
          const { data: fileData } = await supabase.storage.from('documentos').download(doc.arquivo_path);
          if (!fileData) continue;

          const extractedText = await extractTextFromBlob(fileData, doc.nome || doc.arquivo_path);
          if (extractedText.length >= 500) {
            editalText = extractedText;
            break;
          }
        } catch (error) {
          console.error('Erro ao ler documento vinculado:', error);
        }
      }

      if (!editalText.trim()) {
        editalText = await tryDownloadOfficialEdital(lic);
      }

      if (!editalText || editalText.trim().length < 500) {
        setItensCount(0);
        onItensLoaded?.([]);
        toast.warning('Não foi possível obter o edital completo. Adicione manualmente na planilha abaixo.');
        return;
      }

      const extracted = await extrairItensIA(licitacaoId, editalText, { forceReExtract: true });

      if (extracted.length > 0) {
        const mappedItens: LicitacaoItemAutoFill[] = extracted.map((item) => ({
          descricao: item.descricao || '',
          quantidade: item.quantidade || 1,
          unidade: item.unidade || 'UN',
          valorUnitario: item.valor_unitario || 0,
          valorTotal: item.valor_total || 0,
          lote: item.lote || 'Único',
        }));

        setItensCount(mappedItens.length);
        onItensLoaded?.(mappedItens);
      } else {
        setItensCount(0);
        onItensLoaded?.([]);
        toast.info('Não foi possível extrair itens automaticamente desta licitação com fidelidade.');
      }
    } catch (err) {
      console.error('Erro na extração automática:', err);
      toast.error('Erro ao tentar extrair itens automaticamente.');
      setItensCount(0);
      onItensLoaded?.([]);
    } finally {
      setExtracting(false);
    }
  };

  const handleClear = () => {
    setSelectedId(null);
    setLicitacaoNumero('');
    setLicitacaoOrgao('');
    setItensCount(0);
    onItensLoaded?.([]);
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

      <p className="text-[10px] text-muted-foreground">
        Selecione uma licitação marcada no sistema para preencher automaticamente os itens (descrição, quantidade, unidade e valores de referência).
      </p>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {licitacoesMarcadas.length} processo(s) disponível(is)
        </Badge>
        {favoritosKeys.size > 0 && (
          <span className="text-[10px] text-muted-foreground">Editais marcados aparecem primeiro na lista.</span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs">1. Selecione o Órgão</Label>
          {orgaosUnicos.length > 0 ? (
            <Select value={filterOrgao} onValueChange={(v) => { setFilterOrgao(v); setFilterNumero(''); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o órgão para ver os processos vinculados" />
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
        {hasActiveFilter && filtered.length > 1 && (
          <div>
            <Label className="text-xs">2. Refinar por Nº (opcional)</Label>
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
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : licitacoesMarcadas.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-border/50 rounded-lg">
          <p className="text-xs text-muted-foreground">Nenhum processo marcado foi encontrado para este usuário.</p>
        </div>
      ) : !hasActiveFilter ? (
        <div className="text-center py-4 border border-dashed border-border/50 rounded-lg">
          <Search className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Selecione um órgão acima para visualizar os processos vinculados.</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/30 rounded-lg p-2">
          {filtered.map(l => (
            <button
              key={l.id}
              onClick={() => handleSelect(l.id)}
              disabled={loadingItens || extracting}
              className="w-full text-left p-2.5 rounded-lg hover:bg-accent/10 transition-colors border border-transparent hover:border-accent/20 group disabled:opacity-70"
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

      {selectedId && (
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
                {licitacoesMarcadas.find(l => l.id === selectedId)?.objeto?.slice(0, 100)}
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
    </div>
  );
}
