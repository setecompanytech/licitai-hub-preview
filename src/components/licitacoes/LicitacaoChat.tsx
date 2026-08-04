import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Send, Loader2, Bot, User, Info, AlertTriangle,
  CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { playNotificationSound, isSoundEnabled, setSoundEnabled } from '@/lib/notification-sound';
import { Volume2, VolumeX } from 'lucide-react';

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
  alerta: 'bg-warning/10 text-warning',
  sucesso: 'bg-success/10 text-success',
  mensagem: 'bg-primary/10 text-primary',
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
    <div className="flex flex-col h-full border border-border/50 rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/30">
        <MessageSquare className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold">Mural do Processo</span>
        {licitacaoNumero && (
          <Badge variant="outline" className="text-xs">{licitacaoNumero}</Badge>
        )}
        <button
          onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}
          className={`p-1 rounded transition-colors ${soundOn ? 'text-accent hover:bg-accent/10' : 'text-muted-foreground hover:bg-muted'}`}
          title={soundOn ? 'Som ativado' : 'Som desativado'}
        >
          {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
        <Badge variant="outline" className="text-xs ml-auto bg-success/10 text-success border-success/30">
          <span className="w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse" />
          Tempo real
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 max-h-[400px]">
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma mensagem ainda. Inicie a conversa!
              </p>
            </div>
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
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      tipoColors[msg.tipo] || 'bg-muted'
                    )}>
                      <Icon className="w-3 h-3" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs',
                    isSystem
                      ? 'bg-muted/50 border border-border/30 text-muted-foreground italic'
                      : isMine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  )}>
                    <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                    <span className={cn(
                      'text-xs mt-1 block',
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
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem ou anotação..."
          className="text-xs h-8"
          disabled={sending}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="h-8 w-8 p-0 rounded-full"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
