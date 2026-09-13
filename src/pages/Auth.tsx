import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Mail, Lock, User, ArrowRight, Loader2, ShieldCheck, KeyRound, ArrowLeft,
  Phone, Building2, Briefcase, MapPin, ChevronRight,
  Eye, EyeOff, Info, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import MfaVerification from '@/components/auth/MfaVerification';
import MolduraAcesso from '@/components/auth/MolduraAcesso';
import OpcaoAcesso from '@/components/auth/OpcaoAcesso';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

/**
 * Só caminho INTERNO serve de destino pós-login: uma barra no início e não
 * duas (`//x` é outra origem), sem esquema. Qualquer outra coisa cai no painel
 * — o `?redirect=` vem da URL e não pode virar redirecionamento aberto.
 */
function destinoSeguro(bruto: string | null): string {
  if (!bruto) return '/dashboard';
  if (!bruto.startsWith('/') || bruto.startsWith('//') || bruto.startsWith('/\\')) return '/dashboard';
  return bruto;
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialStep = (searchParams.get('step') as AuthStep) || 'escolha';
  const redirectAfterAuth = destinoSeguro(searchParams.get('redirect'));
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

  // Ao trocar de passo, o foco vai para o título da etapa: quem navega por
  // teclado/leitor de tela não fica perdido no meio da tela anterior.
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    tituloRef.current?.focus();
  }, [step]);

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
    if (loading) return;
    setLoading(true);

    // Limpeza preventiva de tokens residuais
    try {
      const { purgeSupabaseAuthStorage } = await import('@/lib/auth-bootstrap');
      purgeSupabaseAuthStorage();
    } catch { /* sem armazenamento acessível: segue sem a limpeza */ }

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
    if (loading) return;
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

  const voltarPara = (to: AuthStep, rotulo: string) => (
    <button
      type="button"
      onClick={() => setStep(to)}
      className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {rotulo}
    </button>
  );

  const classeTitulo = 'font-heading text-[1.75rem] font-bold leading-9 text-foreground outline-none';
  const classeLink = 'inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  // Signup form - professional multi-section layout
  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-center gap-3">
            <PraefectusLogo size="xl" />
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
                    <Label className="text-xs font-medium">Como conheceu o Praefectus?</Label>
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
                  da plataforma Praefectus, manifestando consentimento livre, informado e inequívoco, nos termos do{' '}
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
     Acesso — prancha 12/09: painel institucional claro + coluna branca de
     acesso (MolduraAcesso). Nada da lógica mudou: handleLogin (resolução de
     login→e-mail, retry de rede, checagem de MFA), handleForgot, os passos e o
     botão de limpar cache são os que já estavam aqui. Diferenças deliberadas
     que continuam valendo: sem botão de cadastro público (conta é criada pelo
     administrador), sem caixa de soltar certificado (o app não autentica por
     certificado na porta — ele identifica e é vinculado depois do primeiro
     acesso) e sem "manter conectado" (a sessão já persiste).
     ========================================================================= */
  return (
    <MolduraAcesso>
      <Link to="/" className={classeLink}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao site
      </Link>

      {/* ===== ESCOLHA ===== */}
      {step === 'escolha' && (
        <div className="mt-8">
          <h1 ref={tituloRef} tabIndex={-1} className={classeTitulo}>Acesse sua conta</h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">Escolha como deseja entrar na plataforma</p>

          <div className="mt-8 flex flex-col gap-4">
            <OpcaoAcesso
              icone={<KeyRound />}
              titulo="Login e senha"
              descricao="Entre com seu e-mail e senha cadastrados"
              onClick={() => setStep('manual')}
              disabled={loading}
            />
            <OpcaoAcesso
              icone={<ShieldCheck />}
              titulo="Certificado digital"
              descricao="Acesse com seu e-CNPJ ou e-CPF"
              badge="Requer conta vinculada"
              onClick={() => setStep('certificado')}
              disabled={loading}
            />
          </div>

          <Separator className="my-8" />
          <p className="text-center text-sm leading-5 text-muted-foreground">
            Para criar uma conta, entre em contato com o administrador.
          </p>
        </div>
      )}

      {/* ===== LOGIN COM E-MAIL ===== */}
      {step === 'manual' && (
        <div className="mt-8">
          <h1 ref={tituloRef} tabIndex={-1} className={classeTitulo}>Entrar com e-mail</h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">Use as credenciais cadastradas pelo administrador</p>

          {networkError && (
            <Alert variant="destructive" className="mt-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Conexão instável</AlertTitle>
              <AlertDescription>Não conseguimos falar com o servidor. Aguarde alguns segundos e tente de novo.</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} noValidate className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lgEmail">E-mail ou login</Label>
              <Input
                id="lgEmail"
                type="text"
                inputMode="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="lgSenha">Senha</Label>
                <button type="button" onClick={() => setStep('forgot')} className={`${classeLink} min-h-0`}>
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input
                  id="lgSenha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  aria-describedby={capsLock ? 'lgCaps' : undefined}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={mostrarSenha}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <p id="lgCaps" role="status" className="flex items-center gap-1.5 text-sm leading-5 text-warning-ink">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Caps Lock está ligado
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading} aria-busy={loading || undefined}>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              Entrar
            </Button>
          </form>

          {voltarPara('escolha', 'Voltar às opções de acesso')}

          <div className="mt-6 text-center">
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
              className="min-h-11 rounded-md px-2 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Limpar cache e recarregar
            </button>
          </div>
        </div>
      )}

      {/* ===== CERTIFICADO DIGITAL ===== */}
      {step === 'certificado' && (
        <div className="mt-8">
          <h1 ref={tituloRef} tabIndex={-1} className={classeTitulo}>Certificado digital</h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">e-CNPJ ou e-CPF, nos padrões A1 e A3</p>

          <Alert variant="info" className="mt-6">
            <Info className="h-4 w-4" />
            <AlertTitle>O certificado identifica, mas não cria conta</AlertTitle>
            <AlertDescription>
              Ele precisa estar vinculado a um usuário — o vínculo é feito em <b>Configuração › Empresas</b>{' '}
              depois do primeiro acesso com e-mail e senha.
            </AlertDescription>
          </Alert>

          <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => setStep('manual')}>
            <KeyRound aria-hidden="true" />
            Entrar com e-mail e senha
          </Button>

          <p className="mt-4 text-xs leading-4 text-muted-foreground">
            Aceitos: e-CNPJ A1/A3 e e-CPF A1/A3, nos formatos .pfx, .p12, .cer, .crt e .pem.
          </p>

          {voltarPara('escolha', 'Voltar às opções de acesso')}
        </div>
      )}

      {/* ===== RECUPERAR SENHA ===== */}
      {step === 'forgot' && (
        <div className="mt-8">
          <h1 ref={tituloRef} tabIndex={-1} className={classeTitulo}>Recuperar senha</h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">
            Informe seu login ou e-mail para receber o link de recuperação
          </p>

          <form onSubmit={handleForgot} noValidate className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lgRecuperar">E-mail ou login</Label>
              <Input
                id="lgRecuperar"
                type="text"
                inputMode="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} aria-busy={loading || undefined}>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
              Enviar link de recuperação
            </Button>
          </form>

          {voltarPara('manual', 'Voltar ao login')}
        </div>
      )}
    </MolduraAcesso>
  );
}
