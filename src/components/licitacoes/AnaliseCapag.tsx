import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, TrendingDown,
  Landmark, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Loader2,
  ExternalLink, Info, Brain, Scale, Banknote, FileWarning, Search
} from 'lucide-react';

type FonteDados = {
  tipo: 'oficial' | 'estimativa_ia';
  portal?: string;
  url?: string;
  uf_dados?: Record<string, unknown> | null;
  municipio_dados?: Record<string, unknown> | null;
  siconfi?: { rcl_12m: number | null; populacao: number | null; periodo: string } | null;
  detalhe?: string;
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

type BadgeTom = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * Cada nota traz o trio de tinta (fundo/tinta/linha) para o ladrilho da letra,
 * a tarja da borda esquerda do cartão-resumo e a cor do ícone. A nota B é
 * neutra de propósito: "boa" não é estado de alerta nem de sucesso.
 */
const notaConfig = {
  A: { ladrilho: 'bg-success-tint text-success-ink border-success-line', tarja: 'border-l-success', text: 'text-success', icon: ShieldCheck, label: 'Excelente' },
  B: { ladrilho: 'bg-muted text-foreground border-border', tarja: 'border-l-info', text: 'text-info', icon: Shield, label: 'Boa' },
  C: { ladrilho: 'bg-warning-tint text-warning-ink border-warning-line', tarja: 'border-l-warning', text: 'text-warning', icon: ShieldAlert, label: 'Fraca' },
  D: { ladrilho: 'bg-destructive-tint text-destructive-ink border-destructive-line', tarja: 'border-l-destructive', text: 'text-destructive', icon: ShieldX, label: 'Muito Fraca' },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; variant: BadgeTom; label: string }> = {
  regular: { icon: CheckCircle2, color: 'text-success-ink', bg: 'bg-success-tint border-success-line', variant: 'success', label: 'Regular' },
  atencao: { icon: AlertTriangle, color: 'text-warning-ink', bg: 'bg-warning-tint border-warning-line', variant: 'warning', label: 'Atenção' },
  critico: { icon: XCircle, color: 'text-destructive-ink', bg: 'bg-destructive-tint border-destructive-line', variant: 'danger', label: 'Crítico' },
  indisponivel: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted border-border', variant: 'muted', label: 'Indisponível' },
};

const riscoConfig: Record<string, { text: string; variant: BadgeTom }> = {
  baixo: { text: 'text-success', variant: 'success' },
  moderado: { text: 'text-warning', variant: 'warning' },
  elevado: { text: 'text-warning', variant: 'warning' },
  critico: { text: 'text-destructive', variant: 'danger' },
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
      <Card>
        <EstadoVazio
          icone={<Landmark />}
          titulo="Análise Fiscal CAPAG"
          descricao={
            <>
              Diagnostique a saúde fiscal do ente federativo vinculado a <strong>{orgao}</strong>.
              A IA analisará endividamento, poupança corrente, liquidez e indicadores complementares.
            </>
          }
          acao={
            <Button onClick={analisar} disabled={loading}>
              {loading ? <><Loader2 className="animate-spin" aria-hidden="true" /> Analisando...</> : <><Brain aria-hidden="true" /> Analisar CAPAG por IA</>}
            </Button>
          }
        />
      </Card>
    );
  }

  const nota = notaConfig[data.capag.nota] || notaConfig.C;
  const NotaIcon = nota.icon;
  const risco = riscoConfig[data.risco_geral.nivel] || riscoConfig.moderado;

  return (
    <div className="space-y-4">
      {/* Resumo com a nota CAPAG — a tarja da esquerda diz o estado, como nos
          cartões de oportunidade da tela (mesma espessura de 3px). */}
      <Card className={`border-l-[3px] ${nota.tarja}`}>
        <CardContent className="p-6">
          {/* Origem dos dados */}
          {data.fonte_dados && (
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {data.fonte_dados.tipo === 'oficial' ? (
                <Badge variant="success">
                  <CheckCircle2 className="w-4 h-4 mr-1" aria-hidden="true" /> Dados Oficiais — Tesouro Nacional
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Brain className="w-4 h-4 mr-1" aria-hidden="true" /> Estimativa por IA
                </Badge>
              )}
              {data.fonte_dados.url && (
                <a href={data.fonte_dados.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" aria-hidden="true" /> Fonte oficial
                </a>
              )}
            </div>
          )}
          {data.fonte_dados?.detalhe && (
            <p className="text-xs text-muted-foreground mb-3">{data.fonte_dados.detalhe}</p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-lg border flex items-center justify-center flex-shrink-0 ${nota.ladrilho}`}>
                <span className="text-2xl font-bold">{data.capag.nota}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">CAPAG: {nota.label}</h3>
                  <NotaIcon className={`w-5 h-5 ${nota.text}`} aria-hidden="true" />
                </div>
                <p className="text-sm text-muted-foreground">{orgao}</p>
                <Badge variant="muted" className="mt-1">
                  Confiança: {data.capag.confianca}
                </Badge>
              </div>
            </div>
            <div className="sm:text-right">
              <div className={`text-[2rem] leading-10 font-bold tabular-nums ${risco.text}`}>
                {data.risco_geral.score}%
              </div>
              <Badge variant={risco.variant}>
                Risco {data.risco_geral.nivel}
              </Badge>
            </div>
          </div>
          <p className="text-base text-muted-foreground mt-4">{data.resumo_executivo}</p>
        </CardContent>
      </Card>

      {/* Indicadores CAPAG */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: 'endividamento', label: 'Endividamento (DC/RCL)', icon: TrendingDown, data: data.capag.endividamento },
          { key: 'poupanca', label: 'Poupança Corrente', icon: Banknote, data: data.capag.poupanca_corrente },
          { key: 'liquidez', label: 'Liquidez', icon: Scale, data: data.capag.liquidez },
        ].map(ind => {
          const isIndisponivel = !ind.data.classificacao || ind.data.classificacao.toLowerCase().includes('indispon');
          const classColor = isIndisponivel ? 'text-muted-foreground' : ind.data.classificacao === 'A' ? 'text-success' : ind.data.classificacao === 'B' ? 'text-info' : 'text-destructive';
          const percentual = typeof ind.data.percentual_estimado === 'number' ? ind.data.percentual_estimado : null;
          return (
            <Card key={ind.key} className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <ind.icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium text-muted-foreground">{ind.label}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-2xl font-bold tabular-nums ${classColor}`}>
                  {isIndisponivel ? 'N/D' : ind.data.classificacao}
                </span>
                {percentual !== null && (
                  <span className="text-sm text-muted-foreground tabular-nums">{percentual}%</span>
                )}
              </div>
              {percentual !== null && (
                <Progress value={Math.min(percentual, 100)} className="h-2 mb-2" />
              )}
              <p className="text-xs text-muted-foreground">{ind.data.descricao}</p>
            </Card>
          );
        })}
      </div>

      {/* Indicadores Fiscais Complementares */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5" aria-hidden="true" />
            Indicadores Fiscais Complementares
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.indicadores_fiscais.map((ind, i) => {
            const cfg = statusConfig[ind.status] || statusConfig.indisponivel;
            const StatusIcon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-md border ${cfg.bg}`}>
                <StatusIcon className={`w-4 h-4 mt-1 ${cfg.color} flex-shrink-0`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{ind.indicador}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{ind.descricao}</p>
                  <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Search className="w-4 h-4" aria-hidden="true" /> {ind.fonte}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Risco + Recomendações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" /> Avaliação de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-muted-foreground">{data.risco_geral.justificativa}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recomendacoes.map((rec, i) => (
                <li key={i} className="text-base text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold" aria-hidden="true">›</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Fontes */}
      <Card className="bg-muted">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">Fontes de consulta</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.fontes_consulta.map((f, i) => (
              <Badge key={i} variant="info" className="font-normal">
                <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" /> {f}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-warning" aria-hidden="true" />
            <span>O CAPAG é apenas um indício, não uma garantia absoluta. Utilize esta análise como ferramenta estratégica complementar.</span>
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={analisar} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Brain aria-hidden="true" />}
          Reanalisar
        </Button>
      </div>
    </div>
  );
}
