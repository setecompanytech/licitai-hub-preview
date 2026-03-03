import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, Upload, FileText, Archive } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };

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
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Gerador de Análises Contábeis com IA</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Análise</label>
            <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option>Análise de Balanço Patrimonial</option>
              <option>Análise de DRE</option>
              <option>Composição de Custos / BDI</option>
              <option>Parecer Contábil</option>
              <option>Análise Tributária</option>
              <option>Verificação de Conformidade NBC</option>
              <option>Cálculo de Inexequibilidade (Art. 59)</option>
              <option>Precificação para Licitação</option>
              <option>Análise de Fluxo de Caixa</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Referência / Nº Edital</label>
            <Input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="PE-001/2026 ou NBC TG 26" className="mt-1" />
          </div>
        </div>

        <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-accent" />
            <label className="text-xs font-medium">Upload de Arquivos (PDF, TXT, CSV, XLS, ZIP)</label>
          </div>
          <Input
            type="file"
            accept=".pdf,.txt,.csv,.xls,.xlsx,.xml,.doc,.docx,.zip"
            multiple
            onChange={handleFileUpload}
            disabled={extracting}
            className="text-xs"
          />
          {extracting && (
            <div className="space-y-1">
              <Progress value={extractProgress} className="h-2" />
              <p className="text-[10px] text-muted-foreground">Extraindo texto... {extractProgress}%</p>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                  {f.name.endsWith('.zip') ? <Archive className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                  {f.name.slice(0, 30)}
                  <button onClick={() => removeFile(i)} className="ml-1 text-destructive hover:text-destructive/80">×</button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Contexto / Dados para Análise</label>
          <Textarea value={contexto} onChange={e => setContexto(e.target.value)}
            placeholder="Descreva os dados contábeis, valores do balanço, itens a precificar, alíquotas, ou cole o conteúdo do demonstrativo para análise..."
            className="mt-1 min-h-[120px]" />
        </div>

        {docsBase.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3" />
              Documentos da Base Contábil como referência ({selectedDocs.length} selecionados)
            </label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 rounded-md bg-muted/30">
              {docsBase.map(doc => (
                <Badge key={doc.id} variant={selectedDocs.includes(doc.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-[11px] transition-colors" onClick={() => toggleDoc(doc.id)}>
                  {doc.titulo.slice(0, 40)}{doc.titulo.length > 40 ? '...' : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleGerar} disabled={gerando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Gerar Análise Contábil
        </Button>
      </div>

      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resultado da Análise</h3>
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
