import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, ImageIcon, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimbradoUploaderProps {
  empresaId: string | undefined;
  timbradoUrl: string | null;
  setTimbradoUrl: (url: string | null) => void;
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

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) { toast.error('Use PNG, JPG, WEBP ou SVG.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB.'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${empresaId}/timbrado.${ext}`;

    const { error } = await supabase.storage.from('timbrados').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro: ' + error.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('timbrados').getPublicUrl(path);
    await supabase.from('empresas').update({ timbrado_path: path, timbrado_url: urlData.publicUrl }).eq('id', empresaId);

    setTimbradoUrl(urlData.publicUrl);
    setUploading(false);
    toast.success('Timbrado enviado!');
  };

  const handleRemove = async () => {
    if (!empresaId) return;
    await supabase.from('empresas').update({ timbrado_path: null, timbrado_url: null }).eq('id', empresaId);
    setTimbradoUrl(null);
    toast.success('Timbrado removido.');
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Timbrado da Empresa</Label>

      {timbradoUrl ? (
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          <img src={timbradoUrl} alt="Timbrado" className="h-16 max-w-[200px] object-contain rounded border border-border/50 bg-white p-1" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Timbrado carregado</p>
            <p className="text-xs text-muted-foreground">Será aplicado no cabeçalho</p>
          </div>
          <div className="flex gap-2">
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
          <span className="text-sm font-medium">{uploading ? 'Enviando...' : 'Enviar timbrado'}</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WEBP ou SVG — Máx. 5MB</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleUpload} />
    </div>
  );
}
