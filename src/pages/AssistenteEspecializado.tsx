import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Loader2, Sparkles, Scale, BarChart3,
  BookOpen, ExternalLink, Trash2, Download, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string }[];
  timestamp: Date;
};

const SUGGESTION_CHIPS = [
  { label: 'Análise de balanço com passivo zero', icon: BarChart3, category: 'contabil' },
  { label: 'Requisitos de habilitação art. 62-70', icon: Scale, category: 'juridico' },
  { label: 'Índices IPCA e IGP-M atualizados', icon: Globe, category: 'economico' },
  { label: 'Impugnação de edital restritivo', icon: BookOpen, category: 'juridico' },
  { label: 'Qualificação econômico-financeira', icon: BarChart3, category: 'contabil' },
  { label: 'Reequilíbrio contratual Lei 14.133', icon: Scale, category: 'juridico' },
];

export default function AssistenteEspecializado() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [buscaWeb, setBuscaWeb] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    let sources: { title: string; url: string }[] = [];
    const assistantId = crypto.randomUUID();

    try {
      const { getUserJwt } = await import('@/lib/auth-token');
      const authToken = await getUserJwt({ showToastOnFail: true });
      if (!authToken) { setIsLoading(false); return; }

      const allMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-especializado`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            busca_web: buscaWeb,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: '' }));
        const isAuthErr = resp.status === 401;
        toast.error(
          isAuthErr ? 'Sessão expirada' : 'Falha ao consultar o assistente',
          {
            description: isAuthErr
              ? 'Sua sessão expirou. Recarregue a página e faça login novamente.'
              : err.error || `O servidor retornou o erro ${resp.status}. Tente novamente em instantes.`,
            duration: 8000,
          }
        );
        setIsLoading(false);
        return;
      }

      // Parse sources from header
      try {
        const sourcesHeader = resp.headers.get('X-Sources');
        if (sourcesHeader) sources = JSON.parse(sourcesHeader);
      } catch { /* ignore */ }

      if (!resp.body) {
        toast.error('Resposta vazia do servidor', {
          description: 'O assistente não retornou conteúdo. Verifique sua conexão e tente novamente.',
          duration: 6000,
        });
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (content: string) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map(m => m.id === assistantId ? { ...m, content, sources } : m);
          }
          return [...prev, {
            id: assistantId,
            role: 'assistant' as const,
            content,
            sources,
            timestamp: new Date(),
          }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateAssistant(assistantContent);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw?.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateAssistant(assistantContent);
            }
          } catch { /* ignore */ }
        }
      }

      // Final update with sources
      updateAssistant(assistantContent);
    } catch (err) {
      console.error('Stream error:', err);
      toast.error('Erro de conexão com o assistente', {
        description: 'Não foi possível completar a resposta. Verifique sua conexão e tente enviar a mensagem novamente.',
        duration: 7000,
      });
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    toast.success('Conversa limpa');
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    const text = messages.map(m =>
      `[${m.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE IA'}] ${m.timestamp.toLocaleString('pt-BR')}\n${m.content}\n${m.sources?.length ? `Fontes: ${m.sources.map(s => s.url).join(', ')}` : ''}`
    ).join('\n\n---\n\n');

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistente-ia-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Conversa exportada!');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b border-border/50 pb-4 mb-4">
           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">Assistente IA Especializada</h1>
                <p className="text-xs sm:text-xs text-muted-foreground truncate">
                  Jurídica, Contábil e Econômico-Financeira — com busca em fontes oficiais
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={buscaWeb ? 'default' : 'outline'}
                onClick={() => setBuscaWeb(!buscaWeb)}
                className="text-xs gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                {buscaWeb ? 'Busca Web Ativa' : 'Busca Web Desativada'}
              </Button>
              {messages.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={handleExport} className="text-xs gap-1">
                    <Download className="w-3 h-3" /> Exportar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleClear} className="text-xs gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" /> Limpar
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="outline" className="text-xs">Lei 14.133/2021</Badge>
            <Badge variant="outline" className="text-xs">NBC TSP</Badge>
            <Badge variant="outline" className="text-xs">TCU</Badge>
            <Badge variant="outline" className="text-xs">LRF</Badge>
            <Badge variant="outline" className="text-xs">CFC/CRC</Badge>
            <Badge variant="outline" className="text-xs">IPCA/IGP-M</Badge>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Assistente IA Especializada</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Pergunte sobre legislação, jurisprudência, balanços patrimoniais, índices econômicos,
                  habilitação em licitações ou qualquer tema jurídico-contábil.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-2xl w-full">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSend(chip.label)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-accent/5 hover:border-accent/30 transition-colors text-left"
                  >
                    <chip.icon className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-xs text-foreground">{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border/50'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-bold prose-h2:text-base prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-2 prose-h3:text-sm prose-strong:text-foreground prose-blockquote:border-accent/50 prose-blockquote:bg-accent/5 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:pl-5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Fontes consultadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {s.title?.slice(0, 40) || new URL(s.url).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/50 rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">
                  {buscaWeb ? 'Buscando em fontes oficiais e analisando...' : 'Analisando...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border/50 pt-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre legislação, balanços, índices econômicos, habilitação..."
              rows={2}
              className="resize-none text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 self-end"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {buscaWeb
              ? 'A IA consultará fontes oficiais (Planalto, TCU, IBGE, Banco Central) em tempo real para fundamentar a resposta.'
              : 'Busca web desativada. A IA responderá com base no conhecimento interno.'
            }
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
