import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, TrendingDown, Clock, Hash, DollarSign,
} from 'lucide-react';
import type { LanceConfig } from './ConfigurarLanceDialog';

type LanceHistorico = {
  rodada: number;
  valor: number;
  timestamp: Date;
  tipo: 'meu' | 'concorrente';
};

type Props = {
  lance: LanceConfig;
  onUpdate: (lance: LanceConfig) => void;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SimulacaoDisputa({ lance, onUpdate }: Props) {
  const [running, setRunning] = useState(false);
  const [historico, setHistorico] = useState<LanceHistorico[]>([]);
  const [valorAtual, setValorAtual] = useState(lance.valorInicial);
  const [rodada, setRodada] = useState(0);
  const [tempoRestante, setTempoRestante] = useState(lance.intervaloSegundos);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararSimulacao = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    intervalRef.current = null;
    timerRef.current = null;
  }, []);

  const executarLance = useCallback(() => {
    setRodada((prev) => {
      const novaRodada = prev + 1;

      if (novaRodada > lance.maxLances) {
        pararSimulacao();
        return prev;
      }

      setValorAtual((prevValor) => {
        // Calculate decrement
        let decremento = lance.decrementoMin;
        const decrementoPct = prevValor * (lance.decrementoPercentual / 100);
        if (decrementoPct > decremento) decremento = decrementoPct;

        // Add some randomness to simulate a real competitor
        const fatorAleatorio = 0.8 + Math.random() * 0.4;
        decremento = decremento * fatorAleatorio;

        let novoValor = prevValor - decremento;

        // Don't go below minimum
        if (novoValor < lance.valorMinimo) {
          novoValor = lance.valorMinimo;
          // Stop after reaching minimum
          setTimeout(() => pararSimulacao(), 100);
        }

        const novoValorFinal = Math.round(novoValor * 100) / 100;

        // Alternate between "my bid" and "competitor bid"
        const tipo: 'meu' | 'concorrente' = novaRodada % 2 === 1 ? 'meu' : 'concorrente';

        setHistorico((h) => [
          { rodada: novaRodada, valor: novoValorFinal, timestamp: new Date(), tipo },
          ...h,
        ]);

        return novoValorFinal;
      });

      setTempoRestante(lance.intervaloSegundos);
      return novaRodada;
    });
  }, [lance, pararSimulacao]);

  const iniciarSimulacao = useCallback(() => {
    setRunning(true);
    setTempoRestante(lance.intervaloSegundos);

    // Execute first bid immediately
    executarLance();

    // Timer countdown
    timerRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) return lance.intervaloSegundos;
        return prev - 1;
      });
    }, 1000);

    // Bid interval
    intervalRef.current = setInterval(() => {
      executarLance();
    }, lance.intervaloSegundos * 1000);
  }, [lance, executarLance]);

  const resetarSimulacao = useCallback(() => {
    pararSimulacao();
    setValorAtual(lance.valorInicial);
    setRodada(0);
    setHistorico([]);
    setTempoRestante(lance.intervaloSegundos);
  }, [lance, pararSimulacao]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const progresso = lance.valorReferencia > lance.valorMinimo
    ? ((lance.valorReferencia - valorAtual) / (lance.valorReferencia - lance.valorMinimo)) * 100
    : 0;

  const economia = lance.valorReferencia - valorAtual;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Simulação de Disputa
          </h4>
          {running && (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px] animate-pulse">
              Em andamento
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {!running ? (
            <Button size="sm" variant="outline" onClick={iniciarSimulacao} disabled={rodada >= lance.maxLances}>
              <Play className="w-3 h-3 mr-1" /> {rodada > 0 ? 'Retomar' : 'Iniciar'}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={pararSimulacao}>
              <Pause className="w-3 h-3 mr-1" /> Pausar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={resetarSimulacao}>
            <RotateCcw className="w-3 h-3 mr-1" /> Resetar
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <DollarSign className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-[10px] text-muted-foreground">Valor Atual</p>
          <p className="text-xs font-bold text-accent">{formatCurrency(valorAtual)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <TrendingDown className="w-3 h-3 mx-auto text-success mb-1" />
          <p className="text-[10px] text-muted-foreground">Economia</p>
          <p className="text-xs font-bold text-success">{formatCurrency(economia)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <Hash className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-[10px] text-muted-foreground">Rodada</p>
          <p className="text-xs font-bold">{rodada} / {lance.maxLances}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <Clock className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-[10px] text-muted-foreground">Próximo em</p>
          <p className="text-xs font-bold">{running ? `${tempoRestante}s` : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <DollarSign className="w-3 h-3 mx-auto text-destructive mb-1" />
          <p className="text-[10px] text-muted-foreground">Piso</p>
          <p className="text-xs font-bold text-destructive">{formatCurrency(lance.valorMinimo)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Referência: {formatCurrency(lance.valorReferencia)}</span>
          <span>Mínimo: {formatCurrency(lance.valorMinimo)}</span>
        </div>
        <Progress value={Math.min(progresso, 100)} className="h-2" />
      </div>

      {/* History */}
      {historico.length > 0 && (
        <div className="max-h-32 overflow-y-auto border border-border/30 rounded-lg">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted/80">
              <tr>
                <th className="text-left px-2 py-1 font-medium text-muted-foreground">#</th>
                <th className="text-left px-2 py-1 font-medium text-muted-foreground">Tipo</th>
                <th className="text-right px-2 py-1 font-medium text-muted-foreground">Valor</th>
                <th className="text-right px-2 py-1 font-medium text-muted-foreground">Hora</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.rodada} className="border-t border-border/20">
                  <td className="px-2 py-1">{h.rodada}</td>
                  <td className="px-2 py-1">
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        h.tipo === 'meu'
                          ? 'bg-accent/10 text-accent border-accent/30'
                          : 'bg-warning/10 text-warning border-warning/30'
                      }`}
                    >
                      {h.tipo === 'meu' ? 'Meu Lance' : 'Concorrente'}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 text-right font-mono">{formatCurrency(h.valor)}</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">
                    {h.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
