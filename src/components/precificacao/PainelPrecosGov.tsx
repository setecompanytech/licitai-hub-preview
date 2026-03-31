import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Building2, Calendar, MapPin, ExternalLink, TrendingDown, BarChart3, FileCheck, Scale, AlertTriangle } from 'lucide-react';
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
  tipo_registro?: string;
  situacao?: string;
};

type ResumoGov = {
  menor_preco: number;
  maior_preco: number;
  preco_medio: number;
  mediana?: number;
  total_registros: number;
  periodo?: string;
  fontes: string[];
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentYear = new Date().getFullYear();

export default function PainelPrecosGov() {
  const [termo, setTermo] = useState('');
  const [anoInicio, setAnoInicio] = useState(String(currentYear - 2));
  const [anoFim, setAnoFim] = useState(String(currentYear));
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
        body: { termo, anoInicio: Number(anoInicio), anoFim: Number(anoFim) },
      });

      if (error || !data?.success) {
        toast.error(error?.message || data?.error || 'Erro ao consultar PNCP.');
        setLoading(false);
        return;
      }

      setResultados(data.resultados || []);
      setResumo(data.resumo || null);

      if ((data.resultados || []).length === 0) {
        toast.warning('Nenhum registro encontrado no PNCP para esse termo e período.');
      } else {
        toast.success(`${data.resultados.length} registros de preços reais encontrados no PNCP!`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao consultar o PNCP.');
    }

    setLoading(false);
  };

  const anos = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-accent/30 border border-accent/50 rounded-lg text-xs text-muted-foreground">
        <FileCheck className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        <p>
          Consulta direta à <strong>API oficial do PNCP</strong> (Portal Nacional de Contratações Públicas).
          Retorna <strong>preços unitários homologados</strong> de ATAs/SRP e contratos reais firmados por órgãos públicos.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Ex: Papel A4, Notebook, Monitor, Serviço de limpeza..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={anoInicio} onValueChange={setAnoInicio}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="De" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={anoFim} onValueChange={setAnoFim}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Até" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={loading} className="bg-primary hover:bg-primary/90">
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Consultando PNCP...</>
          ) : (
            <><Building2 className="w-4 h-4 mr-1" /> Consultar PNCP</>
          )}
        </Button>
      </div>

      {/* Resumo */}
      {resumo && (
        <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            Resumo — Preços Homologados PNCP ({resumo.periodo || `${anoInicio}-${anoFim}`})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Menor Preço</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(resumo.menor_preco)}</p>
            </div>
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Maior Preço</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(resumo.maior_preco)}</p>
            </div>
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço Médio</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(resumo.preco_medio)}</p>
            </div>
            {resumo.mediana != null && (
              <div className="text-center p-2 bg-card rounded-md border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mediana</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(resumo.mediana)}</p>
              </div>
            )}
            <div className="text-center p-2 bg-card rounded-md border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Registros</p>
              <p className="text-lg font-bold text-primary">{resumo.total_registros}</p>
              <p className="text-[10px] text-muted-foreground">PNCP Oficial</p>
            </div>
          </div>
        </div>
      )}

      {/* Results list */}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {resultados.length} itens com preço unitário encontrados no PNCP ({anoInicio}–{anoFim})
          </p>
          {resultados.map((r, i) => {
            const isCheapest = resumo ? r.preco_unitario === resumo.menor_preco : false;
            const isHomologado = r.situacao === 'Homologado';
            return (
              <div key={i} className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{r.descricao}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {r.tipo_registro && (
                      <Badge
                        variant="outline"
                        className={
                          r.tipo_registro === 'ATA/SRP'
                            ? 'text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                            : 'text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                        }
                      >
                        {r.tipo_registro}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        isHomologado
                          ? 'text-[10px] bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20'
                          : 'text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                      }
                    >
                      {isHomologado ? (
                        <><Scale className="w-3 h-3 mr-0.5" /> Homologado</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-0.5" /> Estimado</>
                      )}
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
                    {r.quantidade > 1 && (
                      <span className="text-xs text-muted-foreground">
                        Qtd: {r.quantidade.toLocaleString('pt-BR')} {r.unidade}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Preço unit.</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(r.preco_unitario)}</p>
                    {isCheapest && (
                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 text-[10px]">
                        <TrendingDown className="w-3 h-3 mr-0.5" /> Menor
                      </Badge>
                    )}
                  </div>
                  {r.url && r.url !== '#' && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(r.url, '_blank')} title="Ver no PNCP">
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
          <p className="text-sm">Consulte preços unitários homologados em ATAs e contratos públicos</p>
          <p className="text-xs mt-1">Dados oficiais do PNCP — últimos 3 anos</p>
        </div>
      )}
    </div>
  );
}
