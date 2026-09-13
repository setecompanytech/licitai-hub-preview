import { useState, useEffect, useCallback } from 'react';
import { FileText, ClipboardCheck, AlertTriangle, ThumbsUp } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { sanitizeAureliaOutput } from '@/prompts/aurelia-system-prompt';
import AureliaQuickCard from './AureliaQuickCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
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
  /**
   * Quantas colunas os quatro cartões de análise ocupam. O padrão (2) serve
   * ao painel largo do Mural; dentro de uma coluna lateral — o modal do
   * Kanban — dois cartões lado a lado viram tiras de 200px, e o resumo
   * executivo tem parágrafos inteiros para ler. Ali é 1.
   */
  colunas?: 1 | 2;
}

type AnalysisType = 'resumo' | 'habilitacao' | 'riscos' | 'recomendacao';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function AureliaEditalPanel({ edital, empresa, colunas = 2 }: AureliaEditalPanelProps) {
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
    /* Identidade 12/09: painel claro, sobre a superfície `muted`, com os
       cartões de análise em `card`. Tudo sai de token e acompanha o tema —
       nada de cor escrita à mão. */
    <div className="rounded-lg border border-border bg-muted overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-xs font-bold text-primary-foreground">IA</span>
        <span className="text-base font-semibold text-foreground">AURÉLIA — Análise Deste Edital</span>
      </div>

      <div className={cn("grid grid-cols-1 gap-3 p-4", colunas === 2 && "md:grid-cols-2")}>
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
      <div className="border-t border-border bg-card p-4">
        {chatMessages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {chatMessages.map((msg, i) => (
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
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="aurelia-edital-pergunta" className="sr-only">Pergunta sobre este edital</label>
          <Input
            id="aurelia-edital-pergunta"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
            placeholder="Pergunte sobre este edital específico"
            disabled={chatLoading}
          />
          <Button
            onClick={handleChatSend}
            disabled={!chatInput.trim() || chatLoading}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Enviar pergunta"
          >
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
