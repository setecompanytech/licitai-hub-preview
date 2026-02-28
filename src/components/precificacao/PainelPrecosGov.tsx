import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Building2, Calendar, MapPin, ExternalLink, TrendingDown, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type ResultadoGov = {
  descricao: string;
  orgao: string;
  preco_unitario: number;
  quantidade: number;
  unidade: string;
  data_compra: string;
  modalidade: string;
  uf: string;
  fonte: string;
  url: string;
  numero_compra: string;
};

type ResumoGov = {
  menor_preco: number;
  maior_preco: number;
  preco_medio: number;
  total_registros: number;
  fontes: string[];
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PainelPrecosGov() {
  const [termo, setTermo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoGov[]>([]);
  const [resumo, setResumo] = useState<ResumoGov | null>(null);

  const handleSearch = async () => {
    if (!termo.trim()) {
      toast.error('Digite um produto ou serviço para buscar.');
      return;
    }
    setLoading(true);
    setResultados([]);
    setResumo(null);

    try {
      const { data, error } = await supabase.functions.invoke('consulta-painel-precos', {
        body: { termo },
      });

      if (error || !data?.success) {
        toast.error(error?.message || data?.error || 'Erro ao consultar Painel de Preços.');
        setLoading(false);
        return;
      }

      setResultados(data.resultados || []);
      setResumo(data.resumo || null);

      if ((data.resultados || []).length === 0) {
        toast.warning('Nenhum preço encontrado no Painel de Preços Gov.br para esse termo.');
      } else {
        toast.success(`${data.resultados.length} registros encontrados no Painel de Preços!`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao consultar o Painel de Preços.');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Ex: Notebook, Monitor, Papel A4, Serviço de limpeza..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="bg-primary hover:bg-primary/90">
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Consultando...</>
          ) : (
            <><Building2 className="w-4 h-4 mr-1" /> Consultar Gov.br</>
          )}
        </Button>
      </div>

      {/* Resumo */}
      {resumo && (
        <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            Resumo de Preços Praticados (Gov.br)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Menor Preço</p>
              <p className="text-lg font-bold text-success">{formatCurrency(resumo.menor_preco)}</p>
            </div>
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Maior Preço</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(resumo.maior_preco)}</p>
            </div>
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço Médio</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(resumo.preco_medio)}</p>
            </div>
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Registros</p>
              <p className="text-lg font-bold text-primary">{resumo.total_registros}</p>
              <p className="text-[10px] text-muted-foreground">{resumo.fontes.join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results list */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {resultados.length} resultados encontrados no Painel de Preços do Governo Federal
          </p>
          {resultados.map((r, i) => {
            const isCheapest = resumo ? r.preco_unitario === resumo.menor_preco : false;
            return (
              <div key={i} className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{r.descricao}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {r.fonte}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {r.orgao}
                    </span>
                    {r.uf && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {r.uf}
                      </span>
                    )}
                    {r.data_compra && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(r.data_compra).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {r.modalidade && (
                      <span className="text-xs text-muted-foreground">{r.modalidade}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(r.preco_unitario)}</p>
                    {isCheapest && (
                      <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                        <TrendingDown className="w-3 h-3 mr-0.5" /> Menor
                      </Badge>
                    )}
                  </div>
                  {r.url && r.url !== '#' && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(r.url, '_blank')}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && resultados.length === 0 && !resumo && (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Consulte preços praticados em compras públicas federais</p>
          <p className="text-xs mt-1">Dados do PNCP e portais do Gov.br</p>
        </div>
      )}
    </div>
  );
}
