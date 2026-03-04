import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, ImageIcon, X, Loader2, FileText, Eye } from 'lucide-react';
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

export default function TimbradoUploader({ empresaId, timbradoUrl, setTimbradoUrl }: TimbradoUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from('empresas').select('timbrado_url').eq('id', empresaId).single()
      .then(({ data }) => setTimbradoUrl(data?.timbrado_url ?? null));
  }, [empresaId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
      toast.error('Formato inválido. Use PNG, JPG, WEBP, SVG, PDF ou Word (DOC/DOCX).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB.'); return; }

    setUploading(true);
    const path = `${empresaId}/timbrado${ext}`;

    const { error } = await supabase.storage.from('timbrados').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro: ' + error.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('timbrados').getPublicUrl(path);
    await supabase.from('empresas').update({ timbrado_path: path, timbrado_url: urlData.publicUrl }).eq('id', empresaId);

    setTimbradoUrl(urlData.publicUrl);
    setUploading(false);
    toast.success('Timbrado enviado com sucesso!');
  };

  const handleRemove = async () => {
    if (!empresaId) return;
    await supabase.from('empresas').update({ timbrado_path: null, timbrado_url: null }).eq('id', empresaId);
    setTimbradoUrl(null);
    toast.success('Timbrado removido.');
  };

  const fileName = timbradoUrl ? decodeURIComponent(timbradoUrl.split('/').pop() || '') : '';

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-accent" /> Papel Timbrado / Marca d'Água</Label>
      <p className="text-xs text-muted-foreground">
        Será utilizado como cabeçalho e marca d'água na Proposta Comercial, declarações, petições, recursos, contrarrazões e demais documentos oficiais.
      </p>

      {timbradoUrl ? (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          {isImageUrl(timbradoUrl) ? (
            <img src={timbradoUrl} alt="Timbrado" className="h-16 max-w-[200px] object-contain rounded border border-border/50 bg-white p-1" />
          ) : (
            <div className="h-16 w-16 rounded border border-border/50 bg-white flex items-center justify-center">
              <FileText className="w-8 h-8 text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Timbrado carregado</p>
            <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          </div>
          <div className="flex gap-2">
            {timbradoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={timbradoUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-4 h-4 mr-1" /> Ver
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Trocar
            </Button>
            <Button variant="outline" size="sm" onClick={handleRemove} className="text-destructive hover:text-destructive">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !empresaId}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-8 h-8 animate-spin text-accent" /> : <Upload className="w-8 h-8 text-muted-foreground" />}
          <span className="text-sm font-medium">{uploading ? 'Enviando...' : 'Enviar papel timbrado'}</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WEBP, SVG, PDF ou Word (DOC/DOCX) — Máx. 10MB</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.doc,.docx"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
