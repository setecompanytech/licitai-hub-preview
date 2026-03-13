import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, TrendingDown, TrendingUp,
  Landmark, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Loader2,
  ExternalLink, Info, Brain, Scale, Banknote, FileWarning, Search
} from 'lucide-react';

type FonteDados = {
  tipo: 'oficial' | 'estimativa_ia';
  portal?: string;
  url?: string;
  uf_dados?: any;
};

type CapagData = {
  capag: {
    nota: 'A' | 'B' | 'C' | 'D';
    confianca: 'alta' | 'media' | 'baixa';
    endividamento: { classificacao: string; percentual_estimado: number; descricao: string };
    poupanca_corrente: { classificacao: string; percentual_estimado: number; descricao: string };
    liquidez: { classificacao: string; percentual_estimado: number; descricao: string };
    observacao: string;
  };
  indicadores_fiscais: Array<{
    indicador: string;
    status: 'regular' | 'atencao' | 'critico' | 'indisponivel';
    descricao: string;
    fonte: string;
  }>;
  risco_geral: { nivel: string; score: number; justificativa: string };
  recomendacoes: string[];
  fontes_consulta: string[];
  resumo_executivo: string;
  fonte_dados?: FonteDados;
};

const notaConfig = {
  A: { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: ShieldCheck, label: 'Excelente' },
  B: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: Shield, label: 'Boa' },
  C: { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: ShieldAlert, label: 'Fraca' },
  D: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: ShieldX, label: 'Muito Fraca' },
};

const statusConfig = {
  regular: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Regular' },
  atencao: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Atenção' },
  critico: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Crítico' },
  indisponivel: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Indisponível' },
};

const riscoConfig: Record<string, { color: string; bg: string }> = {
  baixo: { color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  moderado: { color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  elevado: { color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  critico: { color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30' },
};

type Props = {
  orgao: string;
  uf?: string;
  municipio?: string;
};

export default function AnaliseCapag({ orgao, uf, municipio }: Props) {
  const [data, setData] = useState<CapagData | null>(null);
  const [loading, setLoading] = useState(false);

  const analisar = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('capag-analysis', {
        body: { orgao, uf, municipio },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res);
      toast.success('Análise CAPAG concluída');
    } catch (e: any) {
      toast.error(e.message || 'Erro na análise CAPAG');
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="p-4 rounded-full bg-accent/10">
            <Landmark className="w-8 h-8 text-accent" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg">Análise Fiscal CAPAG</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Diagnostique a saúde fiscal do ente federativo vinculado a <strong>{orgao}</strong>. 
              A IA analisará endividamento, poupança corrente, liquidez e indicadores complementares.
            </p>
          </div>
          <Button onClick={analisar} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</> : <><Brain className="w-4 h-4 mr-2" /> Analisar CAPAG por IA</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const nota = notaConfig[data.capag.nota] || notaConfig.C;
  const NotaIcon = nota.icon;
  const risco = riscoConfig[data.risco_geral.nivel] || riscoConfig.moderado;

  return (
    <div className="space-y-4">
      {/* Header com Nota CAPAG */}
      <Card className={`${nota.bg} ${nota.border} border-2`}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl ${nota.color} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-3xl font-black">{data.capag.nota}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">CAPAG: {nota.label}</h3>
                  <NotaIcon className={`w-5 h-5 ${nota.text}`} />
                </div>
                <p className="text-sm text-muted-foreground">{orgao}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  Confiança: {data.capag.confianca}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-black ${risco.color}`}>
                {data.risco_geral.score}%
              </div>
              <Badge className={`${risco.bg} ${risco.color} border-0 text-xs`}>
                Risco {data.risco_geral.nivel}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{data.resumo_executivo}</p>
        </CardContent>
      </Card>

      {/* Indicadores CAPAG */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'endividamento', label: 'Endividamento (DC/RCL)', icon: TrendingDown, data: data.capag.endividamento },
          { key: 'poupanca', label: 'Poupança Corrente', icon: Banknote, data: data.capag.poupanca_corrente },
          { key: 'liquidez', label: 'Liquidez', icon: Scale, data: data.capag.liquidez },
        ].map(ind => {
          const isIndisponivel = !ind.data.classificacao || ind.data.classificacao.toLowerCase().includes('indispon');
          const classColor = isIndisponivel ? 'text-muted-foreground' : ind.data.classificacao === 'A' ? 'text-emerald-600' : ind.data.classificacao === 'B' ? 'text-blue-600' : 'text-red-600';
          const percentual = typeof ind.data.percentual_estimado === 'number' ? ind.data.percentual_estimado : null;
          return (
            <Card key={ind.key} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ind.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{ind.label}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-2xl font-bold ${classColor}`}>
                  {isIndisponivel ? 'N/D' : ind.data.classificacao}
                </span>
                {percentual !== null && (
                  <span className="text-sm text-muted-foreground">{percentual}%</span>
                )}
              </div>
              {percentual !== null && (
                <Progress value={Math.min(percentual, 100)} className="h-1.5 mb-2" />
              )}
              <p className="text-[11px] text-muted-foreground leading-tight">{ind.data.descricao}</p>
            </Card>
          );
        })}
      </div>

      {/* Indicadores Fiscais Complementares */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileWarning className="w-4 h-4" />
            Indicadores Fiscais Complementares
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.indicadores_fiscais.map((ind, i) => {
            const cfg = statusConfig[ind.status] || statusConfig.indisponivel;
            const StatusIcon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${cfg.bg}`}>
                <StatusIcon className={`w-4 h-4 mt-0.5 ${cfg.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{ind.indicador}</span>
                    <Badge variant="outline" className={`text-[9px] ${cfg.color} border-current`}>{cfg.label}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ind.descricao}</p>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                    <Search className="w-3 h-3" /> {ind.fonte}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Risco + Recomendações */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Avaliação de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{data.risco_geral.justificativa}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recomendacoes.map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-accent font-bold mt-0.5">›</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Fontes */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Fontes de consulta</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.fontes_consulta.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                <ExternalLink className="w-2.5 h-2.5 mr-1" /> {f}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2 italic">
            ⚠️ O CAPAG é apenas um indício, não uma garantia absoluta. Utilize esta análise como ferramenta estratégica complementar.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={analisar} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3 h-3 mr-1" />}
          Reanalisar
        </Button>
      </div>
    </div>
  );
}
