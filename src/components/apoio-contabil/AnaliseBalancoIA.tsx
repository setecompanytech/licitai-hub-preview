import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Copy, AlertTriangle, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

export default function AnaliseBalancoIA() {
  const [dados, setDados] = useState('');
  const [orgao, setOrgao] = useState('');
  const [exercicio, setExercicio] = useState(new Date().getFullYear().toString());
  const [resultado, setResultado] = useState('');
  const [analisando, setAnalisando] = useState(false);

  const handleAnalisar = async () => {
    if (!dados) { toast.error('Cole os dados do balanço patrimonial ou demonstração contábil'); return; }
    setAnalisando(true);
    setResultado('');

    const prompt = `Você é um contador especialista em contabilidade pública e tributária brasileira, com profundo conhecimento da Lei 14.133/2021, NBC TSP, Lei 4.320/64, Lei Complementar 101/2000 (LRF) e normas do CFC.

Analise os seguintes dados contábeis do órgão "${orgao || 'Não informado'}" referente ao exercício ${exercicio}:

${dados}

Realize uma análise completa e estruturada com os seguintes tópicos:

## 1. DIAGNÓSTICO GERAL
- Situação patrimonial líquida
- Indicadores de liquidez (corrente, seca, geral)
- Grau de endividamento

## 2. DIVERGÊNCIAS E IRREGULARIDADES
- Inconsistências nos saldos contábeis
- Violações de princípios contábeis (competência, oportunidade, prudência)
- Descumprimento de normas NBC TSP
- Irregularidades na classificação de receitas e despesas

## 3. CONFORMIDADE LEGAL
- Conformidade com a Lei 4.320/64
- Atendimento aos limites da LRF (Art. 19/20 - pessoal, Art. 29 - dívida)
- Aplicação mínima em saúde e educação (CF Art. 198 e 212)

## 4. RISCOS PARA FORNECEDORES
- Capacidade de pagamento do ente
- Risco de inadimplência contratual
- Indicadores de alerta para licitantes

## 5. IMPACTO NA PRECIFICAÇÃO
- Recomendações para composição de preços em licitações deste ente
- Sugestão de margem de segurança considerando o perfil financeiro
- Alertas sobre possíveis aditivos e reequilíbrios

## 6. RECOMENDAÇÕES
- Pontos de atenção prioritários
- Sugestões de consultas adicionais (CAUC, CADIN, certidões)

Seja técnico, objetivo e cite as normas aplicáveis.`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'analise_balanco',
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setAnalisando(false),
      onError: (err) => { toast.error(err); setAnalisando(false); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Análise de Balanço e Demonstrações Contábeis</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Cole os dados do balanço patrimonial, DRE ou demonstrações contábeis para uma análise completa de divergências, conformidade legal e riscos.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Órgão / Entidade</label>
            <Input value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Prefeitura de Belém, Governo do Pará..." className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exercício</label>
            <Input value={exercicio} onChange={e => setExercicio(e.target.value)} placeholder="2025" className="mt-1" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Dados Contábeis (cole o balanço, DRE ou valores)</label>
          <Textarea value={dados} onChange={e => setDados(e.target.value)}
            placeholder={`Cole aqui os dados contábeis. Exemplos:\n\nATIVO CIRCULANTE: R$ 150.000.000\nATIVO NÃO CIRCULANTE: R$ 320.000.000\nPASSIVO CIRCULANTE: R$ 180.000.000\nPATRIMÔNIO LÍQUIDO: R$ 290.000.000\n\nOu cole o texto completo do balanço patrimonial...`}
            className="mt-1 min-h-[180px] font-mono text-xs" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">NBC TSP</Badge>
          <Badge variant="outline" className="text-[10px]">Lei 4.320/64</Badge>
          <Badge variant="outline" className="text-[10px]">LRF - LC 101/2000</Badge>
          <Badge variant="outline" className="text-[10px]">Lei 14.133/2021</Badge>
          <Badge variant="outline" className="text-[10px]">CFC/CRC</Badge>
        </div>

        <Button onClick={handleAnalisar} disabled={analisando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {analisando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Analisar com IA Contábil
        </Button>
      </div>

      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Parecer da IA Contábil</h3>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resultado); toast.success('Copiado!'); }}>
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
