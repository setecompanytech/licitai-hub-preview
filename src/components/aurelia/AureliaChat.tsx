import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { streamAIChat, ChatMessage, ToolEvent } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useFabArrastavel } from '@/hooks/useFabArrastavel';
import roboAvatar from '@/assets/brand/icon-robo-avatar.png';

export default function AureliaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [hasNotification, setHasNotification] = useState(true);
  const [activeTool, setActiveTool] = useState<{ name: string; args?: Record<string, unknown> } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const fab = useFabArrastavel();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setHasNotification(false);
      if (!hasGreeted && messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: 'Olá! Sou a **AURÉLIA**, sua consultora de licitações da PRAEFECTUS.\n\nComo posso ajudar hoje?\n\n- Análise de editais e cláusulas\n- Habilitação e documentação\n- Estratégia de propostas e lances\n- Dúvidas sobre a Lei 14.133/2021'
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
    setActiveTool(null);

    let assistantContent = '';

    await streamAIChat({
      messages: updatedMessages,
      endpoint: 'aurelia-tools',
      context: `Tela ativa: ${location.pathname}`,
      onToolEvent: (evt: ToolEvent) => {
        if (evt.type === 'running') {
          setActiveTool({ name: evt.name, args: evt.args });
        } else if (evt.type === 'done') {
          setActiveTool(null);
        }
      },
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length > updatedMessages.length - 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      },
      onDone: () => { setIsLoading(false); setActiveTool(null); },
      onError: (err) => {
        const msg = (err === 'Invalid token' || err === 'Unauthorized')
          ? 'Sua sessão expirou. Recarregue a página (F5) e tente novamente.'
          : `Não foi possível conectar com a AURÉLIA. ${err}`;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
        setIsLoading(false);
        setActiveTool(null);
      },
    });
  };

  const handleNewChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Nova consulta iniciada. Como posso ajudar?'
    }]);
  };

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            {...fab.handlers}
            style={fab.estilo}
            // Um arraste termina em clique no navegador; sem isto o chat abriria
            // toda vez que o botão fosse reposicionado.
            onClick={() => {
              if (fab.consumirArraste()) return;
              setOpen(true);
            }}
            className={cn(
              "aurelia-fab fixed z-50 w-14 h-14 rounded-full flex items-center justify-center touch-none select-none",
              fab.arrastando ? "cursor-grabbing aurelia-fab--arrastando" : "cursor-grab",
              hasNotification && "aurelia-glow"
            )}
            title="Consultar AURÉLIA — arraste para reposicionar"
            aria-label="Consultar AURÉLIA. Arraste para reposicionar o botão."
          >
            {/* REBRAND — o escudo com um "A" saiu. Escudo é o símbolo de
                proteção/segurança, e a AURÉLIA é consultora: o ícone contava
                outra história. Entra o robô da marca, em dourado sobre o navy
                do cabeçalho.

                O robô é pintado por MÁSCARA, não exibido como imagem: o PNG é
                azul, e a cor pedida é o dourado da logo. A máscara usa só o
                canal alfa do arquivo — o desenho vira recorte, e a cor vem do
                `background`. Assim ele acompanha o token, e se o dourado mudar
                um dia o ícone muda junto. */}
            <span className="aurelia-fab__robo pointer-events-none" aria-hidden="true" />
            {hasNotification && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="aurelia-bg fixed bottom-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] rounded-xl overflow-hidden shadow-2xl border border-border flex flex-col"
            // Abre do mesmo lado em que o botão está encostado.
            // O fundo saiu do `style` e virou `aurelia-bg`: era
            // `hsl(215, 50%, 7%)` escrito à mão, e cor inline não acompanha o
            // tema nem aparece nos greps de conferência do documento.
            style={
              fab.lado === 'esquerda'
                ? { left: 16, right: 'auto' }
                : { right: 16, left: 'auto' }
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border aurelia-surface">
              <div className="flex items-center gap-2">
                {/* O robô da marca no lugar do "AU".
                    Aqui ele vai nas cores ORIGINAIS — azul sobre círculo claro.
                    No botão flutuante ele é dourado porque lá o fundo é o navy
                    do cabeçalho e o dourado é a cor da marca sobre navy; neste
                    cabeçalho de chat, que é quase preto, o mesmo dourado
                    disputaria com o texto. Fundo claro devolve o contraste e
                    mantém o desenho como foi desenhado. */}
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white/25">
                  <img src={roboAvatar} alt="" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground tracking-wide">AURÉLIA</h3>
                  <p className="text-xs text-muted-foreground">Consultora de Licitações</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-7 w-7 text-muted-foreground hover:text-accent" title="Nova consulta">
                  <Minimize2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                    msg.role === 'user'
                      ? 'aurelia-bubble-user text-foreground'
                      : 'aurelia-bubble-ai text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="whitespace-pre-line">{sanitizeAureliaOutput(msg.content)}</div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {activeTool && (
                <div className="flex justify-start">
                  <div className="aurelia-bubble-ai rounded-lg px-3 py-2 text-xs text-foreground flex items-center gap-2 border border-accent/30">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    <span>
                      {activeTool.name === 'buscar_edital' && '🔎 Buscando edital no cache PNCP…'}
                      {activeTool.name === 'buscar_diario' && '📰 Consultando Diários Oficiais…'}
                      {activeTool.name === 'consultar_historico_precos' && '💰 Consultando histórico de preços…'}
                      {!['buscar_edital','buscar_diario','consultar_historico_precos'].includes(activeTool.name) && `Executando ${activeTool.name}…`}
                    </span>
                  </div>
                </div>
              )}
              {isLoading && !activeTool && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="aurelia-bubble-ai rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    AURÉLIA está analisando…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border aurelia-surface">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Pergunte sobre editais, habilitação, propostas…"
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-8 w-8 bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
