import { useState } from 'react';
import { Sparkles, Search, Loader2, Brain, ExternalLink, MapPin, Building2, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ResultadoSemantico = {
  id: string;
  pncp_id?: string;
  numero_controle_pncp?: string;
  orgao?: string;
  objeto?: string;
  modalidade_nome?: string;
  uf?: string;
  municipio?: string;
  valor_total_estimado?: number | null;
  data_publicacao_pncp?: string;
  data_encerramento_proposta?: string;
  url_pncp?: string;
  link_sistema_origem?: string;
  similaridade?: number;
};

type Resposta = {
  ok: boolean;
  query: string;
  provedor: 'lovable_gemini_768' | 'openai_1536' | 'textual_tsvector';
  rerank: boolean;
  total: number;
  resultados: ResultadoSemantico[];
};

// Os dois provedores vetoriais sao o caminho feliz -> chip neutro (o texto do label ja
// diferencia Gemini de OpenAI). O fallback textual sinaliza qualidade DEGRADADA do
// resultado, entao precisa destoar em cor, nao so em texto.
const PROVEDOR_LABEL: Record<string, { texto: string; cor: string }> = {
  lovable_gemini_768: {
    texto: 'IA Gemini (vetorial)',
    cor: 'bg-muted text-foreground border-border hover:bg-muted',
  },
  openai_1536: {
    texto: 'IA OpenAI (vetorial)',
    cor: 'bg-muted text-foreground border-border hover:bg-muted',
  },
  textual_tsvector: {
    texto: 'Busca textual (fallback)',
    cor: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/10',
  },
};

export default function BuscaSemanticaAurelia() {
  const [query, setQuery] = useState('');
  const [usarRerank, setUsarRerank] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resposta | null>(null);

  const buscar = async () => {
    if (query.trim().length < 3) {
      toast.error('Digite pelo menos 3 caracteres');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('busca-semantica-editais', {
        body: {
          query: query.trim(),
          limite: 25,
          similaridade_min: 0.2,
          apenas_abertos: true,
          rerank: usarRerank,
        },
      });
      if (error) throw error;
      const resp = data as Resposta;
      setResultado(resp);
      if (resp.total === 0) {
        toast.info('Nenhum edital relacionado encontrado');
      } else {
        toast.success(`${resp.total} edital(is) — ${PROVEDOR_LABEL[resp.provedor]?.texto || resp.provedor}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha na busca semântica');
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setQuery('');
    setResultado(null);
  };

  const formatBR = (v?: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  const formatData = (v?: string) => {
    if (!v) return '—';
    try {
      return format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '—';
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-muted/40 via-background to-background">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Busca Semântica AURÉLIA
            <Badge variant="outline" className="text-xs px-1.5 py-0">FASE 4</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Encontre editais por significado, não apenas palavras exatas.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              Ex: <strong>"merenda escolar"</strong> também encontra "gêneros alimentícios"; <strong>"informática"</strong>
              encontra "equipamentos de TI". Modelo híbrido com fallback automático.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Ex: serviços de limpeza hospitalar, equipamentos de informática..."
            className="pl-9 pr-9"
            disabled={loading}
          />
          {query && (
            <button
              onClick={limpar}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button onClick={buscar} disabled={loading || query.trim().length < 3} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Buscar
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Switch id="rerank" checked={usarRerank} onCheckedChange={setUsarRerank} />
        <Label htmlFor="rerank" className="text-xs flex items-center gap-1.5 cursor-pointer">
          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          Reordenar com IA Claude (mais preciso, +2s)
        </Label>
      </div>

      {resultado && (
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {resultado.total} resultado(s) por similaridade
            </span>
            <Badge className={`${PROVEDOR_LABEL[resultado.provedor]?.cor} text-xs`}>
              {PROVEDOR_LABEL[resultado.provedor]?.texto || resultado.provedor}
              {resultado.rerank && ' + Claude'}
            </Badge>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {resultado.resultados.map((r, idx) => (
              <Card
                key={r.id}
                className="p-3 hover:bg-accent/5 transition-colors border-border/60"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-medium leading-snug flex-1 min-w-0">
                    {r.objeto || 'Sem descrição'}
                  </p>
                  {typeof r.similaridade === 'number' && (
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${
                        r.similaridade > 0.7
                          ? 'border-success text-success'
                          : r.similaridade > 0.5
                          ? 'border-warning text-warning'
                          : 'border-muted-foreground text-muted-foreground'
                      }`}
                    >
                      {(r.similaridade * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground ml-8">
                  {r.orgao && (
                    <span className="flex items-center gap-1 truncate max-w-[260px]">
                      <Building2 className="w-3 h-3 flex-shrink-0" /> {r.orgao}
                    </span>
                  )}
                  {(r.uf || r.municipio) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {r.municipio}{r.municipio && r.uf ? '/' : ''}{r.uf}
                    </span>
                  )}
                  {r.modalidade_nome && (
                    <Badge variant="secondary" className="text-xs py-0 h-4">
                      {r.modalidade_nome}
                    </Badge>
                  )}
                  {r.valor_total_estimado != null && (
                    <span className="font-medium text-foreground">
                      {formatBR(r.valor_total_estimado)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2 ml-8">
                  <span className="text-xs text-muted-foreground">
                    Encerra: {formatData(r.data_encerramento_proposta)}
                  </span>
                  {(r.link_sistema_origem || r.url_pncp) && (
                    <a
                      href={r.link_sistema_origem || r.url_pncp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </Card>
            ))}

            {resultado.total === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum edital semelhante encontrado.
                <br />
                <span className="text-xs">Tente termos mais genéricos ou aguarde a indexação completa.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
