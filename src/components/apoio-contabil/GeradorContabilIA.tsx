import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, Upload, FileText, Archive, X } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };

const TIPOS_ANALISE = [
  'Análise de Balanço Patrimonial',
  'Análise de DRE',
  'Composição de Custos / BDI',
  'Parecer Contábil',
  'Análise Tributária',
  'Verificação de Conformidade NBC',
  'Cálculo de Inexequibilidade (Art. 59)',
  'Precificação para Licitação',
  'Análise de Fluxo de Caixa',
];

export default function GeradorContabilIA() {
  const { user } = useAuth();
  const [tipoDoc, setTipoDoc] = useState('Análise de Balanço Patrimonial');
  const [referencia, setReferencia] = useState('');
  const [contexto, setContexto] = useState('');
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
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
            const allFiles = Object.values(zip.files).filter(f => !f.dir);
            for (const zf of allFiles.slice(0, 5)) {
              try {
                const content = await zf.async('string');
                if (content && content.length > 50) {
                  results.push({ name: zf.name, text: content.slice(0, 30000) });
                }
              } catch { /* binary */ }
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
          toast.info(`${file.name}: texto não extraído. Use a Base Contábil para PDFs complexos.`);
        }
      }
    }

    setExtractProgress(100);
    if (results.length > 0) {
      setUploadedFiles(prev => [...prev, ...results]);
      const combined = results.map(r => `--- ${r.name} ---\n${r.text}`).join('\n\n');
      setContexto(prev => prev ? prev + '\n\n' + combined : combined);
      toast.success(`${results.length} arquivo(s) processado(s)!`);
    }
    setExtracting(false);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('base_contabil')
      .select('id, titulo, tipo, ementa, texto_integral')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setDocsBase(data as DocRef[]); });
  }, [user]);

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleGerar = async () => {
    if (!contexto) { toast.error('Descreva o contexto da análise contábil'); return; }
    setGerando(true);
    setResultado('');

    let baseContext = '';
    if (selectedDocs.length > 0) {
      const selected = docsBase.filter(d => selectedDocs.includes(d.id));
      baseContext = '\n\n--- DOCUMENTOS DE REFERÊNCIA DA BASE CONTÁBIL ---\n';
      for (const doc of selected) {
        baseContext += `\n### ${doc.titulo} (${doc.tipo})\n`;
        if (doc.ementa) baseContext += `Resumo: ${doc.ementa}\n`;
        if (doc.texto_integral) baseContext += `Texto: ${doc.texto_integral.slice(0, 5000)}\n`;
      }
    }

    const prompt = `Tipo de análise: ${tipoDoc}\nReferência: ${referencia}\nContexto: ${contexto}${baseContext}`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_contabil',
      context: baseContext,
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setGerando(false),
      onError: (err) => { toast.error(err); setGerando(false); },
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
          Gerador de Análises Contábeis com IA
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gc-tipo">Tipo de Análise</Label>
            <Select value={tipoDoc} onValueChange={setTipoDoc}>
              <SelectTrigger id="gc-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_ANALISE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-referencia">Referência / Nº Edital</Label>
            <Input id="gc-referencia" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="PE-001/2026 ou NBC TG 26" />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-border p-4 space-y-3">
          <Label htmlFor="gc-arquivos" className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" aria-hidden="true" />
            Upload de Arquivos (PDF, TXT, CSV, XLS, ZIP)
          </Label>
          <Input
            id="gc-arquivos"
            type="file"
            accept=".pdf,.txt,.csv,.xls,.xlsx,.xml,.doc,.docx,.zip"
            multiple
            onChange={handleFileUpload}
            disabled={extracting}
          />
          {extracting && (
            <div className="space-y-1" role="status">
              <Progress value={extractProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Extraindo texto... {extractProgress}%</p>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="gc-contexto">Contexto / Dados para Análise</Label>
          <Textarea id="gc-contexto" value={contexto} onChange={e => setContexto(e.target.value)}
            placeholder="Descreva os dados contábeis, valores do balanço, itens a precificar, alíquotas, ou cole o conteúdo do demonstrativo para análise..."
            className="min-h-32" />
        </div>

        {docsBase.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none flex items-center gap-1">
              <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
              Documentos da Base Contábil como referência ({selectedDocs.length} selecionados)
            </p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-md border border-border p-2">
              {docsBase.map(doc => {
                const selecionado = selectedDocs.includes(doc.id);
                return (
                  <Button
                    key={doc.id}
                    type="button"
                    size="sm"
                    variant={selecionado ? 'default' : 'outline'}
                    aria-pressed={selecionado}
                    className="h-8 rounded-full text-xs"
                    onClick={() => toggleDoc(doc.id)}
                  >
                    {doc.titulo.slice(0, 40)}{doc.titulo.length > 40 ? '...' : ''}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <Button onClick={handleGerar} disabled={gerando}>
          {gerando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          Gerar Análise Contábil
        </Button>
      </section>

      {resultado && (
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Resultado da Análise</h2>
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
