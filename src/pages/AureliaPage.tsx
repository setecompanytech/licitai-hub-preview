import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Send, Loader2, FileText, ClipboardCheck, DollarSign, Target, Scale, Zap } from 'lucide-react';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import { cn } from '@/lib/utils';

const quickActions = [
  { icon: FileText, label: 'Interpretar Edital', prompt: 'Quero colar o texto de um edital para você analisar' },
  { icon: ClipboardCheck, label: 'Checklist de Habilitação', prompt: 'Me ajude a montar o checklist de habilitação para uma licitação' },
  { icon: DollarSign, label: 'Pesquisa de Preços', prompt: 'Como fazer pesquisa de preços de mercado conforme IN 73/2022?' },
  { icon: Target, label: 'Montar Proposta', prompt: 'Me oriente a estruturar uma proposta técnica' },
  { icon: Scale, label: 'Dúvida Jurídica', prompt: 'Tenho uma dúvida sobre a Lei 14.133/2021' },
  { icon: Zap, label: 'Estratégia de Lance', prompt: 'Me ajude a definir estratégia de lance para pregão eletrônico' },
];

export default function AureliaPage() {
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
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    await streamAIChat({
      messages: updated,
      action: 'aurelia',
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
      onError: (err) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${err}` }]);
        setIsLoading(false);
      },
    });
  };

  const showWelcome = messages.length === 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto min-h-[calc(100vh-120px)] flex flex-col">
        {showWelcome ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            {/* Logo */}
            <div className="w-20 h-20 rounded-full bg-[hsl(43,60%,54%)] flex items-center justify-center mb-6 shadow-lg" style={{ boxShadow: '0 4px 24px hsl(43 60% 54% / 0.3)' }}>
              <span className="text-2xl font-bold text-white tracking-wider">AU</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">AURÉLIA</h1>
            <p className="text-sm text-muted-foreground mb-2">Sua consultora sênior em licitações públicas</p>
            <p className="text-xs text-muted-foreground/60 mb-10">Powered by PRAEFECTUS Intelligence</p>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl mb-8">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => handleSend(qa.prompt)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-all text-center group"
                >
                  <qa.icon className="w-5 h-5 text-[hsl(43,60%,54%)] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-foreground">{qa.label}</span>
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="w-full max-w-xl">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pergunte sobre editais, habilitação, propostas…"
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(43,60%,54%)] transition-all"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="bg-[hsl(43,60%,54%)] hover:bg-[hsl(43,60%,48%)] text-white h-auto px-4 rounded-xl"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto py-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[hsl(43,60%,54%)] flex items-center justify-center shrink-0 mt-1">
                      <span className="text-[10px] font-bold text-white">AU</span>
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert [&>*]:my-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(43,60%,54%)] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-white">AU</span>
                  </div>
                  <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[hsl(43,60%,54%)]" />
                    AURÉLIA está analisando…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="sticky bottom-0 py-4 bg-background">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Continue a conversa…"
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(43,60%,54%)] transition-all"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="bg-[hsl(43,60%,54%)] hover:bg-[hsl(43,60%,48%)] text-white h-auto px-4 rounded-xl"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
