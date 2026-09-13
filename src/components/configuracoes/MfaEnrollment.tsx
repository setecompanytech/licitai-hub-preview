import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MfaEnrollment() {
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, [user]);

  const checkMfaStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verifiedTOTP = data.totp?.find(f => f.status === 'verified');
      setMfaEnabled(!!verifiedTOTP);
      if (verifiedTOTP) setFactorId(verifiedTOTP.id);
    } catch (err) {
      console.error('Erro ao verificar MFA:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      // Clean up any unverified factors first
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = factors?.totp?.filter(f => (f.status as string) !== 'verified') || [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'PRAEFECTUS App',
      });
      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar configuração do MFA');
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      toast.error('Informe o código de 6 dígitos');
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setMfaEnabled(true);
      setShowEnrollDialog(false);
      setVerifyCode('');
      toast.success('Autenticação em dois fatores ativada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Código inválido. Tente novamente.');
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (!confirm('Tem certeza que deseja desativar a autenticação em dois fatores?')) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setMfaEnabled(false);
      setFactorId('');
      toast.success('MFA desativado com sucesso.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desativar MFA');
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm" role="status" aria-busy="true">
        <span className="sr-only">Carregando verificação em duas etapas</span>
        <Skeleton className="mb-4 h-6 w-64" />
        <Skeleton className="h-12 w-full" />
      </section>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">Autenticação em Dois Fatores (2FA/MFA)</h2>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-base font-medium text-foreground">Verificação por aplicativo (TOTP)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Google Authenticator, Authy ou outro app compatível
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {mfaEnabled ? (
              <>
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Ativo
                </Badge>
                <Button
                  variant="outline"
                  onClick={handleUnenroll}
                  disabled={unenrolling}
                  className="text-destructive hover:text-destructive"
                >
                  {unenrolling ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldOff aria-hidden="true" />}
                  Desativar
                </Button>
              </>
            ) : (
              <>
                <Badge variant="muted">
                  Inativo
                </Badge>
                <Button
                  onClick={handleEnroll}
                  disabled={enrolling}
                >
                  {enrolling ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                  Ativar 2FA
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            A autenticação em dois fatores adiciona uma camada extra de segurança à sua conta, exigindo um código temporário além da senha para acessar o sistema.
          </p>
        </div>
      </section>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Configurar Autenticação em Dois Fatores
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu aplicativo autenticador e insira o código de verificação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <p className="text-base font-medium text-foreground">1. Escaneie o QR Code</p>
              {/* Fundo branco fixo de propósito: o leitor de QR precisa de
                  contraste preto-sobre-branco também no tema escuro. */}
              <div className="flex justify-center rounded-lg bg-white p-4">
                {qrCode && <img src={qrCode} alt="QR Code MFA" className="h-48 w-48" />}
              </div>
            </div>

            {/* Manual entry */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ou insira o código manualmente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {secret}
                </code>
                <Button variant="ghost" size="icon" onClick={copySecret} className="shrink-0" aria-label="Copiar código">
                  {copied ? <CheckCircle2 className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </Button>
              </div>
            </div>

            {/* Step 2: Verify */}
            <div className="space-y-3">
              <Label htmlFor="mfa-codigo" className="text-base font-medium">2. Insira o código de verificação</Label>
              <Input
                id="mfa-codigo"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
                maxLength={6}
                inputMode="numeric"
                autoFocus
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={verifying || verifyCode.length !== 6}
              className="w-full"
            >
              {verifying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
              Verificar e Ativar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
