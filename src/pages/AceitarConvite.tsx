import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Mail, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';

const equipeLabels: Record<string, string> = {
  geral: 'Geral',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  logistica: 'Logística',
  juridico: 'Jurídico',
  contabil: 'Contábil',
  licitacoes: 'Licitações',
  documentos: 'Documentos',
};

type ConviteStatus = 'loading' | 'invalid' | 'expired' | 'used' | 'valid' | 'success';

interface ConviteData {
  id: string;
  equipe: string;
  papel: string;
  email_setor: string;
  empresa_id: string;
  expires_at: string;
  accepted_at: string | null;
  empresa_nome: string;
}

export default function AceitarConvite() {
  const [status, setStatus] = useState<ConviteStatus>('loading');
  const [convite, setConvite] = useState<ConviteData | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URL(window.location.href).searchParams.get('token');
    if (!token) {
      setStatus('invalid');
      return;
    }

    const fetchConvite = async () => {
      const { data, error } = await (supabase as any)
        .from('empresa_convites')
        .select('id, equipe, papel, email_setor, empresa_id, expires_at, accepted_at, empresas(nome_fantasia, razao_social)')
        .eq('token', token)
        .maybeSingle();

      if (error || !data) {
        setStatus('invalid');
        return;
      }

      if (data.accepted_at) {
        setStatus('used');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setStatus('expired');
        return;
      }

      const emp = data.empresas as { nome_fantasia?: string | null; razao_social?: string | null } | null;
      const empresa_nome = emp?.nome_fantasia || emp?.razao_social || 'sua empresa';

      setConvite({ ...data, empresa_nome });
      setEmail(data.email_setor);
      setStatus('valid');
    };

    fetchConvite();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error('Informe seu nome completo');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Informe um e-mail válido');
      return;
    }
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSubmitting(true);
    try {
      const token = new URL(window.location.href).searchParams.get('token')!;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      const user_id = signUpData.user?.id;
      if (!user_id) {
        toast.error('Erro ao criar conta. Tente novamente.');
        return;
      }

      const { error: acceptError } = await supabase.functions.invoke('accept-sector-invite', {
        body: { token, user_id, email, nome },
      });
      if (acceptError) {
        toast.error((acceptError as any)?.message || 'Erro ao aceitar convite');
        return;
      }

      setStatus('success');
      toast.success('Conta criada com sucesso! Bem-vindo ao PRAEFECTUS.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <PraefectusLogo size="xl" variant="light" />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">
          {status === 'loading' && (
            <div className="text-center space-y-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
              <p className="text-sm text-muted-foreground">Validando convite...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4 py-6">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Convite inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este link de convite não existe ou não é mais válido.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center space-y-4 py-6">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Convite expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este convite expirou. Solicite ao administrador que envie um novo convite.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'used' && (
            <div className="text-center space-y-4 py-6">
              <CheckCircle2 className="w-12 h-12 text-accent mx-auto" />
              <h2 className="text-xl font-bold">Convite já utilizado</h2>
              <p className="text-sm text-muted-foreground">
                Este convite já foi aceito. Acesse sua conta normalmente.
              </p>
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => navigate('/auth')}
              >
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-accent mx-auto" />
              <h2 className="text-xl font-bold">Conta criada!</h2>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          )}

          {status === 'valid' && convite && (
            <>
              <h2 className="text-xl font-bold text-center mb-2">Criar sua conta</h2>
              <p className="text-xs text-muted-foreground text-center mb-1">
                Você foi convidado para
              </p>
              <p className="text-sm font-semibold text-center mb-1">
                {convite.empresa_nome}
              </p>
              <p className="text-xs text-muted-foreground text-center mb-6">
                Setor:{' '}
                <span className="font-medium">
                  {equipeLabels[convite.equipe] ?? convite.equipe}
                </span>
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Seu e-mail pessoal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Criar senha (mín. 8 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Confirmar senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar minha conta
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
