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
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { toast } from 'sonner';
import { Sparkles, Loader2, BookOpen, Copy, Upload, FileText, Archive, X } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import NotaDeOrigem from '@/components/apoio-juridico/NotaDeOrigem';
import { marcarNotasComoLinks, textoParaExportacao } from '@/lib/juridico/notas-de-origem';
import { roteiroEmTexto, type ModeloContabil } from '@/lib/contabil/modelos';
import { Download } from 'lucide-react';

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

/**
 * Gerador contábil (28/09/2026): roda na mesma edge do Apoio Jurídico
 * (Claude com ferramentas, persona de contador, notas de origem
 * obrigatórias); cai na edge antiga só se a nova não estiver no ar. O modelo
 * escolhido em "Modelos e Templates" chega por `modeloInicial` e traz o
 * roteiro e o fundamento.
 */
export default function GeradorContabilIA({ modeloInicial = null }: { modeloInicial?: ModeloContabil | null }) {
  const { user } = useAuth();
  const [tipoDoc, setTipoDoc] = useState(modeloInicial?.tipoGerador ?? 'Análise de Balanço Patrimonial');
  const [referencia, setReferencia] = useState(modeloInicial?.fundamentacao ?? '');
  const [modelo, setModelo] = useState<ModeloContabil | null>(modeloInicial);
  useEffect(() => {
    if (!modeloInicial) return;
    setModelo(modeloInicial);
    setTipoDoc(modeloInicial.tipoGerador);
    setReferencia(modeloInicial.fundamentacao);
  }, [modeloInicial]);
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

    const roteiro = modelo ? `\n\nSiga este roteiro, seção por seção:\n${roteiroEmTexto(modelo)}` : '';
    const prompt = `Tipo de análise: ${tipoDoc}\nReferência: ${referencia || '—'}${roteiro}\n\nContexto e dados informados pela pessoa:\n${contexto}${baseContext}`;

    const chamar = (endpoint: 'juridico' | 'ai-chat') => streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'contabilidade_tributaria',
      context: baseContext,
      endpoint,
      extra: { dominio: 'contabil', modelo: modelo ? { titulo: modelo.titulo, categoria: modelo.categoria, fundamentacao: modelo.fundamentacao } : { titulo: tipoDoc, categoria: 'Contábil', fundamentacao: referencia } },
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setGerando(false),
      onError: (err) => {
        if (endpoint === 'juridico' && /404|not found|n[aã]o encontrad/i.test(err)) { setResultado(''); void chamar('ai-chat'); return; }
        toast.error(err); setGerando(false);
      },
    });
    await chamar('juridico');
  };

  const baixarWord = () => {
    if (!resultado) return;
    const corpo = textoParaExportacao(resultado).split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).map((l) => (l.startsWith('# ') ? `<h1>${l.slice(2)}</h1>` : l.startsWith('## ') ? `<h2>${l.slice(3)}</h2>` : l.startsWith('### ') ? `<h3>${l.slice(4)}</h3>` : l.trim() ? `<p>${l}</p>` : '')).join('\n');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${tipoDoc}</title><style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5}h1{font-size:16pt}h2{font-size:13pt}</style></head><body>${corpo}<p style="color:#555">Minuta gerada pelo Praefectus IA em ${new Date().toLocaleDateString('pt-BR')} — para revisão do contador responsável; fontes entre parênteses.</p></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tipoDoc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-')}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        {/* Recurso de IA: o selo "Praefectus IA" identifica o gerador. */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Gerador de Análises Contábeis com IA
          </h2>
          <SeloPraefectusIA />
        </div>

        {modelo && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3" data-testid="modelo-escolhido">
            <p className="text-sm text-foreground"><b>{modelo.titulo}</b> · {modelo.fundamentacao} · roteiro de {modelo.roteiro.length} seções</p>
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => { setModelo(null); setReferencia(''); }}>Sem modelo</Button>
          </div>
        )}
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
            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                    className="ml-1 h-5 w-5 rounded-sm p-0 text-muted-foreground hover:text-destructive-ink [&_svg]:size-3"
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
            <p className="flex items-center gap-1 text-sm font-medium leading-none">
              <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                    className="h-8 px-3 text-xs font-medium"
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
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold leading-6 text-foreground">Resultado da Análise</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(textoParaExportacao(resultado)); toast.success('Copiado!'); }}>
                <Copy aria-hidden="true" /> Copiar
              </Button>
              <Button variant="outline" onClick={baixarWord}>
                <Download aria-hidden="true" /> Baixar Word
              </Button>
            </div>
          </div>
          <p className="g-meta text-muted-foreground">Minuta para o contador responsável. Cada afirmação traz a origem (norma, dado do sistema, anexo ou base); "a confirmar" é o que a IA não achou em fonte.</p>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown components={{ a: NotaDeOrigem }}>{marcarNotasComoLinks(resultado)}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
