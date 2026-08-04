import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, Clock, FileWarning, TrendingDown, AlertTriangle,
  CheckCircle2, X, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationType = 'prazo' | 'documento' | 'lance' | 'edital' | 'sistema' | 'info' | 'sucesso' | 'alerta';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
  actionPath?: string;
};

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  prazo: { icon: Clock, color: 'text-warning', label: 'Prazo' },
  documento: { icon: FileWarning, color: 'text-destructive', label: 'Documento' },
  lance: { icon: TrendingDown, color: 'text-accent', label: 'Lance' },
  edital: { icon: CheckCircle2, color: 'text-success', label: 'Edital' },
  sistema: { icon: Bell, color: 'text-muted-foreground', label: 'Sistema' },
  info: { icon: Bell, color: 'text-info', label: 'Info' },
  sucesso: { icon: CheckCircle2, color: 'text-success', label: 'Sucesso' },
  alerta: { icon: AlertTriangle, color: 'text-warning', label: 'Alerta' },
};

const severityFromTipo = (tipo: string): 'info' | 'warning' | 'critical' => {
  if (tipo === 'alerta' || tipo === 'lance' || tipo === 'prazo') return 'critical';
  if (tipo === 'documento') return 'warning';
  return 'info';
};

const severityBorder: Record<string, string> = {
  critical: 'border-l-destructive',
  warning: 'border-l-warning',
  info: 'border-l-border',
};

export default function NotificationCenter({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    loadNotifications();
  }, [open, user]);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const mapped: Notification[] = (data || []).map((n: any) => ({
      id: n.id,
      type: n.tipo || 'info',
      title: n.titulo,
      message: n.mensagem || '',
      timestamp: n.created_at,
      read: n.lida || false,
      severity: severityFromTipo(n.tipo || 'info'),
      actionPath: n.link,
    }));
    setNotifications(mapped);
    setLoading(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const markAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('user_id', user.id)
      .eq('lida', false);
  };

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
  };

  if (!open) return null;

  return (
    <div className="fixed top-16 right-2 sm:right-4 z-50 w-[calc(100vw-1rem)] sm:w-[420px] bg-card border border-border rounded-xl shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={markAllRead}>
            Marcar todas como lidas
          </Button>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto">
        {(['all', 'info', 'sucesso', 'alerta', 'sistema'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? `Todas (${notifications.length})` : `${(typeConfig[f]?.label || f)} (${notifications.filter((n) => n.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[420px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((notif) => {
              const cfg = typeConfig[notif.type] || typeConfig.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-l-[3px] ${severityBorder[notif.severity]} ${
                    !notif.read ? 'bg-accent/5' : ''
                  } hover:bg-muted/30 transition-colors cursor-pointer`}
                  onClick={() => {
                    markRead(notif.id);
                    if (notif.actionPath) onNavigate(notif.actionPath);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${!notif.read ? '' : 'text-muted-foreground'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {new Date(notif.timestamp).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-center">
        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
          Ver todas as notificações
        </Button>
      </div>
    </div>
  );
}
