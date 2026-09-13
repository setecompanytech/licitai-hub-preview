import { useState, useRef, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Upload, ImageIcon, X, Loader2, FileText, Eye, ArrowUp, ArrowDown, Printer, RotateCw, Settings2, Ruler, FileImage, Monitor, Scissors, SplitSquareHorizontal, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { limparCacheTimbrado } from '@/lib/timbrado/timbrado';
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

type AlinhamentoImg = 'esticar' | 'esquerda' | 'centro' | 'direita';

interface PageSetup {
  orientation: PageOrientation;
  paperSize: PaperSize;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
  /** Posição/dimensão da ARTE dentro da área (03/09): mover/editar a
   *  logomarca para adequar ao documento — pedido do dono. */
  headerAlign: AlinhamentoImg;
  headerWidth: number;   // % da largura da página (10–100)
  headerOffsetY: number; // cm, empurra para baixo
  headerOffsetX: number; // cm, arrasto horizontal
  footerAlign: AlinhamentoImg;
  footerWidth: number;
  footerOffsetY: number; // cm, empurra para cima
  footerOffsetX: number;
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
  headerAlign: 'esticar',
  headerWidth: 100,
  headerOffsetY: 0,
  headerOffsetX: 0,
  footerAlign: 'esticar',
  footerWidth: 100,
  footerOffsetY: 0,
  footerOffsetX: 0,
};

/**
 * PDF de papel timbrado → PNG da 1ª página (04/09). O ramo antigo subia o
 * PDF cru: a prévia <img> não renderiza PDF (o campo "voltava em branco"),
 * o gerador recusava application/pdf, e o rodapé nunca nascia. Convertido,
 * o arquivo entra no MESMO fluxo de recorte das imagens.
 */
async function pdfParaPngBlob(file: Blob): Promise<Blob> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pagina = await pdf.getPage(1);
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  await pagina.render({ canvasContext: ctx, viewport } as never).promise;
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao converter o PDF'))), 'image/png', 1));
}

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
    (supabase.from('empresas') as any)
      .select('timbrado_url, timbrado_path, cabecalho_url, cabecalho_path, rodape_url, rodape_path, timbrado_ajustes')
      .eq('id', empresaId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const hUrl = (data as any).cabecalho_url || data.timbrado_url || null;
        const hPath = (data as any).cabecalho_path || data.timbrado_path || null;
        const fUrl = (data as any).rodape_url || null;
        const fPath = (data as any).rodape_path || null;
        const ajustes = (data as any).timbrado_ajustes;
        if (ajustes && typeof ajustes === 'object') {
          setPageSetup((prev) => ({ ...prev, ...ajustes }));
        }

        // If saved URL points to a non-image file (e.g. .docx), clear it
        // so the user can re-upload properly
        const isValidImage = (url: string | null) => !url || /\.(png|jpe?g|webp|svg)(\?|$)/i.test(url);

        if (isValidImage(hUrl)) {
          setHeader({ url: hUrl, path: hPath });
          setTimbradoUrl(hUrl);
        } else if (hPath && /\.pdf$/i.test(hPath)) {
          // Legado (04/09): o timbrado foi salvo como PDF CRU pelo fluxo
          // antigo — era isto que fazia o campo "voltar em branco": o load
          // descartava o arquivo salvo em silêncio. Agora o PDF é convertido
          // aqui mesmo e o recorte abre para o usuário confirmar — um clique
          // e os PNGs definitivos são persistidos.
          setHeader({ url: null, path: null });
          setTimbradoUrl(null);
          (async () => {
            try {
              const { data: blob } = await supabase.storage.from('timbrados').download(hPath);
              if (!blob) return;
              const png = await pdfParaPngBlob(blob);
              setSourceImageUrl(URL.createObjectURL(png));
              const pathFull = `${empresaId}/timbrado_full.png`;
              await supabase.storage.from('timbrados').upload(pathFull, png, { upsert: true, contentType: 'image/png' });
              toast.info('Seu timbrado estava salvo em PDF — convertido. Ajuste o recorte de cabeçalho e rodapé abaixo e confirme.');
            } catch { /* PDF ilegível: o campo fica para reenvio manual */ }
          })();
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
      } else if (file.type === 'application/pdf' || ext === '.pdf') {
        // PDF entra no fluxo das imagens: converte a 1ª página e abre o
        // recorte de cabeçalho/rodapé — nada de PDF cru no banco.
        toast.info('Convertendo o PDF do timbrado…');
        const png = await pdfParaPngBlob(file);
        const localUrl = URL.createObjectURL(png);
        setSourceImageUrl(localUrl);
        const path = `${empresaId}/timbrado_full.png`;
        await supabase.storage.from('timbrados').upload(path, png, { upsert: true, contentType: 'image/png' });
        setUploading(false);
        toast.success('PDF convertido! Ajuste as áreas de cabeçalho e rodapé abaixo e confirme o recorte.');
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

  const [salvandoAjustes, setSalvandoAjustes] = useState(false);
  /** Edição MANUAL no mockup (04/09): arrastar move, alça redimensiona. */
  const arrastoRef = useRef<{
    alvo: 'header' | 'footer';
    modo: 'mover' | 'redimensionar';
    x0: number; y0: number;
    base: { offsetX: number; offsetY: number; width: number; align: AlinhamentoImg };
  } | null>(null);

  const iniciarArrasto = (
    e: React.PointerEvent,
    alvo: 'header' | 'footer',
    modo: 'mover' | 'redimensionar',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const s = pageSetup;
    arrastoRef.current = {
      alvo, modo, x0: e.clientX, y0: e.clientY,
      base: alvo === 'header'
        ? { offsetX: s.headerOffsetX, offsetY: s.headerOffsetY, width: s.headerWidth, align: s.headerAlign }
        : { offsetX: s.footerOffsetX, offsetY: s.footerOffsetY, width: s.footerWidth, align: s.footerAlign },
    };
  };

  useEffect(() => {
    const mover = (e: PointerEvent) => {
      const d = arrastoRef.current;
      if (!d) return;
      const escala = 460 / (pageSetup.orientation === 'landscape'
        ? PAPER_SIZES[pageSetup.paperSize].h : PAPER_SIZES[pageSetup.paperSize].w);
      const dxCm = (e.clientX - d.x0) / escala / 10;
      const dyCm = (e.clientY - d.y0) / escala / 10;
      setPageSetup((prev) => {
        if (d.modo === 'redimensionar') {
          const larguraPagina = pageSetup.orientation === 'landscape'
            ? PAPER_SIZES[prev.paperSize].h : PAPER_SIZES[prev.paperSize].w;
          const deltaPct = (dxCm * 10 / larguraPagina) * 100;
          const nova = Math.min(100, Math.max(10, d.base.width + deltaPct));
          // Redimensionar sai do "esticar": largura manual pede alinhamento real.
          const align = d.base.align === 'esticar' ? 'esquerda' : d.base.align;
          return d.alvo === 'header'
            ? { ...prev, headerWidth: Math.round(nova), headerAlign: align }
            : { ...prev, footerWidth: Math.round(nova), footerAlign: align };
        }
        const arred = (v: number) => Math.round(v * 10) / 10;
        if (d.alvo === 'header') {
          return {
            ...prev,
            headerAlign: d.base.align === 'esticar' ? 'esquerda' : d.base.align,
            headerOffsetX: arred(d.base.offsetX + dxCm),
            headerOffsetY: Math.max(0, arred(d.base.offsetY + dyCm)),
          };
        }
        return {
          ...prev,
          footerAlign: d.base.align === 'esticar' ? 'esquerda' : d.base.align,
          footerOffsetX: arred(d.base.offsetX + dxCm),
          footerOffsetY: Math.max(0, arred(d.base.offsetY - dyCm)),
        };
      });
    };
    const soltar = () => { arrastoRef.current = null; };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSetup.orientation, pageSetup.paperSize]);
  const salvarAjustes = async () => {
    if (!empresaId) return;
    setSalvandoAjustes(true);
    const { data: ok, error } = await supabase.from('empresas')
      .update({ timbrado_ajustes: pageSetup } as never)
      .eq('id', empresaId)
      .select('id');
    setSalvandoAjustes(false);
    // Contagem de linhas: update barrado por RLS volta sem erro e sem efeito —
    // o falso sucesso silencioso que a casa já conhece.
    if (error || !ok?.length) {
      toast.error('Não foi possível salvar os ajustes: ' + (error?.message ?? 'sem permissão (só o Admin da empresa altera o timbrado)'));
      return;
    }
    limparCacheTimbrado(empresaId);
    toast.success('Ajustes do timbrado salvos — valem para o próximo documento gerado em cada aba (até 45s de espera).');
  };

  const paper = PAPER_SIZES[pageSetup.paperSize];
  const isLandscape = pageSetup.orientation === 'landscape';
  const pageW = isLandscape ? paper.h : paper.w;
  const pageH = isLandscape ? paper.w : paper.h;

  // Campo numérico com a unidade grudada à direita. O rótulo é visível e está
  // ligado ao campo pelo `id` (o `field` já é único em cada chamada).
  const renderMarginInput = (label: string, field: keyof PageSetup, unit = 'cm') => (
    <div className="space-y-2">
      <Label htmlFor={`timbrado-${field}`} className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          id={`timbrado-${field}`}
          type="number"
          step="0.1"
          min="0"
          max={unit === '%' ? 100 : 10}
          value={pageSetup[field] as number}
          onChange={(e) => setPageSetup(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
          className="pr-9 tabular-nums"
        />
        <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );

  const renderSplitEditor = () => {
    if (!sourceImageUrl) return null;

    return (
      <div className="space-y-4 rounded-lg border border-border bg-muted p-6">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-foreground">Recorte automático de cabeçalho e rodapé</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Ajuste os controles para definir a área do <strong className="text-foreground">cabeçalho</strong> (topo) e <strong className="text-foreground">rodapé</strong> (base) do seu timbrado.
        </p>

        {/* Fac-símile do papel: a folha enviada é branca e continua branca em
            qualquer tema — por isso `bg-white` aqui, e não `bg-card`. */}
        <div className="relative overflow-hidden rounded-md border border-border bg-white">
          <img src={sourceImageUrl} alt="Timbrado completo" className="h-auto w-full" />
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 border-b-2 border-dashed border-primary bg-primary/15 transition-all"
            style={{ height: `${headerSplit}%` }}
          >
            <div className="absolute bottom-1 left-2 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              Cabeçalho ({headerSplit}%)
            </div>
          </div>
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 border-t-2 border-dashed border-primary bg-primary/15 transition-all"
            style={{ height: `${footerSplit}%` }}
          >
            <div className="absolute left-2 top-1 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              Rodapé ({footerSplit}%)
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              Área de conteúdo
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ArrowUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              Cabeçalho — {headerSplit}% do topo
            </p>
            <Slider aria-label="Altura do cabeçalho, em % do topo" value={[headerSplit]} onValueChange={([v]) => setHeaderSplit(v)} min={5} max={40} step={1} className="w-full" />
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ArrowDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              Rodapé — {footerSplit}% da base
            </p>
            <Slider aria-label="Altura do rodapé, em % da base" value={[footerSplit]} onValueChange={([v]) => setFooterSplit(v)} min={3} max={30} step={1} className="w-full" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={applySplit} disabled={splitting}>
            {splitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <SplitSquareHorizontal className="w-4 h-4" aria-hidden="true" />}
            {splitting ? 'Recortando…' : 'Aplicar recorte'}
          </Button>
          {splitDone && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Recorte aplicado
            </Badge>
          )}
        </div>
      </div>
    );
  };

  const renderExtractedResults = () => {
    if (!header.url && !footer.url) return null;

    // Os dois recortes lado a lado. `bg-white` no quadro da arte é o papel —
    // um timbrado claro sobre `bg-card` escuro sumiria no modo noturno.
    const recorte = (
      titulo: string,
      Icone: typeof ArrowUp,
      parte: { url: string | null },
    ) => (
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Icone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">{titulo}</span>
        </div>
        {parte.url ? (
          <div className="p-3">
            {isImageUrl(parte.url) ? (
              <img src={parte.url} alt={titulo} className="h-auto max-h-24 w-full rounded-md border border-border bg-white object-contain p-1" />
            ) : (
              <div className="flex h-16 items-center justify-center gap-2 rounded-md border border-border bg-white">
                <FileText className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Documento carregado</span>
              </div>
            )}
          </div>
        ) : (
          <p className="p-3 text-center text-sm italic text-muted-foreground">Não encontrado no documento</p>
        )}
      </div>
    );

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {recorte('Cabeçalho', ArrowUp, header)}
        {recorte('Rodapé', ArrowDown, footer)}
      </div>
    );
  };

  // Seletor de alinhamento da arte — o mesmo controle para cabeçalho e rodapé.
  const renderAlinhamento = (
    id: string,
    valor: AlinhamentoImg,
    aoMudar: (v: AlinhamentoImg) => void,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-muted-foreground">Alinhamento</Label>
      <Select value={valor} onValueChange={(v) => aoMudar(v as AlinhamentoImg)}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="esticar">Preencher a área</SelectItem>
          <SelectItem value="esquerda">Esquerda</SelectItem>
          <SelectItem value="centro">Centro</SelectItem>
          <SelectItem value="direita">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // Miniatura de folha dos botões de orientação — decoração, não informação:
  // o rótulo ao lado ("Retrato"/"Paisagem") é quem diz o que está escolhido.
  const miniaturaFolha = (ativo: boolean, retrato: boolean) => (
    <span
      aria-hidden="true"
      className={`block rounded-sm border-2 ${retrato ? 'h-11 w-8' : 'h-8 w-11'} ${
        ativo ? 'border-primary bg-primary-tint' : 'border-border bg-muted'
      }`}
    >
      <span className="m-1 block space-y-0.5">
        <span className={`block h-0.5 rounded-full ${ativo ? 'bg-primary' : 'bg-border'}`} />
        <span className={`block h-0.5 w-3/4 rounded-full ${ativo ? 'bg-primary' : 'bg-border'}`} />
      </span>
    </span>
  );

  const renderPageSetupPanel = () => (
    <div className="space-y-6">
      {/* ── Orientação e papel ──────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <RotateCw className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Orientação da página
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {([['portrait', 'Retrato'], ['landscape', 'Paisagem']] as const).map(([valor, rotulo]) => {
            const ativo = pageSetup.orientation === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: valor }))}
                aria-pressed={ativo}
                className={`flex flex-col items-center gap-2 rounded-md border-2 p-3 transition-colors ${
                  ativo ? 'border-primary bg-primary-tint shadow-sm' : 'border-border hover:bg-muted'
                }`}
              >
                {miniaturaFolha(ativo, valor === 'portrait')}
                <span className="text-sm font-medium text-foreground">{rotulo}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="timbrado-papel" className="flex items-center gap-1.5 text-sm font-semibold">
          <FileImage className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Tamanho do papel
        </Label>
        <Select value={pageSetup.paperSize} onValueChange={(v) => setPageSetup(prev => ({ ...prev, paperSize: v as PaperSize }))}>
          <SelectTrigger id="timbrado-papel"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Margens e áreas reservadas ──────────────────────────────────── */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Ruler className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Margens
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderMarginInput('Superior', 'marginTop')}
          {renderMarginInput('Inferior', 'marginBottom')}
          {renderMarginInput('Esquerda', 'marginLeft')}
          {renderMarginInput('Direita', 'marginRight')}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Settings2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Área do cabeçalho / rodapé
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderMarginInput('Altura do cabeçalho', 'headerHeight')}
          {renderMarginInput('Altura do rodapé', 'footerHeight')}
        </div>
      </div>

      {/* ── Mover/editar a arte dentro da área (03/09) ─────────────────── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Posição da logomarca — cabeçalho</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderAlinhamento('timbrado-align-cabecalho', pageSetup.headerAlign,
            (v) => setPageSetup((prev) => ({ ...prev, headerAlign: v })))}
          {renderMarginInput('Largura', 'headerWidth', '%')}
          {renderMarginInput('Descer', 'headerOffsetY')}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Posição da logomarca — rodapé</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {renderAlinhamento('timbrado-align-rodape', pageSetup.footerAlign,
            (v) => setPageSetup((prev) => ({ ...prev, footerAlign: v })))}
          {renderMarginInput('Largura', 'footerWidth', '%')}
          {renderMarginInput('Subir', 'footerOffsetY')}
        </div>
      </div>

      {/* ── Predefinições ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Predefinições rápidas</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"
            onClick={() => setPageSetup({ ...DEFAULT_SETUP, orientation: pageSetup.orientation, paperSize: pageSetup.paperSize })}>
            NBR 14724 (ABNT)
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => setPageSetup(prev => ({ ...prev, marginTop: 2.54, marginBottom: 2.54, marginLeft: 2.54, marginRight: 2.54, headerHeight: 1.27, footerHeight: 1.27 }))}>
            Padrão Office
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => setPageSetup(prev => ({ ...prev, marginTop: 1.5, marginBottom: 1.5, marginLeft: 1.5, marginRight: 1.5, headerHeight: 1, footerHeight: 1 }))}>
            Margens estreitas
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Dimensões finais:</strong>{' '}
          <span className="tabular-nums">{pageW} × {pageH} mm</span> ({pageSetup.orientation === 'portrait' ? 'Retrato' : 'Paisagem'})
          <br />
          <strong className="text-foreground">Área útil:</strong>{' '}
          <span className="tabular-nums">
            {(pageW - pageSetup.marginLeft * 10 - pageSetup.marginRight * 10).toFixed(0)} × {(pageH - pageSetup.marginTop * 10 - pageSetup.marginBottom * 10).toFixed(0)} mm
          </span>
        </p>
      </div>

      {/* Ação no rodapé do formulário — era um botão solto no meio dos campos
          de posição, e valia para o painel inteiro. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
        <Button onClick={salvarAjustes} disabled={salvandoAjustes}>
          {salvandoAjustes ? 'Salvando…' : 'Salvar ajustes da página'}
        </Button>
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
      // ┌── FAC-SÍMILE DO PAPEL ──────────────────────────────────────────────┐
      // A folha é branca com marcas em preto translúcido em qualquer tema: é a
      // página que vai sair na impressora, não uma superfície da interface.
      // Só a alça de redimensionar usa a cor da ação (verde), porque é
      // controle e não papel.
      // └─────────────────────────────────────────────────────────────────────┘
      <div className="flex flex-col items-center gap-4">
        <div className="relative border border-border bg-white shadow-md" style={{ width: displayW, height: displayH }}>
          <div className="pointer-events-none absolute border border-dashed border-black/20"
            style={{ top: mTop, left: mLeft, right: mRight, bottom: mBottom }} />

          <div className="absolute overflow-hidden" style={{ top: 0, left: 0, right: 0, height: mTop + hHeight }}>
            <div className="absolute inset-0 border-b border-dashed border-black/15 bg-black/5" />
            {header.url && isImageUrl(header.url) ? (
              <div
                className="relative z-10 w-full h-full flex"
                style={{
                  justifyContent: pageSetup.headerAlign === 'esquerda' ? 'flex-start'
                    : pageSetup.headerAlign === 'direita' ? 'flex-end' : 'center',
                  paddingTop: pageSetup.headerOffsetY * 10 * scaleFactor,
                }}
              >
                <div
                  className="relative h-full cursor-move group"
                  style={{
                    width: pageSetup.headerAlign === 'esticar' ? '100%' : `${pageSetup.headerWidth}%`,
                    transform: `translateX(${pageSetup.headerOffsetX * 10 * scaleFactor}px)`,
                  }}
                  onPointerDown={(e) => iniciarArrasto(e, 'header', 'mover')}
                  title="Arraste para posicionar o cabeçalho"
                >
                  <img src={header.url} alt="Cabeçalho" draggable={false}
                    className="w-full h-full object-contain pointer-events-none select-none" />
                  <span
                    className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize rounded-sm bg-primary opacity-0 shadow-sm group-hover:opacity-100"
                    onPointerDown={(e) => iniciarArrasto(e, 'header', 'redimensionar')}
                    title="Arraste para redimensionar"
                  />
                </div>
              </div>
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <span className="text-black/40 italic" style={{ fontSize: Math.max(7, hHeight * 0.25) }}>
                  {header.url ? 'Cabeçalho' : 'Área do cabeçalho'}
                </span>
              </div>
            )}
          </div>

          <div className="absolute overflow-hidden" style={{ top: contentTop, left: mLeft, right: mRight, height: Math.max(contentHeight, 20) }}>
            <div aria-hidden="true" className="space-y-1.5 p-2">
              {Array.from({ length: Math.max(3, Math.floor(contentHeight / 12)) }).map((_, i) => (
                <div key={i} className="rounded-sm bg-black/10" style={{ height: Math.max(3, scaleFactor * 2.5), width: `${60 + Math.sin(i * 1.7) * 30}%` }} />
              ))}
            </div>
          </div>

          <div className="absolute overflow-hidden" style={{ bottom: 0, left: 0, right: 0, height: mBottom + fHeight }}>
            <div className="absolute inset-0 border-t border-dashed border-black/15 bg-black/5" />
            {footer.url && isImageUrl(footer.url) ? (
              <div
                className="relative z-10 w-full h-full flex"
                style={{
                  justifyContent: pageSetup.footerAlign === 'esquerda' ? 'flex-start'
                    : pageSetup.footerAlign === 'direita' ? 'flex-end' : 'center',
                  paddingBottom: pageSetup.footerOffsetY * 10 * scaleFactor,
                }}
              >
                <div
                  className="relative h-full cursor-move group"
                  style={{
                    width: pageSetup.footerAlign === 'esticar' ? '100%' : `${pageSetup.footerWidth}%`,
                    transform: `translateX(${pageSetup.footerOffsetX * 10 * scaleFactor}px)`,
                  }}
                  onPointerDown={(e) => iniciarArrasto(e, 'footer', 'mover')}
                  title="Arraste para posicionar o rodapé"
                >
                  <img src={footer.url} alt="Rodapé" draggable={false}
                    className="w-full h-full object-contain pointer-events-none select-none" />
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize rounded-sm bg-primary opacity-0 shadow-sm group-hover:opacity-100"
                    onPointerDown={(e) => iniciarArrasto(e, 'footer', 'redimensionar')}
                    title="Arraste para redimensionar"
                  />
                </div>
              </div>
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
          <span aria-hidden="true" className="absolute select-none text-black/30" style={{ fontSize: Math.max(7, scaleFactor * 3), top: mTop * 0.3, right: mRight + 4 }}>1</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{PAPER_SIZES[pageSetup.paperSize].label}</span>
          <span aria-hidden="true">·</span>
          <span>{pageSetup.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">Margens: {pageSetup.marginTop}/{pageSetup.marginBottom}/{pageSetup.marginLeft}/{pageSetup.marginRight} cm</span>
        </div>

        {/* Ação no rodapé, como no painel Página — a mesma gravação, do lado de
            onde se arrasta a arte. */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Arraste a arte para posicionar; a alça no canto redimensiona.
          </p>
          <Button size="sm" variant="outline" onClick={salvarAjustes} disabled={salvandoAjustes}>
            {salvandoAjustes ? 'Salvando…' : 'Salvar ajustes'}
          </Button>
        </div>
      </div>
    );
  };

  const hasAnyContent = header.url || footer.url || sourceImageUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ImageIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Papel timbrado / marca d'água
          </h3>
          <p className="mt-1 text-base text-muted-foreground">
            Envie uma imagem ou documento Word do seu papel timbrado. O sistema extrai automaticamente o cabeçalho e o rodapé.
          </p>
        </div>
        <Button
          variant={showPreview ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="shrink-0"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          {showPreview ? 'Fechar prévia' : 'Visualizar impressão'}
        </Button>
      </div>

      {!hasAnyContent ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !empresaId}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary hover:bg-primary-tint disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-base font-semibold text-foreground">{uploading ? 'Processando…' : 'Enviar papel timbrado'}</span>
          <span className="max-w-sm text-center text-sm text-muted-foreground">
            PNG, JPG, WEBP, SVG, PDF ou Word — máx. 10MB
            <br />
            <span className="font-medium">Documentos Word: extração automática de cabeçalho e rodapé</span>
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          {sourceImageUrl && renderSplitEditor()}

          {renderExtractedResults()}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" aria-hidden="true" />
              Trocar arquivo
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive-tint hover:text-destructive" onClick={handleRemoveAll}>
              <X className="w-4 h-4" aria-hidden="true" />
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
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Configurar página</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={pageSetup.orientation === 'portrait' ? 'default' : 'outline'} size="sm"
                aria-pressed={pageSetup.orientation === 'portrait'}
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'portrait' }))}>
                <span aria-hidden="true" className="block h-4 w-3 rounded-sm border border-current" />
                Retrato
              </Button>
              <Button variant={pageSetup.orientation === 'landscape' ? 'default' : 'outline'} size="sm"
                aria-pressed={pageSetup.orientation === 'landscape'}
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'landscape' }))}>
                <span aria-hidden="true" className="block h-3 w-4 rounded-sm border border-current" />
                Paisagem
              </Button>
            </div>
          </div>

          <Tabs value={previewTab} onValueChange={setPreviewTab} className="w-full">
            <div className="border-b border-border px-4 pt-3">
              <TabsList>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="w-4 h-4" aria-hidden="true" />Visualizar impressão
                </TabsTrigger>
                <TabsTrigger value="page" className="gap-1.5">
                  <Settings2 className="w-4 h-4" aria-hidden="true" />Página
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="m-0 overflow-x-auto bg-muted p-6">
              {renderPagePreview()}
            </TabsContent>
            <TabsContent value="page" className="m-0 p-6">
              {renderPageSetupPanel()}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
