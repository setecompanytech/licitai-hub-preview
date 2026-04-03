import { useState, useEffect, useCallback } from 'react';
import { FileText, ClipboardCheck, AlertTriangle, ThumbsUp } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import AureliaQuickCard from './AureliaQuickCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface EditalData {
  titulo: string;
  objeto: string;
  orgao: string;
  valor: string;
  modalidade: string;
  dataAbertura?: string;
  uf?: string;
}

interface EmpresaContext {
  cnae?: string;
  uf?: string;
  porte?: string;
}

interface AureliaEditalPanelProps {
  edital: EditalData;
  empresa?: EmpresaContext;
}

type AnalysisType = 'resumo' | 'habilitacao' | 'riscos' | 'recomendacao';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function AureliaEditalPanel({ edital, empresa }: AureliaEditalPanelProps) {
  const [analyses, setAnalyses] = useState<Record<AnalysisType, { content: string | null; loading: boolean; error: boolean }>>({
    resumo: { content: null, loading: true, error: false },
    habilitacao: { content: null, loading: true, error: false },
    riscos: { content: null, loading: true, error: false },
    recomendacao: { content: null, loading: true, error: false },
  });

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const editalContext = `Edital: ${edital.titulo} | Objeto: ${edital.objeto} | Órgão: ${edital.orgao} | Valor: ${edital.valor} | Modalidade: ${edital.modalidade} | UF: ${edital.uf || '-'} | Empresa CNAE: ${empresa?.cnae || '-'} | UF: ${empresa?.uf || '-'} | Porte: ${empresa?.porte || '-'}`;

  const runAnalysis = useCallback(async (type: AnalysisType) => {
    setAnalyses(prev => ({ ...prev, [type]: { content: null, loading: true, error: false } }));

    let result = '';
    await streamAIChat({
      messages: [{ role: 'user', content: editalContext }],
      action: `aurelia_${type}`,
      onDelta: (chunk) => {
        result += chunk;
        setAnalyses(prev => ({ ...prev, [type]: { content: result, loading: false, error: false } }));
      },
      onDone: () => {
        if (!result) {
          setAnalyses(prev => ({ ...prev, [type]: { content: null, loading: false, error: true } }));
        }
      },
      onError: () => {
        setAnalyses(prev => ({ ...prev, [type]: { content: null, loading: false, error: true } }));
      },
    });
  }, [editalContext]);

  useEffect(() => {
    const types: AnalysisType[] = ['resumo', 'habilitacao', 'riscos', 'recomendacao'];
    types.forEach(t => runAnalysis(t));
  }, []);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMsg = { role: 'user', content: text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatLoading(true);

    let assistantContent = '';
    await streamAIChat({
      messages: updated,
      action: 'aurelia',
      context: editalContext,
      onDelta: (chunk) => {
        assistantContent += chunk;
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      },
      onDone: () => setChatLoading(false),
      onError: () => setChatLoading(false),
    });
  };

  const cards: { type: AnalysisType; title: string; icon: React.ReactNode }[] = [
    { type: 'resumo', title: 'Resumo Executivo', icon: <FileText className="w-4 h-4" /> },
    { type: 'habilitacao', title: 'Checklist de Habilitação', icon: <ClipboardCheck className="w-4 h-4" /> },
    { type: 'riscos', title: 'Alertas e Riscos', icon: <AlertTriangle className="w-4 h-4" /> },
    { type: 'recomendacao', title: 'Recomendação', icon: <ThumbsUp className="w-4 h-4" /> },
  ];

  return (
    <div className="rounded-xl border aurelia-border overflow-hidden" style={{ background: 'hsl(215, 50%, 7%)' }}>
      <div className="px-4 py-3 border-b border-[hsl(215,20%,20%)] flex items-center gap-2" style={{ background: 'hsl(215, 40%, 10%)' }}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(43,60%,54%)] text-[10px] font-bold text-white">IA</span>
        <span className="text-sm font-semibold text-[hsl(215,14%,92%)]">AURÉLIA — Análise Deste Edital</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {cards.map(c => (
          <AureliaQuickCard
            key={c.type}
            title={c.title}
            icon={c.icon}
            content={analyses[c.type].content}
            isLoading={analyses[c.type].loading}
            error={analyses[c.type].error}
            onRetry={() => runAnalysis(c.type)}
          />
        ))}
      </div>

      {/* Contextual chat */}
      <div className="border-t border-[hsl(215,20%,20%)] p-4">
        {chatMessages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                  msg.role === 'user' ? 'aurelia-bubble-user text-[hsl(215,14%,92%)]' : 'aurelia-bubble-ai text-[hsl(215,14%,82%)]'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
            placeholder="Pergunte sobre este edital específico"
            className="bg-[hsl(215,25%,15%)] border-[hsl(215,20%,22%)] text-xs text-[hsl(215,14%,92%)] placeholder:text-[hsl(215,12%,40%)]"
            disabled={chatLoading}
          />
          <Button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading} size="icon" className="h-9 w-9 bg-[hsl(43,60%,54%)] hover:bg-[hsl(43,60%,48%)] text-white shrink-0">
            {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
