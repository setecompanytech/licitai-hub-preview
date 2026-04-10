import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Upload, Download, FileText, Trash2, Pencil, Loader2, File, Eye
} from 'lucide-react';

const TIPOS_ARQUIVO: Record<string, { label: string; color: string }> = {
  contrato_original: { label: 'Contrato Original', color: 'bg-primary/10 text-primary' },
  aditivo_valor: { label: 'Aditivo de Valor', color: 'bg-success/10 text-success' },
  aditivo_quantidade: { label: 'Aditivo de Quantidade', color: 'bg-accent/10 text-accent' },
  aditivo_prazo: { label: 'Aditivo de Prazo', color: 'bg-warning/10 text-warning' },
  outro: { label: 'Outro Documento', color: 'bg-muted text-muted-foreground' },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContratoArquivos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; arquivo: any | null }>({ open: false, arquivo: null });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTipo, setEditTipo] = useState('contrato_original');
  const [editDescricao, setEditDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [uploadTipo, setUploadTipo] = useState('contrato_original');

  const loadArquivos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contrato_arquivos')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false });
    setArquivos((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadArquivos(); }, [contratoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('contratos-docs')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('contrato_arquivos').insert({
        contrato_id: contratoId,
        user_id: user.id,
        nome_arquivo: file.name,
        storage_path: path,
        tipo: uploadTipo,
        tamanho_bytes: file.size,
      } as any);

      if (dbError) throw dbError;

      toast.success('Arquivo enviado com sucesso!');
      loadArquivos();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar arquivo', { description: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownload = async (arquivo: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('contratos-docs')
        .download(arquivo.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erro ao baixar arquivo', { description: err.message });
    }
  };

  const handleDelete = async (arquivo: any) => {
    if (!confirm('Excluir este arquivo permanentemente?')) return;
    try {
      await supabase.storage.from('contratos-docs').remove([arquivo.storage_path]);
      await supabase.from('contrato_arquivos').delete().eq('id', arquivo.id);
      toast.success('Arquivo excluído');
      loadArquivos();
    } catch (err: any) {
      toast.error('Erro ao excluir', { description: err.message });
    }
  };

  const openEdit = (arquivo: any) => {
    setEditDialog({ open: true, arquivo });
    setEditTipo(arquivo.tipo);
    setEditDescricao(arquivo.descricao || '');
    setEditFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editDialog.arquivo || !user) return;
    setSaving(true);
    try {
      let newPath = editDialog.arquivo.storage_path;
      let newName = editDialog.arquivo.nome_arquivo;
      let newSize = editDialog.arquivo.tamanho_bytes;

      // If a new file was selected, replace it
      if (editFile) {
        // Remove old file
        await supabase.storage.from('contratos-docs').remove([editDialog.arquivo.storage_path]);

        // Upload new file
        const ext = editFile.name.split('.').pop() || 'pdf';
        newPath = `${user.id}/${contratoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('contratos-docs').upload(newPath, editFile);
        if (upErr) throw upErr;

        newName = editFile.name;
        newSize = editFile.size;
      }

      const { error } = await supabase.from('contrato_arquivos').update({
        tipo: editTipo,
        descricao: editDescricao || null,
        storage_path: newPath,
        nome_arquivo: newName,
        tamanho_bytes: newSize,
      } as any).eq('id', editDialog.arquivo.id);

      if (error) throw error;

      toast.success('Arquivo atualizado!');
      setEditDialog({ open: false, arquivo: null });
      loadArquivos();
    } catch (err: any) {
      toast.error('Erro ao atualizar', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs font-semibold mb-1 block">Tipo do Documento</Label>
            <Select value={uploadTipo} onValueChange={setUploadTipo}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_ARQUIVO).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              size="sm"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar Arquivo
            </Button>
          </div>
        </div>
      </Card>

      {/* File list */}
      {arquivos.length === 0 ? (
        <Card className="p-8 text-center">
          <File className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum documento anexado a este contrato</p>
          <p className="text-xs text-muted-foreground mt-1">Envie o contrato original, aditivos e outros documentos relevantes.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {arquivos.map((arq) => {
            const tipoConfig = TIPOS_ARQUIVO[arq.tipo] || TIPOS_ARQUIVO.outro;
            return (
              <Card key={arq.id} className="p-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{arq.nome_arquivo}</span>
                    <Badge className={`text-[9px] ${tipoConfig.color}`}>{tipoConfig.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatBytes(arq.tamanho_bytes)}</span>
                    <span>{new Date(arq.created_at).toLocaleDateString('pt-BR')}</span>
                    {arq.descricao && <span className="truncate">{arq.descricao}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(arq)} title="Baixar">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(arq)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(arq)} title="Excluir">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialog.open} onOpenChange={(v) => setEditDialog({ open: v, arquivo: v ? editDialog.arquivo : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Tipo do Documento</Label>
              <Select value={editTipo} onValueChange={setEditTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_ARQUIVO).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} placeholder="Ex: 1º Aditivo de Prazo" />
            </div>
            <div>
              <Label className="text-xs">Substituir arquivo</Label>
              <div className="mt-1">
                <input
                  ref={editFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
                <Button variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  {editFile ? editFile.name : 'Selecionar novo arquivo'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter o arquivo atual.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialog({ open: false, arquivo: null })}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
