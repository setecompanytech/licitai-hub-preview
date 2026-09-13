import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
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
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCerts() {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data } = await supabase
      .from('certificados_digitais' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: false });
    setCerts((data ?? []) as Certificado[]);
    setLoading(false);
  }

  useEffect(() => { loadCerts(); }, [empresaAtiva?.id]);

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
    loadCerts();
  }

  const certAtivo = certs.find(c => c.ativo);
  const vencido = certAtivo?.validade && certAtivo.validade < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Adicionar Certificado Digital A1
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Alert variant="info">
              <AlertDescription>
                O arquivo <strong>.pfx</strong> ou <strong>.p12</strong> contém seu certificado digital A1. Ele será armazenado de forma segura e usado para assinar as NFS-e enviadas à Prefeitura.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Arquivo do certificado (.pfx / .p12)</Label>
              <div
                className="mt-1 rounded-lg border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary hover:bg-primary-tint transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file
                  ? <p className="text-sm font-medium text-foreground">{file.name}</p>
                  : <><Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" aria-hidden="true" /><p className="text-xs text-muted-foreground">Clique para selecionar</p></>
                }
              </div>
              <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <Label htmlFor="cert-senha">Senha do certificado</Label>
              <div className="relative mt-1">
                <Input
                  id="cert-senha"
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="sm" aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSenha(v => !v)}>
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">A senha não é armazenada — é usada apenas no momento da assinatura.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setUploadOpen(false); setFile(null); setSenha(''); }}>Cancelar</Button>
            <Button
              disabled={!file || !senha || uploading}
              onClick={handleUpload}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Enviar Certificado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Certificado Digital
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Usado para assinar e emitir NFS-e via Prefeitura de Belém (ABRASFv2)
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4" /> Adicionar A1
        </Button>
      </div>

      {/* A3 info */}
      <Alert variant="info">
        <HardDrive className="w-5 h-5" aria-hidden="true" />
        <AlertTitle>Certificado A3 (token/cartão)</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Certificados A3 ficam em tokens físicos e não podem ser carregados aqui. Para usá-lo, o sistema irá detectar automaticamente quando o token estiver conectado ao computador no momento da emissão.
        </AlertDescription>
      </Alert>

      {/* Cert list */}
      {loading ? (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">Carregando</span>
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : certs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<ShieldCheck />}
            titulo="Nenhum certificado cadastrado"
            descricao="Adicione um certificado A1 para emitir NFS-e automaticamente."
            acao={<Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4" /> Adicionar A1</Button>}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {certs.map(cert => (
            <div key={cert.id} className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${vencido ? 'bg-destructive-tint text-destructive-ink' : 'bg-success-tint text-success-ink'}`}>
                  {vencido
                    ? <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{cert.nome_titular ?? 'Certificado A1'}</span>
                    <Badge variant="info">Tipo {cert.tipo}</Badge>
                    {vencido ? <Badge variant="danger">Vencido</Badge> : <Badge variant="success">Válido</Badge>}
                  </div>
                  {cert.cnpj_titular && <p className="text-xs text-muted-foreground">{cert.cnpj_titular}</p>}
                  {cert.validade && <p className="text-xs text-muted-foreground">Válido até {new Date(cert.validade).toLocaleDateString('pt-BR')}</p>}
                </div>
              </div>
              <Button variant="ghost" size="sm" aria-label="Remover certificado" className="shrink-0 w-9 px-0" onClick={() => handleDelete(cert)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Belém integration info */}
      <Alert variant="info">
        <AlertTitle>Integração com Prefeitura de Belém (ISSNET/ABRASFv2)</AlertTitle>
        <AlertDescription className="space-y-1 text-muted-foreground">
          <p className="break-all">Endpoint: <code className="font-mono text-xs">https://www.issdigital.com.br/WsNFe2/LoteRps.jws</code></p>
          <p>O certificado é usado para assinar o XML RPS antes do envio ao webservice municipal.</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
