import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import MolduraAcesso from '@/components/auth/MolduraAcesso';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [isInvite, setIsInvite] = useState(false);

  // Format 3: token_hash detected — show "Confirmar" button instead of auto-consuming
  const [pendingTokenHash, setPendingTokenHash] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash || '';
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

        const errorDescription = hashParams.get('error_description') || url.searchParams.get('error_description');
        if (errorDescription) throw new Error(decodeURIComponent(errorDescription));

        // Format 1 (PKCE): ?code=XXXX
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) {
            setCanReset(true);
            window.history.replaceState({}, '', '/reset-password');
          }
          return;
        }

        // Format 2 (legacy hash): #access_token=...&type=recovery|invite
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        if (accessToken && refreshToken && (hashType === 'recovery' || hashType === 'invite' || hashType === 'signup')) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          if (!cancelled) {
            if (hashType === 'invite' || hashType === 'signup') setIsInvite(true);
            setCanReset(true);
            window.history.replaceState({}, '', '/reset-password');
          }
          return;
        }

        // Format 3 (token_hash): ?token_hash=...&type=...
        // NÃO consome o token aqui — exibe botão "Confirmar acesso" para que
        // apenas um clique humano real consuma o token de uso único.
        // Scanners de e-mail (mesmo com JS completo) não clicam em botões.
        const tokenHash = url.searchParams.get('token_hash');
        const queryType = url.searchParams.get('type');
        if (tokenHash && queryType) {
          if (!cancelled) {
            if (queryType === 'invite' || queryType === 'signup') setIsInvite(true);
            setPendingTokenHash(tokenHash);
            setPendingType(queryType);
            window.history.replaceState({}, '', '/reset-password');
          }
          return;
        }

        // Nenhum token no URL — verifica se já existe sessão ativa
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (!cancelled) setCanReset(true);
        } else {
          throw new Error('Link de acesso inválido ou expirado. Solicite um novo convite.');
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || 'Link inválido. Solicite uma nova recuperação.');
          setTimeout(() => navigate('/auth'), 2500);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleConfirm = async () => {
    if (!pendingTokenHash || !pendingType) return;
    setConfirming(true);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: pendingTokenHash,
      type: pendingType as 'recovery' | 'invite' | 'signup' | 'email_change' | 'magiclink',
    });
    setConfirming(false);
    if (error) {
      toast.error('Link expirado ou já utilizado. Solicite um novo convite ao administrador.');
      setTimeout(() => navigate('/auth'), 2500);
    } else {
      setPendingTokenHash(null);
      setPendingType(null);
      setCanReset(true);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('As senhas não coincidem'); return; }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => navigate('/dashboard'), 1500);
    }
  };

  // Régua v3 das telas de acesso: título 24/600 e os avisos de estado com o
  // ícone num ladrilho tingido (trio tint/ink), no lugar do ícone solto.
  const classeTitulo = 'text-3xl font-semibold leading-8 tracking-tight text-foreground';
  const classeAviso = 'flex flex-col items-center gap-3 py-4 text-center';
  const classeLadrilho = 'inline-flex h-14 w-14 items-center justify-center rounded-full [&>svg]:h-7 [&>svg]:w-7';

  return (
    <MolduraAcesso>
        <div>
          {verifying ? (
            /* A espera na forma do formulário que vai chegar (manual §5); o
               texto segue existindo, para o leitor de tela. */
            <div role="status" aria-live="polite" className="space-y-4">
              <span className="sr-only">Validando link...</span>
              <Skeleton className="h-8 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : success ? (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-success-tint text-success-ink`}>
                <CheckCircle2 />
              </span>
              <h2 className={classeTitulo}>Senha alterada!</h2>
              <p className="text-sm leading-5 text-muted-foreground">Redirecionando...</p>
            </div>
          ) : pendingTokenHash ? (
            <div className={classeAviso}>
              <span aria-hidden="true" className={`${classeLadrilho} bg-primary-tint text-primary`}>
                <ShieldCheck />
              </span>
              <div>
                <h2 className={classeTitulo}>
                  {isInvite ? 'Confirmar convite' : 'Confirmar acesso'}
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {isInvite
                    ? 'Clique no botão abaixo para confirmar seu convite e criar sua senha de acesso.'
                    : 'Clique no botão abaixo para validar seu link e redefinir sua senha.'}
                </p>
              </div>
              <Button
                size="lg"
                className="mt-2 w-full"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {isInvite ? 'Confirmar convite e criar senha' : 'Confirmar e redefinir senha'}
              </Button>
            </div>
          ) : canReset ? (
            <>
              <h2 className={classeTitulo}>
                {isInvite ? 'Bem-vindo! Crie sua senha' : 'Definir nova senha'}
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                {isInvite
                  ? 'Defina uma senha para acessar sua conta no Praefectus.'
                  : 'Escolha uma nova senha para sua conta.'}
              </p>
              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <div className="relative">
                  <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" placeholder={isInvite ? 'Crie uma senha' : 'Nova senha'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} autoFocus />
                </div>
                <div className="relative">
                  <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" placeholder="Confirmar senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {isInvite ? 'Criar senha e acessar' : 'Salvar nova senha'}
                </Button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm leading-5 text-muted-foreground">Redirecionando para o login...</p>
            </div>
          )}
        </div>
    </MolduraAcesso>
  );
}
