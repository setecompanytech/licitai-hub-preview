import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Bell, AlertTriangle, CheckCircle2, Clock,
  Search, RefreshCw, Eye, Volume2, VolumeX, Filter, Play, Pause,
  Megaphone, FileWarning, HelpCircle, FileEdit
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import LicitacaoChat from '@/components/licitacoes/LicitacaoChat';

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
        // Urgent triple beep
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } else if (type === 'alerta') {
        // Double beep
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } else {
        // Single soft tone
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

type MensagemChat = {
  id: string;
  pregaoNumero: string;
  orgao: string;
  portal: string;
  tipo: 'sistema' | 'pregoeiro' | 'fornecedor' | 'convocacao';
  remetente: string;
  mensagem: string;
  horario: string;
  destaque: boolean;
};

type PregaoMonitorado = {
  id: string;
  numero: string;
  orgao: string;
  portal: string;
  objeto: string;
  status: 'ao_vivo' | 'encerrado' | 'suspenso' | 'agendado';
  totalMensagens: number;
  alertas: number;
  ultimaAtualizacao: string;
};

type MuralItem = {
  id: string;
  pregaoNumero: string;
  tipo: 'aviso' | 'esclarecimento' | 'impugnacao' | 'retificacao';
  titulo: string;
  conteudo: string;
  dataPublicacao: string;
  autor: string;
};

const mockMural: MuralItem[] = [];
const mockPregoes: PregaoMonitorado[] = [];
const mockMensagens: MensagemChat[] = [];

const statusConfig = {
  ao_vivo: { label: 'Ao Vivo', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: Play },
  encerrado: { label: 'Encerrado', color: 'bg-muted text-muted-foreground border-border', icon: CheckCircle2 },
  suspenso: { label: 'Suspenso', color: 'bg-warning/15 text-warning border-warning/30', icon: Pause },
  agendado: { label: 'Agendado', color: 'bg-info/15 text-info border-info/30', icon: Clock },
};

const tipoMsgConfig = {
  sistema: 'text-muted-foreground bg-muted/50',
  pregoeiro: 'text-info bg-info/10 border-l-4 border-info',
  fornecedor: 'text-foreground bg-card',
  convocacao: 'text-warning bg-warning/10 border-l-4 border-warning font-medium',
};

export default function MonitoramentoChat() {
  const [searchParams] = useSearchParams();
  const licitacaoId = searchParams.get('lid');
  const licitacaoNumero = searchParams.get('num');
  const [busca, setBusca] = useState('');
  const [pregaoSelecionado, setPregaoSelecionado] = useState<string | null>('1');
  const [alertaSonoro, setAlertaSonoro] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mainTab, setMainTab] = useState(licitacaoId ? 'processo' : 'chat');
  const playAlert = useSoundAlert();
  const prevMsgCountRef = useRef(mockMensagens.length);

  // Play sound on new convocação messages when alertaSonoro is on
  useEffect(() => {
    if (!alertaSonoro) return;
    const pregaoAtivo = mockPregoes.find(p => p.id === pregaoSelecionado);
    if (!pregaoAtivo) return;
    
    const mensagens = mockMensagens.filter(m => pregaoAtivo.numero === m.pregaoNumero);
    const convocacoes = mensagens.filter(m => m.tipo === 'convocacao');
    
    if (convocacoes.length > 0 && mensagens.length > prevMsgCountRef.current) {
      playAlert('convocacao');
    }
    prevMsgCountRef.current = mensagens.length;
  }, [alertaSonoro, pregaoSelecionado, playAlert]);

  // Demo: play sound when toggling alertaSonoro ON
  const handleToggleSom = (checked: boolean) => {
    setAlertaSonoro(checked);
    if (checked) {
      setTimeout(() => playAlert('mensagem'), 100);
    }
  };

  const muralTipoConfig = {
    aviso: { icon: Megaphone, color: 'text-warning bg-warning/10 border-warning/30' },
    esclarecimento: { icon: HelpCircle, color: 'text-info bg-info/10 border-info/30' },
    impugnacao: { icon: FileWarning, color: 'text-destructive bg-destructive/10 border-destructive/30' },
    retificacao: { icon: FileEdit, color: 'text-accent bg-accent/10 border-accent/30' },
  };

  const pregoesFiltrados = mockPregoes.filter(p =>
    !busca || p.numero.toLowerCase().includes(busca.toLowerCase()) ||
    p.orgao.toLowerCase().includes(busca.toLowerCase()) ||
    p.objeto.toLowerCase().includes(busca.toLowerCase())
  );

  const mensagensFiltradas = mockMensagens.filter(m =>
    !pregaoSelecionado || mockPregoes.find(p => p.id === pregaoSelecionado)?.numero === m.pregaoNumero
  );

  const pregaoAtivo = mockPregoes.find(p => p.id === pregaoSelecionado);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              Monitoramento de Chat e Mural
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe em tempo real o chat e mural dos pregões eletrônicos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Auto-refresh</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              {alertaSonoro ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              <Switch checked={alertaSonoro} onCheckedChange={handleToggleSom} />
              <span className="text-xs text-muted-foreground">{alertaSonoro ? 'Som ativo' : 'Mudo'}</span>
            </div>
            <Button size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Sound alert indicator */}
        {alertaSonoro && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20 text-xs text-accent">
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span>Alertas sonoros ativados — você receberá notificações sonoras ao ser convocado ou quando houver mensagens urgentes</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="stat-card text-center">
            <Play className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold">{mockPregoes.filter(p => p.status === 'ao_vivo').length}</p>
            <p className="text-[10px] text-muted-foreground">Ao Vivo</p>
          </div>
          <div className="stat-card text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-info" />
            <p className="text-lg font-bold">{mockPregoes.filter(p => p.status === 'agendado').length}</p>
            <p className="text-[10px] text-muted-foreground">Agendados</p>
          </div>
          <div className="stat-card text-center">
            <Bell className="w-5 h-5 mx-auto mb-1 text-warning" />
            <p className="text-lg font-bold">{mockPregoes.reduce((a, p) => a + p.alertas, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Alertas</p>
          </div>
          <div className="stat-card text-center">
            <MessageSquare className="w-5 h-5 mx-auto mb-1 text-accent" />
            <p className="text-lg font-bold">{mockPregoes.reduce((a, p) => a + p.totalMensagens, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Mensagens</p>
          </div>
        </div>

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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Lista de pregões */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar pregão..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10" />
                </div>
                <div className="space-y-2 max-h-[calc(100vh-440px)] overflow-y-auto pr-1">
                  {pregoesFiltrados.map(pregao => {
                    const cfg = statusConfig[pregao.status];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={pregao.id}
                        onClick={() => setPregaoSelecionado(pregao.id)}
                        className={`w-full text-left bg-card rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow ${pregaoSelecionado === pregao.id ? 'ring-2 ring-accent border-accent/50' : 'border-border/50'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{pregao.numero}</span>
                          <Badge variant="outline" className={cfg.color + ' text-[10px]'}>
                            <Icon className="w-3 h-3 mr-1" /> {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{pregao.objeto}</p>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>{pregao.orgao}</span>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {pregao.totalMensagens}</span>
                            {pregao.alertas > 0 && (
                              <span className="flex items-center gap-0.5 text-warning"><Bell className="w-3 h-3" /> {pregao.alertas}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Chat */}
              <div className="lg:col-span-2">
                {pregaoAtivo ? (
                  <Card className="p-0 overflow-hidden">
                    <div className="bg-card border-b border-border/50 p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{pregaoAtivo.numero}</h3>
                          <Badge variant="outline" className={statusConfig[pregaoAtivo.status].color + ' text-[10px]'}>
                            {statusConfig[pregaoAtivo.status].label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">• {pregaoAtivo.portal}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{pregaoAtivo.orgao} — {pregaoAtivo.objeto}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { if (alertaSonoro) playAlert('convocacao'); }}>
                          <Volume2 className="w-3 h-3 mr-1" /> Testar Som
                        </Button>
                        <Button size="sm" variant="outline"><Eye className="w-3 h-3 mr-1" /> Ver no Portal</Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto bg-muted/30">
                      {mensagensFiltradas.length > 0 ? mensagensFiltradas.map(msg => (
                        <div key={msg.id} className={`rounded-lg p-3 text-sm ${tipoMsgConfig[msg.tipo]}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs flex items-center gap-1.5">
                              {msg.tipo === 'convocacao' && <Volume2 className="w-3 h-3 text-warning animate-pulse" />}
                              {msg.remetente}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{msg.horario}</span>
                          </div>
                          <p className="text-sm">{msg.mensagem}</p>
                        </div>
                      )) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm">Nenhuma mensagem ainda neste pregão.</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border/50 p-3 bg-card text-xs text-muted-foreground flex items-center justify-between">
                      <span>Última atualização: {pregaoAtivo.ultimaAtualizacao}</span>
                      <span>{pregaoAtivo.totalMensagens} mensagens • {pregaoAtivo.alertas} alertas</span>
                    </div>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Selecione um pregão para visualizar o chat</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mural">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Avisos, esclarecimentos, impugnações e retificações publicados nos portais de compras.
              </p>
              {mockMural.map(item => {
                const cfg = muralTipoConfig[item.tipo];
                const Icon = cfg.icon;
                return (
                  <Card key={item.id} className={`p-4 border-l-4 ${cfg.color}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{item.titulo}</span>
                            <Badge variant="outline" className="text-[10px]">{item.pregaoNumero}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.dataPublicacao).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.conteudo}</p>
                        <p className="text-xs text-muted-foreground mt-2">Por: {item.autor}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
