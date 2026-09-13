import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare, Send, Loader2, Bot, User, Info, AlertTriangle,
  CheckCircle2, Volume2, VolumeX,
} from 'lucide-react';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { playNotificationSound, isSoundEnabled, setSoundEnabled } from '@/lib/notification-sound';

type Mensagem = {
  id: string;
  licitacao_id: string;
  user_id: string;
  conteudo: string;
  tipo: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Props = {
  licitacaoId: string;
  licitacaoNumero?: string;
};

const tipoIcons: Record<string, typeof Info> = {
  sistema: Bot,
  alerta: AlertTriangle,
  sucesso: CheckCircle2,
  mensagem: User,
};

const tipoColors: Record<string, string> = {
  sistema: 'bg-muted text-muted-foreground',
  alerta: 'bg-warning-tint text-warning-ink',
  sucesso: 'bg-success-tint text-success-ink',
  mensagem: 'bg-primary-tint text-primary',
};

export default function LicitacaoChat({ licitacaoId, licitacaoNumero }: Props) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Load messages
  useEffect(() => {
    if (!user || !licitacaoId) return;

    const loadMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('licitacao_mensagens')
        .select('*')
        .eq('licitacao_id', licitacaoId)
        .order('created_at', { ascending: true });

      setMensagens((data as Mensagem[]) || []);
      setLoading(false);
      initialLoadDone.current = true;
    };

    loadMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`licitacao_chat_${licitacaoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'licitacao_mensagens',
          filter: `licitacao_id=eq.${licitacaoId}`,
        },
        (payload) => {
          const newMsg = payload.new as Mensagem;
          setMensagens((prev) => [...prev, newMsg]);
          // Play sound for incoming messages (not own)
          if (initialLoadDone.current && newMsg.user_id !== user?.id && isSoundEnabled()) {
            const soundType = newMsg.tipo === 'alerta' ? 'alert' : newMsg.tipo === 'sucesso' ? 'success' : 'message';
            playNotificationSound(soundType);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, licitacaoId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || sending) return;

    setSending(true);
    const { error } = await supabase.from('licitacao_mensagens').insert({
      licitacao_id: licitacaoId,
      user_id: user.id,
      conteudo: input.trim(),
      tipo: 'mensagem',
    });

    if (!error) setInput('');
    setSending(false);
  }, [input, user, licitacaoId, sending]);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-muted">
        <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="text-lg font-semibold">Mural do Processo</span>
        {licitacaoNumero && (
          <Badge variant="info">{licitacaoNumero}</Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}
          className={soundOn ? 'text-primary' : 'text-muted-foreground'}
          title={soundOn ? 'Som ativado' : 'Som desativado'}
          aria-label={soundOn ? 'Desativar som das notificações' : 'Ativar som das notificações'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </Button>
        <Badge variant="success" className="ml-auto">
          <span className="w-2 h-2 rounded-full bg-success mr-1 animate-pulse" aria-hidden="true" />
          Tempo real
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 max-h-[400px]">
        <div className="space-y-2">
          {loading ? (
            <div role="status" aria-live="polite" className="space-y-3 py-2">
              <span className="sr-only">Carregando mensagens…</span>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-12 w-3/5 rounded-lg" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-2/5 rounded-lg" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-12 w-1/2 rounded-lg" />
              </div>
            </div>
          ) : mensagens.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<MessageSquare />}
              titulo="Nenhuma mensagem ainda"
              descricao="Inicie a conversa pela caixa abaixo."
            />
          ) : (
            mensagens.map((msg) => {
              const Icon = tipoIcons[msg.tipo] || User;
              const isSystem = msg.tipo === 'sistema' || msg.tipo === 'alerta' || msg.tipo === 'sucesso';
              const isMine = msg.user_id === user?.id && !isSystem;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    isMine ? 'justify-end' : 'justify-start'
                  )}
                >
                  {!isMine && (
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      tipoColors[msg.tipo] || 'bg-muted'
                    )}>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    isSystem
                      ? 'bg-muted border border-border text-muted-foreground italic'
                      : isMine
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}>
                    <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                    <span className={cn(
                      'text-xs mt-1 block tabular-nums',
                      isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    )}>
                      {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem ou anotação..."
          aria-label="Mensagem"
          disabled={sending}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="h-11 w-11 flex-shrink-0"
          aria-label="Enviar mensagem"
        >
          {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
