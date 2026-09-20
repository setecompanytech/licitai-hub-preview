import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import BotaoVoltar from '@/components/layout/BotaoVoltar';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import {
  ShieldCheck, Upload, Loader2, CheckCircle2, XCircle,
  Clock, Lock, Eye, EyeOff, Building2,
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
    /* Página isolada (fora do AppLayout): fundo da página, cabeçalho com a
       marca e um cartão padrão. Só apresentação — o envio e o tratamento da
       senha do certificado não mudaram. */
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <BotaoVoltar />
        {/* Header */}
        <header className="mb-6">
          <PraefectusLogo className="mb-4 h-10" />
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">Upload Seguro de Certificado Digital</h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Painel isolado — seu certificado será armazenado em container criptografado
          </p>
        </header>

        <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          {status === 'loading' && (
            /* Espera na forma do formulário que vai aparecer; o texto fica para o leitor de tela. */
            <div role="status" aria-busy="true" className="space-y-6">
              <span className="sr-only">Validando link...</span>
              <Skeleton className="h-[72px] w-full" />
              <div className="space-y-4">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-[88px] w-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-64 max-w-full" />
              </div>
            </div>
          )}

          {/* Estados terminais do link em Alert semântico: erro em vermelho,
              expirado em âmbar, já utilizado em verde — sempre com o texto. */}
          {status === 'invalid' && (
            <Alert variant="destructive">
              <XCircle aria-hidden="true" />
              <AlertTitle>Link Inválido</AlertTitle>
              <AlertDescription>
                Este link de upload não é válido. Solicite um novo link através do painel do Agente Cloud.
              </AlertDescription>
            </Alert>
          )}

          {status === 'expired' && (
            <Alert variant="warning">
              <Clock aria-hidden="true" />
              <AlertTitle>Link Expirado</AlertTitle>
              <AlertDescription>
                Este link expirou em{' '}
                {tokenInfo?.expires_at && new Date(tokenInfo.expires_at).toLocaleString('pt-BR')}.
                Solicite um novo link no painel do Agente Cloud.
              </AlertDescription>
            </Alert>
          )}

          {status === 'used' && (
            <Alert variant="success">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Certificado Já Enviado</AlertTitle>
              <AlertDescription>
                Este link já foi utilizado para enviar um certificado. Caso precise reenviar, solicite um novo link.
              </AlertDescription>
            </Alert>
          )}

          {status === 'valid' && !uploaded && (
            <>
              {/* Empresa info — ladrilho neutro, eyebrow e razão social 14/600. */}
              {tokenInfo?.empresa && (
                <div className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Empresa vinculada
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-foreground">{tokenInfo.empresa.razao_social}</p>
                    <p className="text-sm text-muted-foreground">CNPJ: {tokenInfo.empresa.cnpj}</p>
                  </div>
                </div>
              )}

              {/* Expiry warning */}
              <Alert variant="warning">
                <Clock aria-hidden="true" />
                <AlertDescription>
                  Link expira em:{' '}
                  <strong>
                    {tokenInfo?.expires_at && new Date(tokenInfo.expires_at).toLocaleString('pt-BR')}
                  </strong>
                </AlertDescription>
              </Alert>

              {/* Upload form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-arquivo">Certificado Digital (.pfx ou .p12) *</Label>
                  {/* Zona de upload: tracejado na borda de campo, ladrilho com o
                      ícone; o campo fica só para o leitor de tela (`sr-only`,
                      não `hidden`) para continuar focável pelo teclado. */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-card p-6 transition-colors duration-150 hover:border-primary/40 hover:bg-primary-tint focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <input
                      id="cert-arquivo"
                      type="file"
                      accept=".pfx,.p12"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file ? (
                      <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success-tint text-success-ink">
                          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Upload className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">
                            Clique para selecionar o arquivo
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Apenas .pfx ou .p12 — máximo 10MB
                          </span>
                        </span>
                      </>
                    )}
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cert-senha">Senha do Certificado *</Label>
                  <div className="relative">
                    <Input
                      id="cert-senha"
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Informe a senha do certificado"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A senha é necessária para que o agente autentique nos portais
                  </p>
                </div>
              </div>

              {/* Security notice */}
              <Alert variant="success">
                <Lock aria-hidden="true" />
                <AlertTitle>Garantias de segurança</AlertTitle>
                <AlertDescription>
                  <ul className="space-y-1">
                    <li>• Armazenamento em container Docker isolado e criptografado</li>
                    <li>• Acesso exclusivo ao agente da sua empresa</li>
                    <li>• Certificado deletado permanentemente ao cancelar o plano</li>
                    <li>• Toda utilização registrada com IP e timestamp</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Rodapé de ação, à direita. */}
              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  onClick={handleUpload}
                  disabled={!file || !senha || uploading}
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck aria-hidden="true" />
                  )}
                  Enviar Certificado com Segurança
                </Button>
              </div>
            </>
          )}

          {uploaded && (
            <div className="space-y-4">
              <Alert variant="success">
                <CheckCircle2 aria-hidden="true" />
                <AlertTitle>Certificado Recebido com Segurança</AlertTitle>
                <AlertDescription>
                  Seu certificado digital foi recebido e vinculado à sua empresa.
                  Ele será utilizado para autenticação nos portais de licitação.
                </AlertDescription>
              </Alert>
              <div className="rounded-md bg-secondary p-4 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Próximos passos:</strong></p>
                <p className="mt-1">Acesse o painel <strong>Robô de Lances → Checklist de Ativação</strong> para verificar o status do certificado. Ele será automaticamente reconhecido pelo sistema.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-muted-foreground">
          Conexão segura via HTTPS • Armazenamento protegido • Em conformidade com a LGPD
        </p>
      </div>
    </div>
  );
}
