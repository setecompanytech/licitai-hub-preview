import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Plus, MessageSquare, History, Archive, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { cn } from '@/lib/utils';
import { streamAIChat, ChatMessage, ToolEvent } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useFabArrastavel } from '@/hooks/useFabArrastavel';
import roboAvatar from '@/assets/brand/icon-robo-avatar.png';
import { useAureliaHistorico } from '@/hooks/useAureliaHistorico';

/**
 * AURÉLIA — o assistente global, aberto pelo botão flutuante (Design System
 * v3, 19/09/2026).
 *
 * O painel continua sendo o MESMO contêiner de antes — o estado `open`, o
 * botão que o abre e o lado em que ele encosta não mudaram. Virar `Sheet`
 * traria véu sobre a página, foco preso e fechamento por Escape ou clique
 * fora: mudanças de comportamento que um redesign visual não autoriza, e a
 * consultora é usada justamente enquanto se lê a tela atrás dela. O que
 * mudou é a apresentação: largura de drawer (480px; 720px ampliado), tela
 * cheia no celular, cabeçalho de 60px com o selo Praefectus IA, histórico
 * com rolagem própria e a entrada fixa no rodapé.
 */
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
      {/* O botão flutuante: verde de ação, redondo, 48px, sombra de menu —
          sem gradiente nem pulso. A posição continua vindo do hook de arraste. */}
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
              'print:hidden fixed z-50 flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              fab.arrastando ? 'cursor-grabbing aurelia-fab--arrastando' : 'cursor-grab',
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
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-destructive"
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* O painel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            role="region"
            aria-label="AURÉLIA"
            className={cn(
              'print:hidden fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-xl',
              // Celular: a tela inteira. Desktop: painel ancorado embaixo, na
              // largura de drawer, do mesmo lado em que o botão está encostado.
              'inset-0 sm:inset-auto sm:bottom-4 sm:max-w-[calc(100vw-2rem)] sm:rounded-xl',
              fab.lado === 'esquerda' ? 'sm:left-4' : 'sm:right-4',
              // Ampliar existe porque análise de edital vem longa: em 380px a
              // resposta cabe em vinte linhas de três palavras.
              ampliado
                ? 'sm:h-[calc(100vh-2rem)] sm:w-[720px]'
                : 'sm:h-[min(680px,calc(100vh-2rem))] sm:w-[480px]',
            )}
          >
            {/* Cabeçalho — 60px: identificação, selo e as ações sobre o painel. */}
            <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4">
              <div className="flex min-w-0 items-center gap-2">
                {/* O robô da marca no lugar do "AU", nas cores originais —
                    azul sobre a tinta verde clara, que dá contraste ao desenho
                    sem disputar com o texto ao lado. */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint ring-1 ring-border">
                  <img src={roboAvatar} alt="" className="h-7 w-7 object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold leading-5 text-foreground">AURÉLIA</h3>
                    <SeloPraefectusIA className="hidden sm:inline-flex" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">Consultora de Licitações</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {/* O ícone era `Minimize2` — desenho de "encolher" para a ação
                    de começar do zero. `Plus` é o que a ação faz. */}
                <Button variant="ghost" size="icon-sm" onClick={handleNewChat} className="text-muted-foreground hover:text-foreground" title="Nova conversa" aria-label="Nova conversa">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => setAmpliado((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                  title={ampliado ? 'Reduzir' : 'Ampliar'}
                  aria-label={ampliado ? 'Reduzir a janela' : 'Ampliar a janela'}
                  aria-pressed={ampliado}
                >
                  {ampliado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar chat">
                  <X className="h-4 w-4" />
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
                    'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    aba === t.id
                      ? 'border-primary font-semibold text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <t.icone className="h-4 w-4" aria-hidden="true" />
                  {t.rotulo}
                  {t.id === 'historico' && historico.conversas.length > 0 && (
                    <span className="tabular-nums text-muted-foreground">({historico.conversas.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Histórico — as conversas anteriores, com rolagem própria. */}
            {aba === 'historico' && (
              <div className="flex-1 overflow-y-auto bg-muted p-3">
                {historico.erro && (
                  <div role="alert" className="mb-3 rounded-md border border-destructive-line bg-destructive-tint px-3 py-2 text-sm text-destructive-ink">
                    {historico.erro}
                    <button
                      type="button"
                      onClick={() => void historico.carregarConversas()}
                      className="ml-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <EstadoVazio
                    tamanho="compacto"
                    icone={<History />}
                    titulo="Nenhuma conversa guardada"
                    descricao="O que você perguntar à AURÉLIA fica aqui, e pode ser reaberto depois."
                  />
                )}

                <ul className="flex flex-col gap-1.5">
                  {historico.conversas.map((c) => (
                    <li key={c.id} className="group flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => void abrirDoHistorico(c.id)}
                        className={cn(
                          'min-w-0 flex-1 rounded-md border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                        variant="ghost" size="icon-sm"
                        onClick={() => void historico.arquivarConversa(c.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
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

            {/* Mensagens — superfície rebaixada; balão da pessoa na tinta da
                ação, à direita; balão da IA em cartão, à esquerda. */}
            <div className={cn('flex-1 space-y-3 overflow-y-auto bg-muted p-3', aba !== 'chat' && 'hidden')}>
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-base leading-5',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="whitespace-pre-line">{sanitizeAureliaOutput(msg.content)}</div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {activeTool && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    AURÉLIA está analisando…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Entrada — fixa no rodapé do painel. */}
            <div className={cn('shrink-0 border-t border-border bg-card p-3', aba !== 'chat' && 'hidden')}>
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
                  className="shrink-0"
                  aria-label="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
