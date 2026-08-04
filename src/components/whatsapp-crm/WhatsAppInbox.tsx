import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Search, Send, Plus, Phone, MoreVertical, Bot, User, Clock,
  MessageSquare, Loader2, Sparkles, Tag
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
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

  const setorColor: Record<string, string> = {
    'licitações': 'bg-muted text-muted-foreground',
    'jurídico': 'bg-muted text-muted-foreground',
    'financeiro': 'bg-muted text-muted-foreground',
    'documentos': 'bg-muted text-muted-foreground',
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-220px)] border rounded-xl overflow-hidden bg-card">
      {/* Sidebar - Lista de conversas */}
      <div className="w-80 border-r flex flex-col flex-shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar conversa..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="h-9 w-9"><Plus className="w-4 h-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Conversa</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-xs">Nome</Label><Input value={newContact.nome} onChange={e => setNewContact(p => ({ ...p, nome: e.target.value }))} className="mt-1" /></div>
                  <div><Label className="text-xs">Telefone</Label><Input value={newContact.telefone} onChange={e => setNewContact(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" className="mt-1" /></div>
                  <div><Label className="text-xs">Empresa</Label><Input value={newContact.empresa} onChange={e => setNewContact(p => ({ ...p, empresa: e.target.value }))} className="mt-1" /></div>
                  <div>
                    <Label className="text-xs">Setor</Label>
                    <Select value={newContact.setor} onValueChange={v => setNewContact(p => ({ ...p, setor: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="licitações">Licitações</SelectItem>
                        <SelectItem value="jurídico">Jurídico</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="documentos">Documentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateConversa} className="w-full">Criar Conversa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {SETORES_FILTER.map(s => (
              <Button key={s} variant={filtroSetor === s ? 'default' : 'ghost'} size="sm" className="text-xs h-7 whitespace-nowrap" onClick={() => setFiltroSetor(s)}>
                {s === 'Todos' ? s : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredConversas.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
          ) : (
            filteredConversas.map(c => (
              <button
                key={c.id}
                onClick={() => setConversaAtiva(c)}
                className={`w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-left ${conversaAtiva?.id === c.id ? 'bg-accent/10' : ''}`}
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(c.contato_nome)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{c.contato_nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.ultima_mensagem_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.ultima_mensagem || 'Nova conversa'}</p>
                  <Badge className={`text-xs mt-1 ${setorColor[c.setor] || 'bg-muted text-muted-foreground'}`}>{c.setor}</Badge>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {conversaAtiva ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(conversaAtiva.contato_nome)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{conversaAtiva.contato_nome}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />{conversaAtiva.contato_telefone}
                    {conversaAtiva.contato_empresa && <span>• {conversaAtiva.contato_empresa}</span>}
                  </p>
                </div>
              </div>
              <Badge className={setorColor[conversaAtiva.setor] || ''}>{conversaAtiva.setor}</Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {mensagens.map(m => (
                  <div key={m.id} className={`flex ${m.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${m.direcao === 'saida'
                      ? 'bg-accent text-accent-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
                      <div className={`flex items-center gap-1 mt-1 ${m.direcao === 'saida' ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.status === 'simulado' && <span className="text-xs ml-1">(simulado)</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t bg-muted/10">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-9 w-9"
                  onClick={handleAISuggest}
                  disabled={generatingAI || mensagens.length === 0}
                  title="Sugestão IA"
                >
                  {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-accent" />}
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSend} disabled={sending || !novaMensagem.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground h-9 w-9">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa ou crie uma nova</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
