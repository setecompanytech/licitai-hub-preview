import { useState, useEffect } from 'react';
// `Badge` renderiza uma <div>; dentro de um <button> só cabe conteúdo de frase,
// então os selos que vivem na linha clicável usam `badgeVariants` num <span> —
// mesma pele, HTML conforme. Fora de botão, o componente.
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Bell, Clock, FileWarning, TrendingDown, AlertTriangle,
  CheckCircle2, CheckCheck, X, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

/** Cor do ícone por tipo — só tokens (`accent` saiu: era o mesmo verde de
 *  `primary`, com dois nomes para a mesma tinta). */
const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  prazo: { icon: Clock, color: 'text-warning-ink', label: 'Prazo' },
  documento: { icon: FileWarning, color: 'text-destructive', label: 'Documento' },
  lance: { icon: TrendingDown, color: 'text-primary', label: 'Lance' },
  edital: { icon: CheckCircle2, color: 'text-success', label: 'Edital' },
  sistema: { icon: Bell, color: 'text-muted-foreground', label: 'Sistema' },
  info: { icon: Bell, color: 'text-info', label: 'Info' },
  sucesso: { icon: CheckCircle2, color: 'text-success', label: 'Sucesso' },
  alerta: { icon: AlertTriangle, color: 'text-warning-ink', label: 'Alerta' },
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

/** Tinta do selo de tipo. A gravidade é função pura do tipo
 *  (`severityFromTipo`), então o selo escreve o tipo e a tinta vem da
 *  gravidade: um único selo, com TEXTO, no lugar de duas pistas que eram só
 *  cor (a barra da esquerda e a cor do ícone). */
const severityBadge: Record<string, 'danger' | 'warning' | 'muted'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'muted',
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
    // A posição da gaveta (top/right/z) é a que já foi ajustada contra a faixa
    // superior — só a pele mudou: cartão `bg-card`, canto `rounded-lg` e
    // sombra no teto da identidade (`shadow-md`).
    <div className="fixed top-[80px] right-2 sm:right-4 z-50 w-[calc(100vw-1rem)] sm:w-[420px] bg-card border border-border rounded-lg shadow-md animate-in slide-in-from-top-2 fade-in duration-200">
      {/* Cabeçalho. A gaveta tem ~359px num aparelho de 375px
          (`w-[calc(100vw-1rem)]`), então o lado esquerdo encolhe (`min-w-0` +
          `truncate` no título) e o rótulo de "marcar todas" só aparece a partir
          de `sm:` — exatamente onde a gaveta passa a ter 420px. Abaixo disso o
          controle é só o ícone, com o nome no `aria-label`/`title`. */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold">Notificações</h2>
          {unreadCount > 0 && (
            <Badge variant="danger" className="flex-shrink-0">
              {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={markAllRead}
            aria-label="Marcar todas como lidas"
            title="Marcar todas como lidas"
          >
            <CheckCheck aria-hidden="true" />
            <span className="hidden sm:inline">Marcar todas</span>
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar notificações" className="h-9 w-9">
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-2 border-b border-border overflow-x-auto">
        {(['all', 'info', 'sucesso', 'alerta', 'sistema'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-primary-tint hover:text-primary',
            )}
          >
            {f === 'all' ? `Todas (${notifications.length})` : `${(typeConfig[f]?.label || f)} (${notifications.filter((n) => n.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[420px]">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Carregando notificações
          </div>
        ) : filtered.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Bell />}
            titulo="Nenhuma notificação"
            descricao={filter === 'all' ? 'Você está em dia.' : 'Nada neste recorte — veja "Todas".'}
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((notif) => {
              const cfg = typeConfig[notif.type] || typeConfig.info;
              const Icon = cfg.icon;
              return (
                <button
                  key={notif.id}
                  type="button"
                  className={cn(
                    'block w-full border-l-4 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    severityBorder[notif.severity],
                    !notif.read && 'bg-primary-tint',
                  )}
                  onClick={() => {
                    markRead(notif.id);
                    if (notif.actionPath) onNavigate(notif.actionPath);
                  }}
                >
                  <span className="flex items-start gap-3">
                    <span aria-hidden="true" className={cn('mt-0.5 flex-shrink-0', cfg.color)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0 block">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-sm font-medium', notif.read && 'text-muted-foreground')}>
                          {notif.title}
                        </span>
                        <span className={badgeVariants({ variant: severityBadge[notif.severity] })}>
                          {cfg.label}
                        </span>
                        {!notif.read && (
                          <span className={badgeVariants({ variant: 'info' })}>Nova</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{notif.message}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(notif.timestamp).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Rodapé. O destino é a Central de avisos (`/avisos` no registro de
          `lib/navegacao/paginas.ts`), que é exatamente "tudo que o sistema
          detectou" — a gaveta mostra só os 50 mais recentes. `onNavigate` já
          fecha a gaveta em quem a usa hoje; o `onClose()` explícito mantém a
          promessa mesmo para outro chamador. */}
      <div className="px-4 py-2 border-t border-border text-center">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            onClose();
            onNavigate('/avisos');
          }}
        >
          Ver todas as notificações
        </Button>
      </div>
    </div>
  );
}
