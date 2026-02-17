import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, FileText, Scale, BarChart3 } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  { icon: FileText, text: 'Resuma o edital PE-001/2026' },
  { icon: Scale, text: 'Quais são os requisitos de habilitação da Lei 14.133/2021?' },
  { icon: BarChart3, text: 'Análise SWOT da licitação CC-012/2026' },
  { icon: Sparkles, text: 'Gere uma impugnação para o edital PE-045/2026' },
];

const mockResponses: Record<string, string> = {
  default: `**Análise do Edital PE-001/2026**

📋 **Resumo:**
- **Objeto:** Construção de ponte sobre o Rio Guamá - Trecho Norte
- **Órgão:** Prefeitura Municipal de Belém
- **Valor estimado:** R$ 4.500.000,00
- **Modalidade:** Pregão Eletrônico

⚖️ **Requisitos de Habilitação (Lei 14.133/2021):**
- Art. 62: Habilitação jurídica
- Art. 65: Qualificação técnica-profissional
- Art. 69: Regularidade fiscal e trabalhista

🎯 **Recomendação IA:** Relevância alta (95%). Histórico favorável na região. Lance sugerido: R$ 4.200.000 (-6.7% do estimado).`,
};

export default function Assistente() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: msg },
      { role: 'assistant', content: mockResponses.default },
    ];
    setMessages(newMessages);
    setInput('');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-accent" />
            Assistente IA Jurídico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            RAG jurídico com citação de leis, artigos e jurisprudências
          </p>
        </div>

        {/* Chat area */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm min-h-[500px] flex flex-col">
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Como posso ajudar?</h2>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                  Pergunte sobre editais, requisitos legais, análises SWOT ou gere documentos automaticamente.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.text)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left text-sm"
                    >
                      <s.icon className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Pergunte sobre licitações, leis, concorrentes..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
