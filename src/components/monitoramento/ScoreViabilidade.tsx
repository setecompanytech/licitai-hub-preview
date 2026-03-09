import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

interface Props {
  edital: {
    numero: string;
    orgao: string;
    objeto: string;
    modalidade: string;
    valor_estimado: number | null;
    uf: string | null;
    municipio: string | null;
    portal: string;
  };
  empresaCnae?: string | null;
  empresaUf?: string | null;
}

export default function ScoreViabilidade({ edital, empresaCnae, empresaUf }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const analisar = async () => {
    setLoading(true);
    setResult('');
    let content = '';

    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Você é um analista de viabilidade de licitações. Analise o edital abaixo e dê uma nota de 0 a 100 de viabilidade para participação, considerando:

1. Compatibilidade do CNAE da empresa (${empresaCnae || 'não informado'}) com o objeto
2. Localização: empresa em ${empresaUf || 'não informado'}, edital em ${edital.uf || 'não informado'}/${edital.municipio || 'não informado'}
3. Valor estimado: competitividade e margem
4. Modalidade: complexidade e exigências típicas
5. Risco vs retorno

Dados do edital:
- Número: ${edital.numero}
- Órgão: ${edital.orgao}
- Objeto: ${edital.objeto}
- Modalidade: ${edital.modalidade}
- Valor: ${edital.valor_estimado ? `R$ ${edital.valor_estimado.toLocaleString('pt-BR')}` : 'Não informado'}
- Portal: ${edital.portal}

IMPORTANTE: Comece sua resposta SEMPRE com "SCORE: XX" onde XX é a nota de 0 a 100. Depois forneça a análise detalhada em markdown.`
      }],
      action: 'score_viabilidade',
      onDelta: (chunk) => {
        content += chunk;
        setResult(content);
        // Extract score from first line
        const match = content.match(/SCORE:\s*(\d+)/i);
        if (match) setScore(parseInt(match[1]));
      },
      onDone: () => setLoading(false),
      onError: () => { setResult('Erro ao analisar viabilidade.'); setLoading(false); },
    });
  };

  const scoreColor = score !== null
    ? score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive'
    : 'text-muted-foreground';

  const ScoreIcon = score !== null
    ? score >= 70 ? CheckCircle2 : score >= 40 ? AlertTriangle : XCircle
    : Brain;

  return (
    <div>
      {!result ? (
        <Button size="sm" variant="outline" onClick={analisar} disabled={loading} className="text-xs">
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
          Score IA
        </Button>
      ) : (
        <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border text-xs">
          {score !== null && (
            <div className="flex items-center gap-2 mb-2">
              <ScoreIcon className={`w-5 h-5 ${scoreColor}`} />
              <span className={`text-lg font-bold ${scoreColor}`}>{score}/100</span>
              <Badge className={`${score >= 70 ? 'bg-success/10 text-success' : score >= 40 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'} text-[10px]`}>
                {score >= 70 ? 'Alta Viabilidade' : score >= 40 ? 'Média Viabilidade' : 'Baixa Viabilidade'}
              </Badge>
            </div>
          )}
          <div className="prose prose-xs max-w-none text-foreground">
            <ReactMarkdown>{result.replace(/^SCORE:\s*\d+\s*/i, '')}</ReactMarkdown>
          </div>
          {loading && <Loader2 className="w-3 h-3 animate-spin mt-2" />}
        </div>
      )}
    </div>
  );
}
