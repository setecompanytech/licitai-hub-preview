import { useState, useEffect, useRef, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Send, Plus, Clock, CheckCircle, AlertCircle, Bot, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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

type ChatMsg = ChatMessage;

/**
 * Estado do chamado (identidade 12/09).
 *
 * Antes a cor vinha composta na mão (`bg-warning/10 text-warning`), que muda de
 * leitura conforme o fundo. Agora cada estado aponta para a variante de selo em
 * tinta do `Badge` — fundo `*-tint`, texto `*-ink`, contorno `*-line` — e o
 * estado continua SEMPRE escrito, com a cor só de reforço.
 */
const statusConfig: Record<
  string,
  { label: string; variante: 'success' | 'warning' | 'info'; icon: LucideIcon }
> = {
  aberto: { label: 'Aberto', variante: 'warning', icon: Clock },
  em_andamento: { label: 'Em Andamento', variante: 'info', icon: AlertCircle },
  resolvido: { label: 'Resolvido', variante: 'success', icon: CheckCircle },
};

const Suporte = forwardRef<HTMLDivElement>(function Suporte(_props, _ref) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [prioridade, setPrioridade] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  // Abas controladas: a ação principal do cabeçalho ("Abrir chamado") precisa
  // trazer a pessoa para a aba de chamados junto com o formulário.
  const [aba, setAba] = useState('chat');

  // Chat IA
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([{ role: 'assistant', content: 'Olá! Sou o assistente do PRAEFECTUS. Como posso ajudar você hoje? Posso tirar dúvidas sobre funcionalidades, planos, cobrança ou problemas técnicos.' }]);
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

  function abrirChamado() {
    setAba('tickets');
    setShowForm(true);
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
    const userMessage: ChatMsg = { role: 'user', content: userMsg };
    setChatMsgs(prev => [...prev, userMessage]);
    setChatLoading(true);

    let assistantContent = '';
    const allMessages = [...chatMsgs, userMessage];

    await streamAIChat({
      messages: allMessages,
      action: 'suporte_chat',
      onDelta: (chunk) => {
        assistantContent += chunk;
        setChatMsgs(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length === allMessages.length + 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      },
      onDone: () => setChatLoading(false),
      onError: (err) => {
        setChatMsgs(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${err}. Tente novamente ou abra um ticket.` }]);
        setChatLoading(false);
      },
    });
  }

  const ticketsFiltrados = filtroStatus === 'todos' ? tickets : tickets.filter(t => t.status === filtroStatus);

  /* O estado vive no ladrilho do ícone (mesmo vocabulário de tom do selo); o
     número fica sempre na tinta principal. */
  const resumo: Indicador[] = [
    { rotulo: 'Abertos', valor: tickets.filter(t => t.status === 'aberto').length, icone: Clock, tom: 'aviso' },
    { rotulo: 'Em andamento', valor: tickets.filter(t => t.status === 'em_andamento').length, icone: AlertCircle, tom: 'info' },
    { rotulo: 'Resolvidos', valor: tickets.filter(t => t.status === 'resolvido').length, icone: CheckCircle, tom: 'ok' },
  ];

  return (
    <AppLayout>
      {/* Título, descrição, ícone e trilha vêm do registro
          `lib/navegacao/paginas.ts` pela própria rota; a ação principal do
          registro ("Abrir chamado") é o botão do cabeçalho, que troca para a
          aba de chamados e abre o formulário — era um botão solto dentro da
          aba antes, invisível para quem chegava pelo chat. */}
      <Tabs value={aba} onValueChange={setAba}>
        <CabecalhoPagina
          acoes={
            <Button onClick={abrirChamado}>
              <Plus aria-hidden="true" /> Abrir chamado
            </Button>
          }
        >
          {/* Fila de abas sublinhada do padrão, sem ícones. */}
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="tickets">Chamados</TabsTrigger>
          </TabsList>
        </CabecalhoPagina>

        <TabsContent value="chat" className="mt-0">
          <Card className="flex h-[min(65vh,520px)] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {chatMsgs.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}>
                  {msg.role === 'assistant' && (
                    <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                      <Bot className="w-4 h-4" />
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-[75%] rounded-lg px-4 py-3 text-base leading-6',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <User className="w-4 h-4" />
                    </span>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary">
                    <Bot className="w-4 h-4" />
                  </span>
                  <p role="status" className="rounded-lg bg-muted px-4 py-3 text-base leading-6 text-muted-foreground">
                    Digitando...
                  </p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 border-t border-border p-3">
              <label htmlFor="suporte-chat-input" className="sr-only">Sua dúvida</label>
              <Input
                id="suporte-chat-input"
                placeholder="Digite sua dúvida..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleChatSend} disabled={chatLoading} aria-label="Enviar mensagem">
                <Send aria-hidden="true" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-0">
          <div className="space-y-4">
            {/* Resumo por estado na faixa de indicadores do padrão. */}
            <FaixaIndicadores itens={resumo} />

            {/* Recorte da lista — o select com o rótulo em cima, na barra padrão. */}
            <BarraFiltros>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="filtro-status" className="text-xs text-muted-foreground">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger id="filtro-status" className="w-[180px]">
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
            </BarraFiltros>

            {/* Formulário de novo chamado — rótulo acima de campos de 40px,
                rodapé com Cancelar antes da ação principal. */}
            {showForm && (
              <Card className="space-y-4 p-5">
                <h2 className="text-lg font-semibold leading-6 text-foreground">Novo chamado</h2>
                <div className="space-y-2">
                  <Label htmlFor="ticket-assunto">Assunto</Label>
                  <Input id="ticket-assunto" placeholder="Assunto" value={assunto} onChange={e => setAssunto(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ticket-categoria">Categoria</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger id="ticket-categoria"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geral">Geral</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="pagamento">Pagamento</SelectItem>
                        <SelectItem value="funcionalidade">Funcionalidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ticket-prioridade">Prioridade</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger id="ticket-prioridade"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-descricao">Descrição</Label>
                  <Textarea id="ticket-descricao" placeholder="Descreva seu problema em detalhes..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button onClick={handleCreateTicket} disabled={loading}>Enviar chamado</Button>
                </div>
              </Card>
            )}

            {/* Lista de chamados */}
            {ticketsFiltrados.length === 0 ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio
                  icone={<MessageCircle />}
                  titulo={tickets.length === 0 ? 'Nenhum chamado aberto' : 'Nenhum chamado com esse filtro'}
                  descricao={
                    tickets.length === 0
                      ? 'Tire a dúvida no chat com o assistente ou abra um chamado para a equipe.'
                      : 'Troque o recorte de status para ver os outros chamados.'
                  }
                  acao={
                    tickets.length === 0 ? (
                      <Button onClick={abrirChamado}>
                        <Plus aria-hidden="true" /> Abrir chamado
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              ticketsFiltrados.map(t => {
                const sc = statusConfig[t.status] || statusConfig.aberto;
                const Icone = sc.icon;
                return (
                  <Card key={t.id} className="p-5">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold leading-6 text-foreground">{t.assunto}</h3>
                      <Badge variant={sc.variante}>
                        <Icone className="mr-1 h-3 w-3" aria-hidden="true" />{sc.label}
                      </Badge>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{t.descricao}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{t.categoria}</span>
                      <span aria-hidden="true">•</span>
                      <span className="capitalize">{t.prioridade}</span>
                      <span aria-hidden="true">•</span>
                      <span>{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {t.resposta && (
                      <div className="mt-4 rounded-md border border-border bg-secondary p-3">
                        <p className="mb-1 text-xs font-semibold text-foreground">Resposta da Equipe</p>
                        <p className="text-sm text-foreground">{t.resposta}</p>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
});

export default Suporte;
