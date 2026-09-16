import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, TrendingDown, Clock, Hash, DollarSign, Info,
} from 'lucide-react';
import type { LanceConfig } from './ConfigurarLanceDialog';
import { textoDoLimiteDeLances } from '@/lib/robo/estrategia-do-item';

type LanceHistorico = {
  rodada: number;
  valor: number;
  timestamp: Date;
  tipo: 'meu' | 'concorrente';
};

/** Um acontecimento da simulação — só nesta tela, nunca no banco. */
type EventoSimulado = {
  id: number;
  texto: string;
  tipo: 'info' | 'alerta' | 'fim';
  em: Date;
};

type Props = {
  lance: LanceConfig;
  onUpdate: (lance: LanceConfig) => void;
  /**
   * Mantido para não quebrar quem chama. NÃO é usado para escrever nada: a
   * simulação não publica no mural do processo (ver o comentário abaixo).
   */
  licitacaoId?: string | null;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const horaCurta = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Simulação de disputa — inteira dentro desta tela.
 *
 * ── Por que não existe mais "Mural ativo" ──────────────────────────────────
 *
 * Até 14/09/2026 esta simulação publicava "🤖 Lance Automático #n — R$ …" em
 * `licitacao_mensagens`, que é o MURAL REAL do processo — o mesmo que recebe as
 * mensagens do pregoeiro e o aviso de sessão encerrada do robô de verdade. O
 * botão nascia ligado sempre que havia processo. Quem abria o processo depois
 * lia lances que nunca existiram, com valores sorteados por `Math.random`, sem
 * nada que os distinguisse dos reais.
 *
 * Agora os eventos ficam em estado local e somem ao recarregar. Nada vai ao
 * portal, nada vai ao banco — e a tela diz isso o tempo todo.
 */
export default function SimulacaoDisputa({ lance }: Props) {
  const [running, setRunning] = useState(false);
  const [historico, setHistorico] = useState<LanceHistorico[]>([]);
  const [eventos, setEventos] = useState<EventoSimulado[]>([]);
  const [valorAtual, setValorAtual] = useState(lance.valorInicial);
  const [rodada, setRodada] = useState(0);
  const [tempoRestante, setTempoRestante] = useState(lance.intervaloSegundos);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Rodada e valor também em ref: o intervalo lê o valor corrente sem encadear
  // setState dentro de outro setState — o StrictMode executa essas funções
  // duas vezes, e o encadeamento anterior duplicava lances no histórico.
  const rodadaRef = useRef(0);
  const valorRef = useRef(lance.valorInicial);
  const proximoEventoId = useRef(0);

  const registrar = useCallback((texto: string, tipo: EventoSimulado['tipo'] = 'info') => {
    proximoEventoId.current += 1;
    const evento: EventoSimulado = { id: proximoEventoId.current, texto, tipo, em: new Date() };
    // Os 50 mais recentes bastam para acompanhar; a lista não cresce sem fim.
    setEventos((lista) => [evento, ...lista].slice(0, 50));
  }, []);

  const pararSimulacao = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    intervalRef.current = null;
    timerRef.current = null;
  }, []);

  const executarLance = useCallback(() => {
    const novaRodada = rodadaRef.current + 1;

    // Sem limite, a simulação segue até o piso — que encerra mais abaixo.
    if (lance.maxLances && novaRodada > lance.maxLances) {
      pararSimulacao();
      registrar(`Simulação encerrada — limite de ${lance.maxLances} lances atingido.`, 'fim');
      return;
    }

    const valorAnterior = valorRef.current;
    let decremento = lance.decrementoMin;
    const decrementoPct = valorAnterior * (lance.decrementoPercentual / 100);
    if (decrementoPct > decremento) decremento = decrementoPct;
    decremento = decremento * (0.8 + Math.random() * 0.4);

    let novoValor = valorAnterior - decremento;
    let atingiuPiso = false;
    if (novoValor < lance.valorMinimo) {
      novoValor = lance.valorMinimo;
      atingiuPiso = true;
    }

    const novoValorFinal = Math.round(novoValor * 100) / 100;
    const tipo: 'meu' | 'concorrente' = novaRodada % 2 === 1 ? 'meu' : 'concorrente';
    const desconto = lance.valorReferencia > 0
      ? ((1 - novoValorFinal / lance.valorReferencia) * 100).toFixed(1)
      : '0';

    rodadaRef.current = novaRodada;
    valorRef.current = novoValorFinal;
    setRodada(novaRodada);
    setValorAtual(novoValorFinal);
    setHistorico((h) => [
      { rodada: novaRodada, valor: novoValorFinal, timestamp: new Date(), tipo },
      ...h,
    ]);
    setTempoRestante(lance.intervaloSegundos);

    registrar(
      tipo === 'meu'
        ? `Lance simulado #${novaRodada} (nosso) — ${formatCurrency(novoValorFinal)} · desconto de ${desconto}% sobre a referência`
        : `Lance simulado #${novaRodada} (concorrente) — ${formatCurrency(novoValorFinal)} · desconto de ${desconto}%`,
      tipo === 'meu' ? 'info' : 'alerta',
    );

    if (atingiuPiso) {
      pararSimulacao();
      registrar(
        `Simulação finalizada — piso de ${formatCurrency(lance.valorMinimo)} atingido. ` +
        `Economia simulada: ${formatCurrency(lance.valorReferencia - novoValorFinal)}.`,
        'fim',
      );
    }
  }, [lance, pararSimulacao, registrar]);

  const iniciarSimulacao = useCallback(() => {
    setRunning(true);
    setTempoRestante(lance.intervaloSegundos);

    registrar(
      `Simulação iniciada — ${lance.edital} (${lance.portal}) · referência ` +
      `${formatCurrency(lance.valorReferencia)} · inicial ${formatCurrency(lance.valorInicial)} · ` +
      `piso ${formatCurrency(lance.valorMinimo)} · a cada ${lance.intervaloSegundos}s, ${lance.maxLances ? `até ${lance.maxLances} lances` : 'sem limite de lances'}`,
    );

    // Os relógios nascem ANTES do primeiro lance: se ele já bater no piso,
    // `pararSimulacao` precisa encontrá-los para desligar.
    timerRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) return lance.intervaloSegundos;
        return prev - 1;
      });
    }, 1000);

    intervalRef.current = setInterval(() => {
      executarLance();
    }, lance.intervaloSegundos * 1000);

    executarLance();
  }, [lance, executarLance, registrar]);

  const resetarSimulacao = useCallback(() => {
    pararSimulacao();
    rodadaRef.current = 0;
    valorRef.current = lance.valorInicial;
    setValorAtual(lance.valorInicial);
    setRodada(0);
    setHistorico([]);
    setEventos([]);
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
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold">
            Simulação de Disputa
          </h4>
          {running && (
            <Badge variant="success" className="animate-pulse">
              Em andamento
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <Button variant="outline" onClick={iniciarSimulacao} disabled={!!lance.maxLances && rodada >= lance.maxLances}>
              <Play className="w-4 h-4" aria-hidden="true" /> {rodada > 0 ? 'Retomar' : 'Iniciar'}
            </Button>
          ) : (
            <Button variant="outline" onClick={pararSimulacao}>
              <Pause className="w-4 h-4" aria-hidden="true" /> Pausar
            </Button>
          )}
          <Button variant="ghost" onClick={resetarSimulacao}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> Resetar
          </Button>
        </div>
      </div>

      {/* O aviso é permanente, não um selo que aparece só rodando: quem olha
          um número de lance precisa saber, sempre, que ele não existe. */}
      <div
        role="note"
        className="flex items-start gap-2 px-3 py-2 bg-muted rounded-md border border-border text-sm text-muted-foreground"
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <strong className="text-foreground">Simulação — nada é enviado ao portal.</strong>{' '}
          Os lances abaixo são sorteados nesta tela, não entram no mural do processo e somem
          ao recarregar a página.
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <div className="bg-muted rounded-lg p-3 text-center">
          <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Valor Atual</p>
          <p className="text-base font-bold text-foreground tabular-nums">{formatCurrency(valorAtual)}</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <TrendingDown className="w-4 h-4 mx-auto text-success mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Economia</p>
          <p className="text-base font-bold text-success-ink tabular-nums">{formatCurrency(economia)}</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <Hash className="w-4 h-4 mx-auto text-muted-foreground mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Rodada</p>
          <p className="text-base font-bold tabular-nums">{rodada} / {textoDoLimiteDeLances(lance.maxLances)}</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Próximo em</p>
          <p className="text-base font-bold tabular-nums">{running ? `${tempoRestante}s` : '—'}</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <DollarSign className="w-4 h-4 mx-auto text-destructive mb-1" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Piso</p>
          <p className="text-base font-bold text-destructive-ink tabular-nums">{formatCurrency(lance.valorMinimo)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1 tabular-nums">
          <span>Referência: {formatCurrency(lance.valorReferencia)}</span>
          <span>Mínimo: {formatCurrency(lance.valorMinimo)}</span>
        </div>
        <Progress value={Math.min(progresso, 100)} className="h-2" aria-label="Progresso da simulação entre referência e piso" />
      </div>

      {/* History */}
      {historico.length > 0 && (
        <div className="max-h-32 overflow-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="text-left px-3 py-2 text-sm font-semibold">#</th>
                <th className="text-left px-3 py-2 text-sm font-semibold">Tipo</th>
                <th className="text-right px-3 py-2 text-sm font-semibold">Valor</th>
                <th className="text-right px-3 py-2 text-sm font-semibold">Hora</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.rodada} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{h.rodada}</td>
                  <td className="px-3 py-2">
                    <Badge variant={h.tipo === 'meu' ? 'info' : 'warning'}>
                      {h.tipo === 'meu' ? 'Meu Lance' : 'Concorrente'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(h.valor)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {horaCurta(h.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Eventos — o que antes ia para o mural real, agora só aqui. */}
      {eventos.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted">
            Eventos da simulação (só nesta tela)
          </p>
          <ul className="max-h-32 overflow-auto divide-y divide-border text-sm">
            {eventos.map((e) => (
              <li key={e.id} className="px-3 py-2 flex gap-2">
                <span className="text-muted-foreground tabular-nums shrink-0">{horaCurta(e.em)}</span>
                <span
                  className={
                    e.tipo === 'alerta'
                      ? 'text-warning-ink'
                      : e.tipo === 'fim'
                      ? 'font-medium text-foreground'
                      : 'text-foreground'
                  }
                >
                  {e.texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
