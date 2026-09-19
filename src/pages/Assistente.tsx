import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, FileText, Scale, BarChart3, Loader2 } from 'lucide-react';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const suggestions = [
  { icon: FileText, text: 'Resuma os requisitos de habilitação da Lei 14.133/2021' },
  { icon: Scale, text: 'Quais são os critérios de julgamento previstos na Lei 14.133/2021?' },
  { icon: BarChart3, text: 'Como calcular o BDI para obras públicas?' },
  { icon: Sparkles, text: 'Gere um modelo de impugnação de edital por restrição à competitividade' },
];

export default function Assistente() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    const allMessages = [...messages, userMsg];

    await streamAIChat({
      messages: allMessages,
      action: 'assistente',
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      },
      onDone: () => setIsLoading(false),
      onError: (error) => toast.error(error),
    });
  };

  return (
    <AppLayout>
      {/* Largura de leitura: a conversa fica numa coluna de 3xl no desktop. */}
      <div className="mx-auto w-full max-w-3xl">
        {/* A tela não é item de menu: título e descrição vêm à mão. */}
        <CabecalhoPagina
          icone={<Bot />}
          titulo="Assistente IA Jurídico"
          descricao="IA especializada em licitações com base na Lei 14.133/2021"
        >
          <div>
            <SeloPraefectusIA />
          </div>
        </CabecalhoPagina>

        {/* O painel da conversa: histórico sobre a superfície rebaixada, com
            rolagem própria, e a entrada fixa no rodapé do cartão. */}
        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto bg-muted p-4 sm:p-5">
            {messages.length === 0 ? (
              <EstadoVazio
                icone={<Sparkles />}
                titulo="Como posso ajudar?"
                descricao="Pergunte sobre editais, requisitos legais, análises ou gere documentos jurídicos automaticamente."
                acao={
                  <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(s.text)}
                        className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left text-sm text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary"
                        >
                          <s.icon className="h-4 w-4" />
                        </span>
                        <span>{s.text}</span>
                      </button>
                    ))}
                  </div>
                }
              />
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-3 text-base leading-6',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card text-foreground',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-card px-4 py-3" role="status">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card p-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <label htmlFor="assistente-juridico-pergunta" className="sr-only">Sua pergunta</label>
              <Input
                id="assistente-juridico-pergunta"
                placeholder="Pergunte sobre licitações, leis, concorrentes..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="shrink-0" disabled={isLoading} aria-label="Enviar pergunta">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
