import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type AuthStep = 'escolha' | 'manual' | 'certificado' | 'signup' | 'forgot';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('escolha');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Se já estiver logado, redireciona para a página inicial
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('E-mail ou senha incorretos');
    } else {
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error('Informe seu nome completo'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, nome);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setStep('manual');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('E-mail de recuperação enviado!');
      setStep('manual');
    }
  };

  const backButton = (to: AuthStep = 'escolha') => (
    <button onClick={() => setStep(to)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </button>
  );

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

        <div className="bg-card rounded-2xl border border-border/50 shadow-2xl p-8">

          {/* ===== STEP: ESCOLHA (como Gov.br) ===== */}
          {step === 'escolha' && (
            <>
              <h2 className="text-xl font-bold text-center mb-1">Identifique-se</h2>
              <p className="text-sm text-muted-foreground text-center mb-8">
                Escolha como deseja acessar o sistema
              </p>

              <div className="space-y-3">
                {/* Opção 1: Login com senha */}
                <button
                  onClick={() => setStep('manual')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Login e Senha</p>
                    <p className="text-xs text-muted-foreground">Acesse com seu e-mail e senha cadastrados</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>

                {/* Opção 2: Certificado Digital */}
                <button
                  onClick={() => setStep('certificado')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
                    <ShieldCheck className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Certificado Digital</p>
                    <p className="text-xs text-muted-foreground">Acesse com e-CNPJ ou e-CPF (A1/A3)</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              </div>

              <div className="mt-8 pt-5 border-t border-border/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <button onClick={() => setStep('signup')} className="text-accent hover:underline font-medium">
                    Cadastre-se
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ===== STEP: LOGIN MANUAL ===== */}
          {step === 'manual' && (
            <>
              {backButton()}
              <div className="flex items-center gap-2 mb-5">
                <KeyRound className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Acesso com Login e Senha</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Entrar
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button onClick={() => setStep('forgot')} className="text-sm text-accent hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            </>
          )}

          {/* ===== STEP: CERTIFICADO DIGITAL ===== */}
          {step === 'certificado' && (
            <>
              {backButton()}
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">Acesso com Certificado Digital</h2>
              </div>

              <div className="rounded-lg bg-muted/50 border border-border/50 p-4 mb-5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para acessar via certificado digital, é necessário ter uma conta vinculada. 
                  Se é seu primeiro acesso, <button onClick={() => setStep('signup')} className="text-accent hover:underline font-medium">crie sua conta</button> primeiro 
                  e depois cadastre seus certificados na área de <strong>Empresas</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={() => setStep('manual')} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <KeyRound className="w-4 h-4 mr-2" />
                  Entrar com Login e Senha
                </Button>
                <Button onClick={() => setStep('signup')} variant="outline" className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Criar conta
                </Button>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-accent/5 border border-accent/10">
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">Certificados aceitos:</strong> e-CNPJ A1, e-CNPJ A3, e-CPF A1, e-CPF A3 nos formatos .pfx, .p12, .cer, .crt e .pem.
                </p>
              </div>
            </>
          )}

          {/* ===== STEP: CADASTRO ===== */}
          {step === 'signup' && (
            <>
              {backButton()}
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">Criar sua conta</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                🎁 Teste grátis por 3 dias — sem cartão de crédito
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} className="pl-10" required />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Crie uma senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Criar conta
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <button onClick={() => setStep('manual')} className="text-accent hover:underline font-medium">Fazer login</button>
              </p>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Sem cartão • Cancela quando quiser • Suporte online
              </p>
            </>
          )}

          {/* ===== STEP: ESQUECEU SENHA ===== */}
          {step === 'forgot' && (
            <>
              {backButton('manual')}
              <h2 className="text-lg font-bold mb-1">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground mb-5">Informe seu e-mail para receber o link de recuperação</p>

              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Enviar link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Sistema de Gestão de Licitações Públicas com IA
        </p>
      </div>
    </div>
  );
}
