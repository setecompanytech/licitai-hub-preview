import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';
import { useLinkedEditalSource } from '@/hooks/useLinkedEditalSource';
import { isItemsLikelyMismatched } from '@/lib/licitacao-item-consistency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
  licitacaoId?: string | null;
  licitacaoNumero: string;
  setLicitacaoNumero: (v: string) => void;
  licitacaoOrgao: string;
  setLicitacaoOrgao: (v: string) => void;
  onItensLoaded?: (itens: LicitacaoItemAutoFill[]) => void;
  /**
   * O ID do processo escolhido, devolvido a quem usa o seletor.
   *
   * Sem isto, escolher uma licitação aqui mudava apenas o número e o órgão —
   * dois textos. Quem chama continuava com o `licitacaoId` que veio da página,
   * que pode ser outro processo ou nenhum. A tela dizia "vinculado ao processo
   * X" e enviava os itens para o lugar de Y.
   */
  onLicitacaoSelecionada?: (id: string | null, numero: string, orgao: string) => void;
}

export default function LicitacaoSelector({
  licitacaoId = null,
  licitacaoNumero,
  setLicitacaoNumero,
  licitacaoOrgao,
  setLicitacaoOrgao,
  onItensLoaded,
  onLicitacaoSelecionada,
}: LicitacaoSelectorProps) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { extrairItensIA, deleteAllItens, fetchItens } = useEditalExtraction();
  const { fetchLinkedLicitacao, findPncpCacheMatch, resolveLinkedEditalText } = useLinkedEditalSource();
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

    /**
     * Só processo que ocupa a mesa.
     *
     * A lista trazia TUDO o que já passou por `licitacoes`, sem olhar
     * `arquivado_em` nem status — processos mortos, encerrados há meses,
     * misturados com os de hoje. Quem vai precificar escolhia entre doze
     * nomes sem saber quais ainda existem.
     *
     * O critério é o mesmo do Kanban e do seletor de Processo Ativo
     * (`useProcessoAtivo`): não arquivado. `arquivado_em` vence qualquer
     * status — processo homologado e arquivado está no Arquivo, e continua
     * homologado. Ver src/lib/licitacao/status.ts.
     */
    const [licitacoesResp, favoritosResp] = await Promise.all([
      (empresaAtiva
        ? supabase.from('licitacoes').select('id, numero, orgao, objeto, modalidade, valor_estimado, url_edital, status, prazo_final').eq('empresa_id', empresaAtiva.id)
        : supabase.from('licitacoes').select('id, numero, orgao, objeto, modalidade, valor_estimado, url_edital, status, prazo_final'))
        .is('arquivado_em', null)
        .neq('status', 'Arquivada')
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
  }, [user, empresaAtiva]);

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

  const handleSelect = useCallback(async (targetLicitacaoId: string) => {
    if (!user) return;

    const lic = licitacoesMarcadas.find((item) => item.id === targetLicitacaoId)
      || await fetchLinkedLicitacao(targetLicitacaoId);
    if (!lic) return;

    setSelectedId(targetLicitacaoId);
    setLicitacaoNumero(lic.numero || '');
    setLicitacaoOrgao(lic.orgao || '');
    onLicitacaoSelecionada?.(targetLicitacaoId, lic.numero || '', lic.orgao || '');
    setLoadingItens(true);

    const [docsResp, rawItensResp, existingItens] = await Promise.all([
      supabase
        .from('documentos')
        .select('id, arquivo_path, nome, tipo, created_at')
        .eq('licitacao_id', targetLicitacaoId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('licitacao_itens')
        .select('descricao, quantidade, unidade, valor_unitario, valor_total, lote, origem')
        // Itens são do processo (empresa); o RLS decide quem lê.
        .eq('licitacao_id', targetLicitacaoId)
        .order('numero', { ascending: true }),
      fetchItens(targetLicitacaoId),
    ]);

    setLoadingItens(false);

    if (docsResp.error) {
      console.error('Erro ao buscar documentos da licitação:', docsResp.error);
    }

    if (rawItensResp.error) {
      console.error('Erro ao buscar itens brutos:', rawItensResp.error);
    }

    const docs = docsResp.data || [];
    const hasLinkedDocument = docs.some((doc) => doc.arquivo_path);
    const rawExistingItens = (rawItensResp.data as any[]) || [];
    const existingAreOnlyAi = rawExistingItens.length > 0 && rawExistingItens.every((item) => item.origem === 'ia');
    const shouldPurgeStaleAiItems = rawExistingItens.length > 0 && existingAreOnlyAi && !hasLinkedDocument;
    const shouldPurgeMismatchedItems = isItemsLikelyMismatched(lic.objeto, rawExistingItens.map((item) => item.descricao));

    // Itens de outra pessoa não saem daqui (o aviso é do próprio deleteAllItens);
    // sem a limpeza, o fluxo segue com o que existe em vez de fingir que limpou.
    if ((shouldPurgeStaleAiItems || shouldPurgeMismatchedItems) && (await deleteAllItens(targetLicitacaoId))) {
      setItensCount(0);
      onItensLoaded?.([]);
      toast.warning(
        shouldPurgeMismatchedItems
          ? 'Itens incompatíveis com o objeto deste processo foram removidos automaticamente.'
          : 'Itens automáticos antigos foram removidos porque não havia um edital confiável vinculado.'
      );
    } else if (existingItens.length > 0) {
      setItensCount(existingItens.length);
      onItensLoaded?.(mapItensToAutofill(existingItens));
      toast.success(`${existingItens.length} item(ns) carregados automaticamente da licitação!`);
      return;
    }

    toast.info('Buscando itens do edital...');
    setExtracting(true);

    try {
      // ══════════ CAMADA 1: API PNCP (itens estruturados) ══════════
      const cacheMatch = await findPncpCacheMatch({ numero: lic.numero, orgao: lic.orgao } as LicitacaoResumo);
      const cnpjOrgao = cacheMatch?.cnpj_orgao || undefined;
      const anoCompra = cacheMatch?.ano_compra || undefined;
      const sequencialCompra = cacheMatch?.sequencial_compra || undefined;
      const numeroControle = cacheMatch?.numero_controle_pncp || undefined;

      if (cnpjOrgao && anoCompra && sequencialCompra) {
        console.log('[LicitacaoSelector] Tentando CAMADA 1 - API PNCP itens...');

        try {
          const { data: pncpResult, error: pncpError } = await supabase.functions.invoke('extrair-itens-edital', {
            body: {
              numero_controle: numeroControle,
              orgao_cnpj: cnpjOrgao,
              ano_compra: parseInt(anoCompra),
              sequencial: parseInt(sequencialCompra),
            },
          });

          if (!pncpError && pncpResult?.success && pncpResult.data?.length > 0) {
            const fonte = pncpResult.fonte || 'PNCP_API';
            const pncpItens = pncpResult.data;

            // Save to licitacao_itens for persistence
            const itemsToSave = pncpItens.map((p: any, idx: number) => ({
              licitacao_id: targetLicitacaoId,
              user_id: user.id,
              numero: parseInt(String(p.item ?? idx + 1), 10) || (idx + 1),
              descricao: p.descricao || '',
              quantidade: p.quantidade || 1,
              unidade: p.unidade || 'UN',
              valor_unitario: p.valor_unitario || 0,
              valor_total: p.valor_total || (p.valor_unitario || 0) * (p.quantidade || 1),
              lote: p.lote || 'Único',
              marca: p.marca || null,
              fabricante: p.fabricante || null,
              modelo: p.modelo || null,
              origem: fonte === 'PNCP_API' ? 'pncp' : 'ia',
            }));

            // Gravar por cima de itens que não puderam ser apagados (são de
            // outra pessoa) duplicaria a planilha. O aviso já foi dado.
            if (!(await deleteAllItens(targetLicitacaoId))) return;
            const { data: savedItens } = await supabase
              .from('licitacao_itens')
              .insert(itemsToSave)
              .select();

            if (savedItens && savedItens.length > 0) {
              const mappedItens = mapItensToAutofill(savedItens);
              setItensCount(mappedItens.length);
              onItensLoaded?.(mappedItens);
              const fonteLabel = fonte === 'PNCP_API' ? 'API PNCP Oficial' : 'IA';
              toast.success(`${mappedItens.length} itens extraídos via ${fonteLabel}!`);
              return;
            }
          }

          // If PNCP returned a pdf_url, log it
          if (pncpResult?.pdf_url) {
            console.log('[LicitacaoSelector] PDF do edital disponível:', pncpResult.pdf_url);
          }
        } catch (pncpErr) {
          console.warn('[LicitacaoSelector] CAMADA 1 falhou:', pncpErr);
        }
      }

      // ══════════ CAMADA 2: Extração via texto do edital (IA) ══════════
      console.log('[LicitacaoSelector] CAMADA 2 - Extração via texto/PDF...');

      const resolvedEdital = await resolveLinkedEditalText(targetLicitacaoId);
      const editalText = resolvedEdital.text;

      const textLength = editalText?.trim().length || 0;
      if (!editalText || textLength < 50) {
        setItensCount(0);
        onItensLoaded?.([]);
        toast.warning('Não foi possível obter o edital completo. Adicione manualmente na planilha abaixo.');
        return;
      }

      const shouldSkipValidation = textLength < 500;
      const extracted = await extrairItensIA(targetLicitacaoId, editalText, { forceReExtract: true, skipValidation: shouldSkipValidation });

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
        toast.info('Não foi possível extrair itens automaticamente. Adicione manualmente na planilha abaixo.');
      }
    } catch (err) {
      console.error('Erro na extração automática:', err);
      toast.error('Erro ao tentar extrair itens automaticamente.');
      setItensCount(0);
      onItensLoaded?.([]);
    } finally {
      setExtracting(false);
    }
  }, [user, licitacoesMarcadas, fetchLinkedLicitacao, setLicitacaoNumero, setLicitacaoOrgao, deleteAllItens, onItensLoaded, findPncpCacheMatch, resolveLinkedEditalText, extrairItensIA]);

  useEffect(() => {
    if (!licitacaoId || !user || loading || loadingItens || extracting || selectedId === licitacaoId) return;

    const lic = licitacoesMarcadas.find((item) => item.id === licitacaoId);
    if (lic?.orgao) setFilterOrgao(lic.orgao);
    if (lic?.numero) setFilterNumero(lic.numero);

    handleSelect(licitacaoId);
  }, [licitacaoId, user, loading, loadingItens, extracting, selectedId, licitacoesMarcadas, handleSelect]);

  const handleClear = () => {
    setSelectedId(null);
    setLicitacaoNumero('');
    setLicitacaoOrgao('');
    setItensCount(0);
    onItensLoaded?.([]);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Vincular à Licitação (preenchimento automático)
        </h4>
        {selectedId && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <Trash2 aria-hidden="true" /> Limpar
          </Button>
        )}
      </div>

      {/* Trabalhando DENTRO de uma pasta, o seletor não oferece outros
          processos: cada pasta é própria e não compartilha dados. O escolhedor
          (órgão → processo) só existe no uso avulso, sem vínculo. */}
      {licitacaoId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary-line bg-primary-tint px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">
            Itens vindos <span className="font-medium text-foreground">deste processo</span> — a calculadora
            opera apenas sobre a pasta aberta.
          </span>
          <Badge variant="success" className="ml-auto">
            Processo vinculado sincronizado
          </Badge>
        </div>
      ) : (
      <>
      <p className="text-sm text-muted-foreground">
        Selecione uma licitação marcada no sistema para preencher automaticamente os itens (descrição, quantidade, unidade e valores de referência).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="tabular-nums">
          {licitacoesMarcadas.length} processo(s) disponível(is)
        </Badge>
        {favoritosKeys.size > 0 && (
          <span className="text-xs text-muted-foreground">Editais marcados aparecem primeiro na lista.</span>
        )}
      </div>

      {/* Filters — rótulo acima do campo, controles de 40px. */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lic-orgao">1. Selecione o Órgão</Label>
          {orgaosUnicos.length > 0 ? (
            <Select value={filterOrgao} onValueChange={(v) => { setFilterOrgao(v); setFilterNumero(''); }}>
              <SelectTrigger id="lic-orgao">
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
              id="lic-orgao"
              value={filterOrgao}
              onChange={e => setFilterOrgao(e.target.value)}
              placeholder="Ex: Prefeitura de Belém"
            />
          )}
        </div>
        {hasActiveFilter && filtered.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="lic-numero">2. Refinar por Nº (opcional)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="lic-numero"
                value={filterNumero}
                onChange={e => setFilterNumero(e.target.value)}
                placeholder="Ex: PE 001/2026"
                className="pl-9"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando processos">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : licitacoesMarcadas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EstadoVazio tamanho="compacto" titulo="Nenhum processo marcado foi encontrado para este usuário." />
        </div>
      ) : !hasActiveFilter ? (
        <div className="rounded-lg border border-dashed border-border">
          <EstadoVazio tamanho="compacto" icone={<Search />} titulo="Selecione um órgão acima para visualizar os processos vinculados." />
        </div>
      ) : filtered.length > 0 ? (
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
          {filtered.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => handleSelect(l.id)}
              disabled={loadingItens || extracting}
              className="group w-full rounded-md border border-transparent p-2.5 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {l.numero || 'Sem número'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{l.orgao}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {l.modalidade && (
                    <Badge variant="outline">{l.modalidade}</Badge>
                  )}
                  {l.valor_estimado && l.valor_estimado > 0 && (
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      R$ {l.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <Download className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{l.objeto}</p>
            </button>
          ))}
        </div>
      ) : (
        <EstadoVazio tamanho="compacto" titulo="Nenhuma licitação encontrada com os filtros aplicados." />
      )}
      </>
      )}

      {selectedId && (
        <div className="space-y-2 rounded-md border border-border bg-secondary p-3">
          <div className="flex flex-wrap items-center gap-2">
            {extracting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {licitacaoNumero} — {licitacaoOrgao}
              </p>
              <p className="text-xs text-muted-foreground">
                {licitacoesMarcadas.find(l => l.id === selectedId)?.objeto?.slice(0, 100)}
              </p>
            </div>
            {extracting ? (
              <Badge variant="ia" className="shrink-0">
                <Brain className="h-3 w-3" aria-hidden="true" /> Extraindo...
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {itensCount} {itensCount === 1 ? 'item' : 'itens'}
              </Badge>
            )}
          </div>
          {extracting && (
            <p className="text-xs text-muted-foreground">
              🤖 A IA está extraindo os itens do edital automaticamente. Aguarde...
            </p>
          )}
          {!extracting && itensCount > 0 && (
            <p className="text-xs text-success-ink">
              ✓ Itens preenchidos automaticamente. Você pode editar, adicionar ou excluir itens livremente.
            </p>
          )}
          {!extracting && itensCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum item extraído. Adicione manualmente na planilha abaixo.
            </p>
          )}
        </div>
      )}

      {/* Manual fallback */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm text-muted-foreground">Ou preencha manualmente:</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lic-manual-numero">Nº da Licitação</Label>
            <Input id="lic-manual-numero" value={licitacaoNumero} onChange={e => setLicitacaoNumero(e.target.value)} placeholder="Ex: PE 001/2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lic-manual-orgao">Órgão</Label>
            <Input id="lic-manual-orgao" value={licitacaoOrgao} onChange={e => setLicitacaoOrgao(e.target.value)} placeholder="Ex: Prefeitura de Belém" />
          </div>
        </div>
      </div>
    </div>
  );
}
