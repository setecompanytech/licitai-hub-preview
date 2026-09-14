import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { LanceConfig } from './ConfigurarLanceDialog';

type Props = {
  lance?: LanceConfig | null;
};

/**
 * Só o texto que a IA escreveu.
 *
 * Até 14/09/2026 o resultado trazia quatro cartões numéricos que a IA nunca
 * produziu: "desconto médio 25%" e "confiança 72%" fixos no código, decremento
 * de 80% do configurado e um "piso seguro" de 70% do valor de referência. O
 * piso era o pior: parecia recomendação de limite, e limite na Praefectus vem
 * da precificação aprovada — nunca de um percentual inventado.
 */
type AnaliseResult = {
  analise: string;
};

/** O texto da resposta, em qualquer dos formatos que a função de chat devolve. */
function textoDaResposta(data: unknown): string | null {
  if (typeof data === 'string') return data.trim() || null;
  const d = (data ?? {}) as Record<string, unknown>;
  const escolhas = Array.isArray(d.choices) ? (d.choices as Array<{ message?: { content?: unknown } }>) : [];
  const candidatos = [d.resposta, d.reply, d.content, d.text, d.message, escolhas[0]?.message?.content];
  const texto = candidatos.find((c) => typeof c === 'string' && c.trim());
  return typeof texto === 'string' ? texto.trim() : null;
}

/** Usado no contexto enviado à IA (valores da disputa), não na tela. */
const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function EstrategiaIAPanel({ lance }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnaliseResult | null>(null);
  const [orgao, setOrgao] = useState('');
  const [objeto, setObjeto] = useState('');

  const analisar = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const context = [
        `Órgão: ${orgao || 'Não informado'}`,
        `Objeto: ${objeto || lance?.edital || 'Não informado'}`,
        lance ? `Valor de Referência: ${formatCurrency(lance.valorReferencia)}` : '',
        lance ? `Valor Inicial: ${formatCurrency(lance.valorInicial)}` : '',
        lance ? `Valor Mínimo atual: ${formatCurrency(lance.valorMinimo)}` : '',
        lance ? `Decremento atual: ${lance.decrementoMin}` : '',
        lance ? `Portal: ${lance.portal}` : '',
      ].filter(Boolean).join('\n');

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          action: 'assistente',
          context,
          messages: [{
            role: 'user',
            content: `Analise a estratégia de lances para esta licitação. Com base em padrões típicos de disputas em pregões eletrônicos brasileiros para "${objeto || lance?.edital || 'material genérico'}" no órgão "${orgao || 'não informado'}":

1. Qual o desconto médio esperado para este tipo de objeto? (%)
2. Qual decremento (em R$) você sugere para maximizar chances de vitória sem comprometer a margem?
3. Quais riscos de inexequibilidade observar nesse tipo de objeto?
4. Que limitações essa análise tem, por não usar os dados desta disputa?

Forneça também um briefing estratégico completo com dicas para a disputa.

Responda em português, com dados numéricos claros e recomendações práticas.`
          }],
        },
      });

      if (error) throw error;

      const texto = textoDaResposta(data);
      if (!texto) {
        // Nunca despejar JSON na tela do cliente.
        toast.error('A análise veio num formato que esta tela não sabe ler. Tente novamente.');
        return;
      }
      setResult({ analise: texto });
      toast.success('Análise gerada.');
    } catch (err) {
      console.error(err);
      toast.error('Erro na análise IA. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Estratégia Preditiva IA
        </h3>
        {/* O selo "Gemini AI" saiu em 14/09/2026: o fornecedor do modelo é
            decisão de bastidor da Praefectus, pode mudar sem aviso, e este
            painel passou a morar na tela do cliente. */}
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="estrategia-orgao">Órgão contratante</Label>
          <Input
            id="estrategia-orgao"
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            placeholder="Ex: UFPA, Prefeitura de Belém..."
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="estrategia-objeto">Objeto / Descrição</Label>
          <Input
            id="estrategia-objeto"
            value={objeto}
            onChange={(e) => setObjeto(e.target.value)}
            placeholder="Ex: Material de escritório, Equipamentos de TI..."
            className="mt-1"
          />
        </div>
      </div>

      <Button
        onClick={analisar}
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Analisando com IA...</>
        ) : (
          <><Brain className="w-4 h-4" aria-hidden="true" /> Gerar Estratégia Preditiva</>
        )}
      </Button>

      {/* Results */}
      {result && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Texto gerado por IA a partir de padrões gerais de pregões. Não usa os lances desta disputa e não
            substitui os limites aprovados na Precificação.
          </p>

          {/* AI Analysis */}
          <div className="bg-muted rounded-lg p-4 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Briefing Estratégico
            </p>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-2 [&>ul]:pl-4 [&>ul]:mb-2">
              <ReactMarkdown>{result.analise}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
