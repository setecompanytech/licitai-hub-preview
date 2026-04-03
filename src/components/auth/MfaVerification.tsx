import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

interface MfaVerificationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaVerification({ onSuccess, onCancel }: MfaVerificationProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Informe o código de 6 dígitos');
      return;
    }

    setVerifying(true);
    try {
      // Get the verified TOTP factor
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp?.find(f => f.status === 'verified');
      if (!totpFactor) {
        toast.error('Nenhum fator MFA encontrado');
        onCancel();
        return;
      }

      // Create challenge and verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Código inválido. Tente novamente.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <PraefectusLogo size="xl" variant="light" />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold">Verificação em Dois Fatores</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Insira o código de 6 dígitos do seu aplicativo autenticador para continuar.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center text-3xl tracking-[0.5em] font-mono h-14"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
            />
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={verifying || code.length !== 6}
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Verificar
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Use o Google Authenticator, Authy ou outro app TOTP compatível.
          </p>
        </div>
      </div>
    </div>
  );
}
