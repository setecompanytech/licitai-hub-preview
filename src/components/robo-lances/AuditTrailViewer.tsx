import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History, Play, Pause, RotateCcw, Shield, AlertTriangle,
  ArrowDown, CheckCircle2, XCircle, Key, OctagonX, Eye,
} from 'lucide-react';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useAuditLog } from '@/hooks/useAuditLog';

const EVENTO_CONFIG: Record<string, {
  icon: typeof Shield;
  cor: string;
  label: string;
}> = {
  sessao_criada: { icon: Play, cor: 'text-foreground', label: 'Sessão criada' },
  sessao_iniciada: { icon: Play, cor: 'text-success', label: 'Sessão iniciada' },
  sessao_pausada: { icon: Pause, cor: 'text-warning', label: 'Sessão pausada' },
  sessao_encerrada: { icon: XCircle, cor: 'text-muted-foreground', label: 'Sessão encerrada' },
  lance_enviado: { icon: ArrowDown, cor: 'text-foreground', label: 'Lance enviado' },
  lance_concorrente: { icon: ArrowDown, cor: 'text-warning', label: 'Lance concorrente' },
  aceite_termos: { icon: Shield, cor: 'text-success', label: 'Aceite de termos' },
  nivel_alterado: { icon: Shield, cor: 'text-foreground', label: 'Nível alterado' },
  parada_emergencial: { icon: OctagonX, cor: 'text-destructive', label: 'PARADA EMERGENCIAL' },
  limite_atingido: { icon: AlertTriangle, cor: 'text-destructive', label: 'Limite atingido' },
  autorizacao_lance: { icon: CheckCircle2, cor: 'text-success', label: 'Lance autorizado' },
  '2fa_verificado': { icon: Key, cor: 'text-success', label: '2FA verificado' },
  estrategia_aprovada: { icon: Shield, cor: 'text-success', label: 'Estratégia aprovada' },
  alerta_risco: { icon: AlertTriangle, cor: 'text-warning', label: 'Alerta de risco' },
  replay_solicitado: { icon: History, cor: 'text-foreground', label: 'Replay solicitado' },
};

type Props = {
  sessaoId?: string;
};

type AuditEntry = {
  id: string;
  evento: string;
  detalhes: Record<string, unknown>;
  valor_lance: number | null;
  rodada: number | null;
  nivel_automacao: number;
  created_at: string;
  hash_registro: string | null;
  hash_anterior: string | null;
};

export default function AuditTrailViewer({ sessaoId }: Props) {
  const { buscarHistorico } = useAuditLog();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(-1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await buscarHistorico(sessaoId);
      setEntries(data);
      setLoading(false);
    };
    load();
  }, [sessaoId, buscarHistorico]);

  const handleReplay = () => {
    if (entries.length === 0) return;
    setReplaying(true);
    setReplayIndex(entries.length - 1);

    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setReplaying(false);
          return -1;
        }
        return prev - 1;
      });
    }, 800);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Trilha de Auditoria Imutável
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">
            {entries.length} eventos
          </Badge>
          <Button
            variant="outline"
            onClick={handleReplay}
            disabled={replaying || entries.length === 0}
          >
            {replaying ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
            {replaying ? 'Reproduzindo...' : 'Replay'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Recarregar trilha"
            onClick={async () => {
              setLoading(true);
              const data = await buscarHistorico(sessaoId);
              setEntries(data);
              setLoading(false);
            }}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-52">
        {loading ? (
          <div className="space-y-2 pr-3" role="status" aria-busy="true">
            <span className="sr-only">Carregando auditoria</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <Skeleton className="h-4 flex-1 max-w-[220px]" />
                <Skeleton className="h-4 w-14 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EstadoVazio
            icone={<Eye />}
            titulo="Nenhum evento registrado"
            descricao="Os eventos aparecerão aqui à medida que ações forem realizadas."
            tamanho="compacto"
          />
        ) : (
          <div className="space-y-1 pr-3">
            {entries.map((entry, i) => {
              const config = EVENTO_CONFIG[entry.evento] || {
                icon: Shield,
                cor: 'text-muted-foreground',
                label: entry.evento,
              };
              const Icon = config.icon;
              const isHighlighted = replaying && i === replayIndex;

              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 py-2 px-2 rounded-md transition-all text-sm ${
                    isHighlighted
                      ? 'bg-primary-tint ring-1 ring-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.cor}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{config.label}</span>
                      <Badge variant="muted">
                        N{entry.nivel_automacao}
                      </Badge>
                      {entry.valor_lance && (
                        <span className="tabular-nums font-semibold text-foreground">
                          {formatCurrency(entry.valor_lance)}
                        </span>
                      )}
                      {entry.rodada && (
                        <span className="text-muted-foreground">R{entry.rodada}</span>
                      )}
                      {entry.hash_registro && (
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[100px]" title={`Hash: ${entry.hash_registro}\nAnterior: ${entry.hash_anterior}`}>
                          🔗 #{entry.hash_registro.slice(0, 12)}
                        </span>
                      )}
                    </div>
                    {Object.keys(entry.detalhes).length > 0 && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {JSON.stringify(entry.detalhes).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                    {new Date(entry.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
