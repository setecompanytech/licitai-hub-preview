import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Send, Plus, Clock, CheckCircle, AlertCircle, Bot, User, Filter } from 'lucide-react';
import { toast } from 'sonner';

type Ticket = {
  id: string;
  assunto: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  resposta: string | null;
  created_at: string;
};

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  aberto: { label: 'Aberto', color: 'bg-warning/10 text-warning', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-info/10 text-info', icon: AlertCircle },
  resolvido: { label: 'Resolvido', color: 'bg-success/10 text-success', icon: CheckCircle },
};

export default function Suporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [prioridade, setPrioridade] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Chat IA
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([{ role: 'assistant', content: 'Olá! Sou o assistente do LicitIA. Como posso ajudar você hoje? Posso tirar dúvidas sobre funcionalidades, planos, cobrança ou problemas técnicos.' }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTickets(); }, [user]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  async function fetchTickets() {
    if (!user) return;
    const { data } = await supabase.from('tickets_suporte').select('*').order('created_at', { ascending: false });
    if (data) setTickets(data);
  }

  async function handleCreateTicket() {
    if (!user || !assunto.trim() || !descricao.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('tickets_suporte').insert({ user_id: user.id, assunto, descricao, categoria, prioridade });
    if (error) { toast.error('Erro ao criar ticket'); } else {
      toast.success('Ticket criado com sucesso!');
      setAssunto(''); setDescricao(''); setShowForm(false);
      fetchTickets();
    }
    setLoading(false);
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [...chatMsgs, { role: 'user', content: userMsg }].map(m => ({ role: m.role, content: m.content })),
          systemPrompt: 'Você é o assistente de suporte do LicitIA, uma plataforma de gestão de licitações. Responda dúvidas sobre funcionalidades, planos, pagamentos e problemas técnicos de forma clara e objetiva. Se não souber, sugira abrir um ticket de suporte.',
        },
      });
      const assistantMsg = response.data?.content || response.data?.message || 'Desculpe, não consegui processar sua pergunta. Tente novamente ou abra um ticket.';
      setChatMsgs(prev => [...prev, { role: 'assistant', content: assistantMsg }]);
    } catch {
      setChatMsgs(prev => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente ou abra um ticket de suporte.' }]);
    }
    setChatLoading(false);
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Chat com IA ou abra um ticket para a equipe</p>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList>
            <TabsTrigger value="chat"><Bot className="w-4 h-4 mr-1.5" /> Chat IA</TabsTrigger>
            <TabsTrigger value="tickets"><MessageCircle className="w-4 h-4 mr-1.5" /> Meus Chamados</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <div className="bg-card rounded-xl border border-border/50 flex flex-col h-[500px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMsgs.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-accent" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center"><Bot className="w-4 h-4 text-accent" /></div>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm text-muted-foreground">Digitando...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Input
                  placeholder="Digite sua dúvida..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleChatSend} disabled={chatLoading} className="bg-accent hover:bg-accent/90">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <div className="space-y-4">
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Abertos', count: tickets.filter(t => t.status === 'aberto').length, color: 'text-warning' },
                  { label: 'Em Andamento', count: tickets.filter(t => t.status === 'em_andamento').length, color: 'text-info' },
                  { label: 'Resolvidos', count: tickets.filter(t => t.status === 'resolvido').length, color: 'text-success' },
                ].map(s => (
                  <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between gap-3">
                {!showForm && (
                  <Button onClick={() => setShowForm(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Plus className="w-4 h-4 mr-1.5" /> Novo Chamado
                  </Button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aberto">Abertos</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="resolvido">Resolvidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* New ticket form */}
              {showForm && (
                <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
                  <h3 className="font-semibold">Novo Chamado</h3>
                  <Input placeholder="Assunto" value={assunto} onChange={e => setAssunto(e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="pagamento">Pagamento</SelectItem>
                        <SelectItem value="funcionalidade">Funcionalidade</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Descreva seu problema em detalhes..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateTicket} disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground">Enviar Chamado</Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Tickets list */}
              {(() => {
                const filtered = filtroStatus === 'todos' ? tickets : tickets.filter(t => t.status === filtroStatus);
                if (filtered.length === 0) return (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{tickets.length === 0 ? 'Nenhum chamado aberto. Use o chat IA ou crie um chamado.' : 'Nenhum chamado com esse filtro.'}</p>
                  </div>
                );
                return filtered.map(t => {
                  const sc = statusConfig[t.status] || statusConfig.aberto;
                  const Icon = sc.icon;
                  return (
                    <div key={t.id} className="bg-card rounded-xl border border-border/50 p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{t.assunto}</h3>
                        <Badge className={sc.color}><Icon className="w-3 h-3 mr-1" />{sc.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{t.descricao}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="capitalize">{t.categoria}</span>
                        <span>•</span>
                        <span className="capitalize">{t.prioridade}</span>
                        <span>•</span>
                        <span>{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {t.resposta && (
                        <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/10">
                          <p className="text-xs font-semibold text-accent mb-1">Resposta da Equipe</p>
                          <p className="text-sm">{t.resposta}</p>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
