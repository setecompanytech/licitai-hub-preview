import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload, FileText, Loader2, X, Search,
  FileArchive, Scale, Download, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildConcorrenteAnalysisContext,
  buildConcorrenteAnalysisUserMessage,
  extractDocumentsFromUpload,
  type AnalysisLicitacaoInfo,
} from '@/lib/concorrentes-document-analysis';

type ArquivoUpload = {
  id: string;
  nome: string;
  tamanho: number;
  file: File;
};

type Licitacao = {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  modalidade: string;
};

const SUPPORTED_COMPETITOR_EXTENSIONS = ['.pdf', '.zip', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.xlsx', '.xls'];
const SUPPORTED_EDITAL_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];

export default function AnaliseDocsConcorrente() {
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [editalFile, setEditalFile] = useState<ArquivoUpload | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLicitacoes = async () => {
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, objeto, orgao, modalidade')
        .order('created_at', { ascending: false });
      if (data) setLicitacoes(data);
    };
    fetchLicitacoes();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const novos: ArquivoUpload[] = [];
    for (const f of Array.from(files)) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!SUPPORTED_COMPETITOR_EXTENSIONS.includes(ext)) {
        toast.error(`Formato não suportado: ${f.name}. Use PDF, ZIP, Word, JPEG/PNG/WebP ou Excel.`);
        continue;
      }
      if (f.size > 150 * 1024 * 1024) {
        toast.error(`Arquivo muito grande: ${f.name}. Máximo 150MB.`);
        continue;
      }
      novos.push({
        id: crypto.randomUUID(),
        nome: f.name,
        tamanho: f.size,
        file: f,
      });
    }
    setArquivos(prev => [...prev, ...novos]);
    e.target.value = '';
  };

  const handleAddEdital = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_EDITAL_EXTENSIONS.includes(ext)) {
      toast.error('O edital deve ser um arquivo PDF, Word ou Excel.');
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 150MB.');
      return;
    }

    setEditalFile({
      id: crypto.randomUUID(),
      nome: file.name,
      tamanho: file.size,
      file,
    });
    e.target.value = '';
    toast.success('Edital anexado com sucesso!');
  };

  const handleRemove = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const handleAnalisar = async () => {
    if (arquivos.length === 0) {
      toast.error('Adicione pelo menos um documento para análise.');
      return;
    }

    setAnalisando(true);
    setResultado('');
    setProgressMsg('Extraindo texto dos documentos...');

    // Extract text from competitor documents using real PDF extractor
    const allDocs: { name: string; text: string }[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      setProgressMsg(`Extraindo texto: ${arquivos[i].nome} (${i + 1}/${arquivos.length})...`);
      const extracted = await extractDocumentsFromUpload(arquivos[i].file, arquivos[i].nome);
      allDocs.push(...extracted);
    }

    if (allDocs.length === 0) {
      toast.error('Nenhum documento legível foi identificado nos anexos enviados.');
      setAnalisando(false);
      setProgressMsg('');
      return;
    }

    // Extract edital text if provided
    let editalTexto = '';
    if (editalFile) {
      setProgressMsg('Extraindo texto do edital...');
      const editalExtracted = await extractDocumentsFromUpload(editalFile.file, editalFile.nome);
      editalTexto = editalExtracted.map(d => `[${d.name}]:\n${d.text}`).join('\n\n');
    }

    setProgressMsg('Enviando para análise pela IA...');

    const licInfo: AnalysisLicitacaoInfo | null = licitacaoSelecionada && licitacaoSelecionada !== 'none'
      ? licitacoes.find(l => l.id === licitacaoSelecionada)
      : null;

    const context = buildConcorrenteAnalysisContext({
      documents: allDocs,
      editalTexto,
      licInfo,
      observacoes,
    });

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: buildConcorrenteAnalysisUserMessage(Boolean(editalTexto)),
      },
    ];

    await streamAIChat({
      messages,
      action: 'analise_documental_concorrente',
      context,
      onDelta: (chunk) => {
        setProgressMsg('');
        setResultado(prev => prev + chunk);
      },
      onDone: () => {
        setAnalisando(false);
        setProgressMsg('');
        toast.success('Análise concluída!');
      },
      onError: (err) => {
        toast.error(err);
        setAnalisando(false);
        setProgressMsg('');
      },
    });
  };

  const handleDownloadMD = () => {
    if (!resultado) return;
    const blob = new Blob([resultado], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-analise-concorrente.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório Markdown baixado!');
  };

  const handleDownloadPDF = async () => {
    if (!resultado) return;
    toast.info('Gerando PDF...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const marginLeft = 20;
      const marginRight = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginLeft - marginRight;
      let y = 25;

      const addPageIfNeeded = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      };

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL', marginLeft, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')} — PRAEFECTUS`, marginLeft, y);
      y += 10;

      doc.setDrawColor(200);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 8;

      // Process content line by line
      const lines = resultado.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          y += 4;
          continue;
        }

        // Heading detection
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          addPageIfNeeded(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          const headingText = trimmed.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(headingText, maxWidth);
          doc.text(wrapped, marginLeft, y);
          y += wrapped.length * 5 + 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          continue;
        }

        if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
          addPageIfNeeded(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(trimmed.startsWith('## ') ? 11 : 10);
          const headingText = trimmed.replace(/^#{2,3}\s*/, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(headingText, maxWidth);
          doc.text(wrapped, marginLeft, y);
          y += wrapped.length * 5 + 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          continue;
        }

        // Normal text
        const cleanText = trimmed
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^[-•]\s*/, '  • ');

        doc.setFontSize(9);
        const wrapped = doc.splitTextToSize(cleanText, maxWidth);
        addPageIfNeeded(wrapped.length * 4.5);
        doc.text(wrapped, marginLeft, y);
        y += wrapped.length * 4.5 + 1.5;
      }

      // Page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
        doc.text('PRAEFECTUS — Análise Jurídico-Contábil', marginLeft, pageHeight - 8);
        doc.setTextColor(0);
      }

      doc.save('relatorio-analise-concorrente.pdf');
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handleDownloadDOCX = async () => {
    if (!resultado) return;
    toast.info('Gerando documento Word...');
    try {
      const content = `RELATÓRIO DE ANÁLISE JURÍDICO-CONTÁBIL
Data de emissão: ${new Date().toLocaleDateString('pt-BR')} — PRAEFECTUS
${'='.repeat(60)}

${resultado.replace(/\*\*/g, '').replace(/#{2,3}\s*/g, '').replace(/\*/g, '')}

${'='.repeat(60)}
Documento gerado automaticamente pelo sistema PRAEFECTUS.
Este relatório possui finalidade meramente informativa e não substitui parecer jurídico formal.`;

      const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-analise-concorrente.doc';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatório Word gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar Word:', err);
      toast.error('Erro ao gerar documento Word.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scale className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-sm">Análise Jurídico-Contábil de Concorrente</h3>
        <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
          Lei 14.133/2021
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Envie os documentos de habilitação do concorrente e o edital da licitação. A IA realizará a leitura integral dos documentos,
        o cruzamento das exigências editalícias e a análise de conformidade com a Lei 14.133/2021, identificando irregularidades,
        falhas e vícios com fundamentação legal específica.
      </p>

      {/* Seletor de Licitação */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Processo licitatório vinculado (opcional)
        </label>
        <Select value={licitacaoSelecionada} onValueChange={setLicitacaoSelecionada}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a licitação relacionada..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma — análise avulsa</SelectItem>
            {licitacoes.map((lic) => (
              <SelectItem key={lic.id} value={lic.id}>
                {lic.numero} — {lic.modalidade} — {lic.orgao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {licitacaoSelecionada && licitacaoSelecionada !== 'none' && (
          <p className="text-xs text-muted-foreground">
            {licitacoes.find(l => l.id === licitacaoSelecionada)?.objeto}
          </p>
        )}
      </div>

      {/* Edital Upload */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Edital da Licitação (permite cruzamento de exigências)
        </label>
        {editalFile ? (
          <div className="bg-card rounded-xl border border-accent/30 flex items-center gap-3 px-4 py-3">
            <BookOpen className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{editalFile.nome}</p>
              <p className="text-xs text-muted-foreground">{formatSize(editalFile.tamanho)}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditalFile(null)}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => editalRef.current?.click()}
            className="w-full border border-dashed border-accent/40 rounded-xl p-4 flex items-center gap-3 hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <Upload className="w-5 h-5 text-accent" />
            <div className="text-left">
              <span className="text-sm font-medium text-foreground block">Anexar Edital (PDF/DOCX)</span>
              <span className="text-xs text-muted-foreground">
                A IA cruzará cada exigência do edital com os documentos do concorrente
              </span>
            </div>
          </button>
        )}
        <input
          ref={editalRef}
          type="file"
          accept=".pdf,.doc,.docx,.xlsx,.xls"
          className="hidden"
          onChange={handleAddEdital}
        />
      </div>

      {/* Upload area - Documentos do concorrente */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Documentos do Concorrente
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-accent/5 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Envie documentos do concorrente para análise
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, ZIP, Word, JPEG/PNG/WebP ou Excel — Máximo 150MB por arquivo
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.zip,.doc,.docx,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
          className="hidden"
          onChange={handleAddFiles}
        />
      </div>

      {/* File list */}
      {arquivos.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/30">
          {arquivos.map((arq) => (
            <div key={arq.id} className="flex items-center gap-3 px-4 py-3">
              {arq.nome.endsWith('.zip') ? (
                <FileArchive className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-accent shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{arq.nome}</p>
                <p className="text-xs text-muted-foreground">{formatSize(arq.tamanho)}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(arq.id)}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Observations */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Observações adicionais (opcional) — Ex: nº do edital, modalidade, requisitos específicos
          </label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Pregão Eletrônico 001/2026 – exige Liquidez Corrente mínima de 1,5 e atestado com 50% do quantitativo..."
            rows={3}
          />
        </div>
      )}

      {/* Analyze button */}
      {arquivos.length > 0 && (
        <Button
          onClick={handleAnalisar}
          disabled={analisando}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {analisando ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analisando documentos com IA...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" /> Analisar Documentos ({arquivos.length} arquivo{arquivos.length > 1 ? 's' : ''}{editalFile ? ' + Edital' : ''})</>
          )}
        </Button>
      )}

      {/* Results */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold">Relatório de Análise Jurídico-Contábil</h4>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadDOCX}>
                <Download className="w-3 h-3 mr-1" /> Word
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDownloadMD}>
                <Download className="w-3 h-3 mr-1" /> .md
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-6 max-h-[700px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:mb-5 prose-p:leading-relaxed prose-li:mb-1.5 prose-headings:mt-8 prose-headings:mb-4 prose-headings:font-bold prose-ul:my-4 prose-ol:my-4 prose-h2:text-base prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-2 prose-h3:text-sm prose-strong:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_p+p]:mt-5">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}

      {analisando && !resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm font-medium">{progressMsg || 'Analisando documentos...'}</p>
          <p className="text-xs text-muted-foreground">
            A IA está realizando leitura integral dos documentos, extração de dados concretos e análise
            de conformidade com a Lei 14.133/2021{editalFile ? ' e cruzamento com o edital' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
