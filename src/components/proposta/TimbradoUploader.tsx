import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, ImageIcon, X, Loader2, FileText, Eye, ArrowUp, ArrowDown, Printer } from 'lucide-react';
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

export default function TimbradoUploader({ empresaId, timbradoUrl, setTimbradoUrl }: TimbradoUploaderProps) {
  const headerRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
  const [header, setHeader] = useState<UploadSlot>({ url: null, path: null });
  const [footer, setFooter] = useState<UploadSlot>({ url: null, path: null });
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from('empresas')
      .select('timbrado_url, timbrado_path, cabecalho_url, cabecalho_path, rodape_url, rodape_path')
      .eq('id', empresaId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        // Migrate legacy: if old timbrado exists but no cabecalho, use it as header
        const hUrl = (data as any).cabecalho_url || data.timbrado_url || null;
        const hPath = (data as any).cabecalho_path || data.timbrado_path || null;
        const fUrl = (data as any).rodape_url || null;
        const fPath = (data as any).rodape_path || null;
        setHeader({ url: hUrl, path: hPath });
        setFooter({ url: fUrl, path: fPath });
        setTimbradoUrl(hUrl);
      });
  }, [empresaId]);

  const handleUpload = async (
    file: File,
    slot: 'header' | 'footer',
  ) => {
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
    // Keep legacy field in sync with header
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
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
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
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" asChild>
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Trocar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRemove(slot)} className="text-destructive hover:text-destructive">
                <X className="w-3.5 h-3.5" />
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
        {(header.url || footer.url) && (
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1.5">
            <Printer className="w-4 h-4" />
            {showPreview ? 'Fechar Prévia' : 'Visualizar Impressão'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderSlot('header', header, headerRef as any, uploadingHeader)}
        {renderSlot('footer', footer, footerRef as any, uploadingFooter)}
      </div>

      {/* Print preview — similar to Excel Page Setup */}
      {showPreview && (
        <div className="border border-border rounded-lg bg-white shadow-md overflow-hidden">
          <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-2">
            <Printer className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Visualização de Impressão — Configurar Página</span>
          </div>
          <div className="p-6 flex flex-col items-center">
            {/* Page simulation */}
            <div
              className="w-full max-w-[500px] border border-border/80 shadow-sm bg-white flex flex-col"
              style={{ aspectRatio: '210 / 297', minHeight: 400 }}
            >
              {/* Header area */}
              <div className="border-b border-dashed border-border/50 p-3 flex items-center justify-center min-h-[60px] bg-muted/10">
                {header.url ? (
                  isImageUrl(header.url) ? (
                    <img src={header.url} alt="Cabeçalho" className="max-h-[60px] max-w-full object-contain" />
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs">Cabeçalho (documento)</span>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic">Sem cabeçalho</span>
                )}
              </div>

              {/* Content area */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center gap-2">
                <div className="w-3/4 h-2 bg-muted/30 rounded" />
                <div className="w-full h-2 bg-muted/20 rounded" />
                <div className="w-full h-2 bg-muted/20 rounded" />
                <div className="w-5/6 h-2 bg-muted/20 rounded" />
                <div className="w-full h-2 bg-muted/20 rounded mt-3" />
                <div className="w-2/3 h-2 bg-muted/20 rounded" />
                <div className="w-full h-2 bg-muted/20 rounded" />
                <div className="w-4/5 h-2 bg-muted/20 rounded" />
              </div>

              {/* Footer area */}
              <div className="border-t border-dashed border-border/50 p-3 flex items-center justify-center min-h-[50px] bg-muted/10">
                {footer.url ? (
                  isImageUrl(footer.url) ? (
                    <img src={footer.url} alt="Rodapé" className="max-h-[50px] max-w-full object-contain" />
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs">Rodapé (documento)</span>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic">Sem rodapé</span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">A4 · Margens: 3cm (sup./esq.) · 2cm (inf./dir.) · NBR 14724</p>
          </div>
        </div>
      )}
    </div>
  );
}
