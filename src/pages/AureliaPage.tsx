import { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, FileText, ClipboardCheck, DollarSign, Target, Scale, Zap, FolderOpen } from 'lucide-react';
import { streamAIChat, ChatMessage } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import { cn } from '@/lib/utils';
import roboAvatar from '@/assets/brand/icon-robo-avatar.png';

/**
 * O robô da marca no lugar do monograma "AU" — o mesmo avatar que o painel
 * flutuante da AURÉLIA já usa, para a consultora ter uma cara só no app.
 * Pintado sobre a tinta verde clara, que dá contraste ao desenho azul.
 */
function AvatarAurelia({ tamanho = 'sm' }: { tamanho?: 'sm' | 'lg' }) {
  const grande = tamanho === 'lg';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint ring-1 ring-border',
        grande ? 'h-20 w-20' : 'mt-1 h-8 w-8',
      )}
    >
      <img src={roboAvatar} alt="" className={cn('object-contain', grande ? 'h-14 w-14' : 'h-6 w-6')} />
    </span>
  );
}

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
  const { processo } = useProcessoAtivo();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    // Inject active process context into the very first user message
    const contextoProcesso = processo
      ? `\n\n[Contexto do processo ativo: ${processo.numero || 'S/N'} — ${processo.orgao || ''} — ${processo.objeto || ''}${processo.valor_estimado ? ` — Valor estimado R$ ${processo.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}]`
      : '';
    const conteudoComContexto = messages.length === 0 && contextoProcesso ? msg + contextoProcesso : msg;

    const userMsg: ChatMessage = { role: 'user', content: conteudoComContexto };
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
        {/* `/assistente` é a rota do menu; a URL atendida é `/aurelia`, então o
            registro é apontado à mão para o título/descrição virem de lá. */}
        <CabecalhoPagina rota="/assistente" />

        {showWelcome ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            {/* Avatar da consultora */}
            <div className="mb-6">
              <AvatarAurelia tamanho="lg" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Como posso ajudar hoje?</h2>
            <p className="text-base text-muted-foreground mb-6 text-center max-w-md">
              Pergunte sobre editais, habilitação, propostas, estratégia de lance ou a Lei 14.133/2021.
            </p>

            {processo && (
              <div className="mb-6 flex max-w-full items-center gap-2 rounded-full border border-border bg-primary-tint px-3 py-1 text-xs">
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="text-primary font-medium">Analisando: {processo.numero || 'S/N'}</span>
                <span className="text-muted-foreground truncate max-w-[200px]">— {processo.orgao}</span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mb-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {quickActions.map((qa) => (
                <Button
                  key={qa.label}
                  variant="outline"
                  onClick={() => handleSend(qa.prompt)}
                  className="h-auto flex-col gap-2 p-4 rounded-lg whitespace-normal text-center"
                >
                  <qa.icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{qa.label}</span>
                </Button>
              ))}
            </div>

            {/* Input */}
            <div className="w-full max-w-xl">
              <div className="flex gap-2">
                <label htmlFor="aurelia-pergunta" className="sr-only">Pergunta para a AURÉLIA</label>
                <Input
                  id="aurelia-pergunta"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pergunte sobre editais, habilitação, propostas…"
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="Enviar pergunta"
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
                  {msg.role === 'assistant' && <AvatarAurelia />}
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-4 py-3 text-base leading-6",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="whitespace-pre-line">{sanitizeAureliaOutput(msg.content)}</div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <AvatarAurelia />
                  <div className="bg-card border border-border rounded-lg px-4 py-3 text-base leading-6 text-muted-foreground flex items-center gap-2" role="status">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    AURÉLIA está analisando…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="sticky bottom-0 py-4 bg-background">
              <div className="flex gap-2">
                <label htmlFor="aurelia-continuar" className="sr-only">Continue a conversa</label>
                <Input
                  id="aurelia-continuar"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Continue a conversa…"
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="Enviar mensagem"
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
