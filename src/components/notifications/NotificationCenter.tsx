import { useState, useEffect } from 'react';
// `Badge` renderiza uma <div>; dentro de um <button> só cabe conteúdo de frase,
// então os selos que vivem na linha clicável usam `badgeVariants` num <span> —
// mesma pele, HTML conforme. Fora de botão, o componente.
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Bell, Clock, FileWarning, TrendingDown, AlertTriangle,
  CheckCircle2, CheckCheck, X
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

/** Ladrilho do ícone por tipo — o trio tinta/tinta-escura do manual (§2), nunca
 *  ícone colorido solto sobre branco. */
const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  prazo: { icon: Clock, color: 'bg-warning-tint text-warning-ink', label: 'Prazo' },
  documento: { icon: FileWarning, color: 'bg-destructive-tint text-destructive-ink', label: 'Documento' },
  lance: { icon: TrendingDown, color: 'bg-primary-tint text-primary', label: 'Lance' },
  edital: { icon: CheckCircle2, color: 'bg-success-tint text-success-ink', label: 'Edital' },
  sistema: { icon: Bell, color: 'bg-muted text-muted-foreground', label: 'Sistema' },
  info: { icon: Bell, color: 'bg-info-tint text-info-ink', label: 'Info' },
  sucesso: { icon: CheckCircle2, color: 'bg-success-tint text-success-ink', label: 'Sucesso' },
  alerta: { icon: AlertTriangle, color: 'bg-warning-tint text-warning-ink', label: 'Alerta' },
};

const severityFromTipo = (tipo: string): 'info' | 'warning' | 'critical' => {
  if (tipo === 'alerta' || tipo === 'lance' || tipo === 'prazo') return 'critical';
  if (tipo === 'documento') return 'warning';
  return 'info';
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
    // superior — só a pele mudou: cartão `bg-card`, canto de menu (`rounded-xl`)
    // e a sombra de modal (`shadow-xl`), como manda o manual (§4).
    <div className="fixed right-2 top-[calc(var(--g-topo)+0.5rem)] z-50 w-[calc(100vw-1rem)] rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 sm:right-4 sm:w-[420px]">
      {/* Cabeçalho. A gaveta tem ~359px num aparelho de 375px
          (`w-[calc(100vw-1rem)]`), então o lado esquerdo encolhe (`min-w-0` +
          `truncate` no título) e o rótulo de "marcar todas" só aparece a partir
          de `sm:` — exatamente onde a gaveta passa a ter 420px. Abaixo disso o
          controle é só o ícone, com o nome no `aria-label`/`title`. */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-lg font-semibold leading-6 text-foreground">Notificações</h2>
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
            className="text-muted-foreground hover:text-foreground"
          >
            <CheckCheck aria-hidden="true" />
            <span className="hidden sm:inline">Marcar todas</span>
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Chips de filtro: o ativo na superfície da ação (tinta + contorno),
          os outros na superfície rebaixada. */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
        {(['all', 'info', 'sucesso', 'alerta', 'sistema'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-sm border px-2.5 text-xs font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === f
                ? 'border-primary-line bg-primary-tint text-primary'
                : 'border-transparent bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' ? `Todas (${notifications.length})` : `${(typeConfig[f]?.label || f)} (${notifications.filter((n) => n.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[min(60vh,440px)]">
        {loading ? (
          /* A espera na forma da lista que vai chegar (manual §5): ladrilho e
             duas linhas por aviso; o texto continua, para o leitor de tela. */
          <div role="status" aria-live="polite" className="divide-y divide-border">
            <span className="sr-only">Carregando notificações</span>
            {[0, 1, 2].map((i) => (
              <div key={i} aria-hidden="true" className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
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
                    'block w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !notif.read && 'bg-primary-tint hover:bg-primary-tint/70',
                  )}
                  onClick={() => {
                    markRead(notif.id);
                    if (notif.actionPath) onNavigate(notif.actionPath);
                  }}
                >
                  <span className="flex items-start gap-3">
                    {/* Ladrilho de 32px com o ícone de 16px, tingido pelo tipo. */}
                    <span
                      aria-hidden="true"
                      className={cn('inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md', cfg.color)}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="block min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn('text-base font-medium leading-5', notif.read ? 'text-muted-foreground' : 'text-foreground')}>
                          {notif.title}
                        </span>
                        <span className={badgeVariants({ variant: severityBadge[notif.severity] })}>
                          {cfg.label}
                        </span>
                        {!notif.read && (
                          <span className={badgeVariants({ variant: 'info' })}>Nova</span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm leading-[18px] text-muted-foreground">{notif.message}</span>
                      <span className="mt-1 block text-xs tabular-nums text-foreground-tertiary">
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
      <div className="border-t border-border px-4 py-2 text-center">
        <Button
          size="sm"
          variant="link"
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
