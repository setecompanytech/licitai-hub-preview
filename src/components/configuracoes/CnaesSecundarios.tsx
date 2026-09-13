import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Tag, Search, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const cnaesPopulares = [
  { codigo: '42.11-1', descricao: 'Construção de rodovias e ferrovias' },
  { codigo: '42.13-8', descricao: 'Obras de urbanização' },
  { codigo: '42.22-7', descricao: 'Redes de abastecimento de água e esgoto' },
  { codigo: '41.20-4', descricao: 'Construção de edifícios' },
  { codigo: '43.30-4', descricao: 'Obras de fundações' },
  { codigo: '43.13-4', descricao: 'Obras de terraplenagem' },
  { codigo: '42.91-0', descricao: 'Obras portuárias, marítimas e fluviais' },
  { codigo: '42.92-8', descricao: 'Montagem de instalações industriais' },
  { codigo: '43.21-5', descricao: 'Instalação elétrica' },
  { codigo: '43.22-3', descricao: 'Instalações hidráulicas e sanitárias' },
  { codigo: '43.99-1', descricao: 'Serviços especializados para construção' },
  { codigo: '71.12-0', descricao: 'Serviços de engenharia' },
];

type CnaeItem = { codigo: string; descricao: string };

const SEARCH_MIN_LENGTH = 2;

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCnaeCode(value: string) {
  const digits = normalizeDigits(value);

  if (digits.length === 7) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}`;
  }

  return value.trim();
}

function parseCnaeValue(value: string): CnaeItem | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([\d.\-\/]+)\s*[–-]\s*(.+)$/);
  if (match) {
    return {
      codigo: formatCnaeCode(match[1]),
      descricao: match[2].trim(),
    };
  }

  const codeOnly = formatCnaeCode(trimmed);
  if (normalizeDigits(codeOnly).length >= 5) {
    return { codigo: codeOnly, descricao: '' };
  }

  return null;
}

function buildCnaeLabel(cnae: CnaeItem) {
  return cnae.descricao ? `${formatCnaeCode(cnae.codigo)} - ${cnae.descricao}` : formatCnaeCode(cnae.codigo);
}

function dedupeCnaes(items: CnaeItem[]) {
  const map = new Map<string, CnaeItem>();

  for (const item of items) {
    const key = normalizeDigits(item.codigo);
    if (!key) continue;

    const normalizedItem = {
      codigo: formatCnaeCode(item.codigo),
      descricao: item.descricao.trim(),
    };

    const existing = map.get(key);
    if (!existing || (!existing.descricao && normalizedItem.descricao)) {
      map.set(key, normalizedItem);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function parseCnaesFromEmpresa(values?: string[] | null) {
  return dedupeCnaes((values || []).map(parseCnaeValue).filter((item): item is CnaeItem => Boolean(item)));
}

function extractCnaesFromConsulta(data: any) {
  const rawSecundarios = data?.cnaesSecundarios || data?.cnaes_secundarios || [];
  const normalized: CnaeItem[] = [];

  if (Array.isArray(rawSecundarios)) {
    rawSecundarios.forEach((item: unknown) => {
      if (typeof item === 'string') {
        const parsed = parseCnaeValue(item);
        if (parsed) normalized.push(parsed);
        return;
      }

      if (item && typeof item === 'object') {
        const code = 'codigo' in item ? String((item as { codigo?: unknown }).codigo || '') : '';
        const descricao = 'descricao' in item ? String((item as { descricao?: unknown }).descricao || '') : '';
        if (code) normalized.push({ codigo: formatCnaeCode(code), descricao: descricao.trim() });
      }
    });
  }

  return dedupeCnaes(normalized);
}

export default function CnaesSecundarios() {
  const { empresaAtiva, reloadEmpresas } = useEmpresa();
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [busca, setBusca] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [sugestoesIA, setSugestoesIA] = useState<CnaeItem[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<CnaeItem[]>([]);
  const autoSyncKeyRef = useRef<string>('');

  const cnaePrincipal = empresaAtiva?.cnae_principal || '';

  const empresaCnaes = useMemo(
    () => parseCnaesFromEmpresa(empresaAtiva?.cnaes_secundarios),
    [empresaAtiva?.cnaes_secundarios],
  );

  useEffect(() => {
    setCnaes(empresaCnaes);
  }, [empresaCnaes]);

  const persistCnaes = useCallback(async (nextCnaes: CnaeItem[], successMessage?: string) => {
    if (!empresaAtiva) return;

    const payload = nextCnaes.map(buildCnaeLabel);
    const { error } = await supabase
      .from('empresas')
      .update({ cnaes_secundarios: payload } as any)
      .eq('id', empresaAtiva.id);

    if (error) {
      throw error;
    }

    await reloadEmpresas();

    if (successMessage) {
      toast.success(successMessage);
    }
  }, [empresaAtiva, reloadEmpresas]);

  const syncFromCnpj = useCallback(async (options?: { silent?: boolean }) => {
    if (!empresaAtiva?.cnpj) {
      toast.error('Nenhuma empresa ativa com CNPJ válido.');
      return;
    }

    setLoadingSync(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: empresaAtiva.cnpj.replace(/\D/g, '') },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Also update cnae_principal if returned and currently empty
      const cnaePrincipalRetornado = data?.cnaePrincipal || '';
      if (cnaePrincipalRetornado && !empresaAtiva.cnae_principal) {
        await supabase
          .from('empresas')
          .update({ cnae_principal: cnaePrincipalRetornado } as any)
          .eq('id', empresaAtiva.id);
      }

      const imported = extractCnaesFromConsulta(data);
      if (imported.length === 0 && !cnaePrincipalRetornado) {
        if (!options?.silent) toast.info('Nenhum CNAE foi encontrado no CNPJ.');
        return;
      }

      if (imported.length > 0) {
        setCnaes(imported);
        await persistCnaes(imported);
      }

      await reloadEmpresas();

      if (!options?.silent) {
        const msgs: string[] = [];
        if (cnaePrincipalRetornado && !empresaAtiva.cnae_principal) msgs.push('CNAE principal atualizado');
        if (imported.length > 0) msgs.push(`${imported.length} CNAEs secundários sincronizados`);
        toast.success(msgs.join(' · ') || 'Dados sincronizados do CNPJ');
      }
    } catch (error: any) {
      console.error('CNPJ CNAE sync error:', error);
      if (!options?.silent) toast.error(error.message || 'Erro ao sincronizar CNAEs do CNPJ');
    } finally {
      setLoadingSync(false);
    }
  }, [empresaAtiva?.cnpj, empresaAtiva?.cnae_principal, empresaAtiva?.id, persistCnaes, reloadEmpresas]);

  useEffect(() => {
    if (!empresaAtiva?.id || !empresaAtiva?.cnpj || empresaCnaes.length > 0) return;

    const syncKey = `${empresaAtiva.id}:${empresaAtiva.cnpj}`;
    if (autoSyncKeyRef.current === syncKey) return;

    autoSyncKeyRef.current = syncKey;
    void syncFromCnpj({ silent: true });
  }, [empresaAtiva?.id, empresaAtiva?.cnpj, empresaCnaes.length, syncFromCnpj]);

  const buscarCnaesIA = async () => {
    if (!cnaePrincipal) {
      toast.error('Cadastre o CNAE Principal primeiro');
      return;
    }
    setLoadingIA(true);
    setSugestoesIA([]);

    try {
      const prompt = `Dado o CNAE principal "${cnaePrincipal}" (${empresaAtiva?.razao_social || ''}), liste os 12 CNAEs secundários mais relevantes e correlatos para participação em licitações públicas brasileiras. Considere CNAEs que ampliem as possibilidades de participação em editais.

Retorne APENAS um JSON puro (sem markdown, sem crases) neste formato:
[{"codigo":"XX.XX-X","descricao":"Descrição da atividade"}]

Use códigos CNAE reais da tabela IBGE/CONCLA. Não invente códigos.`;

      const { streamAIChat } = await import('@/lib/ai-stream');
      let fullText = '';
      let streamErr = '';
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'assistente',
        onDelta: (chunk) => { fullText += chunk; },
        onDone: () => {},
        onError: (err) => { streamErr = err; },
      });
      if (streamErr) throw new Error(streamErr);

      // Extract JSON from response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('A IA não retornou uma lista de CNAEs válida. Tente novamente.');

      const parsed: CnaeItem[] = JSON.parse(jsonMatch[0]);
      const valid = dedupeCnaes(parsed.filter(c => c.codigo && c.descricao).map((item) => ({
        codigo: formatCnaeCode(item.codigo),
        descricao: item.descricao,
      })));

      if (valid.length === 0) throw new Error('Nenhum CNAE retornado');

      // Auto-add first batch, keep rest as suggestions
      const autoAdd = valid.slice(0, 6);
      const extras = valid.slice(6);
      const nextCnaes = dedupeCnaes([...cnaes, ...autoAdd]);

      setCnaes(nextCnaes);
      setSugestoesIA(extras);
      await persistCnaes(nextCnaes, `${autoAdd.length} CNAEs correlatos adicionados via IA`);
    } catch (e: any) {
      console.error('IA CNAE error:', e);
      toast.error('Falha ao buscar CNAEs por IA', {
        description: e.message || 'Verifique sua conexão e tente novamente.',
        duration: 6000,
      });
    } finally {
      setLoadingIA(false);
    }
  };

  useEffect(() => {
    if (!showSugestoes) return;

    const query = busca.trim();
    if (query.length < SEARCH_MIN_LENGTH) {
      setResultadosBusca([]);
      setLoadingBusca(false);
      return;
    }

    let active = true;
    setLoadingBusca(true);

    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('buscar-cnae-ibge', {
          body: { query, limit: 20 },
        });

        if (error) throw error;
        if (!active) return;

        const currentCodes = new Set(cnaes.map((item) => normalizeDigits(item.codigo)));
        const matches = Array.isArray(data?.results)
          ? dedupeCnaes(data.results)
              .filter((item) => !currentCodes.has(normalizeDigits(item.codigo)))
          : [];

        setResultadosBusca(matches);
      } catch (error) {
        console.error('CNAE search error:', error);
        if (active) setResultadosBusca([]);
      } finally {
        if (active) setLoadingBusca(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [busca, cnaes, showSugestoes]);

  const addCnae = async (cnae: CnaeItem) => {
    const nextCnaes = dedupeCnaes([...cnaes, cnae]);
    setCnaes(nextCnaes);
    setSugestoesIA(prev => prev.filter(s => normalizeDigits(s.codigo) !== normalizeDigits(cnae.codigo)));
    setBusca('');
    setShowSugestoes(false);
    setResultadosBusca([]);

    try {
      await persistCnaes(nextCnaes, 'CNAE secundário adicionado');
    } catch (error: any) {
      console.error('Add CNAE error:', error);
      toast.error(error.message || 'Erro ao salvar CNAE secundário');
      setCnaes(cnaes);
    }
  };

  const removeCnae = async (codigo: string) => {
    const nextCnaes = cnaes.filter((c) => normalizeDigits(c.codigo) !== normalizeDigits(codigo));
    setCnaes(nextCnaes);

    try {
      await persistCnaes(nextCnaes, 'CNAE secundário removido');
    } catch (error: any) {
      console.error('Remove CNAE error:', error);
      toast.error(error.message || 'Erro ao remover CNAE secundário');
      setCnaes(cnaes);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">CNAEs Secundários para Busca de Licitações</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void syncFromCnpj()}
            disabled={loadingSync || !empresaAtiva?.cnpj}
          >
            {loadingSync ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {loadingSync ? 'Sincronizando...' : 'Sincronizar CNPJ'}
          </Button>
          <Button
            variant="outline"
            onClick={buscarCnaesIA}
            disabled={loadingIA || !cnaePrincipal}
          >
            {loadingIA ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {loadingIA ? 'Buscando...' : 'Gerar via IA'}
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        O sistema sincroniza os CNAEs secundários reais do CNPJ e permite complementar a lista com IA ou busca oficial por código/descrição.
      </p>

      {/* CNAE principal (read-only) */}
      <div className="mb-4 rounded-lg border border-border bg-muted p-4">
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">CNAE Principal</p>
        <p className="text-base font-semibold text-foreground">
          {cnaePrincipal ? `${cnaePrincipal} – ${empresaAtiva?.razao_social || ''}` : 'Nenhum CNAE principal cadastrado'}
        </p>
      </div>

      {/* CNAEs cadastrados */}
      <div className="mb-4">
        <p className="mb-2 text-sm text-muted-foreground">CNAEs Secundários Cadastrados ({cnaes.length})</p>
        <div className="flex flex-wrap gap-2">
          {cnaes.map((cnae) => (
            <Badge
              key={cnae.codigo}
              variant="info"
              className="flex items-center gap-1 whitespace-normal pr-1"
            >
              <span className="font-mono text-xs">{cnae.codigo}</span>
              <span className="text-xs font-normal">– {cnae.descricao}</span>
              <button
                type="button"
                onClick={() => void removeCnae(cnae.codigo)}
                aria-label={`Remover CNAE ${cnae.codigo}`}
                className="ml-1 rounded-full p-1 text-destructive transition-colors hover:bg-destructive-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {cnaes.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              {loadingIA ? 'Buscando CNAEs via IA...' : 'Nenhum CNAE secundário cadastrado. Clique em "Gerar via IA" para começar.'}
            </p>
          )}
        </div>
      </div>

      {/* Sugestões IA extras */}
      {sugestoesIA.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-muted p-4">
          <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Sugestões da IA – Clique para adicionar
          </p>
          <div className="flex flex-wrap gap-2">
            {sugestoesIA.map((cnae) => (
              <Button
                key={cnae.codigo}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void addCnae(cnae)}
                className="h-auto whitespace-normal py-2 text-left font-normal"
              >
                <Plus aria-hidden="true" />
                <span className="font-mono">{cnae.codigo}</span>
                <span>– {cnae.descricao}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Adicionar CNAE manual */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar CNAE por código ou descrição..."
              aria-label="Buscar CNAE por código ou descrição"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setShowSugestoes(true);
              }}
              onFocus={() => setShowSugestoes(true)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Dropdown sugestões */}
        {showSugestoes && busca.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-md">
            {busca.trim().length < SEARCH_MIN_LENGTH ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar na base oficial.</p>
            ) : loadingBusca ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Buscando CNAEs oficiais...</p>
            ) : resultadosBusca.length > 0 ? (
              resultadosBusca.map((cnae) => (
                <Button
                  key={cnae.codigo}
                  type="button"
                  variant="ghost"
                  onClick={() => void addCnae(cnae)}
                  className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2 text-left font-normal"
                >
                  <Plus className="text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-xs">{cnae.codigo}</span>
                  <span className="text-muted-foreground">–</span>
                  <span>{cnae.descricao}</span>
                </Button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum CNAE encontrado na base oficial</p>
            )}
          </div>
        )}
      </div>

      {/* Quick add popular */}
      <div className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sugestões rápidas</p>
        <div className="flex flex-wrap gap-2">
          {cnaesPopulares
            .filter((c) => !cnaes.some((e) => e.codigo === c.codigo))
            .slice(0, 6)
            .map((cnae) => (
              <Button
                type="button"
                key={cnae.codigo}
                variant="outline"
                size="sm"
                onClick={() => void addCnae(cnae)}
                title={cnae.descricao}
              >
                <Plus aria-hidden="true" />
                {cnae.codigo}
              </Button>
            ))}
        </div>
      </div>
    </section>
  );
}
