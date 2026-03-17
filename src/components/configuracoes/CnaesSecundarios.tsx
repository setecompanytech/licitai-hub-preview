import { useState, useEffect } from 'react';
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

export default function CnaesSecundarios() {
  const { empresaAtiva } = useEmpresa();
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [busca, setBusca] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [sugestoesIA, setSugestoesIA] = useState<CnaeItem[]>([]);

  const cnaePrincipal = empresaAtiva?.cnae_principal || '';

  // Auto-load AI suggestions when empresa changes
  useEffect(() => {
    if (cnaePrincipal && cnaes.length === 0) {
      buscarCnaesIA();
    }
  }, [cnaePrincipal]);

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

      // Use user JWT for authenticated AI calls
      let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authToken = session.access_token;
      } catch { /* fallback to anon key */ }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          action: 'assistente',
        }),
      });

      if (!resp.ok) throw new Error('Erro na consulta IA');

      // Read streaming response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullText += content;
          } catch { /* partial */ }
        }
      }

      // Extract JSON from response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Resposta inválida da IA');

      const parsed: CnaeItem[] = JSON.parse(jsonMatch[0]);
      const valid = parsed.filter(c => c.codigo && c.descricao);

      if (valid.length === 0) throw new Error('Nenhum CNAE retornado');

      // Auto-add first batch, keep rest as suggestions
      const autoAdd = valid.slice(0, 6);
      const extras = valid.slice(6);

      setCnaes(prev => {
        const existing = new Set(prev.map(c => c.codigo));
        const newOnes = autoAdd.filter(c => !existing.has(c.codigo));
        return [...prev, ...newOnes];
      });
      setSugestoesIA(extras);
      toast.success(`${autoAdd.length} CNAEs correlatos adicionados via IA`);
    } catch (e: any) {
      console.error('IA CNAE error:', e);
      toast.error(e.message || 'Erro ao buscar CNAEs via IA');
    } finally {
      setLoadingIA(false);
    }
  };

  const sugestoesFiltradas = cnaesPopulares.filter(
    (c) =>
      !cnaes.some((e) => e.codigo === c.codigo) &&
      (c.codigo.includes(busca) || c.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  const addCnae = (cnae: CnaeItem) => {
    if (!cnaes.some((c) => c.codigo === cnae.codigo)) {
      setCnaes([...cnaes, cnae]);
      setSugestoesIA(prev => prev.filter(s => s.codigo !== cnae.codigo));
    }
    setBusca('');
    setShowSugestoes(false);
  };

  const removeCnae = (codigo: string) => {
    setCnaes(cnaes.filter((c) => c.codigo !== codigo));
  };

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">CNAEs Secundários para Busca de Licitações</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={buscarCnaesIA}
          disabled={loadingIA || !cnaePrincipal}
          className="text-xs gap-1.5"
        >
          {loadingIA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-accent" />}
          {loadingIA ? 'Buscando...' : 'Gerar via IA'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        A IA identifica automaticamente CNAEs correlatos ao seu CNAE principal para ampliar buscas de licitações. Você pode adicionar ou remover livremente.
      </p>

      {/* CNAE principal (read-only) */}
      <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">CNAE Principal</p>
        <p className="text-sm font-semibold text-accent">
          {cnaePrincipal ? `${cnaePrincipal} – ${empresaAtiva?.razao_social || ''}` : 'Nenhum CNAE principal cadastrado'}
        </p>
      </div>

      {/* CNAEs cadastrados */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">CNAEs Secundários Cadastrados ({cnaes.length})</p>
        <div className="flex flex-wrap gap-2">
          {cnaes.map((cnae) => (
            <Badge
              key={cnae.codigo}
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 pr-1 flex items-center gap-1"
            >
              <span className="font-mono text-xs">{cnae.codigo}</span>
              <span className="text-[10px]">– {cnae.descricao}</span>
              <button
                onClick={() => removeCnae(cnae.codigo)}
                className="ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
            </Badge>
          ))}
          {cnaes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              {loadingIA ? 'Buscando CNAEs via IA...' : 'Nenhum CNAE secundário cadastrado. Clique em "Gerar via IA" para começar.'}
            </p>
          )}
        </div>
      </div>

      {/* Sugestões IA extras */}
      {sugestoesIA.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/10">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-accent" /> Sugestões da IA – Clique para adicionar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoesIA.map((cnae) => (
              <button
                key={cnae.codigo}
                onClick={() => addCnae(cnae)}
                className="text-[11px] px-2 py-1 rounded-md border border-accent/30 hover:border-accent hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
              >
                <Plus className="w-2.5 h-2.5" />
                <span className="font-mono">{cnae.codigo}</span>
                <span>– {cnae.descricao}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Adicionar CNAE manual */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar CNAE por código ou descrição..."
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
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {sugestoesFiltradas.length > 0 ? (
              sugestoesFiltradas.map((cnae) => (
                <button
                  key={cnae.codigo}
                  onClick={() => addCnae(cnae)}
                  className="w-full text-left px-4 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm transition-colors"
                >
                  <Plus className="w-3 h-3 text-accent" />
                  <span className="font-mono text-xs">{cnae.codigo}</span>
                  <span className="text-muted-foreground">–</span>
                  <span>{cnae.descricao}</span>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum CNAE encontrado</p>
            )}
          </div>
        )}
      </div>

      {/* Quick add popular */}
      <div className="mt-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sugestões rápidas</p>
        <div className="flex flex-wrap gap-1.5">
          {cnaesPopulares
            .filter((c) => !cnaes.some((e) => e.codigo === c.codigo))
            .slice(0, 6)
            .map((cnae) => (
              <button
                key={cnae.codigo}
                onClick={() => addCnae(cnae)}
                className="text-[11px] px-2 py-1 rounded-md border border-border/50 hover:border-accent hover:text-accent transition-colors"
              >
                <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                {cnae.codigo}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
