import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
      const unverified = factors?.totp?.filter(f => f.status === 'unverified') || [];
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
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold">Autenticação em Dois Fatores (2FA/MFA)</h2>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">Verificação por aplicativo (TOTP)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use Google Authenticator, Authy ou outro app compatível
            </p>
          </div>
          <div className="flex items-center gap-3">
            {mfaEnabled ? (
              <>
                <Badge className="bg-success/10 text-success border-success/20">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Ativo
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnenroll}
                  disabled={unenrolling}
                  className="text-destructive hover:text-destructive"
                >
                  {unenrolling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ShieldOff className="w-3 h-3 mr-1" />}
                  Desativar
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Inativo
                </Badge>
                <Button
                  size="sm"
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {enrolling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                  Ativar 2FA
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/30">
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
              <Shield className="w-5 h-5 text-accent" />
              Configurar Autenticação em Dois Fatores
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu aplicativo autenticador e insira o código de verificação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <p className="text-sm font-medium">1. Escaneie o QR Code</p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {qrCode && <img src={qrCode} alt="QR Code MFA" className="w-48 h-48" />}
              </div>
            </div>

            {/* Manual entry */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ou insira o código manualmente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                  {secret}
                </code>
                <Button variant="ghost" size="icon" onClick={copySecret} className="flex-shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Step 2: Verify */}
            <div className="space-y-3">
              <p className="text-sm font-medium">2. Insira o código de verificação</p>
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
                autoFocus
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={verifying || verifyCode.length !== 6}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Verificar e Ativar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
