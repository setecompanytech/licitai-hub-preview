import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
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

/**
 * Tipografia da resposta em markdown.
 *
 * As classes `prose-*` que viviam aqui não pintavam nada: o
 * `@tailwindcss/typography` está no package.json mas NÃO está registrado em
 * `tailwind.config.ts`, então `prose`, `prose-sm` e companhia não geram CSS —
 * e o preflight do Tailwind zera título e lista. O texto saía achatado. Aqui o
 * mesmo desenho é escrito com variantes que existem de fato, e toda cor vem de
 * token.
 *
 * Não há variante de `table` aqui de propósito: o `<ReactMarkdown>` roda sem
 * plugins e o `remark-gfm` não está no projeto, então tabela em pipe nunca vira
 * `<table>` — classe que não pinta nada é a mesma armadilha das `prose-*`. Se o
 * gfm entrar um dia, a tabela precisa de contêiner de rolagem, e isso se faz por
 * componente, não por variante:
 *   <ReactMarkdown components={{
 *     table: (p) => <div className="overflow-x-auto"><table className="w-full text-sm" {...p} /></div>,
 *   }}>
 */
const MARKDOWN_RESPOSTA = [
  'max-w-none text-base leading-6 text-foreground',
  '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-lg [&_h1]:font-semibold',
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-semibold',
  '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_p]:mb-4 [&_p:last-child]:mb-0',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-4 [&_blockquote]:rounded-md [&_blockquote]:border [&_blockquote]:border-border [&_blockquote]:bg-muted [&_blockquote]:px-3 [&_blockquote]:py-2',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm',
  '[&_hr]:my-4 [&_hr]:border-border',
].join(' ');

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
        for (const raw of buffer.split('\n')) {
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
      <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0">
        <CabecalhoPagina
          icone={<Sparkles />}
          titulo="Assistente IA Especializada"
          descricao="Jurídica, Contábil e Econômico-Financeira — com busca em fontes oficiais"
          acoes={
            <>
              <Button
                variant={buscaWeb ? 'default' : 'outline'}
                onClick={() => setBuscaWeb(!buscaWeb)}
                aria-pressed={buscaWeb}
              >
                <Globe className="w-4 h-4" />
                {buscaWeb ? 'Busca Web Ativa' : 'Busca Web Desativada'}
              </Button>
              {messages.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="w-4 h-4" /> Exportar
                  </Button>
                  <Button variant="ghost" onClick={handleClear} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" /> Limpar
                  </Button>
                </>
              )}
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Lei 14.133/2021</Badge>
            <Badge variant="info">NBC TSP</Badge>
            <Badge variant="info">TCU</Badge>
            <Badge variant="info">LRF</Badge>
            <Badge variant="info">CFC/CRC</Badge>
            <Badge variant="info">IPCA/IGP-M</Badge>
          </div>
        </CabecalhoPagina>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <EstadoVazio
              className="h-full"
              icone={<Sparkles />}
              titulo="Assistente IA Especializada"
              descricao="Pergunte sobre legislação, jurisprudência, balanços patrimoniais, índices econômicos, habilitação em licitações ou qualquer tema jurídico-contábil."
              acao={
                <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <Button
                      key={chip.label}
                      variant="outline"
                      onClick={() => handleSend(chip.label)}
                      className="h-auto justify-start gap-2 px-3 py-3 text-left whitespace-normal font-medium"
                    >
                      <chip.icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{chip.label}</span>
                    </Button>
                  ))}
                </div>
              }
            />
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className={MARKDOWN_RESPOSTA}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-base leading-6 whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Fontes consultadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-primary-tint px-2 py-1 text-xs text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <ExternalLink className="w-3 h-3" />
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
              <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2" role="status">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {buscaWeb ? 'Buscando em fontes oficiais e analisando...' : 'Analisando...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border pt-4">
          <div className="flex gap-2">
            <label htmlFor="assistente-pergunta" className="sr-only">Sua pergunta</label>
            <Textarea
              id="assistente-pergunta"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre legislação, balanços, índices econômicos, habilitação..."
              rows={2}
              className="resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 shrink-0 self-end"
              aria-label="Enviar pergunta"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
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
