import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, Sparkles, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; citados?: any[] };

const SUGESTOES = [
  'Quais editais de merenda escolar abrem essa semana?',
  'Liste pregões eletrônicos de TI no Pará com valor acima de R$ 500 mil.',
  'Há dispensas eletrônicas para serviços de limpeza?',
  'Quais editais de obras estão com encerramento próximo?',
];

export default function ChatAureliaEditais() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim();
    if (!pergunta || loading) return;

    const novas: Msg[] = [...messages, { role: 'user', content: pergunta }];
    setMessages(novas);
    setInput('');
    setLoading(true);

    try {
      const { getUserJwt } = await import('@/lib/auth-token');
      const token = await getUserJwt({ showToastOnFail: true });
      if (!token) { setLoading(false); return; }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aurelia-chat-editais`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: novas }),
      });

      if (resp.status === 429) { toast.error('Limite de uso atingido. Aguarde um momento.'); setLoading(false); return; }
      if (resp.status === 402) { toast.error('Créditos da IA esgotados.'); setLoading(false); return; }
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j.error || 'Falha ao consultar AURÉLIA');
        setLoading(false);
        return;
      }

      // Extrai citações do header
      let citados: any[] = [];
      const headerCit = resp.headers.get('X-Editais-Citados');
      if (headerCit) {
        try { citados = JSON.parse(decodeURIComponent(headerCit)); } catch {}
      }

      // Streaming SSE
      setMessages((prev) => [...prev, { role: 'assistant', content: '', citados }]);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acumulado = '';
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const p = JSON.parse(json);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) {
              acumulado += delta;
              setMessages((prev) => {
                const novo = [...prev];
                const last = novo[novo.length - 1];
                if (last?.role === 'assistant') last.content = acumulado;
                return novo;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  function limpar() {
    setMessages([]);
    setInput('');
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Chat AURÉLIA — Pergunte sobre os editais
            <Badge variant="outline" className="text-xs">Fase 5 · RAG</Badge>
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={limpar} className="h-7 px-2">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Faça perguntas em linguagem natural sobre o acervo de editais. A AURÉLIA usa busca semântica + IA para responder com citações.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 text-xs text-left justify-start whitespace-normal"
                  onClick={() => enviar(s)}
                >
                  <Bot className="w-3.5 h-3.5 mr-2 shrink-0 text-primary" />
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-3" ref={scrollRef as any}>
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                          <ReactMarkdown>{m.content || '_pensando..._'}</ReactMarkdown>
                        </div>
                        {m.citados && m.citados.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-border/50 space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground">Editais citados:</p>
                            {m.citados.map((c: any) => (
                              <a
                                key={c.n}
                                href={c.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-1.5 text-xs hover:text-primary transition-colors"
                              >
                                <span className="font-mono text-primary shrink-0">[{c.n}]</span>
                                <span className="line-clamp-2">
                                  <span className="font-medium">{c.orgao}</span> — {c.objeto}
                                </span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-muted-foreground">Buscando editais e raciocinando...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Ex: quais editais de informática no DF abrem nos próximos 7 dias?"
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            disabled={loading}
          />
          <Button onClick={() => enviar()} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
