import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import {
  ShieldCheck, Upload, Loader2, CheckCircle2, XCircle,
  Clock, Lock, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';

type TokenInfo = {
  id: string;
  empresa_id: string;
  expires_at: string;
  used_at: string | null;
  empresa?: { razao_social: string; cnpj: string };
};

export default function CertificadoUpload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'used' | 'invalid'>('loading');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from('cert_upload_tokens' as any)
        .select('id, empresa_id, expires_at, used_at')
        .eq('token', token!)
        .single();

      if (error || !data) {
        setStatus('invalid');
        return;
      }

      const info = data as any as TokenInfo;

      if (info.used_at) {
        setStatus('used');
        setTokenInfo(info);
        return;
      }

      if (new Date(info.expires_at) < new Date()) {
        setStatus('expired');
        setTokenInfo(info);
        return;
      }

      // Get empresa info
      const { data: empresa } = await supabase
        .from('empresas')
        .select('razao_social, cnpj')
        .eq('id', info.empresa_id)
        .single();

      info.empresa = empresa as any;
      setTokenInfo(info);
      setStatus('valid');
    } catch {
      setStatus('invalid');
    }
  };

  const handleUpload = async () => {
    if (!file || !senha || !tokenInfo || !token) return;

    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error('Apenas arquivos .pfx ou .p12 são aceitos.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 10MB).');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('senha', senha);
      formData.append('file', file);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/upload-certificado`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar certificado.');
      }

      setUploaded(true);
      toast.success('Certificado enviado com sucesso!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Erro ao enviar certificado.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <PraefectusLogo className="h-10 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Upload Seguro de Certificado Digital</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel isolado — seu certificado será armazenado em container criptografado
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-lg p-6 space-y-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Validando link...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <XCircle className="w-12 h-12 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Link Inválido</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Este link de upload não é válido. Solicite um novo link através do painel do Agente Cloud.
              </p>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <Clock className="w-12 h-12 text-warning" />
              <h2 className="text-lg font-semibold text-foreground">Link Expirado</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Este link expirou em{' '}
                {tokenInfo?.expires_at && new Date(tokenInfo.expires_at).toLocaleString('pt-BR')}.
                Solicite um novo link no painel do Agente Cloud.
              </p>
            </div>
          )}

          {status === 'used' && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-success" />
              <h2 className="text-lg font-semibold text-foreground">Certificado Já Enviado</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Este link já foi utilizado para enviar um certificado. Caso precise reenviar, solicite um novo link.
              </p>
            </div>
          )}

          {status === 'valid' && !uploaded && (
            <>
              {/* Empresa info */}
              {tokenInfo?.empresa && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">
                    Empresa vinculada
                  </p>
                  <p className="text-sm font-bold text-foreground">{tokenInfo.empresa.razao_social}</p>
                  <p className="text-xs text-muted-foreground">CNPJ: {tokenInfo.empresa.cnpj}</p>
                </div>
              )}

              {/* Expiry warning */}
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-3">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Link expira em:{' '}
                  <strong>
                    {tokenInfo?.expires_at && new Date(tokenInfo.expires_at).toLocaleString('pt-BR')}
                  </strong>
                </span>
              </div>

              {/* Upload form */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">Certificado Digital (.pfx ou .p12) *</Label>
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      {file ? (
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-success" />
                          <span className="text-sm font-medium text-foreground">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Clique para selecionar o arquivo
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Apenas .pfx ou .p12 — máximo 10MB
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Senha do Certificado *</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Informe a senha do certificado"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A senha é necessária para que o agente autentique nos portais
                  </p>
                </div>
              </div>

              {/* Security notice */}
              <div className="bg-success/10 border border-success/20 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Garantias de segurança
                </p>
                <ul className="text-[11px] text-success/80 space-y-1 ml-5">
                  <li>• Armazenamento em container Docker isolado e criptografado</li>
                  <li>• Acesso exclusivo ao agente da sua empresa</li>
                  <li>• Certificado deletado permanentemente ao cancelar o plano</li>
                  <li>• Toda utilização registrada com IP e timestamp</li>
                </ul>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || !senha || uploading}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Enviar Certificado com Segurança
              </Button>
            </>
          )}

          {uploaded && (
            <div className="flex flex-col items-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Certificado Recebido com Segurança</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Seu certificado digital foi recebido e vinculado à sua empresa.
                Ele será utilizado para autenticação nos portais de licitação.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground max-w-sm">
                <p><strong>Próximos passos:</strong></p>
                <p className="mt-1">Você receberá uma confirmação por e-mail quando o certificado estiver ativo e pronto para uso nas disputas eletrônicas.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-6">
          Conexão segura via HTTPS • Armazenamento protegido • Em conformidade com a LGPD
        </p>
      </div>
    </div>
  );
}
