import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Plus, MessageSquare, History, Archive, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { streamAIChat, ChatMessage, ToolEvent } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useFabArrastavel } from '@/hooks/useFabArrastavel';
import roboAvatar from '@/assets/brand/icon-robo-avatar.png';
import { useAureliaHistorico } from '@/hooks/useAureliaHistorico';

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

  /* Histórico (13/09/2026). A conversa vivia em `useState` e sumia no F5:
     quem pedia análise de um edital, saía para conferir o documento e voltava,
     encontrava a tela em branco e refazia a pergunta — outro gasto de IA, e
     outra resposta, que raramente sai igual à primeira. */
  const [aba, setAba] = useState<'chat' | 'historico'>('chat');
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);
  const historico = useAureliaHistorico();

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

    // A conversa só nasce quando alguém fala. Criá-la ao abrir o painel
    // encheria o histórico de linhas vazias de quem abriu e desistiu.
    let idDaConversa = conversaId;
    if (!idDaConversa) {
      idDaConversa = await historico.abrirConversa(location.pathname);
      setConversaId(idDaConversa);
    }
    // `ordem` é a posição na conversa que está na tela. A saudação inicial
    // conta: ela é a primeira fala e precisa voltar igual ao reabrir.
    const ordemDaPergunta = updatedMessages.length - 1;
    if (idDaConversa) {
      // Grava ANTES de perguntar. Se a resposta falhar ou a pessoa fechar a
      // aba no meio, a pergunta sobrevive — e é ela que custou o raciocínio.
      void historico.gravarMensagem(idDaConversa, 'user', text, ordemDaPergunta);
    }

    let assistantContent = '';
    let ferramentaUsada: string | undefined;

    await streamAIChat({
      messages: updatedMessages,
      endpoint: 'aurelia-tools',
      context: `Tela ativa: ${location.pathname}`,
      onToolEvent: (evt: ToolEvent) => {
        if (evt.type === 'running') {
          setActiveTool({ name: evt.name, args: evt.args });
          ferramentaUsada = evt.name;
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
      onDone: () => {
        setIsLoading(false);
        setActiveTool(null);
        if (idDaConversa && assistantContent.trim()) {
          void historico.gravarMensagem(
            idDaConversa, 'assistant', assistantContent, ordemDaPergunta + 1, ferramentaUsada,
          );
        }
        // Recarrega a lista para a conversa nova aparecer com o título que o
        // gatilho acabou de dar a ela.
        void historico.carregarConversas();
      },
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

  /**
   * Conversa NOVA — a anterior fica guardada.
   *
   * Antes isto era um `setMessages` que apagava a conversa em curso e não
   * abria nada: "novo" significava "perdi o que estava aqui", que é o oposto
   * do que a palavra promete em qualquer outro lugar do sistema.
   */
  const handleNewChat = () => {
    setConversaId(null);
    setAba('chat');
    setMessages([{
      role: 'assistant',
      content: 'Nova consulta iniciada. Como posso ajudar?'
    }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /** Reabre uma conversa do histórico, inteira, na ordem em que aconteceu. */
  const abrirDoHistorico = async (id: string) => {
    const falas = await historico.carregarMensagens(id);
    if (!falas) return;
    setConversaId(id);
    setMessages(falas);
    setAba('chat');
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
                outra história. Entra o robô da marca.

                O robô é pintado por MÁSCARA, não exibido como imagem: o PNG é
                azul, e a cor pedida vem do token. A máscara usa só o canal
                alfa do arquivo — o desenho vira recorte, e a cor vem do
                `background` (`.aurelia-fab__robo` no index.css). Assim ele
                acompanha o tema, e se a cor mudar um dia o ícone muda junto. */}
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
            className={cn(
              'fixed bottom-4 z-50 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] rounded-lg overflow-hidden shadow-md border border-border bg-card flex flex-col',
              // Ampliar existe porque análise de edital vem longa: em 380px a
              // resposta cabe em vinte linhas de três palavras.
              ampliado ? 'w-[720px] h-[calc(100vh-2rem)]' : 'w-[380px] h-[520px]',
            )}
            // Abre do mesmo lado em que o botão está encostado.
            // Só a posição vive em `style`: cor e raio saem de token, para
            // acompanhar o tema e aparecer nos greps de conferência.
            style={
              fab.lado === 'esquerda'
                ? { left: 16, right: 'auto' }
                : { right: 16, left: 'auto' }
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                {/* O robô da marca no lugar do "AU", nas cores originais —
                    azul sobre a tinta verde clara, que dá contraste ao desenho
                    sem disputar com o texto ao lado. */}
                <div className="w-9 h-9 rounded-full bg-primary-tint flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border">
                  <img src={roboAvatar} alt="" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-wide">AURÉLIA</h3>
                  <p className="text-xs text-muted-foreground">Consultora de Licitações</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* O ícone era `Minimize2` — desenho de "encolher" para a ação
                    de começar do zero. `Plus` é o que a ação faz. */}
                <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Nova conversa" aria-label="Nova conversa">
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setAmpliado((v) => !v)}
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  title={ampliado ? 'Reduzir' : 'Ampliar'}
                  aria-label={ampliado ? 'Reduzir a janela' : 'Ampliar a janela'}
                  aria-pressed={ampliado}
                >
                  {ampliado ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Fechar chat">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Abas — a conversa de agora e as anteriores.
                Ficam abaixo da identificação e não ao lado dos botões porque
                trocar de aba é navegação dentro do painel; fechar e ampliar são
                ações sobre o painel. Misturar as duas naturezas na mesma fila
                faz clicar em "Histórico" parecer que vai fechar alguma coisa. */}
            <div
              role="tablist"
              aria-label="Conversas da AURÉLIA"
              className="flex shrink-0 border-b border-border bg-card"
            >
              {([
                { id: 'chat' as const, rotulo: 'Chat', icone: MessageSquare },
                { id: 'historico' as const, rotulo: 'Histórico', icone: History },
              ]).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={aba === t.id}
                  onClick={() => {
                    setAba(t.id);
                    if (t.id === 'historico') void historico.carregarConversas();
                  }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    aba === t.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <t.icone className="h-4 w-4" aria-hidden="true" />
                  {t.rotulo}
                  {t.id === 'historico' && historico.conversas.length > 0 && (
                    <span className="tabular-nums opacity-70">({historico.conversas.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Histórico — as conversas anteriores */}
            {aba === 'historico' && (
              <div className="flex-1 overflow-y-auto bg-background p-3">
                {historico.erro && (
                  <div role="alert" className="mb-3 rounded-lg border border-destructive-line bg-destructive-tint px-3 py-2 text-xs text-destructive-ink">
                    {historico.erro}
                    <button
                      type="button"
                      onClick={() => void historico.carregarConversas()}
                      className="ml-2 font-semibold underline underline-offset-2"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                {historico.carregando && (
                  <p role="status" className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversas…
                  </p>
                )}

                {!historico.carregando && historico.conversas.length === 0 && !historico.erro && (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <History className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground">Nenhuma conversa guardada</p>
                    <p className="text-xs text-muted-foreground">
                      O que você perguntar à AURÉLIA fica aqui, e pode ser reaberto depois.
                    </p>
                  </div>
                )}

                <ul className="flex flex-col gap-1.5">
                  {historico.conversas.map((c) => (
                    <li key={c.id} className="group flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => void abrirDoHistorico(c.id)}
                        className={cn(
                          'min-w-0 flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
                          c.id === conversaId
                            ? 'border-primary bg-primary-tint'
                            : 'border-border bg-card hover:border-primary/40',
                        )}
                      >
                        <span className="block truncate text-sm font-medium text-foreground">
                          {/* Sem título, a conversa existe mas ninguém falou
                              nela ainda — dizer "Sem título" seria confundir
                              ausência de nome com ausência de assunto. */}
                          {c.titulo ?? 'Conversa sem perguntas'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(c.ultima_mensagem_em).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                          {' · '}
                          <span className="tabular-nums">{c.total_mensagens}</span>{' '}
                          {c.total_mensagens === 1 ? 'mensagem' : 'mensagens'}
                        </span>
                      </button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => void historico.arquivarConversa(c.id)}
                        className="mt-1 h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        title="Arquivar conversa"
                        aria-label={`Arquivar a conversa ${c.titulo ?? 'sem título'}`}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Messages */}
            <div className={cn('flex-1 overflow-y-auto p-3 space-y-3 bg-background', aba !== 'chat' && 'hidden')}>
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="whitespace-pre-line">{sanitizeAureliaOutput(msg.content)}</div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {activeTool && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground flex items-center gap-2 border border-border" role="status">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2" role="status">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    AURÉLIA está analisando…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={cn('p-3 border-t border-border bg-card', aba !== 'chat' && 'hidden')}>
              <div className="flex gap-2">
                <label htmlFor="aurelia-chat-input" className="sr-only">Pergunta para a AURÉLIA</label>
                <Input
                  id="aurelia-chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Pergunte sobre editais, habilitação, propostas…"
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="Enviar mensagem"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
