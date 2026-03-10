import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, ImageIcon, X, Loader2, FileText, Eye, ArrowUp, ArrowDown, Printer, RotateCw, Settings2, Ruler, FileImage, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export default function TimbradoUploader({ empresaId, timbradoUrl, setTimbradoUrl }: TimbradoUploaderProps) {
  const headerRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
  const [header, setHeader] = useState<UploadSlot>({ url: null, path: null });
  const [footer, setFooter] = useState<UploadSlot>({ url: null, path: null });
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetup>(DEFAULT_SETUP);
  const [previewTab, setPreviewTab] = useState<string>('preview');

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
        setHeader({ url: hUrl, path: hPath });
        setFooter({ url: fUrl, path: fPath });
        setTimbradoUrl(hUrl);
      });
  }, [empresaId]);

  const handleUpload = async (file: File, slot: 'header' | 'footer') => {
    if (!empresaId) return;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
      toast.error('Formato inválido. Use PNG, JPG, WEBP, SVG, PDF ou Word.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB.'); return; }

    const setLoading = slot === 'header' ? setUploadingHeader : setUploadingFooter;
    setLoading(true);

    const prefix = slot === 'header' ? 'cabecalho' : 'rodape';
    const path = `${empresaId}/${prefix}${ext}`;

    const { error } = await supabase.storage.from('timbrados').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro: ' + error.message); setLoading(false); return; }

    const { data: urlData } = supabase.storage.from('timbrados').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const updateFields: Record<string, any> = {
      [`${prefix}_path`]: path,
      [`${prefix}_url`]: publicUrl,
    };
    if (slot === 'header') {
      updateFields.timbrado_path = path;
      updateFields.timbrado_url = publicUrl;
    }

    await supabase.from('empresas').update(updateFields).eq('id', empresaId);

    if (slot === 'header') {
      setHeader({ url: publicUrl, path });
      setTimbradoUrl(publicUrl);
    } else {
      setFooter({ url: publicUrl, path });
    }

    setLoading(false);
    toast.success(`${slot === 'header' ? 'Cabeçalho' : 'Rodapé'} enviado com sucesso!`);
  };

  const handleRemove = async (slot: 'header' | 'footer') => {
    if (!empresaId) return;
    const prefix = slot === 'header' ? 'cabecalho' : 'rodape';
    const updateFields: Record<string, any> = {
      [`${prefix}_path`]: null,
      [`${prefix}_url`]: null,
    };
    if (slot === 'header') {
      updateFields.timbrado_path = null;
      updateFields.timbrado_url = null;
    }
    await supabase.from('empresas').update(updateFields).eq('id', empresaId);
    if (slot === 'header') {
      setHeader({ url: null, path: null });
      setTimbradoUrl(null);
    } else {
      setFooter({ url: null, path: null });
    }
    toast.success(`${slot === 'header' ? 'Cabeçalho' : 'Rodapé'} removido.`);
  };

  const paper = PAPER_SIZES[pageSetup.paperSize];
  const isLandscape = pageSetup.orientation === 'landscape';
  const pageW = isLandscape ? paper.h : paper.w;
  const pageH = isLandscape ? paper.w : paper.h;

  const renderSlot = (
    slot: 'header' | 'footer',
    data: UploadSlot,
    inputRef: React.RefObject<HTMLInputElement>,
    uploading: boolean,
  ) => {
    const label = slot === 'header' ? 'Cabeçalho' : 'Rodapé';
    const Icon = slot === 'header' ? ArrowUp : ArrowDown;
    const fileName = data.url ? decodeURIComponent(data.url.split('/').pop() || '') : '';

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-accent" />
          {label}
        </Label>

        {data.url ? (
          <div className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              {isImageUrl(data.url) ? (
                <img src={data.url} alt={label} className="h-12 max-w-[180px] object-contain rounded border border-border/50 bg-white p-1" />
              ) : (
                <div className="h-12 w-12 rounded border border-border/50 bg-white flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{label} carregado</p>
                <p className="text-xs text-muted-foreground truncate">{fileName}</p>
              </div>
            </div>
            <div className="flex gap-1.5 px-3 pb-3">
              <Button variant="outline" size="sm" className="text-xs" asChild>
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                </a>
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => inputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Trocar
              </Button>
              <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => handleRemove(slot)}>
                <X className="w-3.5 h-3.5 mr-1" /> Excluir
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !empresaId}
            className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1.5 hover:border-accent/50 hover:bg-muted/30 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin text-accent" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
            <span className="text-sm font-medium">{uploading ? 'Enviando...' : `Enviar ${label.toLowerCase()}`}</span>
            <span className="text-xs text-muted-foreground">PNG, JPG, WEBP, SVG, PDF ou Word — Máx. 10MB</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file, slot);
            e.target.value = '';
          }}
        />
      </div>
    );
  };

  const renderMarginInput = (label: string, field: keyof PageSetup, unit = 'cm') => (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
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
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );

  const renderPageSetupPanel = () => (
    <div className="space-y-5">
      {/* Orientation toggle */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5 text-accent" />
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
                <div className={`h-0.5 rounded-full ${pageSetup.orientation === 'portrait' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
              </div>
            </div>
            <span className="text-xs font-medium">Retrato</span>
            {pageSetup.orientation === 'portrait' && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
            )}
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
                <div className={`h-0.5 rounded-full ${pageSetup.orientation === 'landscape' ? 'bg-accent/40' : 'bg-muted-foreground/20'}`} />
              </div>
            </div>
            <span className="text-xs font-medium">Paisagem</span>
            {pageSetup.orientation === 'landscape' && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Paper size */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <FileImage className="w-3.5 h-3.5 text-accent" />
          Tamanho do Papel
        </Label>
        <Select
          value={pageSetup.paperSize}
          onValueChange={(v) => setPageSetup(prev => ({ ...prev, paperSize: v as PaperSize }))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Margins */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 text-accent" />
          Margens
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {renderMarginInput('Superior', 'marginTop')}
          {renderMarginInput('Inferior', 'marginBottom')}
          {renderMarginInput('Esquerda', 'marginLeft')}
          {renderMarginInput('Direita', 'marginRight')}
        </div>
      </div>

      {/* Header/Footer height */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-accent" />
          Área do Cabeçalho / Rodapé
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {renderMarginInput('Altura Cabeçalho', 'headerHeight')}
          {renderMarginInput('Altura Rodapé', 'footerHeight')}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Define a altura reservada para o cabeçalho e rodapé dentro das margens da página.
        </p>
      </div>

      {/* Quick presets */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Predefinições Rápidas</Label>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7"
            onClick={() => setPageSetup({ ...DEFAULT_SETUP, orientation: pageSetup.orientation, paperSize: pageSetup.paperSize })}
          >
            NBR 14724 (ABNT)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7"
            onClick={() => setPageSetup(prev => ({
              ...prev,
              marginTop: 2.54, marginBottom: 2.54, marginLeft: 2.54, marginRight: 2.54,
              headerHeight: 1.27, footerHeight: 1.27,
            }))}
          >
            Padrão Office
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7"
            onClick={() => setPageSetup(prev => ({
              ...prev,
              marginTop: 1.5, marginBottom: 1.5, marginLeft: 1.5, marginRight: 1.5,
              headerHeight: 1, footerHeight: 1,
            }))}
          >
            Margens Estreitas
          </Button>
        </div>
      </div>

      {/* Dimensions info */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
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
    // Scale factor: fit page into a container of max 460px width
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
        {/* Page frame */}
        <div
          className="relative bg-white border border-border/80 shadow-lg"
          style={{ width: displayW, height: displayH }}
        >
          {/* Margin guides (dashed) */}
          <div
            className="absolute border border-dashed border-accent/30 pointer-events-none"
            style={{
              top: mTop,
              left: mLeft,
              right: mRight,
              bottom: mBottom,
            }}
          />

          {/* Header area */}
          <div
            className="absolute overflow-hidden"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: mTop + hHeight,
            }}
          >
            <div className="absolute inset-0 bg-accent/5 border-b border-dashed border-accent/20" />
            {header.url ? (
              isImageUrl(header.url) ? (
                <img src={header.url} alt="Cabeçalho" className="relative z-10 w-full h-full object-fill" />
              ) : (
                <div className="relative z-10 w-full h-full flex items-center justify-center text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span style={{ fontSize: Math.max(8, hHeight * 0.3) }}>Cabeçalho</span>
                </div>
              )
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <span className="text-muted-foreground/40 italic" style={{ fontSize: Math.max(7, hHeight * 0.25) }}>
                  Área do cabeçalho
                </span>
              </div>
            )}
          </div>

          {/* Content area */}
          <div
            className="absolute overflow-hidden"
            style={{
              top: contentTop,
              left: mLeft,
              right: mRight,
              height: Math.max(contentHeight, 20),
            }}
          >
            <div className="p-2 space-y-1.5">
              {Array.from({ length: Math.max(3, Math.floor(contentHeight / 12)) }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted/25 rounded-sm"
                  style={{
                    height: Math.max(3, scaleFactor * 2.5),
                    width: `${60 + Math.sin(i * 1.7) * 30}%`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer area */}
          <div
            className="absolute overflow-hidden"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              height: mBottom + fHeight,
            }}
          >
            <div className="absolute inset-0 bg-accent/5 border-t border-dashed border-accent/20" />
            {footer.url ? (
              isImageUrl(footer.url) ? (
                <img src={footer.url} alt="Rodapé" className="relative z-10 w-full h-full object-fill" />
              ) : (
                <div className="relative z-10 w-full h-full flex items-center justify-center text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span style={{ fontSize: Math.max(8, fHeight * 0.3) }}>Rodapé</span>
                </div>
              )
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <span className="text-muted-foreground/40 italic" style={{ fontSize: Math.max(7, fHeight * 0.25) }}>
                  Área do rodapé
                </span>
              </div>
            )}
          </div>

          {/* Corner labels for margins */}
          <span className="absolute text-[8px] text-accent/50 select-none" style={{ top: 2, left: mLeft }}>
            {pageSetup.marginTop}cm
          </span>
          <span className="absolute text-[8px] text-accent/50 select-none" style={{ bottom: 2, left: mLeft }}>
            {pageSetup.marginBottom}cm
          </span>
          <span className="absolute text-[8px] text-accent/50 select-none rotate-90 origin-top-left" style={{ top: mTop, left: 2 }}>
            {pageSetup.marginLeft}cm
          </span>

          {/* Page number simulation */}
          <span
            className="absolute text-muted-foreground/40 select-none"
            style={{
              fontSize: Math.max(7, scaleFactor * 3),
              top: mTop * 0.3,
              right: mRight + 4,
            }}
          >
            1
          </span>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/20 rounded-md px-3 py-1.5">
          <span className="font-medium text-foreground">{PAPER_SIZES[pageSetup.paperSize].label}</span>
          <span>•</span>
          <span>{pageSetup.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
          <span>•</span>
          <span>Margens: {pageSetup.marginTop}/{pageSetup.marginBottom}/{pageSetup.marginLeft}/{pageSetup.marginRight} cm</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="w-4 h-4 text-accent" />
            Papel Timbrado / Marca d'Água
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Cabeçalho e rodapé utilizados em Propostas Comerciais, declarações, petições, recursos, planilhas de composição e demais documentos oficiais.
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

      {/* Upload slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderSlot('header', header, headerRef as any, uploadingHeader)}
        {renderSlot('footer', footer, footerRef as any, uploadingFooter)}
      </div>

      {/* Print Preview & Page Setup panel */}
      {showPreview && (
        <div className="border border-border rounded-xl bg-card shadow-md overflow-hidden">
          {/* Toolbar */}
          <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Configurar Página</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={pageSetup.orientation === 'portrait' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'portrait' }))}
              >
                <div className="w-3 h-4 border border-current rounded-[1px]" />
                Retrato
              </Button>
              <Button
                variant={pageSetup.orientation === 'landscape' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => setPageSetup(prev => ({ ...prev, orientation: 'landscape' }))}
              >
                <div className="w-4 h-3 border border-current rounded-[1px]" />
                Paisagem
              </Button>
            </div>
          </div>

          <Tabs value={previewTab} onValueChange={setPreviewTab} className="w-full">
            <div className="px-4 pt-2 border-b border-border/50">
              <TabsList className="h-8 bg-muted/30">
                <TabsTrigger value="preview" className="text-xs gap-1.5 h-7">
                  <Eye className="w-3.5 h-3.5" />
                  Visualizar Impressão
                </TabsTrigger>
                <TabsTrigger value="page" className="text-xs gap-1.5 h-7">
                  <Settings2 className="w-3.5 h-3.5" />
                  Página
                </TabsTrigger>
                <TabsTrigger value="header-footer" className="text-xs gap-1.5 h-7">
                  <FileImage className="w-3.5 h-3.5" />
                  Cabeçalho/Rodapé
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="m-0 p-6 bg-muted/10">
              {renderPagePreview()}
            </TabsContent>

            <TabsContent value="page" className="m-0 p-5">
              {renderPageSetupPanel()}
            </TabsContent>

            <TabsContent value="header-footer" className="m-0 p-5">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ArrowUp className="w-3.5 h-3.5 text-accent" />
                    Cabeçalho
                  </Label>
                  {header.url ? (
                    <div className="flex items-center gap-3 bg-muted/20 rounded-lg p-3 border border-border/40">
                      {isImageUrl(header.url) ? (
                        <img src={header.url} alt="Cabeçalho" className="h-10 max-w-[140px] object-contain rounded bg-white border border-border/30 p-0.5" />
                      ) : (
                        <FileText className="w-8 h-8 text-accent" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-medium">Cabeçalho carregado</p>
                        <p className="text-[10px] text-muted-foreground">Altura reservada: {pageSetup.headerHeight} cm</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => headerRef.current?.click()}>
                        <Upload className="w-3 h-3 mr-1" /> Trocar
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => headerRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1.5 hover:border-accent/50 hover:bg-muted/20 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs font-medium">Enviar cabeçalho</span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, PDF ou Word</span>
                    </button>
                  )}
                  {renderMarginInput('Altura da área do cabeçalho', 'headerHeight')}
                </div>

                <div className="border-t border-border/30" />

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ArrowDown className="w-3.5 h-3.5 text-accent" />
                    Rodapé
                  </Label>
                  {footer.url ? (
                    <div className="flex items-center gap-3 bg-muted/20 rounded-lg p-3 border border-border/40">
                      {isImageUrl(footer.url) ? (
                        <img src={footer.url} alt="Rodapé" className="h-10 max-w-[140px] object-contain rounded bg-white border border-border/30 p-0.5" />
                      ) : (
                        <FileText className="w-8 h-8 text-accent" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-medium">Rodapé carregado</p>
                        <p className="text-[10px] text-muted-foreground">Altura reservada: {pageSetup.footerHeight} cm</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => footerRef.current?.click()}>
                        <Upload className="w-3 h-3 mr-1" /> Trocar
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => footerRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1.5 hover:border-accent/50 hover:bg-muted/20 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs font-medium">Enviar rodapé</span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, PDF ou Word</span>
                    </button>
                  )}
                  {renderMarginInput('Altura da área do rodapé', 'footerHeight')}
                </div>

                {/* Visual indicator */}
                <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    💡 <strong className="text-foreground">Dica:</strong> O cabeçalho e rodapé são posicionados dentro das margens superiores e inferiores da página.
                    Ajuste a altura para garantir que a imagem não sobreponha o conteúdo. Alterne para a aba{' '}
                    <strong className="text-foreground">Visualizar Impressão</strong> para ver o resultado em tempo real.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
