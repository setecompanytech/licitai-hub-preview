import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Sparkles, Loader2, Copy, BarChart3, Upload, FileText, Archive, X } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

export default function AnaliseBalancoIA() {
  const [dados, setDados] = useState('');
  const [orgao, setOrgao] = useState('');
  const [exercicio, setExercicio] = useState(new Date().getFullYear().toString());
  const [resultado, setResultado] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string)?.slice(0, 50000) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExtracting(true);
    setExtractProgress(0);
    const results: { name: string; text: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setExtractProgress(Math.round(((i) / files.length) * 100));

      if (file.name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(file);
          const zipFiles = Object.values(zip.files).filter(f => !f.dir && (f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.name.endsWith('.xml')));
          for (const zf of zipFiles) {
            const content = await zf.async('string');
            results.push({ name: zf.name, text: content.slice(0, 30000) });
          }
          if (zipFiles.length === 0) {
            // Try extracting any text-readable file
            const allFiles = Object.values(zip.files).filter(f => !f.dir);
            for (const zf of allFiles.slice(0, 5)) {
              try {
                const content = await zf.async('string');
                if (content && content.length > 50) {
                  results.push({ name: zf.name, text: content.slice(0, 30000) });
                }
              } catch { /* binary file, skip */ }
            }
          }
        } catch {
          toast.error(`Erro ao processar ZIP: ${file.name}`);
        }
      } else {
        const text = await extractTextFromFile(file);
        if (text && text.length > 20) {
          results.push({ name: file.name, text: text.slice(0, 50000) });
        } else {
          toast.info(`${file.name}: texto não extraído (PDF binário). Use a extração via IA na Base Contábil para PDFs complexos.`);
        }
      }
    }

    setExtractProgress(100);
    if (results.length > 0) {
      setUploadedFiles(prev => [...prev, ...results]);
      const combined = results.map(r => `--- ${r.name} ---\n${r.text}`).join('\n\n');
      setDados(prev => prev ? prev + '\n\n' + combined : combined);
      toast.success(`${results.length} arquivo(s) processado(s) com sucesso!`);
    }
    setExtracting(false);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
            Análise de Balanço e Demonstrações Contábeis
          </h2>
          <p className="text-sm text-muted-foreground">
            Cole os dados do balanço patrimonial, DRE ou demonstrações contábeis para uma análise completa de divergências, conformidade legal e riscos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ab-orgao">Órgão / Entidade</Label>
            <Input id="ab-orgao" value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Prefeitura de Belém, Governo do Pará..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ab-exercicio">Exercício</Label>
            <Input id="ab-exercicio" value={exercicio} onChange={e => setExercicio(e.target.value)} placeholder="2025" />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-border p-4 space-y-3">
          <Label htmlFor="ab-arquivos" className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" aria-hidden="true" />
            Upload de Arquivos (PDF, TXT, CSV, XLS, ZIP)
          </Label>
          <Input
            id="ab-arquivos"
            type="file"
            accept=".pdf,.txt,.csv,.xls,.xlsx,.xml,.doc,.docx,.zip"
            multiple
            onChange={handleFileUpload}
            disabled={extracting}
          />
          {extracting && (
            <div className="space-y-1" role="status">
              <Progress value={extractProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Extraindo texto dos arquivos... {extractProgress}%</p>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((f, i) => (
                <Badge key={i} variant="muted" className="gap-1">
                  {f.name.endsWith('.zip') ? <Archive className="w-3 h-3" aria-hidden="true" /> : <FileText className="w-3 h-3" aria-hidden="true" />}
                  {f.name.slice(0, 30)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(i)}
                    aria-label={`Remover ${f.name}`}
                    className="ml-1 h-5 w-5 rounded-full p-0 text-muted-foreground hover:text-destructive [&_svg]:size-3"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            O conteúdo extraído será adicionado automaticamente ao campo de dados abaixo. Para PDFs complexos, use a Base Contábil com extração via IA.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ab-dados">Dados Contábeis (cole o balanço, DRE ou valores, ou use o upload acima)</Label>
          <Textarea id="ab-dados" value={dados} onChange={e => setDados(e.target.value)}
            placeholder={`Cole aqui os dados contábeis. Exemplos:\n\nATIVO CIRCULANTE: R$ 150.000.000\nATIVO NÃO CIRCULANTE: R$ 320.000.000\nPASSIVO CIRCULANTE: R$ 180.000.000\nPATRIMÔNIO LÍQUIDO: R$ 290.000.000\n\nOu cole o texto completo do balanço patrimonial...`}
            className="min-h-44 font-mono text-sm" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="muted">NBC TSP</Badge>
          <Badge variant="muted">Lei 4.320/64</Badge>
          <Badge variant="muted">LRF - LC 101/2000</Badge>
          <Badge variant="muted">Lei 14.133/2021</Badge>
          <Badge variant="muted">CFC/CRC</Badge>
        </div>

        <Button onClick={handleAnalisar} disabled={analisando}>
          {analisando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          Analisar com IA Contábil
        </Button>
      </section>

      {resultado && (
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Parecer da IA Contábil</h2>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(resultado); toast.success('Copiado!'); }}>
              <Copy aria-hidden="true" /> Copiar
            </Button>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
