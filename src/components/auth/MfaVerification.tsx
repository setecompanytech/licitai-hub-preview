import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import MolduraAcesso from '@/components/auth/MolduraAcesso';

interface MfaVerificationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaVerification({ onSuccess, onCancel }: MfaVerificationProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
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
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : 'Código inválido. Tente novamente.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <MolduraAcesso>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao login
      </button>

      <div className="mt-8">
        <h1 ref={tituloRef} tabIndex={-1} className="font-heading text-[1.75rem] font-bold leading-9 text-foreground outline-none">
          Verificação em dois fatores
        </h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Insira o código de 6 dígitos do seu aplicativo autenticador para continuar.
        </p>

        <form onSubmit={handleVerify} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="mfaCodigo">Código de verificação</Label>
            <Input
              id="mfaCodigo"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" className="w-full" disabled={verifying || code.length !== 6} aria-busy={verifying || undefined}>
            {verifying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Shield aria-hidden="true" />}
            Verificar
          </Button>
        </form>

        <p className="mt-4 text-xs leading-4 text-muted-foreground">
          Use o Google Authenticator, Authy ou outro app TOTP compatível.
        </p>
      </div>
    </MolduraAcesso>
  );
}
