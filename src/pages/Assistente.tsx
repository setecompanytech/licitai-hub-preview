import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, FileText, Scale, BarChart3, Loader2 } from 'lucide-react';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import { toast } from 'sonner';

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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
            Assistente IA Jurídico
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            IA especializada em licitações com base na Lei 14.133/2021
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm min-h-[500px] flex flex-col">
          <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Como posso ajudar?</h2>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                  Pergunte sobre editais, requisitos legais, análises ou gere documentos jurídicos automaticamente.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.text)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left text-sm"
                    >
                      <s.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-border/50 p-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input
                placeholder="Pergunte sobre licitações, leis, concorrentes..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-accent"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
