import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useFabArrastavel, FAB_MARGEM } from '@/hooks/useFabArrastavel';

interface FloatingChatProps {
  /**
   * Marca a instância que aparece na landing. Na identidade 12/09 o verde é
   * um só — o par dourado/navy que separava landing e app deixou de existir —
   * então a prop não repinta mais nada; fica como marcação de contexto para
   * quem inspeciona a página (e porque a landing já a passa).
   */
  isLanding?: boolean;
}

export default function FloatingChat({ isLanding = false }: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fab = useFabArrastavel();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
      if (!hasGreeted && messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: 'Olá! 👋 Sou a **Lia**, sua assistente virtual do PRAEFECTUS. Como posso te ajudar hoje?\n\nPosso tirar dúvidas sobre:\n- 📋 Funcionalidades da plataforma\n- 📝 Licitações e editais\n- 💡 Como usar as ferramentas\n- 🆘 Suporte técnico'
        }]);
        setHasGreeted(true);
      }
    }
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length === updatedMessages.length + 1) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    await streamAIChat({
      messages: updatedMessages,
      action: 'suporte_chat',
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Desculpe, tive um problema: ${err}. Tente novamente em instantes.` }]);
        setIsLoading(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    'Como monitorar editais?',
    'O que é o Robô de Lances?',
    'Como gerar uma proposta?',
    'Pare o robô no pregão',
    'Qual minha posição na disputa?',
    'Sugira um decremento ideal',
  ];

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed z-50"
            style={fab.estilo}
            data-contexto={isLanding ? 'landing' : 'app'}
          >
            <Button
              {...fab.handlers}
              // Um arraste termina em clique no navegador; sem isto o chat abriria
              // toda vez que o botão fosse reposicionado.
              onClick={() => {
                if (fab.consumirArraste()) return;
                setOpen(true);
              }}
              title="Abrir o chat — arraste para reposicionar"
              aria-label="Abrir o chat com a Lia. Arraste para reposicionar o botão."
              className={cn(
                'rounded-full w-14 h-14 shadow-md transition-shadow touch-none select-none',
                'bg-primary text-primary-foreground hover:bg-primary-hover',
                fab.arrastando ? 'cursor-grabbing scale-105' : 'cursor-grab',
              )}
            >
              <MessageCircle className="w-6 h-6 pointer-events-none" aria-hidden="true" />
            </Button>
            {/* Pulse indicator */}
            <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            // Abre do mesmo lado em que o botão está encostado; abrir sempre à
            // direita deixaria a janela longe de onde o usuário clicou.
            style={fab.lado === 'esquerda'
              ? { left: FAB_MARGEM, right: 'auto' }
              : { right: FAB_MARGEM, left: 'auto' }}
            className="fixed bottom-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] flex flex-col rounded-lg shadow-md border border-border overflow-hidden bg-card"
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex min-w-0 items-center gap-3">
                <div aria-hidden="true" className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none">Lia — Assistente PRAEFECTUS</p>
                  <p className="text-xs opacity-80 mt-1">Online • Resposta instantânea</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar o chat"
                className="flex-shrink-0 rounded-full p-2 transition-colors hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div aria-hidden="true" className="w-7 h-7 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ul]:pl-4 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div aria-hidden="true" className="w-7 h-7 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 items-start" role="status" aria-label="A Lia está escrevendo">
                  <div aria-hidden="true" className="w-7 h-7 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions (only when few messages) */}
            {messages.length <= 1 && !isLoading && (
              <div className="px-3 pb-2 flex flex-wrap gap-2">
                {quickActions.map(q => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-3">
              <label htmlFor="floating-chat-mensagem" className="sr-only">Sua dúvida para a Lia</label>
              <input
                id="floating-chat-mensagem"
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="h-9 w-9 flex-shrink-0 rounded-full p-0"
                aria-label="Enviar a mensagem"
              >
                {isLoading
                  ? <Loader2 className="animate-spin" aria-hidden="true" />
                  : <Send aria-hidden="true" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
