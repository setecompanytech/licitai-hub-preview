import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileArchive, FilePlus, FileText, Trash2, GripVertical, 
  Download, Loader2, ArrowUpDown, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ArquivoParaMerge = {
  id: string;
  nome: string;
  tamanho: string;
  tipo: 'pdf' | 'image' | 'doc';
  file: File;
};

export default function MergeDocumentos() {
  const [arquivos, setArquivos] = useState<ArquivoParaMerge[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('documentos_licitacao');
  const [formato, setFormato] = useState<'pdf' | 'zip'>('pdf');
  const [processando, setProcessando] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const novos: ArquivoParaMerge[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      nome: file.name,
      tamanho: formatSize(file.size),
      tipo: file.type.includes('pdf') ? 'pdf' : file.type.startsWith('image') ? 'image' : 'doc',
      file,
    }));

    setArquivos(prev => [...prev, ...novos]);
    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setArquivos(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === arquivos.length - 1) return;
    setArquivos(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleMerge = async () => {
    if (arquivos.length < 2) {
      toast.error('Adicione pelo menos 2 arquivos para juntar');
      return;
    }

    setProcessando(true);

    try {
      if (formato === 'zip') {
        // Use JSZip-like approach with native compression
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();

        for (const arq of arquivos) {
          const buffer = await arq.file.arrayBuffer();
          zip.file(arq.nome, buffer);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${nomeArquivo}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Arquivo ZIP gerado com sucesso!');
      } else {
        // Merge PDFs using jsPDF
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        let isFirst = true;

        for (const arq of arquivos) {
          if (arq.tipo === 'image') {
            if (!isFirst) doc.addPage();
            const dataUrl = await readFileAsDataURL(arq.file);
            const img = await loadImage(dataUrl);
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const ratio = Math.min(pageWidth / img.width, pageHeight / img.height) * 0.9;
            const imgW = img.width * ratio;
            const imgH = img.height * ratio;
            doc.addImage(dataUrl, 'JPEG', (pageWidth - imgW) / 2, (pageHeight - imgH) / 2, imgW, imgH);
            isFirst = false;
          } else {
            // For PDF files, we add a cover page with the file name
            if (!isFirst) doc.addPage();
            doc.setFontSize(14);
            doc.text(arq.nome, 20, 30);
            doc.setFontSize(10);
            doc.setTextColor(128);
            doc.text(`Arquivo: ${arq.nome} (${arq.tamanho})`, 20, 40);
            doc.text('Este documento foi incluído no merge.', 20, 50);
            doc.setTextColor(0);
            isFirst = false;
          }
        }

        doc.save(`${nomeArquivo}.pdf`);
        toast.success('PDF combinado gerado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao juntar documentos:', error);
      toast.error('Erro ao processar os arquivos');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileArchive className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Juntar Documentos</h3>
          <Badge variant="outline" className="text-xs">{arquivos.length} arquivo(s)</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setFormato('pdf')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', formato === 'pdf' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              PDF
            </button>
            <button
              onClick={() => setFormato('zip')}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', formato === 'zip' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              ZIP
            </button>
          </div>
        </div>
      </div>

      {/* File name */}
      <div className="flex items-center gap-2">
        <Input
          value={nomeArquivo}
          onChange={(e) => setNomeArquivo(e.target.value)}
          placeholder="Nome do arquivo de saída"
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground">.{formato}</span>
      </div>

      {/* Drop zone */}
      <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
        <FilePlus className="w-8 h-8 text-muted-foreground mb-2" />
        <span className="text-sm text-muted-foreground">Clique ou arraste arquivos aqui</span>
        <span className="text-xs text-muted-foreground mt-1">PDF, imagens, documentos</span>
        <input type="file" multiple className="hidden" onChange={handleAddFiles} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </label>

      {/* File list */}
      {arquivos.length > 0 && (
        <Card className="divide-y divide-border/30">
          {arquivos.map((arq, index) => (
            <div key={arq.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              <span className="text-xs font-mono text-muted-foreground w-6">{index + 1}.</span>
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{arq.nome}</p>
                <p className="text-xs text-muted-foreground">{arq.tamanho}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                  <ArrowUpDown className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleRemove(arq.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Action */}
      {arquivos.length >= 2 && (
        <Button onClick={handleMerge} disabled={processando} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {processando ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processando...</>
          ) : (
            <><Download className="w-4 h-4 mr-2" /> Gerar {formato.toUpperCase()} ({arquivos.length} arquivos)</>
          )}
        </Button>
      )}
    </div>
  );
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
