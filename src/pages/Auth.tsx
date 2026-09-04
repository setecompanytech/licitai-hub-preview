import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Zap, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck, KeyRound, ArrowLeft,
  Phone, Building2, Briefcase, MapPin, ChevronRight,
  Eye, EyeOff, Search, Sparkles, Bot, Info, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import MfaVerification from '@/components/auth/MfaVerification';
import heroLogin from '@/assets/brand/hero-login.jpg';
import '@/styles/login.css';

const CARGOS = [
  'Diretor(a)', 'Gerente', 'Coordenador(a)', 'Analista', 'Assistente',
  'Pregoeiro(a)', 'Licitante', 'Consultor(a)', 'Empresário(a)', 'Outro'
];

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const COMO_CONHECEU = [
  'Google / Busca', 'Indicação', 'Redes Sociais', 'Evento / Feira', 'Outro'
];

const QTD_FUNCIONARIOS = [
  '1 a 5', '6 a 20', '21 a 50', '51 a 100', 'Mais de 100'
];

const LICITACOES_MES = [
  '1 a 5', '6 a 15', '16 a 30', 'Mais de 30', 'Ainda não participo'
];

const FATURAMENTO_ANUAL = [
  'Até R$ 100 mil', 'R$ 100 mil a R$ 500 mil', 'R$ 500 mil a R$ 1 milhão',
  'R$ 1 milhão a R$ 5 milhões', 'Acima de R$ 5 milhões', 'Prefiro não informar'
];

type AuthStep = 'escolha' | 'manual' | 'certificado' | 'signup' | 'forgot' | 'mfa';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialStep = (searchParams.get('step') as AuthStep) || 'escolha';
  const redirectAfterAuth = searchParams.get('redirect') || '/dashboard';
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [celular, setCelular] = useState('');
  const [telefoneEmpresarial, setTelefoneEmpresarial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [qtdFuncionarios, setQtdFuncionarios] = useState('');
  const [licitacoesMes, setLicitacoesMes] = useState('');
  const [faturamentoAnual, setFaturamentoAnual] = useState('');
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && step !== 'mfa') {
      navigate(redirectAfterAuth, { replace: true });
    }
  }, [user, navigate, redirectAfterAuth, step]);

  // Teste silencioso de conectividade — apenas loga no console, NÃO bloqueia a UI.
  // Removido o toast automático: redes lentas (3G, ISPs regionais, firewalls corporativos)
  // disparavam falso positivo mesmo com servidor online. O erro real só aparece se
  // o usuário tentar logar de fato e a requisição falhar.
  useEffect(() => {
    let cancelled = false;
    const checkConnectivity = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) {
        console.error('[PRAEFECTUS] Variáveis de ambiente ausentes no bundle');
        if (!cancelled) setNetworkError(true);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${url}/auth/v1/health`, {
          method: 'GET',
          headers: { apikey: key },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log(`[PRAEFECTUS] Health check: HTTP ${response.status} (${response.ok ? 'OK' : 'falha'})`);
      } catch (err: unknown) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : 'unknown';
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[PRAEFECTUS] Health check falhou silenciosamente: ${name} - ${msg}`);
        // NÃO seta networkError nem mostra toast — o usuário pode tentar logar normalmente.
        // Se o login falhar de verdade, o erro do supabase.auth.signIn será exibido.
      }
    };
    checkConnectivity();
    return () => { cancelled = true; };
  }, []);

  // MFA verification screen
  if (step === 'mfa') {
    return (
      <MfaVerification
        onSuccess={() => navigate(redirectAfterAuth)}
        onCancel={async () => {
          await supabase.auth.signOut();
          setStep('manual');
        }}
      />
    );
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Limpeza preventiva de tokens residuais
    try {
      const { purgeSupabaseAuthStorage } = await import('@/lib/auth-bootstrap');
      purgeSupabaseAuthStorage();
    } catch {}

    // Retry automático com backoff para erros transitórios de rede.
    // Resolve "Failed to fetch" causado por instabilidade momentânea
    // (Cloudflare cold-start, ISP regional, 4G oscilante) sem que o usuário
    // precise saber o que fazer.
    // Resolve username → email se o campo não contiver @
    let loginEmail = email.trim();
    if (!loginEmail.includes('@')) {
      const { data: emailFound } = await supabase.rpc('buscar_email_por_username', { p_username: loginEmail });
      if (!emailFound) {
        setLoading(false);
        toast.error(
          'Login não encontrado. Confira a digitação — ou, se você ainda não criou um login, '
          + 'entre com o e-mail e defina-o em Meu Perfil.',
        );
        return;
      }
      loginEmail = emailFound as string;
    }

    const attemptLogin = async (attempt: number): Promise<{ error: any }> => {
      const result = await signIn(loginEmail, password);
      if (!result.error) return result;
      const msg = (result.error.message || '').toLowerCase();
      const isTransient =
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        (result.error as any).name === 'AuthRetryableFetchError';
      if (isTransient && attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        return attemptLogin(attempt + 1);
      }
      return result;
    };

    const { error } = await attemptLogin(0);
    setLoading(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      const isNetwork =
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('fetch') ||
        (error as any).name === 'AuthRetryableFetchError';

      if (isNetwork) {
        setNetworkError(true);
        toast.error('Conexão instável. Aguarde alguns segundos e tente novamente.');
      } else if (msg.includes('email not confirmed')) {
        toast.error('E-mail ainda não confirmado. Verifique sua caixa de entrada (e spam) e clique no link de confirmação.');
      } else if (msg.includes('invalid login credentials')) {
        toast.error('E-mail ou senha incorretos. Se esqueceu a senha, use "Esqueci minha senha".');
      } else if (msg.includes('rate') || msg.includes('too many')) {
        toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (msg.includes('user not found')) {
        toast.error('Não encontramos uma conta com este e-mail. Verifique ou crie sua conta.');
      } else {
        toast.error(error.message || 'Não foi possível entrar. Tente novamente.');
      }
      return;
    }
    setNetworkError(false);
    // Check if user has MFA enabled
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTOTP = factors?.totp?.some(f => f.status === 'verified');
      if (hasVerifiedTOTP) {
        setStep('mfa');
        return;
      }
    } catch (error) { console.warn('[Auth] MFA check failed', error); }
    navigate(redirectAfterAuth);
  };

  const checkLeakedPassword = async (pwd: string): Promise<boolean> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pwd);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      const text = await response.text();
      return text.split('\n').some(line => line.startsWith(suffix));
    } catch (error) {
      console.warn('[Auth] Password breach check failed', error);
      return false; // fail open if API unreachable
    }
  };

  const validatePasswordStrength = (pwd: string): string | null => {
    if (pwd.length < 8) return 'A senha deve ter no mínimo 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'A senha deve conter ao menos uma letra maiúscula';
    if (!/[a-z]/.test(pwd)) return 'A senha deve conter ao menos uma letra minúscula';
    if (!/[0-9]/.test(pwd)) return 'A senha deve conter ao menos um número';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'A senha deve conter ao menos um caractere especial (!@#$%...)';
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error('Informe seu nome completo'); return; }
    if (!celular.trim()) { toast.error('Informe seu celular'); return; }
    if (email !== emailConfirm) { toast.error('Os e-mails não conferem'); return; }
    if (password !== passwordConfirm) { toast.error('As senhas não conferem'); return; }
    
    const strengthError = validatePasswordStrength(password);
    if (strengthError) { toast.error(strengthError); return; }
    
    if (!aceitaTermos) { toast.error('Você precisa aceitar os termos de uso'); return; }

    setLoading(true);

    // Check if password has been leaked
    const isLeaked = await checkLeakedPassword(password);
    if (isLeaked) {
      setLoading(false);
      toast.error('Esta senha já foi exposta em vazamentos de dados. Por segurança, escolha outra senha.');
      return;
    }

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

    // O campo aceita login ou e-mail. Sem resolver o login aqui, quem entra
    // por login digitaria o mesmo valor de sempre e o envio falharia.
    let alvo = email.trim();
    if (!alvo.includes('@')) {
      const { data: emailFound } = await supabase.rpc('buscar_email_por_username', { p_username: alvo });
      if (!emailFound) {
        setLoading(false);
        toast.error('Login não encontrado. Confira a digitação ou informe o e-mail.');
        return;
      }
      alvo = emailFound as string;
    }

    const { error } = await resetPassword(alvo);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('E-mail de recuperação enviado!');
      setStep('manual');
    }
  };

  const backButton = (to: AuthStep = 'escolha') => (
    <button type="button" onClick={() => setStep(to)} className="lg__voltar">
      <ArrowLeft className="w-[15px] h-[15px]" />
      Voltar
    </button>
  );

  // Signup form - professional multi-section layout
  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-center gap-3">
            <PraefectusLogo size="lg" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-10">
            <div className="mb-6">
              <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <h1 className="text-2xl font-bold">Cadastre-se</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Crie sua conta e acesse a plataforma completa de licitações
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-8">
              {/* Seção 1: Dados do contato */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados do contato</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Nome completo *</Label>
                    <Input
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Cargo</Label>
                    <Select value={cargo} onValueChange={setCargo}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CARGOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Celular *</Label>
                    <Input
                      value={celular}
                      onChange={e => setCelular(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Telefone empresarial</Label>
                    <Input
                      value={telefoneEmpresarial}
                      onChange={e => setTelefoneEmpresarial(formatPhone(e.target.value))}
                      placeholder="(00) 0000-0000"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>

              {/* Seção 2: Dados da conta */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados da conta</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">E-mail *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Confirmar e-mail *</Label>
                    <Input
                      type="email"
                      value={emailConfirm}
                      onChange={e => setEmailConfirm(e.target.value)}
                      placeholder="Confirme seu e-mail"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium">CNPJ</Label>
                    <Input
                      value={cnpj}
                      onChange={e => setCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0001-00"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Opcional no cadastro. Você poderá cadastrar empresas depois.</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Escolha uma senha *</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Confirmar senha *</Label>
                    <Input
                      type="password"
                      value={passwordConfirm}
                      onChange={e => setPasswordConfirm(e.target.value)}
                      placeholder="Confirme sua senha"
                      className="mt-1.5"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </section>

              {/* Seção 3: Configuração do serviço */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configuração do serviço</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Estado de atuação</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Seção 4: Informações do perfil */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações do perfil</h2>
                </div>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Como conheceu o PRAEFECTUS?</Label>
                    <Select value={comoConheceu} onValueChange={setComoConheceu}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMO_CONHECEU.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Quantidade de funcionários?</Label>
                    <Select value={qtdFuncionarios} onValueChange={setQtdFuncionarios}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {QTD_FUNCIONARIOS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Quantas licitações participa por mês?</Label>
                    <Select value={licitacoesMes} onValueChange={setLicitacoesMes}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {LICITACOES_MES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Faturamento anual com licitações?</Label>
                    <Select value={faturamentoAnual} onValueChange={setFaturamentoAnual}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {FATURAMENTO_ANUAL.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Declaração de Consentimento — LGPD */}
              <div className="flex items-start gap-3 p-5 rounded-xl bg-muted/50 border border-border">
                <Checkbox
                  id="termos"
                  checked={aceitaTermos}
                  onCheckedChange={(v) => setAceitaTermos(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="termos" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  <strong className="text-foreground text-sm block mb-1">Declaração de Consentimento</strong>
                  Ao confirmar o cadastro, <strong>DECLARO</strong>, para os devidos fins de direito, que li, compreendi e aceito integralmente os{' '}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-semibold">Termos de Uso</a>{' '}
                  e a{' '}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-semibold">Política de Privacidade</a>{' '}
                  da plataforma PRAEFECTUS, manifestando consentimento livre, informado e inequívoco, nos termos do{' '}
                  <strong>Art. 7º, inciso I, da Lei nº 13.709/2018 (LGPD)</strong>, para o tratamento de meus dados pessoais nas finalidades descritas nos referidos documentos.
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled={loading || !aceitaTermos}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Enviar cadastro
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <button type="button" onClick={() => setStep('manual')} className="text-accent hover:underline font-medium">
                  Fazer login
                </button>
              </p>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 pb-8">
            Sistema de Gestão de Licitações Públicas com IA
          </p>
        </div>
      </div>
    );
  }

  /* ===========================================================================
     Login — vidro sobre foto, o desenho aprovado do protótipo.

     Estrutura transcrita de `prototype-praefectus/index.html` (bloco `.lg`,
     linhas 3344-3468); estilo em `src/styles/login.css`.

     TRÊS DIFERENÇAS DELIBERADAS em relação ao protótipo, todas pela mesma
     razão — isto é a produção, não uma demonstração:

     1. O botão "Protótipo de avaliação — use caio-teste@… / 123456" NÃO existe.
     2. A área de soltar certificado (.lg__solta) não foi trazida: o app não tem
        login por certificado, ele orienta a vincular o certificado depois do
        primeiro acesso. Caixa de arrastar arquivo que não recebe arquivo é
        promessa falsa na porta de entrada.
     3. O "Manter conectado" ficou de fora: o Supabase já persiste a sessão e
        não há o que a caixinha ligasse ou desligasse. Marcada e inerte, ela
        mentiria sobre uma escolha que o usuário não tem.

     Nada da lógica mudou: handleLogin (com resolução de login→e-mail, retry de
     rede e checagem de MFA), handleForgot, os passos e o botão de limpar cache
     são exatamente os que já estavam aqui.
     ========================================================================= */
  return (
    <div className="lg">
      <div className="lg__foto">
        <img src={heroLogin} alt="" aria-hidden="true" />
      </div>
      <div className="lg__veu" />

      <div className="lg__grade">
        <div className="lg__marca">
          <div className="lg__logo">PRAE<b>FECTUS</b></div>
          <p className="lg__tagline">
            Gestão de licitações públicas com inteligência artificial — do edital
            publicado ao contrato assinado, num lugar só.
          </p>
          <div className="lg__provas">
            <div className="lg__prova">
              <span><Search className="w-4 h-4" /></span>
              <div>Busca em <b>13 portais</b> ao mesmo tempo</div>
            </div>
            <div className="lg__prova">
              <span><Sparkles className="w-4 h-4" /></span>
              <div>Análise de edital e <b>score de aderência</b> por IA</div>
            </div>
            <div className="lg__prova">
              <span><Bot className="w-4 h-4" /></span>
              <div>Robô de lances e <b>acompanhamento da disputa</b></div>
            </div>
          </div>
        </div>

        <div className="lg__card">
          {/* ===== STEP: ESCOLHA ===== */}
          {step === 'escolha' && (
            <div className="lg__passo">
              <h1 className="lg__t">Identifique-se</h1>
              <p className="lg__s">Escolha como deseja acessar o sistema</p>

              <div className="lg__opcoes">
                <button type="button" onClick={() => setStep('manual')} className="lg__opcao">
                  <span className="lg__opcao__ic"><KeyRound className="w-5 h-5" /></span>
                  <span className="lg__opcao__txt">
                    <span className="lg__opcao__t">Login e Senha</span>
                    <span className="lg__opcao__d">Acesse com seu e-mail e senha cadastrados</span>
                  </span>
                  <ArrowRight className="lg__opcao__seta w-[18px] h-[18px]" />
                </button>

                <button type="button" onClick={() => setStep('certificado')} className="lg__opcao">
                  <span className="lg__opcao__ic"><ShieldCheck className="w-5 h-5" /></span>
                  <span className="lg__opcao__txt">
                    <span className="lg__opcao__t">Certificado Digital</span>
                    <span className="lg__opcao__d">Acesse com e-CNPJ ou e-CPF (A1/A3)</span>
                    <span className="lg__req">requer conta já vinculada</span>
                  </span>
                  <ArrowRight className="lg__opcao__seta w-[18px] h-[18px]" />
                </button>
              </div>

              <p className="lg__pe">
                Para criar uma conta, fale com o administrador da sua empresa.
              </p>
            </div>
          )}

          {/* ===== STEP: LOGIN MANUAL ===== */}
          {step === 'manual' && (
            <div className="lg__passo">
              {backButton()}
              <h1 className="lg__t text-left">Entrar com e-mail</h1>
              <p className="lg__s text-left mb-[22px]">
                Use as credenciais cadastradas pelo administrador
              </p>

              <form onSubmit={handleLogin} noValidate>
                <div className="lg__campo">
                  <label className="lg__rot" htmlFor="lgEmail">Login ou e-mail</label>
                  <div className="lg__cx">
                    <User className="w-4 h-4" />
                    <input
                      id="lgEmail"
                      type="text"
                      placeholder="voce@empresa.com.br"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="lg__campo">
                  <label className="lg__rot" htmlFor="lgSenha">Senha</label>
                  <div className="lg__cx">
                    <Lock className="w-4 h-4" />
                    <input
                      id="lgSenha"
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyUp={e => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                      required
                      minLength={6}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="lg__olho"
                      onClick={() => setMostrarSenha(v => !v)}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarSenha
                        ? <EyeOff className="w-[17px] h-[17px]" />
                        : <Eye className="w-[17px] h-[17px]" />}
                    </button>
                  </div>
                  {capsLock && (
                    <div className="lg__caps">
                      <AlertTriangle className="w-[13px] h-[13px]" /> Caps Lock está ligado
                    </div>
                  )}
                </div>

                <div className="lg__linha justify-end">
                  <button type="button" onClick={() => setStep('forgot')} className="lg__link">
                    Esqueci minha senha
                  </button>
                </div>

                <button type="submit" className="lg__btn" disabled={loading}>
                  {loading
                    ? <Loader2 className="lg__spin w-[17px] h-[17px]" />
                    : <KeyRound className="w-[17px] h-[17px]" />}
                  Entrar
                </button>
              </form>

              {/* Escape para bundle preso em cache — some do desenho, mas é a
                  saída de quem ficou travado numa versão velha depois de um
                  deploy. Tirar seria trocar suporte por estética. */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(registrations.map((r) => r.unregister()));
                      }
                      if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map((k) => caches.delete(k)));
                      }
                    } finally {
                      window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
                    }
                  }}
                  className="text-[11px] underline underline-offset-2 transition-colors"
                  style={{ color: 'var(--lg-fraco)' }}
                >
                  Limpar cache e recarregar
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP: CERTIFICADO DIGITAL ===== */}
          {step === 'certificado' && (
            <div className="lg__passo">
              {backButton()}
              <h1 className="lg__t text-left">Certificado Digital</h1>
              <p className="lg__s text-left mb-5">e-CNPJ ou e-CPF, nos padrões A1 e A3</p>

              <div className="lg__nota">
                <Info className="w-[15px] h-[15px]" />
                <span>
                  O certificado <b>identifica</b>, mas não cria conta. Ele precisa estar
                  vinculado a um usuário — o vínculo é feito em <b>Configuração › Empresas</b>{' '}
                  depois do primeiro acesso.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setStep('manual')}
                className="lg__btn lg__btn--vidro mt-[18px]"
              >
                <KeyRound className="w-4 h-4" />
                Entrar com e-mail e senha
              </button>

              <p className="lg__pe">
                Aceitos: e-CNPJ A1/A3 e e-CPF A1/A3, nos formatos .pfx, .p12, .cer, .crt e .pem.
              </p>
            </div>
          )}

          {/* ===== STEP: ESQUECEU SENHA ===== */}
          {step === 'forgot' && (
            <div className="lg__passo">
              {backButton('manual')}
              <h1 className="lg__t text-left">Recuperar senha</h1>
              <p className="lg__s text-left mb-[22px]">
                Informe seu login ou e-mail para receber o link de recuperação
              </p>

              <form onSubmit={handleForgot} noValidate>
                <div className="lg__campo">
                  <label className="lg__rot" htmlFor="lgRecuperar">Login ou e-mail</label>
                  <div className="lg__cx">
                    <Mail className="w-4 h-4" />
                    <input
                      id="lgRecuperar"
                      type="text"
                      placeholder="voce@empresa.com.br"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      spellCheck={false}
                    />
                  </div>
                </div>

                <button type="submit" className="lg__btn mt-1" disabled={loading}>
                  {loading
                    ? <Loader2 className="lg__spin w-[17px] h-[17px]" />
                    : <ArrowRight className="w-[17px] h-[17px]" />}
                  Enviar link
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="lg__rodape">Sistema de Gestão de Licitações Públicas com IA</div>
    </div>
  );
}
