import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Search, Send, Plus, Phone, Clock, MessageSquare, Loader2, Sparkles, ArrowLeft,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Conversa {
  id: string;
  contato_nome: string;
  contato_telefone: string;
  contato_empresa: string | null;
  setor: string;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string;
  status: string;
  tags: string[];
}

interface Mensagem {
  id: string;
  direcao: string;
  tipo: string;
  conteudo: string;
  status: string;
  created_at: string;
}

const SETORES_FILTER = ['Todos', 'licitações', 'jurídico', 'financeiro', 'documentos'];

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newContact, setNewContact] = useState({ nome: '', telefone: '', empresa: '', setor: 'licitações' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadConversas();
  }, [user]);

  useEffect(() => {
    if (conversaAtiva) loadMensagens(conversaAtiva.id);
  }, [conversaAtiva]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('whatsapp-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens' }, () => {
        if (conversaAtiva) loadMensagens(conversaAtiva.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas' }, () => {
        loadConversas();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, conversaAtiva]);

  const loadConversas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('user_id', user!.id)
      .order('ultima_mensagem_at', { ascending: false });
    if (data) setConversas(data as Conversa[]);
    setLoading(false);
  };

  const loadMensagens = async (conversaId: string) => {
    const { data } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('conversa_id', conversaId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true });
    if (data) setMensagens(data as Mensagem[]);
  };

  const handleSend = async () => {
    if (!novaMensagem.trim() || !conversaAtiva) return;
    setSending(true);
    const { error } = await supabase.from('whatsapp_mensagens').insert({
      user_id: user!.id,
      conversa_id: conversaAtiva.id,
      direcao: 'saida',
      conteudo: novaMensagem.trim(),
      status: 'simulado',
    });
    if (!error) {
      await supabase.from('whatsapp_conversas').update({
        ultima_mensagem: novaMensagem.trim(),
        ultima_mensagem_at: new Date().toISOString(),
      }).eq('id', conversaAtiva.id);
      setNovaMensagem('');
      loadMensagens(conversaAtiva.id);
      loadConversas();
    } else {
      toast.error('Erro ao enviar mensagem');
    }
    setSending(false);
  };

  const handleAISuggest = async () => {
    if (!conversaAtiva || mensagens.length === 0) return;
    setGeneratingAI(true);
    try {
      const lastMessages = mensagens.slice(-5).map(m =>
        `${m.direcao === 'entrada' ? 'Cliente' : 'Eu'}: ${m.conteudo}`
      ).join('\n');

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: 'Você é um assistente de vendas de licitações. Sugira uma resposta profissional e objetiva para a conversa do WhatsApp abaixo. Responda apenas com a sugestão de resposta, sem explicações.' },
            { role: 'user', content: `Conversa com ${conversaAtiva.contato_nome} (${conversaAtiva.setor}):\n${lastMessages}\n\nSugira uma resposta:` }
          ]
        }
      });
      if (data?.content) {
        setNovaMensagem(data.content);
      }
    } catch {
      toast.error('Erro ao gerar sugestão IA');
    }
    setGeneratingAI(false);
  };

  const handleCreateConversa = async () => {
    if (!newContact.nome || !newContact.telefone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    const { error } = await supabase.from('whatsapp_conversas').insert({
      user_id: user!.id,
      contato_nome: newContact.nome,
      contato_telefone: newContact.telefone.replace(/\D/g, ''),
      contato_empresa: newContact.empresa || null,
      setor: newContact.setor,
    });
    if (error) toast.error('Erro ao criar conversa');
    else {
      toast.success('Conversa criada!');
      setShowNewDialog(false);
      setNewContact({ nome: '', telefone: '', empresa: '', setor: 'licitações' });
      loadConversas();
    }
  };

  const filteredConversas = conversas.filter(c => {
    if (filtroSetor !== 'Todos' && c.setor !== filtroSetor) return false;
    if (busca && !c.contato_nome.toLowerCase().includes(busca.toLowerCase()) && !c.contato_telefone.includes(busca)) return false;
    return true;
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-96 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Lista de conversas. No celular ela ocupa a largura toda e dá lugar à
          conversa aberta (o botão "voltar" do cabeçalho traz de volta); a
          partir de `sm` as duas colunas convivem, como sempre conviveram. */}
      <div
        className={`${conversaAtiva ? 'hidden sm:flex' : 'flex'} w-full flex-col border-r border-border sm:w-80 sm:flex-shrink-0`}
      >
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar conversa..."
                aria-label="Buscar conversa"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="flex-shrink-0" aria-label="Nova conversa">
                  <Plus aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nova-conversa-nome">Nome</Label>
                    <Input id="nova-conversa-nome" value={newContact.nome} onChange={e => setNewContact(p => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nova-conversa-telefone">Telefone</Label>
                    <Input id="nova-conversa-telefone" value={newContact.telefone} onChange={e => setNewContact(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nova-conversa-empresa">Empresa</Label>
                    <Input id="nova-conversa-empresa" value={newContact.empresa} onChange={e => setNewContact(p => ({ ...p, empresa: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nova-conversa-setor">Setor</Label>
                    <Select value={newContact.setor} onValueChange={v => setNewContact(p => ({ ...p, setor: v }))}>
                      <SelectTrigger id="nova-conversa-setor"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="licitações">Licitações</SelectItem>
                        <SelectItem value="jurídico">Jurídico</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="documentos">Documentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateConversa}>Criar conversa</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {/* Filtro de setor em botão tonal: o ativo em `secondary`, os demais
              em `ghost` — o verde sólido fica só para "Enviar". */}
          <div className="flex flex-wrap gap-1">
            {SETORES_FILTER.map(s => (
              <Button
                key={s}
                variant={filtroSetor === s ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={filtroSetor === s}
                onClick={() => setFiltroSetor(s)}
              >
                {s === 'Todos' ? s : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            /* Esqueleto na forma da lista: avatar, nome e prévia. */
            <div role="status" aria-busy="true" className="divide-y divide-border">
              <span className="sr-only">Carregando conversas</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversas.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<MessageSquare aria-hidden="true" />}
              titulo="Nenhuma conversa encontrada"
              descricao="Ajuste a busca e o setor, ou crie uma conversa nova."
            />
          ) : (
            /* Lista `divide-y`: avatar, nome 14/500, prévia 13 e horário 12 em
               dígitos tabulares; a conversa aberta fica na tinta verde. */
            <div className="divide-y divide-border">
              {filteredConversas.map(c => (
                <button
                  key={c.id}
                  onClick={() => setConversaAtiva(c)}
                  aria-current={conversaAtiva?.id === c.id ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${conversaAtiva?.id === c.id ? 'bg-primary-tint' : ''}`}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(c.contato_nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-medium text-foreground">{c.contato_nome}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(c.ultima_mensagem_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.ultima_mensagem || 'Nova conversa'}</p>
                    <Badge variant="muted" className="mt-1.5" truncate>{c.setor}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Conversa aberta */}
      <div className={`${conversaAtiva ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col`}>
        {conversaAtiva ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 sm:hidden"
                  onClick={() => setConversaAtiva(null)}
                  aria-label="Voltar para a lista de conversas"
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="text-xs">{getInitials(conversaAtiva.contato_nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{conversaAtiva.contato_nome}</p>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" aria-hidden="true" />{conversaAtiva.contato_telefone}
                    {conversaAtiva.contato_empresa && <span>• {conversaAtiva.contato_empresa}</span>}
                  </p>
                </div>
              </div>
              <Badge variant="muted" truncate>{conversaAtiva.setor}</Badge>
            </div>

            {/* Balões: o contato em cartão branco com fio, a empresa na tinta
                verde; o fundo rebaixado é o que separa os dois do painel. */}
            <ScrollArea className="flex-1 bg-secondary p-4">
              <div className="mx-auto max-w-2xl space-y-3">
                {mensagens.map(m => (
                  <div key={m.id} className={`flex ${m.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${m.direcao === 'saida'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground shadow-sm'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                      <div className={`mt-1 flex items-center gap-1 text-xs ${m.direcao === 'saida' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span className="tabular-nums">
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.status === 'simulado' && <span className="ml-1">(simulado)</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Entrada fixa de 40px: sugestão da IA (Sparkles em teal), campo e envio. */}
            <div className="border-t border-border bg-card p-4">
              <div className="mx-auto flex max-w-2xl items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={handleAISuggest}
                  disabled={generatingAI || mensagens.length === 0}
                  title="Sugestão IA"
                  aria-label="Gerar sugestão de resposta com IA"
                >
                  {generatingAI
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : <Sparkles className="text-teal" aria-hidden="true" />}
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  aria-label="Mensagem para enviar"
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || !novaMensagem.trim()}
                  className="flex-shrink-0"
                  aria-label="Enviar mensagem"
                >
                  {sending
                    ? <Loader2 className="animate-spin" aria-hidden="true" />
                    : <Send aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EstadoVazio
            preencher
            icone={<MessageSquare aria-hidden="true" />}
            titulo="Nenhuma conversa aberta"
            descricao="Escolha uma conversa na lista ao lado ou crie uma nova."
          />
        )}
      </div>
    </div>
  );
}
