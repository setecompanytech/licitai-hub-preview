import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Target,
  ShieldAlert, BarChart3,
} from 'lucide-react';
import type { LanceConfig } from './ConfigurarLanceDialog';

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

/** Variantes semânticas do Badge de ui — status sempre com texto. */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// "Alto" e "Crítico" partilham a tinta vermelha: a diferença é dita pelo TEXTO
// do selo ("Risco Crítico"), não por um vermelho cheio — a identidade 12/09
// reserva o sólido para a ação destrutiva, não para rótulo de estado.
const RISCO_VARIANTE: Record<string, BadgeVariant> = {
  baixo: 'success',
  medio: 'warning',
  alto: 'danger',
  critico: 'danger',
};

const POSICAO_VARIANTE: Record<string, BadgeVariant> = {
  liderando: 'success',
  competitivo: 'info',
  perdendo: 'warning',
  indefinido: 'muted',
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
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Painel de Risco — Nível {nivel}
        </h3>
        <Badge variant={RISCO_VARIANTE[risco.nivel]}>
          Risco {risco.nivel.charAt(0).toUpperCase() + risco.nivel.slice(1)}
        </Badge>
      </div>

      {/* Position & Risk Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Posição */}
        <div className="bg-muted rounded-lg p-3 text-center">
          <Target className="w-4 h-4 mx-auto text-muted-foreground mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Posição</p>
          <Badge variant={POSICAO_VARIANTE[posicao.posicao]} className="mt-1">
            {posicao.posicao === 'liderando' && '🏆 '}
            {posicao.posicao.charAt(0).toUpperCase() + posicao.posicao.slice(1)}
          </Badge>
        </div>

        {/* Desconto */}
        <div className="bg-muted rounded-lg p-3 text-center">
          {margem > 0 ? (
            <TrendingDown className="w-4 h-4 mx-auto text-success mb-1" aria-hidden="true" />
          ) : (
            <TrendingUp className="w-4 h-4 mx-auto text-destructive mb-1" aria-hidden="true" />
          )}
          <p className="text-xs text-muted-foreground">Desconto</p>
          <p className={`text-base font-bold tabular-nums ${margem > 50 ? 'text-destructive' : margem > 30 ? 'text-warning' : 'text-success'}`}>
            {margem.toFixed(1)}%
          </p>
        </div>

        {/* Faixa ideal */}
        <div className="bg-muted rounded-lg p-3 text-center">
          <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Faixa Ideal</p>
          <p className="text-base font-bold tabular-nums">
            {formatCurrency(faixa.min)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">a {formatCurrency(faixa.max)}</p>
        </div>

        {/* Status faixa */}
        <div className="bg-muted rounded-lg p-3 text-center">
          {dentroFaixa ? (
            <CheckCircle2 className="w-4 h-4 mx-auto text-success mb-1" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 mx-auto text-warning mb-1" aria-hidden="true" />
          )}
          <p className="text-xs text-muted-foreground">Na Faixa?</p>
          <p className={`text-base font-bold ${dentroFaixa ? 'text-success' : 'text-warning'}`}>
            {dentroFaixa ? 'Sim ✓' : 'Fora'}
          </p>
        </div>
      </div>

      {/* Barra de faixa visual */}
      <div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1 tabular-nums">
          <span>Piso: {formatCurrency(lance.valorMinimo)}</span>
          <span className="text-foreground font-semibold">Ótimo: {formatCurrency(faixa.otimo)}</span>
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
            aria-label="Desconto atual sobre o valor de referência"
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
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              {risco.nivel === 'baixo' ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
              )}
              {f}
            </div>
          ))}
        </div>
      )}

      {/* Recomendação */}
      <div className={`px-4 py-3 rounded-lg border text-sm ${
        dentroFaixa
          ? 'bg-success-tint border-success-line text-success-ink'
          : 'bg-warning-tint border-warning-line text-warning-ink'
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
