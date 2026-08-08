import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X, CheckCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  extractFirstJsonObject,
  hasCoreRepresentanteValues,
  normalizeRepresentanteData,
  type ExtractedRepresentanteData,
} from './representante-extraction';

const PDF_VISION_PAGE_LIMIT = 5;
const PDF_RENDER_SCALE = 2.2;
const PDF_MAX_RENDER_WIDTH = 1800;

export type { ExtractedRepresentanteData } from './representante-extraction';

interface RepresentanteUploaderProps {
  onExtracted: (data: ExtractedRepresentanteData) => void;
}

export default function RepresentanteUploader({ onExtracted }: RepresentanteUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExts.includes(ext)) {
      toast.error('Formato inválido. Use PDF, Word, Excel, TXT ou imagem (JPG/PNG).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setFile(f);
    setExtracted(false);
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsExtracting(true);
    try {
      const name = file.name.toLowerCase();
      const type = file.type.toLowerCase();
      const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(name);
      const isPdf = type.includes('pdf') || name.endsWith('.pdf');

      let images: { name: string; dataUrl: string }[] = [];
      let text = '';

      if (isImage) {
        // Send image directly to Vision AI — no intermediate OCR step
        const dataUrl = await fileToDataUrl(file);
        images = [{ name: file.name, dataUrl }];
      } else if (isPdf) {
        // Render PDF pages to images and also send extracted text as support context
        images = await renderPdfToImages(file);
        text = await extractDocumentText(file);
      } else {
        // Text-based documents (DOCX, TXT, etc.)
        text = await extractDocumentText(file);
      }

      if (images.length === 0 && text.length < 20) {
        toast.error('Nenhum texto legível encontrado. Tente enviar uma imagem (JPG/PNG) do documento.');
        setIsExtracting(false);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'extrair-representante-vision',
        { body: { fileName: file.name, images, text } }
      );

      if (fnError) {
        toast.error(fnError.message || 'Erro ao processar documento.');
        setIsExtracting(false);
        return;
      }

      const rawResult = fnData?.result || '';
      const parsed = extractFirstJsonObject(rawResult);

      if (!parsed) {
        toast.error('Não foi possível extrair dados estruturados do documento.');
      } else {
        const data = normalizeRepresentanteData(parsed);
        if (!hasCoreRepresentanteValues(data)) {
          toast.error('Não foi possível identificar nome, CPF ou RG com segurança no documento enviado.');
        } else {
          onExtracted(data);
          setExtracted(true);
          toast.success('Dados do representante extraídos com sucesso!');
        }
      }
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error('Erro ao processar documento. Tente outro formato ou imagem mais nítida.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setExtracted(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {file ? (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
              {extracted && <span className="text-success ml-2">✓ Dados extraídos</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {!extracted && (
              <Button size="sm" onClick={handleExtract} disabled={isExtracting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isExtracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-1" /> Extrair Dados</>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRemove}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors"
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Upload de documento para extração por IA</span>
          <span className="text-xs text-muted-foreground">Contrato social, procuração, RG/CPF, CNH — PDF, Word, TXT ou imagem (máx. 10MB)</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

async function extractDocumentText(file: File): Promise<string> {
  try {
    const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
    return (await extractTextFromFile(file)).slice(0, 12000);
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Falha ao converter arquivo.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

async function renderPdfToImages(file: File): Promise<{ name: string; dataUrl: string }[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pagesToRender = Math.min(pdf.numPages, PDF_VISION_PAGE_LIMIT);
    const results: { name: string; dataUrl: string }[] = [];

    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdf.getPage(i);
      const previewViewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const scaleFactor = previewViewport.width > PDF_MAX_RENDER_WIDTH
        ? PDF_MAX_RENDER_WIDTH / previewViewport.width
        : 1;
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE * scaleFactor });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      results.push({
        name: `page-${i}.jpg`,
        dataUrl: canvas.toDataURL('image/jpeg', 0.84),
      });
    }
    return results;
  } catch (err) {
    console.error('PDF render error:', err);
    return [];
  }
}
