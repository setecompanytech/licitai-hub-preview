import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, Clock, FileWarning, TrendingDown, AlertTriangle,
  CheckCircle2, X, ChevronDown
} from 'lucide-react';

export type NotificationType = 'prazo' | 'documento' | 'lance' | 'edital' | 'sistema';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
  action?: string;
  actionPath?: string;
};

const mockNotifications: Notification[] = [
  {
    id: '1', type: 'prazo', title: 'Prazo vencendo em 24h',
    message: 'PE-001/2026 – Proposta deve ser enviada até amanhã 18:00.',
    timestamp: '2026-02-21T10:30:00', read: false, severity: 'critical',
    action: 'Ver licitação', actionPath: '/licitacoes',
  },
  {
    id: '2', type: 'prazo', title: 'Prazo vencendo em 48h',
    message: 'CC-003/2026 – Habilitação encerra em 23/02/2026.',
    timestamp: '2026-02-21T09:15:00', read: false, severity: 'warning',
    action: 'Ver licitação', actionPath: '/licitacoes',
  },
  {
    id: '3', type: 'documento', title: 'CRF (FGTS) vencido',
    message: 'Certidão de Regularidade do FGTS venceu em 10/01/2026. Renove imediatamente.',
    timestamp: '2026-02-21T08:00:00', read: false, severity: 'critical',
    action: 'Ir para Documentos', actionPath: '/documentos',
  },
  {
    id: '4', type: 'documento', title: 'Certidão da Junta vencendo',
    message: 'Certidão Simplificada da Junta Comercial vence em 15/03/2026.',
    timestamp: '2026-02-21T08:00:00', read: false, severity: 'warning',
    action: 'Ir para Documentos', actionPath: '/documentos',
  },
  {
    id: '5', type: 'documento', title: 'CAT ausente',
    message: 'Certidão de Acervo Técnico ainda não foi enviada. Documento obrigatório.',
    timestamp: '2026-02-20T17:00:00', read: true, severity: 'warning',
    action: 'Enviar documento', actionPath: '/documentos',
  },
  {
    id: '6', type: 'lance', title: 'Lance sendo superado!',
    message: 'PE-012/2026 (Compras.gov.br) – Concorrente deu lance de R$ 865.000. Você está perdendo.',
    timestamp: '2026-02-21T14:52:00', read: false, severity: 'critical',
    action: 'Ir para Robô de Lances', actionPath: '/robo-lances',
  },
  {
    id: '7', type: 'lance', title: 'Lance perdendo – CC-003/2026',
    message: 'BLL Compras – Seu lance de R$ 2.250.000 foi superado por R$ 2.200.000.',
    timestamp: '2026-02-21T14:45:00', read: false, severity: 'critical',
    action: 'Dar novo lance', actionPath: '/robo-lances',
  },
  {
    id: '8', type: 'edital', title: 'Novo edital compatível',
    message: 'PE-099/2026 – Construção de ponte em Belém/PA. Valor: R$ 8.500.000.',
    timestamp: '2026-02-21T07:30:00', read: true, severity: 'info',
    action: 'Ver edital', actionPath: '/licitacoes',
  },
  {
    id: '9', type: 'lance', title: 'Sessão iniciando em 15min',
    message: 'PE-045/2026 (Licitações-e) inicia às 16:00. Prepare seu lance.',
    timestamp: '2026-02-21T15:45:00', read: false, severity: 'warning',
    action: 'Preparar lance', actionPath: '/robo-lances',
  },
  {
    id: '10', type: 'sistema', title: 'Portal BLC reconectado',
    message: 'A conexão com BLC Licitações foi restabelecida com sucesso.',
    timestamp: '2026-02-21T06:00:00', read: true, severity: 'info',
  },
];

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
  prazo: { icon: Clock, color: 'text-warning', label: 'Prazo' },
  documento: { icon: FileWarning, color: 'text-destructive', label: 'Documento' },
  lance: { icon: TrendingDown, color: 'text-accent', label: 'Lance' },
  edital: { icon: CheckCircle2, color: 'text-success', label: 'Edital' },
  sistema: { icon: Bell, color: 'text-muted-foreground', label: 'Sistema' },
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
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  if (!open) return null;

  return (
    <div className="fixed top-16 right-4 z-50 w-[420px] bg-card border border-border rounded-xl shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">
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
        {(['all', 'prazo', 'documento', 'lance', 'edital', 'sistema'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? `Todas (${notifications.length})` : `${typeConfig[f].label} (${notifications.filter((n) => n.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[420px]">
        <div className="divide-y divide-border/50">
          {filtered.map((notif) => {
            const cfg = typeConfig[notif.type];
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
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(notif.timestamp).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {notif.action && (
                        <span className="text-[11px] text-accent font-medium">{notif.action} →</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
