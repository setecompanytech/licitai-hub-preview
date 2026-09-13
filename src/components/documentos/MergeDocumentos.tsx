import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileArchive, FilePlus, FileText, Trash2, GripVertical,
  Download, Loader2, ChevronUp, ChevronDown
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FileArchive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Juntar documentos</h3>
          <Badge variant="muted">{arquivos.length} arquivo(s)</Badge>
        </div>
        {/* Formato de saída: dois estados, um só de cada vez — `aria-pressed`
            diz qual está escolhido a quem não enxerga a tinta. */}
        <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="Formato do arquivo de saída">
          {(['pdf', 'zip'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormato(f)}
              aria-pressed={formato === f}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                formato === f
                  ? 'bg-primary-tint font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* File name */}
      <div className="space-y-2">
        <Label htmlFor="merge-nome-saida" className="text-sm">Nome do arquivo de saída</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="merge-nome-saida"
            value={nomeArquivo}
            onChange={(e) => setNomeArquivo(e.target.value)}
            placeholder="Nome do arquivo de saída"
            className="min-w-0 flex-1"
          />
          <span className="text-sm text-muted-foreground">.{formato}</span>
        </div>
      </div>

      {/* Drop zone */}
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-8 transition-colors hover:border-primary hover:bg-primary-tint focus-within:outline-none focus-within:ring-2 focus-within:ring-ring">
        <FilePlus className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <span className="text-base font-medium text-foreground">Clique ou arraste arquivos aqui</span>
        <span className="mt-1 text-sm text-muted-foreground">PDF, imagens, documentos</span>
        <input type="file" multiple className="sr-only" onChange={handleAddFiles} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </label>

      {/* File list */}
      {arquivos.length > 0 && (
        <Card className="divide-y divide-border">
          {arquivos.map((arq, index) => (
            <div key={arq.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="w-6 text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{arq.nome}</p>
                <p className="text-sm text-muted-foreground">{arq.tamanho}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* A ordem manda no documento final — subir E descer, porque
                    com só um sentido a última linha nunca chega ao topo. */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title="Mover para cima"
                  aria-label={`Mover ${arq.nome} para cima`}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === arquivos.length - 1}
                  title="Mover para baixo"
                  aria-label={`Mover ${arq.nome} para baixo`}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(arq.id)}
                  className="text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                  title="Remover da lista"
                  aria-label={`Remover ${arq.nome} da lista`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Action */}
      {arquivos.length >= 2 && (
        <Button onClick={handleMerge} disabled={processando} className="w-full">
          {processando ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processando…</>
          ) : (
            <><Download className="h-4 w-4" aria-hidden="true" /> Gerar {formato.toUpperCase()} ({arquivos.length} arquivos)</>
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
