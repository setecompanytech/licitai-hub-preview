import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <PraefectusLogo size="xl" variant="light" />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">
          {verifying ? (
            <div className="text-center space-y-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validando link...</p>
            </div>
          ) : success ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">Senha alterada!</h2>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : pendingTokenHash ? (
            <div className="text-center space-y-5 py-2">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <h2 className="text-xl font-bold mb-1">
                  {isInvite ? 'Confirmar convite' : 'Confirmar acesso'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isInvite
                    ? 'Clique no botão abaixo para confirmar seu convite e criar sua senha de acesso.'
                    : 'Clique no botão abaixo para validar seu link e redefinir sua senha.'}
                </p>
              </div>
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isInvite ? 'Confirmar convite e criar senha' : 'Confirmar e redefinir senha'}
              </Button>
            </div>
          ) : canReset ? (
            <>
              <h2 className="text-xl font-bold text-center mb-2">
                {isInvite ? 'Bem-vindo! Crie sua senha' : 'Definir nova senha'}
              </h2>
              <p className="text-xs text-muted-foreground text-center mb-6">
                {isInvite
                  ? 'Defina uma senha para acessar sua conta no PRAEFECTUS.'
                  : 'Escolha uma nova senha para sua conta.'}
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder={isInvite ? 'Crie uma senha' : 'Nova senha'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} autoFocus />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Confirmar senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isInvite ? 'Criar senha e acessar' : 'Salvar nova senha'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-3 py-6">
              <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
