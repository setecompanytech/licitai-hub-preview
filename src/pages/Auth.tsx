import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
        setMode('login');
      }
      return;
    }

    if (mode === 'signup') {
      if (!nome.trim()) {
        toast.error('Informe seu nome completo');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, nome);
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        setMode('login');
      }
      return;
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('E-mail ou senha incorretos');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-dark)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <Zap className="w-6 h-6 text-accent-foreground" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-white">
            Licit<span className="text-accent">IA</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">
          <h2 className="text-xl font-bold text-center mb-1">
            {mode === 'login' && 'Entrar no sistema'}
            {mode === 'signup' && 'Criar sua conta'}
            {mode === 'forgot' && 'Recuperar senha'}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {mode === 'login' && 'Gerencie suas licitações com inteligência artificial'}
            {mode === 'signup' && 'Preencha os dados para começar'}
            {mode === 'forgot' && 'Informe seu e-mail para receber o link de recuperação'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            )}

            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {mode === 'login' && 'Entrar'}
              {mode === 'signup' && 'Criar conta'}
              {mode === 'forgot' && 'Enviar link'}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('forgot')} className="text-accent hover:underline block mx-auto">
                  Esqueceu a senha?
                </button>
                <p className="text-muted-foreground">
                  Não tem conta?{' '}
                  <button onClick={() => setMode('signup')} className="text-accent hover:underline font-medium">
                    Criar conta
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground">
                Já tem conta?{' '}
                <button onClick={() => setMode('login')} className="text-accent hover:underline font-medium">
                  Fazer login
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <button onClick={() => setMode('login')} className="text-accent hover:underline">
                Voltar ao login
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Sistema de Gestão de Licitações Públicas com IA
        </p>
      </div>
    </div>
  );
}
