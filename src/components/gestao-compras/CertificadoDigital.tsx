import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  ShieldCheck, Upload, Eye, EyeOff, AlertTriangle,
  CheckCircle2, Loader2, Trash2, Key, HardDrive,
} from 'lucide-react';

type Certificado = {
  id: string;
  tipo: 'A1' | 'A3';
  nome_titular: string | null;
  cnpj_titular: string | null;
  validade: string | null;
  ativo: boolean;
  storage_path: string | null;
};

export default function CertificadoDigital() {
  const { empresaAtiva } = useEmpresa();
  const [certs, setCerts]             = useState<Certificado[]>([]);
  const [loading, setLoading]         = useState(false);
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [senha, setSenha]             = useState('');
  const [showSenha, setShowSenha]     = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCerts() {
    if (!empresaAtiva || loaded) return;
    setLoading(true);
    const { data } = await supabase
      .from('certificados_digitais' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: false });
    setCerts((data ?? []) as Certificado[]);
    setLoaded(true);
    setLoading(false);
  }

  // Lazy load on mount
  useState(() => { loadCerts(); });

  async function handleUpload() {
    if (!file || !empresaAtiva) return;
    if (!senha.trim()) { toast.error('Informe a senha do certificado'); return; }
    setUploading(true);
    try {
      const path = `${empresaAtiva.id}/certificados/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('certificados-digitais')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('certificados_digitais' as never)
        .insert({
          empresa_id:   empresaAtiva.id,
          tipo:         'A1',
          storage_path: path,
          ativo:        true,
        } as never);
      if (dbErr) throw dbErr;

      toast.success('Certificado A1 enviado com sucesso');
      setUploadOpen(false);
      setFile(null);
      setSenha('');
      setLoaded(false);
      loadCerts();
    } catch (err: any) {
      toast.error(`Erro ao enviar certificado: ${err.message ?? 'verifique o arquivo'}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(cert: Certificado) {
    if (cert.storage_path) {
      await supabase.storage.from('certificados-digitais').remove([cert.storage_path]);
    }
    await supabase.from('certificados_digitais' as never).delete().eq('id', cert.id);
    toast.success('Certificado removido');
    setLoaded(false);
    loadCerts();
  }

  const certAtivo = certs.find(c => c.ativo);
  const vencido = certAtivo?.validade && certAtivo.validade < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" /> Adicionar Certificado Digital A1
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-md p-3 text-xs text-blue-800 dark:text-blue-300">
              O arquivo <strong>.pfx</strong> ou <strong>.p12</strong> contém seu certificado digital A1. Ele será armazenado de forma segura e usado para assinar as NFS-e enviadas à Prefeitura.
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Arquivo do certificado (.pfx / .p12)</Label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file
                  ? <p className="text-sm font-medium text-amber-600">{file.name}</p>
                  : <><Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground/50" /><p className="text-xs text-muted-foreground">Clique para selecionar</p></>
                }
              </div>
              <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Senha do certificado</Label>
              <div className="relative mt-1">
                <Input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9 text-sm"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSenha(v => !v)}>
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">A senha não é armazenada — é usada apenas no momento da assinatura.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setUploadOpen(false); setFile(null); setSenha(''); }}>Cancelar</Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!file || !senha || uploading}
              onClick={handleUpload}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Enviar Certificado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" /> Certificado Digital
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Usado para assinar e emitir NFS-e via Prefeitura de Belém (ABRASFv2)
          </p>
        </div>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs"
          onClick={() => setUploadOpen(true)}>
          <Upload className="w-3 h-3 mr-1" /> Adicionar A1
        </Button>
      </div>

      {/* A3 info */}
      <div className="border rounded-lg p-3 flex items-start gap-3 bg-muted/20">
        <HardDrive className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium">Certificado A3 (token/cartão)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Certificados A3 ficam em tokens físicos e não podem ser carregados aqui. Para usá-lo, o sistema irá detectar automaticamente quando o token estiver conectado ao computador no momento da emissão.
          </p>
        </div>
      </div>

      {/* Cert list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : certs.length === 0 ? (
        <div className="border rounded-lg p-6 text-center">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione um certificado A1 para emitir NFS-e automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {certs.map(cert => (
            <div key={cert.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${vencido ? 'bg-red-100 dark:bg-red-950/30' : 'bg-green-100 dark:bg-green-950/30'}`}>
                  {vencido
                    ? <AlertTriangle className="w-4 h-4 text-red-500" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{cert.nome_titular ?? 'Certificado A1'}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Tipo {cert.tipo}</Badge>
                    {vencido && <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-400/60 text-red-500">Vencido</Badge>}
                  </div>
                  {cert.cnpj_titular && <p className="text-[10px] text-muted-foreground">{cert.cnpj_titular}</p>}
                  {cert.validade && <p className="text-[10px] text-muted-foreground">Válido até {new Date(cert.validade).toLocaleDateString('pt-BR')}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(cert)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Belém integration info */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <p className="font-medium">Integração com Prefeitura de Belém (ISSNET/ABRASFv2)</p>
        <p>Endpoint: <code className="text-[10px] bg-amber-100 dark:bg-amber-900/30 px-1 rounded">https://www.issdigital.com.br/WsNFe2/LoteRps.jws</code></p>
        <p className="text-amber-700 dark:text-amber-400">O certificado é usado para assinar o XML RPS antes do envio ao webservice municipal.</p>
      </div>
    </div>
  );
}
