import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Target,
  ShieldAlert, BarChart3, ArrowDown, ArrowUp,
} from 'lucide-react';
import type { LanceConfig, DisputeItem } from './ConfigurarLanceDialog';

type Props = {
  lance: LanceConfig;
  nivel: number;
};

type FaixaIdeal = {
  min: number;
  max: number;
  otimo: number;
};

function calcularFaixaIdeal(lance: LanceConfig): FaixaIdeal {
  const ref = lance.valorReferencia;
  if (ref <= 0) return { min: 0, max: 0, otimo: 0 };

  // Faixa ideal: entre 15-35% de desconto (abaixo de 50% = inexequível)
  return {
    min: ref * 0.65,  // 35% desconto
    max: ref * 0.85,  // 15% desconto
    otimo: ref * 0.75, // 25% desconto (sweet spot)
  };
}

function calcularPosicao(valorAtual: number, ref: number): {
  posicao: 'liderando' | 'competitivo' | 'perdendo' | 'indefinido';
  desconto: number;
} {
  if (ref <= 0 || valorAtual <= 0) return { posicao: 'indefinido', desconto: 0 };
  const desconto = ((ref - valorAtual) / ref) * 100;

  if (desconto > 30) return { posicao: 'liderando', desconto };
  if (desconto > 15) return { posicao: 'competitivo', desconto };
  return { posicao: 'perdendo', desconto };
}

function calcularRisco(lance: LanceConfig): {
  nivel: 'baixo' | 'medio' | 'alto' | 'critico';
  fatores: string[];
} {
  const fatores: string[] = [];
  const desconto = lance.valorReferencia > 0
    ? ((lance.valorReferencia - lance.valorAtual) / lance.valorReferencia) * 100
    : 0;

  if (desconto > 50) fatores.push('⚠️ Risco de inexequibilidade (desconto > 50%)');
  if (desconto > 40) fatores.push('Desconto agressivo (> 40%)');
  if (lance.valorMinimo < lance.valorReferencia * 0.5) fatores.push('Piso muito baixo');
  if (lance.maxLances > 30) fatores.push('Muitos lances configurados');
  if (lance.intervaloSegundos < 10) fatores.push('Intervalo entre lances muito curto');

  const qtdFatores = fatores.length;
  if (qtdFatores === 0) return { nivel: 'baixo', fatores: ['Parâmetros dentro da normalidade'] };
  if (qtdFatores === 1) return { nivel: 'medio', fatores };
  if (qtdFatores <= 3) return { nivel: 'alto', fatores };
  return { nivel: 'critico', fatores };
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const RISCO_CORES: Record<string, string> = {
  baixo: 'bg-success/15 text-success border-success/30',
  medio: 'bg-warning/15 text-warning border-warning/30',
  alto: 'bg-destructive/15 text-destructive border-destructive/30',
  critico: 'bg-destructive text-destructive-foreground border-destructive',
};

const POSICAO_CORES: Record<string, string> = {
  liderando: 'bg-success/15 text-success border-success/30',
  competitivo: 'bg-info/15 text-info border-info/30',
  perdendo: 'bg-warning/15 text-warning border-warning/30',
  indefinido: 'bg-muted text-muted-foreground border-border',
};

export default function PainelRisco({ lance, nivel }: Props) {
  const faixa = useMemo(() => calcularFaixaIdeal(lance), [lance.valorReferencia]);
  const posicao = useMemo(() => calcularPosicao(lance.valorAtual, lance.valorReferencia), [lance.valorAtual, lance.valorReferencia]);
  const risco = useMemo(() => calcularRisco(lance), [lance]);

  const margem = lance.valorReferencia > 0
    ? ((lance.valorReferencia - lance.valorAtual) / lance.valorReferencia * 100)
    : 0;

  const dentroFaixa = lance.valorAtual >= faixa.min && lance.valorAtual <= faixa.max;

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-accent" />
          Painel de Risco — Nível {nivel}
        </h3>
        <Badge variant="outline" className={RISCO_CORES[risco.nivel]}>
          Risco {risco.nivel.charAt(0).toUpperCase() + risco.nivel.slice(1)}
        </Badge>
      </div>

      {/* Position & Risk Grid */}
      <div className="grid grid-cols-4 gap-2">
        {/* Posição */}
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <Target className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Posição</p>
          <Badge variant="outline" className={`text-xs mt-1 ${POSICAO_CORES[posicao.posicao]}`}>
            {posicao.posicao === 'liderando' && '🏆 '}
            {posicao.posicao.charAt(0).toUpperCase() + posicao.posicao.slice(1)}
          </Badge>
        </div>

        {/* Desconto */}
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          {margem > 0 ? (
            <TrendingDown className="w-3.5 h-3.5 mx-auto text-success mb-1" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 mx-auto text-destructive mb-1" />
          )}
          <p className="text-xs text-muted-foreground">Desconto</p>
          <p className={`text-xs font-bold ${margem > 50 ? 'text-destructive' : margem > 30 ? 'text-warning' : 'text-success'}`}>
            {margem.toFixed(1)}%
          </p>
        </div>

        {/* Faixa ideal */}
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <BarChart3 className="w-3.5 h-3.5 mx-auto text-accent mb-1" />
          <p className="text-xs text-muted-foreground">Faixa Ideal</p>
          <p className="text-xs font-mono font-bold">
            {formatCurrency(faixa.min)}
          </p>
          <p className="text-xs text-muted-foreground">a {formatCurrency(faixa.max)}</p>
        </div>

        {/* Status faixa */}
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          {dentroFaixa ? (
            <CheckCircle2 className="w-3.5 h-3.5 mx-auto text-success mb-1" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mx-auto text-warning mb-1" />
          )}
          <p className="text-xs text-muted-foreground">Na Faixa?</p>
          <p className={`text-xs font-bold ${dentroFaixa ? 'text-success' : 'text-warning'}`}>
            {dentroFaixa ? 'Sim ✓' : 'Fora'}
          </p>
        </div>
      </div>

      {/* Barra de faixa visual */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Piso: {formatCurrency(lance.valorMinimo)}</span>
          <span className="text-accent font-semibold">Ótimo: {formatCurrency(faixa.otimo)}</span>
          <span>Ref: {formatCurrency(lance.valorReferencia)}</span>
        </div>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          {/* Faixa ideal highlight */}
          {lance.valorReferencia > 0 && (
            <div
              className="absolute top-0 h-full bg-success/20 border-x border-success/40"
              style={{
                left: `${Math.max(0, (1 - faixa.max / lance.valorReferencia) * 100)}%`,
                right: `${Math.max(0, (faixa.min / lance.valorReferencia) * 100 - 100 + 100)}%`,
                width: `${((faixa.max - faixa.min) / lance.valorReferencia) * 100}%`,
              }}
            />
          )}
          {/* Current position indicator */}
          <Progress
            value={lance.valorReferencia > 0 ? ((lance.valorReferencia - lance.valorAtual) / lance.valorReferencia) * 100 : 0}
            className="h-3"
          />
        </div>
      </div>

      {/* Fatores de risco */}
      {risco.fatores.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Fatores de risco
          </p>
          {risco.fatores.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              {risco.nivel === 'baixo' ? (
                <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
              )}
              {f}
            </div>
          ))}
        </div>
      )}

      {/* Recomendação */}
      <div className={`px-3 py-2 rounded-lg border text-xs ${
        dentroFaixa
          ? 'bg-success/5 border-success/20 text-success'
          : 'bg-warning/5 border-warning/20 text-warning'
      }`}>
        {dentroFaixa ? (
          <p><strong>✅ Recomendação:</strong> Valor atual dentro da faixa ideal. Posição competitiva mantida.</p>
        ) : lance.valorAtual < faixa.min ? (
          <p><strong>⚠️ Atenção:</strong> Valor abaixo da faixa ideal. Risco de inexequibilidade. Considere não reduzir mais.</p>
        ) : (
          <p><strong>💡 Sugestão:</strong> Valor acima da faixa ideal. Há margem para um desconto mais competitivo (até {formatCurrency(faixa.max)}).</p>
        )}
      </div>
    </div>
  );
}
