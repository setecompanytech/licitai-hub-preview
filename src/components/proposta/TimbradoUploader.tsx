import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Upload, ImageIcon, X, Loader2, FileText, Eye, ArrowUp, ArrowDown, Printer, RotateCw, Settings2, Ruler, FileImage, Monitor, Scissors, SplitSquareHorizontal, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface TimbradoUploaderProps {
  empresaId: string | undefined;
  timbradoUrl: string | null;
  setTimbradoUrl: (url: string | null) => void;
}

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf', '.doc', '.docx'];

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|svg)(\?|$)/i.test(url);
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

function isDocxFile(file: File) {
  return file.name.toLowerCase().endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

type UploadSlot = {
  url: string | null;
  path: string | null;
};

type PageOrientation = 'portrait' | 'landscape';
type PaperSize = 'a4' | 'letter' | 'legal' | 'oficio';

interface PageSetup {
  orientation: PageOrientation;
  paperSize: PaperSize;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
}

const PAPER_SIZES: Record<PaperSize, { label: string; w: number; h: number }> = {
  a4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  letter: { label: 'Carta (216 × 279 mm)', w: 216, h: 279 },
  legal: { label: 'Ofício US (216 × 356 mm)', w: 216, h: 356 },
  oficio: { label: 'Ofício BR (216 × 330 mm)', w: 216, h: 330 },
};

const DEFAULT_SETUP: PageSetup = {
  orientation: 'portrait',
  paperSize: 'a4',
  marginTop: 3,
  marginBottom: 2,
  marginLeft: 3,
  marginRight: 2,
  headerHeight: 2.5,
  footerHeight: 2,
};

function cropImageToBlob(
  img: HTMLImageElement,
  region: 'top' | 'bottom',
  splitPercent: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (region === 'top') {
      const cropH = Math.round(h * (splitPercent / 100));
      canvas.width = w;
      canvas.height = cropH;
      ctx.drawImage(img, 0, 0, w, cropH, 0, 0, w, cropH);
    } else {
      const startY = Math.round(h * (1 - splitPercent / 100));
      const cropH = h - startY;
      canvas.width = w;
      canvas.height = cropH;
      ctx.drawImage(img, 0, startY, w, cropH, 0, 0, w, cropH);
    }

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao recortar imagem'))),
      'image/png',
      1,
    );
  });
}

async function extractDocxHeaderFooterImages(file: File): Promise<{ headerBlob: Blob | null; footerBlob: Blob | null }> {
  const zip = await JSZip.loadAsync(file);

  const findImageRefs = (xml: string): string[] => {
    const refs: string[] = [];
    const matches = xml.matchAll(/r:(?:embed|link)="(rId\d+)"/g);
    for (const m of matches) refs.push(m[1]);
    return refs;
  };

  const resolveRefs = (relsXml: string, rIds: string[]): string[] => {
    const paths: string[] = [];
    for (const rId of rIds) {
      const regex = new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`, 'i');
      const match = relsXml.match(regex);
      if (match) paths.push(match[1]);
    }
    return paths;
  };

  const getImageBlob = async (relPath: string): Promise<Blob | null> => {
    const fullPath = relPath.startsWith('/') ? relPath.slice(1) : `word/${relPath}`;
    const entry = zip.file(fullPath);
    if (!entry) return null;
    const data = await entry.async('arraybuffer');
    const ext = fullPath.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', emf: 'image/emf', wmf: 'image/wmf' };
    return new Blob([data], { type: mimeMap[ext] || 'image/png' });
  };

  let headerBlob: Blob | null = null;
  let footerBlob: Blob | null = null;

  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xml = await zip.file(name)!.async('text');
      const rIds = findImageRefs(xml);
      if (rIds.length === 0) continue;

      const relsName = name.replace('word/', 'word/_rels/') + '.rels';
      const relsFile = zip.file(relsName);
      if (!relsFile) continue;

      const relsXml = await relsFile.async('text');
      const paths = resolveRefs(relsXml, rIds);

      for (const p of paths) {
        const blob = await getImageBlob(p);
        if (blob && blob.size > 500) {
          headerBlob = blob;
          break;
        }
      }
      if (headerBlob) break;
    }
  }

  for (const name of Object.keys(zip.files)) {
    if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xml = await zip.file(name)!.async('text');
      const rIds = findImageRefs(xml);
      if (rIds.length === 0) continue;

      const relsName = name.replace('word/', 'word/_rels/') + '.rels';
      const relsFile = zip.file(relsName);
      if (!relsFile) continue;

      const relsXml = await relsFile.async('text');
      const paths = resolveRefs(relsXml, rIds);

      for (const p of paths) {
        const blob = await getImageBlob(p);
        if (blob && blob.size > 500) {
          footerBlob = blob;
          break;
        }
      }
      if (footerBlob) break;
    }
  }

  if (!headerBlob && !footerBlob) {
    const mediaImages: Blob[] = [];
    for (const name of Object.keys(zip.files)) {
      if (/^word\/media\//i.test(name) && /\.(png|jpe?g|gif|bmp)$/i.test(name)) {
        const entry = zip.file(name);
        if (!entry) continue;
        const data = await entry.async('arraybuffer');
        const ext = name.split('.').pop()?.toLowerCase() || 'png';
        const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' };
        const blob = new Blob([data], { type: mimeMap[ext] || 'image/png' });
        if (blob.size > 500) mediaImages.push(blob);
      }
    }
    if (mediaImages.length >= 2) {
      headerBlob = mediaImages[0];
      footerBlob = mediaImages[mediaImages.length - 1];
    } else if (mediaImages.length === 1) {
      headerBlob = mediaImages[0];
    }
  }

  return { headerBlob, footerBlob };
}

export default function TimbradoUploader({ empresaId, timbradoUrl, setTimbradoUrl }: TimbradoUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [header, setHeader] = useState<UploadSlot>({ url: null, path: null });
  const [footer, setFooter] = useState<UploadSlot>({ url: null, path: null });
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetup>(DEFAULT_SETUP);
  const [previewTab, setPreviewTab] = useState<string>('preview');

  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [headerSplit, setHeaderSplit] = useState(15);
  const [footerSplit, setFooterSplit] = useState(10);
  const [splitting, setSplitting] = useState(false);
  const [splitDone, setSplitDone] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from('empresas')
      .select('timbrado_url, timbrado_path, cabecalho_url, cabecalho_path, rodape_url, rodape_path')
      .eq('id', empresaId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const hUrl = (data as any).cabecalho_url || data.timbrado_url || null;
        const hPath = (data as any).cabecalho_path || data.timbrado_path || null;
        const fUrl = (data as any).rodape_url || null;
        const fPath = (data as any).rodape_path || null;

        // If saved URL points to a non-image file (e.g. .docx), clear it
        // so the user can re-upload properly
        const isValidImage = (url: string | null) => !url || /\.(png|jpe?g|webp|svg)(\?|$)/i.test(url);

        if (isValidImage(hUrl)) {
          setHeader({ url: hUrl, path: hPath });
          setTimbradoUrl(hUrl);
        } else {
          // Non-image timbrado URL — don't use as image, reset so user can re-upload
          setHeader({ url: null, path: null });
          setTimbradoUrl(null);
        }

        if (isValidImage(fUrl)) {
          setFooter({ url: fUrl, path: fPath });
        } else {
          setFooter({ url: null, path: null });
        }

        if (isValidImage(hUrl) && hUrl && isValidImage(fUrl) && fUrl) setSplitDone(true);
      });
  }, [empresaId]);

  const handleFileSelected = async (file: File) => {
    if (!empresaId) return;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
      toast.error('Formato inválido. Use PNG, JPG, WEBP, SVG, PDF ou Word.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB.'); return; }

    setUploading(true);
    setSplitDone(false);

    try {
      if (isImageFile(file)) {
        const localUrl = URL.createObjectURL(file);
        setSourceImageUrl(localUrl);

        const path = `${empresaId}/timbrado_full.png`;
        await supabase.storage.from('timbrados').upload(path, file, { upsert: true });

        setUploading(false);
        toast.success('Imagem carregada! Ajuste as áreas de cabeçalho e rodapé abaixo.');
      } else if (isDocxFile(file)) {
        toast.info('Extraindo cabeçalho e rodapé do documento Word...');

        const { headerBlob, footerBlob } = await extractDocxHeaderFooterImages(file);

        if (!headerBlob && !footerBlob) {
          toast.error('Não foi possível extrair imagens do documento. O arquivo não contém cabeçalho ou rodapé com imagens.');
          setUploading(false);
          return;
        }

        let headerUrl = '';
        let headerPath = '';
        if (headerBlob) {
          headerPath = `${empresaId}/cabecalho.png`;
          const { error: hErr } = await supabase.storage.from('timbrados').upload(headerPath, headerBlob, { upsert: true, contentType: 'image/png' });
          if (hErr) throw hErr;
          const { data: hSigned } = await supabase.storage.from('timbrados').createSignedUrl(headerPath, 31536000);
          headerUrl = hSigned?.signedUrl || '';
        }

        let footerUrl = '';
        let footerPath = '';
        if (footerBlob) {
          footerPath = `${empresaId}/rodape.png`;
          const { error: fErr } = await supabase.storage.from('timbrados').upload(footerPath, footerBlob, { upsert: true, contentType: 'image/png' });
          if (fErr) throw fErr;
          const { data: fSigned } = await supabase.storage.from('timbrados').createSignedUrl(footerPath, 31536000);
          footerUrl = fSigned?.signedUrl || '';
        }

        await supabase.from('empresas').update({
          cabecalho_path: headerPath || null,
          cabecalho_url: headerUrl || null,
          timbrado_path: headerPath || null,
          timbrado_url: headerUrl || null,
          rodape_path: footerPath || null,
          rodape_url: footerUrl || null,
        }).eq('id', empresaId);

        setHeader({ url: headerUrl || null, path: headerPath || null });
        setFooter({ url: footerUrl || null, path: footerPath || null });
        setTimbradoUrl(headerUrl || null);
        setSplitDone(true);

        const parts = [headerBlob ? 'cabeçalho' : '', footerBlob ? 'rodapé' : ''].filter(Boolean).join(' e ');
        toast.success(`${parts.charAt(0).toUpperCase() + parts.slice(1)} extraído(s) do documento Word com sucesso!`);
        setUploading(false);
      } else {
        const path = `${empresaId}/cabecalho${ext}`;
        const { error } = await supabase.storage.from('timbrados').upload(path, file, { upsert: true });
        if (error) { toast.error('Erro: ' + error.message); setUploading(false); return; }

        const { data: signedData } = await supabase.storage.from('timbrados').createSignedUrl(path, 31536000);
        const publicUrl = signedData?.signedUrl || '';

        await supabase.from('empresas').update({
          cabecalho_path: path,
          cabecalho_url: publicUrl,
          timbrado_path: path,
          timbrado_url: publicUrl,
        }).eq('id', empresaId);

        setHeader({ url: publicUrl, path });
        setTimbradoUrl(publicUrl);
        setSplitDone(true);
        setUploading(false);
        toast.success('Documento enviado como timbrado!');
      }
    } catch (err: any) {
      console.error('Erro ao processar timbrado:', err);
      toast.error('Erro ao processar arquivo: ' + (err.message || 'desconhecido'));
      setUploading(false);
    }
  };

  const applySplit = useCallback(async () => {
    if (!sourceImageUrl || !empresaId) return;
    setSplitting(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = sourceImageUrl;
      });

      const headerBlob = await cropImageToBlob(img, 'top', headerSplit);
      const headerPath = `${empresaId}/cabecalho.png`;
      const { error: hErr } = await supabase.storage.from('timbrados').upload(headerPath, headerBlob, { upsert: true, contentType: 'image/png' });
      if (hErr) throw hErr;
      const { data: hSigned } = await supabase.storage.from('timbrados').createSignedUrl(headerPath, 31536000);
      const headerUrl = hSigned?.signedUrl || '';

      const footerBlob = await cropImageToBlob(img, 'bottom', footerSplit);
      const footerPath = `${empresaId}/rodape.png`;
      const { error: fErr } = await supabase.storage.from('timbrados').upload(footerPath, footerBlob, { upsert: true, contentType: 'image/png' });
      if (fErr) throw fErr;
      const { data: fSigned } = await supabase.storage.from('timbrados').createSignedUrl(footerPath, 31536000);
      const footerUrl = fSigned?.signedUrl || '';

      await supabase.from('empresas').update({
        cabecalho_path: headerPath,
        cabecalho_url: headerUrl,
        timbrado_path: headerPath,
        timbrado_url: headerUrl,
        rodape_path: footerPath,
        rodape_url: footerUrl,
      }).eq('id', empresaId);

      setHeader({ url: headerUrl, path: headerPath });
      setFooter({ url: footerUrl, path: footerPath });
      setTimbradoUrl(headerUrl);
      setSplitDone(true);
      toast.success('Cabeçalho e rodapé extraídos com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao recortar: ' + (err.message || 'desconhecido'));
    } finally {
      setSplitting(false);
    }
  }, [sourceImageUrl, empresaId, headerSplit, footerSplit]);

  const handleRemoveAll = async () => {
    if (!empresaId) return;
    await supabase.from('empresas').update({
      cabecalho_path: null, cabecalho_url: null,
      timbrado_path: null, timbrado_url: null,
      rodape_path: null, rodape_url: null,
    }).eq('id', empresaId);
    setHeader({ url: null, path: null });
    setFooter({ url: null, path: null });
    setTimbradoUrl(null);
    setSourceImageUrl(null);
    setSplitDone(false);
    toast.success('Timbrado removido.');
  };

  const paper = PAPER_SIZES[pageSetup.paperSize];
  const isLandscape = pageSetup.orientation === 'landscape';
  const pageW = isLandscape ? paper.h : paper.w;
  const pageH = isLandscape ? paper.w : paper.h;

  const renderMarginInput = (label: string, field: keyof PageSetup, unit = 'cm') => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={pageSetup[field] as number}
          onChange={(e) => setPageSetup(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
          className="h-8 text-xs pr-8"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );

  const renderSplitEditor = () => {
    if (!sourceImageUrl) return null;

    return (
      <div className="space-y-4 border border-border rounded-xl bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Recorte Automático de Cabeçalho e Rodapé</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Ajuste os controles para definir a área do <strong className="text-foreground">cabeçalho</strong> (topo) e <strong className="text-foreground">rodapé</strong> (base) do seu timbrado.
        </p>

        <div className="relative rounded-lg overflow-hidden border border-border bg-white">
          <img src={sourceImageUrl} alt="Timbrado completo" className="w-full h-auto" />
          <div
            className="absolute top-0 left-0 right-0 bg-accent/15 border-b-2 border-dashed border-accent transition-all pointer-events-none"
            style={{ height: `${headerSplit}%` }}
          >
            <div className="absolute bottom-1 left-2 bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 rounded">
              Cabeçalho ({headerSplit}%)
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 bg-accent/15 border-t-2 border-dashed border-accent transition-all pointer-events-none"
            style={{ height: `${footerSplit}%` }}
          >
            <div className="absolute top-1 left-2 bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 rounded">
              Rodapé ({footerSplit}%)
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-muted/80 text-muted-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              Área de conteúdo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
              Cabeçalho — {headerSplit}% do topo
            </Label>
            <Slider value={[headerSplit]} onValueChange={([v]) => setHeaderSplit(v)} min={5} max={40} step={1} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
              Rodapé — {footerSplit}% da base
            </Label>
            <Slider value={[footerSplit]} onValueChange={([v]) => setFooterSplit(v)} min={3} max={30} step={1} className="w-full" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={applySplit} disabled={splitting} className="gap-2">
            {splitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SplitSquareHorizontal className="w-4 h-4" />}
            {splitting ? 'Recortando...' : 'Aplicar Recorte'}
          </Button>
          {splitDone && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Recorte aplicado
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderExtractedResults = () => {
    if (!header.url && !footer.url) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
            <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Cabeçalho</span>
          </div>
          {header.url ? (
            <div className="p-3">
              {isImageUrl(header.url) ? (
                <img src={header.url} alt="Cabeçalho" className="w-full h-auto max-h-24 object-contain rounded border border-border/30 bg-white p-1" />
              ) : (
                <div className="h-16 flex items-center justify-center rounded border border-border/30 bg-white">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs ml-2 text-muted-foreground">Documento carregado</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 text-center">
              <span className="text-xs text-muted-foreground italic">Não encontrado no documento</span>
            </div>
          )}
        </div>

        <div className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
            <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Rodapé</span>
          </div>
          {footer.url ? (
            <div className="p-3">
              {isImageUrl(footer.url) ? (
                <img src={footer.url} alt="Rodapé" className="w-full h-auto max-h-24 object-contain rounded border border-border/30 bg-white p-1" />
              ) : (
                <div className="h-16 flex items-center justify-center rounded border border-border/30 bg-white">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs ml-2 text-muted-foreground">Documento carregado</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 text-center">
              <span className="text-xs text-muted-foreground italic">Não encontrado no documento</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPageSetupPanel = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
          Orientação da Página
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'portrait' }))}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              pageSetup.orientation === 'portrait'
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-border hover:border-accent/30 hover:bg-muted/30'
            }`}
          >
            <div className={`w-8 h-11 rounded-sm border-2 ${pageSetup.orientation === 'portrait' ? 'border-accent bg-accent/10' : 'border-muted-foreground/30 bg-muted/20'}`}>
              <div className="m-1 space-y-0.5">
                <div className={`h-0.5 rounded-full ${pageSetup.orientation === 'portrait' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
                <div className={`h-0.5 w-3/4 rounded-full ${pageSetup.orientation === 'portrait' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
              </div>
            </div>
            <span className="text-xs font-medium">Retrato</span>
            {pageSetup.orientation === 'portrait' && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
          </button>
          <button
            type="button"
            onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'landscape' }))}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              pageSetup.orientation === 'landscape'
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-border hover:border-accent/30 hover:bg-muted/30'
            }`}
          >
            <div className={`w-11 h-8 rounded-sm border-2 ${pageSetup.orientation === 'landscape' ? 'border-accent bg-accent/10' : 'border-muted-foreground/30 bg-muted/20'}`}>
              <div className="m-1 space-y-0.5">
                <div className={`h-0.5 rounded-full ${pageSetup.orientation === 'landscape' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
                <div className={`h-0.5 w-3/4 rounded-full ${pageSetup.orientation === 'landscape' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
              </div>
            </div>
            <span className="text-xs font-medium">Paisagem</span>
            {pageSetup.orientation === 'landscape' && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <FileImage className="w-3.5 h-3.5 text-muted-foreground" />
          Tamanho do Papel
        </Label>
        <Select value={pageSetup.paperSize} onValueChange={(v) => setPageSetup(prev => ({ ...prev, paperSize: v as PaperSize }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
          Margens
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {renderMarginInput('Superior', 'marginTop')}
          {renderMarginInput('Inferior', 'marginBottom')}
          {renderMarginInput('Esquerda', 'marginLeft')}
          {renderMarginInput('Direita', 'marginRight')}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
          Área do Cabeçalho / Rodapé
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {renderMarginInput('Altura Cabeçalho', 'headerHeight')}
          {renderMarginInput('Altura Rodapé', 'footerHeight')}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Predefinições Rápidas</Label>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => setPageSetup({ ...DEFAULT_SETUP, orientation: pageSetup.orientation, paperSize: pageSetup.paperSize })}>
            NBR 14724 (ABNT)
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => setPageSetup(prev => ({ ...prev, marginTop: 2.54, marginBottom: 2.54, marginLeft: 2.54, marginRight: 2.54, headerHeight: 1.27, footerHeight: 1.27 }))}>
            Padrão Office
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => setPageSetup(prev => ({ ...prev, marginTop: 1.5, marginBottom: 1.5, marginLeft: 1.5, marginRight: 1.5, headerHeight: 1, footerHeight: 1 }))}>
            Margens Estreitas
          </Button>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Dimensões finais:</strong>{' '}
          {pageW} × {pageH} mm ({pageSetup.orientation === 'portrait' ? 'Retrato' : 'Paisagem'})
          <br />
          <strong className="text-foreground">Área útil:</strong>{' '}
          {(pageW - pageSetup.marginLeft * 10 - pageSetup.marginRight * 10).toFixed(0)} × {(pageH - pageSetup.marginTop * 10 - pageSetup.marginBottom * 10).toFixed(0)} mm
        </p>
      </div>
    </div>
  );

  const renderPagePreview = () => {
    const scaleFactor = 460 / pageW;
    const displayW = pageW * scaleFactor;
    const displayH = pageH * scaleFactor;
    const mTop = pageSetup.marginTop * 10 * scaleFactor;
    const mBottom = pageSetup.marginBottom * 10 * scaleFactor;
    const mLeft = pageSetup.marginLeft * 10 * scaleFactor;
    const mRight = pageSetup.marginRight * 10 * scaleFactor;
    const hHeight = pageSetup.headerHeight * 10 * scaleFactor;
    const fHeight = pageSetup.footerHeight * 10 * scaleFactor;
    const contentTop = mTop + hHeight;
    const contentBottom = displayH - mBottom - fHeight;
    const contentHeight = contentBottom - contentTop;

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative bg-white border border-border/80 shadow-lg" style={{ width: displayW, height: displayH }}>
          <div className="absolute border border-dashed border-muted-foreground/30 pointer-events-none"
            style={{ top: mTop, left: mLeft, right: mRight, bottom: mBottom }} />

          <div className="absolute overflow-hidden" style={{ top: 0, left: 0, right: 0, height: mTop + hHeight }}>
            <div className="absolute inset-0 bg-black/[0.04] border-b border-dashed border-border" />
            {header.url && isImageUrl(header.url) ? (
              <img src={header.url} alt="Cabeçalho" className="relative z-10 w-full h-full object-contain" />
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <span className="text-black/40 italic" style={{ fontSize: Math.max(7, hHeight * 0.25) }}>
                  {header.url ? 'Cabeçalho' : 'Área do cabeçalho'}
                </span>
              </div>
            )}
          </div>

          <div className="absolute overflow-hidden" style={{ top: contentTop, left: mLeft, right: mRight, height: Math.max(contentHeight, 20) }}>
            <div className="p-2 space-y-1.5">
              {Array.from({ length: Math.max(3, Math.floor(contentHeight / 12)) }).map((_, i) => (
                <div key={i} className="bg-muted/25 rounded-sm" style={{ height: Math.max(3, scaleFactor * 2.5), width: `${60 + Math.sin(i * 1.7) * 30}%` }} />
              ))}
            </div>
          </div>

          <div className="absolute overflow-hidden" style={{ bottom: 0, left: 0, right: 0, height: mBottom + fHeight }}>
            <div className="absolute inset-0 bg-black/[0.04] border-t border-dashed border-border" />
            {footer.url && isImageUrl(footer.url) ? (
              <img src={footer.url} alt="Rodapé" className="relative z-10 w-full h-full object-contain" />
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <span className="text-black/40 italic" style={{ fontSize: Math.max(7, fHeight * 0.25) }}>
                  {footer.url ? 'Rodapé' : 'Área do rodapé'}
                </span>
              </div>
            )}
          </div>

          <span className="absolute text-xs text-black/50 select-none" style={{ top: 2, left: mLeft }}>{pageSetup.marginTop}cm</span>
          <span className="absolute text-xs text-black/50 select-none" style={{ bottom: 2, left: mLeft }}>{pageSetup.marginBottom}cm</span>
          <span className="absolute text-xs text-black/50 select-none rotate-90 origin-top-left" style={{ top: mTop, left: 2 }}>{pageSetup.marginLeft}cm</span>
          <span className="absolute text-muted-foreground/40 select-none" style={{ fontSize: Math.max(7, scaleFactor * 3), top: mTop * 0.3, right: mRight + 4 }}>1</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-1.5">
          <span className="font-medium text-foreground">{PAPER_SIZES[pageSetup.paperSize].label}</span>
          <span>•</span>
          <span>{pageSetup.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
          <span>•</span>
          <span>Margens: {pageSetup.marginTop}/{pageSetup.marginBottom}/{pageSetup.marginLeft}/{pageSetup.marginRight} cm</span>
        </div>
      </div>
    );
  };

  const hasAnyContent = header.url || footer.url || sourceImageUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Label className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
            Papel Timbrado / Marca d'Água
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Envie uma imagem ou documento Word do seu papel timbrado. O sistema extrai automaticamente o cabeçalho e rodapé.
          </p>
        </div>
        <Button
          variant={showPreview ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1.5"
        >
          <Printer className="w-4 h-4" />
          {showPreview ? 'Fechar Prévia' : 'Visualizar Impressão'}
        </Button>
      </div>

      {!hasAnyContent ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !empresaId}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{uploading ? 'Processando...' : 'Enviar papel timbrado'}</span>
          <span className="text-xs text-muted-foreground text-center max-w-sm">
            PNG, JPG, WEBP, SVG, PDF ou Word — Máx. 10MB
            <br />
            <span className="font-medium">Documentos Word: extração automática de cabeçalho e rodapé</span>
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          {sourceImageUrl && renderSplitEditor()}

          {renderExtractedResults()}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Trocar arquivo
            </Button>
            <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive gap-1.5" onClick={handleRemoveAll}>
              <X className="w-3.5 h-3.5" />
              Remover tudo
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
      />

      {showPreview && (
        <div className="border border-border rounded-xl bg-card shadow-md overflow-hidden">
          <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Configurar Página</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant={pageSetup.orientation === 'portrait' ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1"
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'portrait' }))}>
                <div className="w-3 h-4 border border-current rounded-[1px]" />Retrato
              </Button>
              <Button variant={pageSetup.orientation === 'landscape' ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1"
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'landscape' }))}>
                <div className="w-4 h-3 border border-current rounded-[1px]" />Paisagem
              </Button>
            </div>
          </div>

          <Tabs value={previewTab} onValueChange={setPreviewTab} className="w-full">
            <div className="px-4 pt-2 border-b border-border/50">
              <TabsList className="h-8 bg-muted/30">
                <TabsTrigger value="preview" className="text-xs gap-1.5 h-7">
                  <Eye className="w-3.5 h-3.5" />Visualizar Impressão
                </TabsTrigger>
                <TabsTrigger value="page" className="text-xs gap-1.5 h-7">
                  <Settings2 className="w-3.5 h-3.5" />Página
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="m-0 p-6 bg-muted/10">
              {renderPagePreview()}
            </TabsContent>
            <TabsContent value="page" className="m-0 p-5">
              {renderPageSetupPanel()}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
