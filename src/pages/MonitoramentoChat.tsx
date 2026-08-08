import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Bell, CheckCircle2, Clock,
  Search, RefreshCw, Volume2, VolumeX, Play, Pause,
  Megaphone, FileWarning, HelpCircle, FileEdit, Info
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// --- Sound Alert System ---
function useSoundAlert() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlert = useCallback((type: 'convocacao' | 'mensagem' | 'alerta') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'convocacao') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } else if (type === 'alerta') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } else {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(520, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn('Sound alert failed:', e);
    }
  }, []);

  return playAlert;
}

type ChatMessage = {
  id: string;
  content: string;
  role: string;
  created_at: string;
  metadata: any;
};

export default function MonitoramentoChat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const licitacaoId = searchParams.get('lid');
  const licitacaoNumero = searchParams.get('num');
  const [alertaSonoro, setAlertaSonoro] = useState(true);
  const [mainTab, setMainTab] = useState(licitacaoId ? 'processo' : 'chat');
  const playAlert = useSoundAlert();

  // Real chat messages from DB
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadMessages = async () => {
      setLoadingMensagens(true);
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setMensagens(data || []);
      setLoadingMensagens(false);
    };
    loadMessages();

    const channel = supabase
      .channel('monitoramento-chat-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, () => loadMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleToggleSom = (checked: boolean) => {
    setAlertaSonoro(checked);
    if (checked) {
      setTimeout(() => playAlert('mensagem'), 100);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
              Monitoramento de Chat e Mural
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Acompanhe em tempo real o chat e mural dos pregões eletrônicos
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 text-sm">
              {alertaSonoro ? <Volume2 className="w-4 h-4 text-success" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              <Switch checked={alertaSonoro} onCheckedChange={handleToggleSom} />
              <span className="text-xs text-muted-foreground">{alertaSonoro ? 'Som ativo' : 'Mudo'}</span>
            </div>
          </div>
        </div>

        {/* Sound alert indicator */}
        {alertaSonoro && (
          <div className="flex items-center gap-2 px-3 py-2 bg-success/10 rounded-lg border border-success/20 text-xs text-success">
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span>Alertas sonoros ativados — você receberá notificações sonoras ao ser convocado ou quando houver mensagens urgentes</span>
          </div>
        )}

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            {licitacaoId && (
              <TabsTrigger value="processo" className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Mural do Processo
              </TabsTrigger>
            )}
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Chat ao Vivo
            </TabsTrigger>
            <TabsTrigger value="mural" className="flex items-center gap-1">
              <Megaphone className="w-4 h-4" /> Mural
            </TabsTrigger>
          </TabsList>

          {licitacaoId && (
            <TabsContent value="processo">
              <div className="max-w-3xl mx-auto">
                <LicitacaoChat
                  licitacaoId={licitacaoId}
                  licitacaoNumero={licitacaoNumero || undefined}
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="chat">
            <div className="space-y-4">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-info/30 bg-info/5">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-info">Chat em Tempo Real de Pregões</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O chat ao vivo será ativado automaticamente quando você estiver participando de um pregão eletrônico.
                    Para monitorar um pregão, acesse o <strong>Kanban</strong> ou a <strong>Busca Inteligente</strong> e inicie o acompanhamento de uma licitação.
                  </p>
                </div>
              </div>

              {/* Recent messages from DB */}
              {mensagens.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Últimas mensagens do assistente</h3>
                  {mensagens.slice(0, 10).map(msg => (
                    <Card key={msg.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">{msg.role === 'user' ? 'Você' : 'Assistente'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{msg.content}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum pregão monitorado no momento</p>
                  <p className="text-xs mt-1">
                    Os pregões aparecerão aqui quando você iniciar o monitoramento em tempo real via Kanban ou Busca Inteligente.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mural">
            <div className="space-y-4">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-info/30 bg-info/5">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-info">Mural de Publicações</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avisos, esclarecimentos, impugnações e retificações publicados nos portais serão exibidos aqui automaticamente 
                    quando você estiver acompanhando processos licitatórios ativos.
                  </p>
                </div>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma publicação no mural</p>
                <p className="text-xs mt-1">Avisos, esclarecimentos e retificações aparecerão aqui quando detectados nos portais dos processos que você acompanha.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
