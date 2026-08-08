import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Zap, TrendingDown, Clock } from 'lucide-react';
import { toast } from 'sonner';

type RealtimeEvent = {
  id: string;
  evento: string;
  valor_lance: number | null;
  rodada: number | null;
  created_at: string;
  hash_registro: string | null;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DisputaRealtimePanel() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('audit-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_log_lances',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newEvent = payload.new as RealtimeEvent;
          setEvents(prev => [newEvent, ...prev].slice(0, 50));

          // Show toast for important events
          if (newEvent.evento === 'lance_enviado') {
            toast.success(`Lance enviado: ${newEvent.valor_lance ? formatCurrency(newEvent.valor_lance) : 'N/I'}`, {
              duration: 3000,
            });
          } else if (newEvent.evento === 'parada_emergencial') {
            toast.warning('🛑 Parada emergencial detectada!', { duration: 10000 });
          } else if (newEvent.evento === 'lance_concorrente') {
            toast.info(`⚡ Lance concorrente: ${newEvent.valor_lance ? formatCurrency(newEvent.valor_lance) : 'N/I'}`, {
              duration: 3000,
            });
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-xs font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          Disputas em Tempo Real
        </h3>
        <Badge
          variant="outline"
          className={`text-xs gap-1 ${
            connected
              ? 'bg-success/15 text-success border-success/30'
              : 'bg-destructive/15 text-destructive border-destructive/30'
          }`}
        >
          {connected ? (
            <><Wifi className="w-3 h-3" /> WebSocket Conectado</>
          ) : (
            <><WifiOff className="w-3 h-3" /> Desconectado</>
          )}
        </Badge>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-4">
          <Wifi className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {connected ? 'Aguardando eventos em tempo real...' : 'Conectando ao canal de disputas...'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Lances, alertas e paradas emergenciais aparecerão aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30"
            >
              {evt.evento === 'lance_enviado' ? (
                <TrendingDown className="w-3 h-3 text-info shrink-0" />
              ) : evt.evento === 'lance_concorrente' ? (
                <TrendingDown className="w-3 h-3 text-warning shrink-0" />
              ) : (
                <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium">{evt.evento.replace(/_/g, ' ')}</span>
              {evt.valor_lance && (
                <span className="font-mono font-semibold text-foreground">{formatCurrency(evt.valor_lance)}</span>
              )}
              {evt.rodada && (
                <span className="text-muted-foreground">R{evt.rodada}</span>
              )}
              {evt.hash_registro && (
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[80px]" title={evt.hash_registro}>
                  #{evt.hash_registro.slice(0, 8)}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {new Date(evt.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
