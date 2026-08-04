import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, TrendingDown, Clock, Hash, DollarSign,
  MessageSquare, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  licitacaoId?: string | null;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SimulacaoDisputa({ lance, onUpdate, licitacaoId }: Props) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [historico, setHistorico] = useState<LanceHistorico[]>([]);
  const [valorAtual, setValorAtual] = useState(lance.valorInicial);
  const [rodada, setRodada] = useState(0);
  const [tempoRestante, setTempoRestante] = useState(lance.intervaloSegundos);
  const [muralSync, setMuralSync] = useState(!!licitacaoId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Post event to mural (licitacao_mensagens)
  const postToMural = useCallback(async (conteudo: string, tipo: 'sistema' | 'alerta' | 'sucesso' = 'sistema') => {
    const lid = licitacaoId || lance.licitacaoId;
    if (!muralSync || !lid || !user) return;
    try {
      await supabase.from('licitacao_mensagens').insert({
        licitacao_id: lid,
        user_id: user.id,
        conteudo,
        tipo,
      });
    } catch (err) {
      console.error('Erro ao postar no mural:', err);
    }
  }, [muralSync, licitacaoId, lance.licitacaoId, user]);

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
        postToMural(
          `⏹️ **Simulação encerrada** — Limite de ${lance.maxLances} lances atingido.\n` +
          `📋 Edital: ${lance.edital}`,
          'alerta'
        );
        return prev;
      }

      setValorAtual((prevValor) => {
        let decremento = lance.decrementoMin;
        const decrementoPct = prevValor * (lance.decrementoPercentual / 100);
        if (decrementoPct > decremento) decremento = decrementoPct;

        const fatorAleatorio = 0.8 + Math.random() * 0.4;
        decremento = decremento * fatorAleatorio;

        let novoValor = prevValor - decremento;
        let atingiuPiso = false;

        if (novoValor < lance.valorMinimo) {
          novoValor = lance.valorMinimo;
          atingiuPiso = true;
          setTimeout(() => pararSimulacao(), 100);
        }

        const novoValorFinal = Math.round(novoValor * 100) / 100;
        const tipo: 'meu' | 'concorrente' = novaRodada % 2 === 1 ? 'meu' : 'concorrente';

        setHistorico((h) => [
          { rodada: novaRodada, valor: novoValorFinal, timestamp: new Date(), tipo },
          ...h,
        ]);

        // Post to mural
        const desconto = lance.valorReferencia > 0
          ? ((1 - novoValorFinal / lance.valorReferencia) * 100).toFixed(1)
          : '0';

        if (tipo === 'meu') {
          postToMural(
            `🤖 **Lance Automático #${novaRodada}** — ${formatCurrency(novoValorFinal)}\n` +
            `📉 Desconto: ${desconto}% sobre referência\n` +
            `📋 Edital: ${lance.edital}`,
            'sistema'
          );
        } else {
          postToMural(
            `⚡ **Lance Concorrente #${novaRodada}** — ${formatCurrency(novoValorFinal)}\n` +
            `📉 Desconto: ${desconto}% sobre referência`,
            'alerta'
          );
        }

        if (atingiuPiso) {
          postToMural(
            `🏁 **Simulação finalizada** — Valor mínimo (piso) atingido: ${formatCurrency(lance.valorMinimo)}\n` +
            `💰 Economia total: ${formatCurrency(lance.valorReferencia - novoValorFinal)}\n` +
            `📊 Desconto final: ${desconto}%\n` +
            `📋 Edital: ${lance.edital}`,
            'sucesso'
          );
        }

        return novoValorFinal;
      });

      setTempoRestante(lance.intervaloSegundos);
      return novaRodada;
    });
  }, [lance, pararSimulacao, postToMural]);

  const iniciarSimulacao = useCallback(() => {
    setRunning(true);
    setTempoRestante(lance.intervaloSegundos);

    postToMural(
      `▶️ **Simulação de disputa iniciada**\n` +
      `📋 Edital: ${lance.edital}\n` +
      `🏢 Portal: ${lance.portal}\n` +
      `💰 Valor de Referência: ${formatCurrency(lance.valorReferencia)}\n` +
      `🎯 Valor Inicial: ${formatCurrency(lance.valorInicial)}\n` +
      `⬇️ Piso: ${formatCurrency(lance.valorMinimo)}\n` +
      `⏱️ Intervalo: ${lance.intervaloSegundos}s | Máx: ${lance.maxLances} lances`,
      'sistema'
    );

    executarLance();

    timerRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) return lance.intervaloSegundos;
        return prev - 1;
      });
    }, 1000);

    intervalRef.current = setInterval(() => {
      executarLance();
    }, lance.intervaloSegundos * 1000);
  }, [lance, executarLance, postToMural]);

  const resetarSimulacao = useCallback(() => {
    pararSimulacao();
    setValorAtual(lance.valorInicial);
    setRodada(0);
    setHistorico([]);
    setTempoRestante(lance.intervaloSegundos);

    postToMural(
      `🔄 **Simulação resetada** — Parâmetros restaurados ao estado inicial.\n📋 Edital: ${lance.edital}`,
      'sistema'
    );
  }, [lance, pararSimulacao, postToMural]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const lidAtivo = licitacaoId || lance.licitacaoId;
  const progresso = lance.valorReferencia > lance.valorMinimo
    ? ((lance.valorReferencia - valorAtual) / (lance.valorReferencia - lance.valorMinimo)) * 100
    : 0;

  const economia = lance.valorReferencia - valorAtual;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Simulação de Disputa
          </h4>
          {running && (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs animate-pulse">
              Em andamento
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mural sync toggle */}
          {lidAtivo && (
            <button
              onClick={() => setMuralSync(!muralSync)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                muralSync
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
              title={muralSync ? 'Sincronizando com o Mural' : 'Mural desativado'}
            >
              <MessageSquare className="w-3 h-3" />
              {muralSync ? 'Mural ativo' : 'Mural off'}
            </button>
          )}
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
      </div>

      {/* Mural sync indicator */}
      {muralSync && lidAtivo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 rounded-lg border border-accent/15 text-xs text-accent">
          <Zap className="w-3 h-3" />
          <span>Eventos da simulação serão publicados no Mural do Processo em tempo real</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <DollarSign className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Valor Atual</p>
          <p className="text-xs font-bold text-accent">{formatCurrency(valorAtual)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <TrendingDown className="w-3 h-3 mx-auto text-success mb-1" />
          <p className="text-xs text-muted-foreground">Economia</p>
          <p className="text-xs font-bold text-success">{formatCurrency(economia)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <Hash className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Rodada</p>
          <p className="text-xs font-bold">{rodada} / {lance.maxLances}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <Clock className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Próximo em</p>
          <p className="text-xs font-bold">{running ? `${tempoRestante}s` : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <DollarSign className="w-3 h-3 mx-auto text-destructive mb-1" />
          <p className="text-xs text-muted-foreground">Piso</p>
          <p className="text-xs font-bold text-destructive">{formatCurrency(lance.valorMinimo)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Referência: {formatCurrency(lance.valorReferencia)}</span>
          <span>Mínimo: {formatCurrency(lance.valorMinimo)}</span>
        </div>
        <Progress value={Math.min(progresso, 100)} className="h-2" />
      </div>

      {/* History */}
      {historico.length > 0 && (
        <div className="max-h-32 overflow-y-auto border border-border/30 rounded-lg">
          <table className="w-full text-xs">
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
                      className={`text-xs ${
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
