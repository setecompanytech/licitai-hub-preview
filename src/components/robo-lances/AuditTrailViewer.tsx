import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History, Play, Pause, RotateCcw, Shield, AlertTriangle,
  ArrowDown, CheckCircle2, XCircle, Key, OctagonX, Eye,
} from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';

const EVENTO_CONFIG: Record<string, {
  icon: typeof Shield;
  cor: string;
  label: string;
}> = {
  sessao_criada: { icon: Play, cor: 'text-info', label: 'Sessão criada' },
  sessao_iniciada: { icon: Play, cor: 'text-success', label: 'Sessão iniciada' },
  sessao_pausada: { icon: Pause, cor: 'text-warning', label: 'Sessão pausada' },
  sessao_encerrada: { icon: XCircle, cor: 'text-muted-foreground', label: 'Sessão encerrada' },
  lance_enviado: { icon: ArrowDown, cor: 'text-accent', label: 'Lance enviado' },
  lance_concorrente: { icon: ArrowDown, cor: 'text-warning', label: 'Lance concorrente' },
  aceite_termos: { icon: Shield, cor: 'text-success', label: 'Aceite de termos' },
  nivel_alterado: { icon: Shield, cor: 'text-info', label: 'Nível alterado' },
  parada_emergencial: { icon: OctagonX, cor: 'text-destructive', label: 'PARADA EMERGENCIAL' },
  limite_atingido: { icon: AlertTriangle, cor: 'text-destructive', label: 'Limite atingido' },
  autorizacao_lance: { icon: CheckCircle2, cor: 'text-success', label: 'Lance autorizado' },
  '2fa_verificado': { icon: Key, cor: 'text-accent', label: '2FA verificado' },
  estrategia_aprovada: { icon: Shield, cor: 'text-success', label: 'Estratégia aprovada' },
  alerta_risco: { icon: AlertTriangle, cor: 'text-warning', label: 'Alerta de risco' },
  replay_solicitado: { icon: History, cor: 'text-info', label: 'Replay solicitado' },
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
    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-xs font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          Trilha de Auditoria Imutável
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] bg-muted">
            {entries.length} eventos
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={handleReplay}
            disabled={replaying || entries.length === 0}
          >
            {replaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {replaying ? 'Reproduzindo...' : 'Replay'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7"
            onClick={async () => {
              setLoading(true);
              const data = await buscarHistorico(sessaoId);
              setEntries(data);
              setLoading(false);
            }}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-52">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">Carregando auditoria...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Eye className="w-6 h-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
            <p className="text-[10px] text-muted-foreground">Os eventos aparecerão aqui à medida que ações forem realizadas.</p>
          </div>
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
                  className={`flex items-start gap-2.5 py-1.5 px-2 rounded-lg transition-all text-[11px] ${
                    isHighlighted
                      ? 'bg-accent/10 ring-1 ring-accent/30'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.cor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{config.label}</span>
                      <Badge variant="outline" className="text-[8px] scale-90">
                        N{entry.nivel_automacao}
                      </Badge>
                      {entry.valor_lance && (
                        <span className="font-mono text-accent">
                          {formatCurrency(entry.valor_lance)}
                        </span>
                      )}
                      {entry.rodada && (
                        <span className="text-muted-foreground">R{entry.rodada}</span>
                      )}
                      {entry.hash_registro && (
                        <span className="font-mono text-[8px] text-muted-foreground/60 truncate max-w-[100px]" title={`Hash: ${entry.hash_registro}\nAnterior: ${entry.hash_anterior}`}>
                          🔗 #{entry.hash_registro.slice(0, 12)}
                        </span>
                      )}
                    </div>
                    {Object.keys(entry.detalhes).length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {JSON.stringify(entry.detalhes).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">
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
