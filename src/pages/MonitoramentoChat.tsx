import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Bell, CheckCircle2, Clock,
  Search, RefreshCw, Volume2, VolumeX, Play, Pause,
  Megaphone, FileWarning, HelpCircle, FileEdit, Info, AlertTriangle
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

/**
 * Uma fala do pregoeiro, lida pelo robô na sala e gravada no processo.
 *
 * ─── POR QUE ESTE TIPO MUDOU ───────────────────────────────────────────────
 *
 * Esta tela dizia "Chat do Pregoeiro" e mostrava `chat_messages` — que tem
 * `role`/`content`, o formato de conversa com assistente de IA. Pior: nada no
 * repositório inteiro escrevia nessa tabela. Era uma aba prometendo mensagens
 * do pregão e lendo uma tabela vazia desde fevereiro de 2026.
 *
 * Agora lê `licitacao_mensagens`, que é onde o robô grava de verdade, filtrada
 * por `metadata->>origem = 'portal'`.
 */
type MensagemDoPortal = {
  id: string;
  conteudo: string;
  tipo: string;
  created_at: string;
  licitacao_id: string;
  metadata: { edital?: string; remetente?: string; requer_acao?: boolean } | null;
};

export default function MonitoramentoChat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const licitacaoId = searchParams.get('lid');
  const licitacaoNumero = searchParams.get('num');
  const [alertaSonoro, setAlertaSonoro] = useState(true);
  const [mainTab, setMainTab] = useState(licitacaoId ? 'processo' : 'chat');
  const playAlert = useSoundAlert();

  // O que o pregoeiro falou, em todos os processos da empresa.
  const [mensagens, setMensagens] = useState<MensagemDoPortal[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadMessages = async () => {
      setLoadingMensagens(true);
      // Sem `.eq('user_id')`: mensagem de pregão é do PROCESSO, e processo é da
      // empresa (princípio 2). Quem decide o alcance é a RLS — filtrar por
      // usuário aqui esconderia do colega o chamado do pregoeiro num processo
      // que os dois acompanham.
      const { data } = await supabase
        .from('licitacao_mensagens')
        .select('id, conteudo, tipo, created_at, licitacao_id, metadata')
        .eq('metadata->>origem', 'portal')
        .order('created_at', { ascending: false })
        .limit(50);
      setMensagens((data as unknown as MensagemDoPortal[]) || []);
      setLoadingMensagens(false);
    };
    loadMessages();

    const channel = supabase
      .channel('monitoramento-portal-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'licitacao_mensagens' },
        (payload) => {
          const nova = payload.new as MensagemDoPortal;
          // O realtime não filtra por conteúdo de jsonb, então a peneira é
          // aqui: sem ela, cada mensagem interna da equipe tocaria o alarme
          // de convocação.
          if (nova?.metadata?.requer_acao === undefined && nova?.tipo !== 'alerta') return;
          loadMessages();
          // O som que existia e nunca tinha quem o disparasse. Só para o que
          // pede ação — alarme em toda fala vira ruído e para de ser ouvido.
          if (alertaSonoro && nova?.metadata?.requer_acao) playAlert('convocacao');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // `alertaSonoro` e `playAlert` de fora: reassinar o canal a cada toggle de
    // som derrubaria e recriaria a conexão sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              Anotações internas da equipe, chat do pregoeiro e publicações oficiais dos portais
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
              <MessageSquare className="w-4 h-4" /> Chat do Pregoeiro
            </TabsTrigger>
            <TabsTrigger value="mural" className="flex items-center gap-1">
              <Megaphone className="w-4 h-4" /> Publicações do Portal
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
                  <p className="text-sm font-medium text-info">Chat do pregoeiro — em tempo real</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando o robô estiver numa <strong>sala de disputa ao vivo</strong>, as falas do
                    pregoeiro caem aqui e no próprio processo. As que pedem ação —{' '}
                    <em>convocação, diligência, prazo, documento</em> — vêm destacadas e tocam
                    alerta sonoro.
                  </p>
                  {/* O estado real, dito sem rodeio. A versão anterior prometia
                      "será ativado automaticamente" para uma tela que lia uma
                      tabela sem escritor — é o tipo de frase que faz procurar
                      defeito onde falta implementação. */}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <strong className="text-foreground">Onde estamos:</strong> os portais só expõem
                    o chat durante a sessão pública. O transporte está pronto; a leitura da sala
                    depende de acompanhar um pregão acontecendo.
                  </p>
                </div>
              </div>

              {/* O que o pregoeiro falou, do processo mais recente para o mais
                  antigo. Quem pede ação vem destacado — é o caso que o cliente
                  descreveu: "dispara um alerta toda vez que a empresa é
                  convocada". */}
              {mensagens.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Últimas mensagens dos pregoeiros
                  </h3>
                  {mensagens.slice(0, 10).map((msg) => {
                    const pedeAcao = msg.metadata?.requer_acao === true;
                    return (
                      <Card
                        key={msg.id}
                        className={`p-3 ${pedeAcao ? 'border-warning/40 bg-warning/5' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {pedeAcao && (
                              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                            )}
                            <Badge variant="outline" className="text-xs font-mono shrink-0">
                              {msg.metadata?.edital || 'processo'}
                            </Badge>
                            {pedeAcao && (
                              <span className="text-xs text-warning font-medium truncate">
                                pede ação
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(msg.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">{msg.conteudo}</p>
                        <Link
                          to={`/processo/${msg.licitacao_id}`}
                          className="text-xs text-accent hover:underline mt-1.5 inline-block"
                        >
                          Abrir o processo →
                        </Link>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem de pregoeiro registrada</p>
                  {/* A frase honesta: hoje a lista fica vazia porque nenhum
                      portal implementado sabe ler a sala. Prometer "aparecerão
                      quando você monitorar" seria repetir o defeito que esta
                      tela tinha. */}
                  <p className="text-xs mt-1 max-w-md mx-auto">
                    As falas do pregoeiro aparecem aqui quando o robô estiver numa sala de disputa
                    ao vivo. Fora da sessão pública, os portais não expõem o chat.
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
                  <p className="text-sm font-medium text-info">Publicações do Portal</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avisos, esclarecimentos, impugnações e retificações publicados nos portais serão exibidos aqui automaticamente 
                    quando você estiver acompanhando processos licitatórios ativos.
                  </p>
                </div>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma publicação do portal</p>
                <p className="text-xs mt-1">Avisos, esclarecimentos e retificações aparecerão aqui quando detectados nos portais dos processos que você acompanha.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
